#!/usr/bin/env node
/**
 * Digital Mirror — Session Watcher v2.0
 *
 * Adapter-based architecture:
 *   Agent Framework → [Adapter] → Mirror Standard Message → Mirror API
 *
 * New in v2.0:
 *   - Proactive alert push (3-day streak detection)
 *   - Weekly digest push (configurable day + hour per user)
 *   - Timezone-aware scheduling via Intl
 *   - Telegram Bot API push notifications
 *   - Settings pulled from Mirror API at startup + every hour
 *
 * Adapters: openclaw, webhook
 * Install: /opt/mirror-watcher/
 * Config:  Environment variables or .env
 */

const fs   = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

// ─── Config ──────────────────────────────────────────────────
const DEFAULT_ENDPOINT = process.env.MIRROR_ENDPOINT || 'http://localhost:3000/api/entry';

const config = {
  adapter:          process.env.MIRROR_ADAPTER        || 'openclaw',
  endpoint:         DEFAULT_ENDPOINT,
  apiBase:          process.env.MIRROR_API_BASE        || DEFAULT_ENDPOINT.replace('/api/entry', '/api'),
  apiKey:           process.env.MIRROR_API_KEY         || '',
  pollInterval:     parseInt(process.env.POLL_INTERVAL  || '2000', 10),
  stateFile:        process.env.STATE_FILE             || '/opt/mirror-watcher/watcher-state.json',
  retryAttempts:    parseInt(process.env.RETRY_ATTEMPTS || '3',    10),
  retryDelayMs:     parseInt(process.env.RETRY_DELAY_MS || '5000', 10),

  // Notifications
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN     || '',
  telegramChatId:   process.env.TELEGRAM_CHAT_ID       || '',
  alertCheckMins:   parseInt(process.env.ALERT_CHECK_MINS || '30', 10),

  // Weekly digest defaults (overridden by /api/settings at runtime)
  weeklyDigestHour: parseInt(process.env.WEEKLY_DIGEST_HOUR || '8', 10),
  weeklyDigestDay:  process.env.WEEKLY_DIGEST_DAY       || 'monday',
  userTimezone:     process.env.USER_TIMEZONE            || 'UTC',

  adapterConfig: {
    openclawHome: process.env.OPENCLAW_HOME || '/home/openclaw/.openclaw',
    webhookPort:  process.env.WEBHOOK_PORT  || '3100',
  }
};

// ─── Logging ─────────────────────────────────────────────────
const LOG = '◈ Mirror';
function log(msg)       { console.log(`[${ts()}] ${LOG} ${msg}`); }
function logErr(msg, e) { console.error(`[${ts()}] ${LOG} ERROR: ${msg}`, e?.message || ''); }
function ts()           { return new Date().toISOString().slice(11, 19); }

// ─── State ───────────────────────────────────────────────────
let state = {
  adapter: null, sessionId: null, byteOffset: 0,
  lastTimestamp: null, messagesSent: 0, errors: 0,
  started: new Date().toISOString(),
  lastAlertCheck: null,
  lastWeeklyDigest: null,
  weeklyDigestSentDate: null   // YYYY-MM-DD — prevents double-send same day
};

function loadState() {
  try {
    if (fs.existsSync(config.stateFile)) {
      state = { ...state, ...JSON.parse(fs.readFileSync(config.stateFile, 'utf8')) };
      log(`State loaded — sent: ${state.messagesSent}`);
    }
  } catch (e) { logErr('Load state failed', e); }
}

function saveState() {
  try {
    const dir = path.dirname(config.stateFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(config.stateFile, JSON.stringify(state, null, 2));
  } catch (e) { logErr('Save state failed', e); }
}

// ─── HTTP helper ─────────────────────────────────────────────
function httpRequest(urlStr, method = 'GET', body = null, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const u         = new URL(urlStr);
    const transport = u.protocol === 'https:' ? https : http;
    const data      = body ? JSON.stringify(body) : null;
    const headers   = {
      'Content-Type': 'application/json',
      ...(config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {}),
      ...(data        ? { 'Content-Length': Buffer.byteLength(data) }   : {}),
      ...extraHeaders
    };
    const req = transport.request(
      { hostname: u.hostname, port: u.port, path: u.pathname + u.search, method, headers, timeout: 10000 },
      (res) => {
        let b = '';
        res.on('data', c => b += c);
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(b) }); }
          catch { resolve({ status: res.statusCode, body: b }); }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    if (data) req.write(data);
    req.end();
  });
}

function mirrorGet(p)       { return httpRequest(`${config.apiBase}${p}`); }
function mirrorPost(p, body){ return httpRequest(`${config.apiBase}${p}`, 'POST', body); }

// ─── Entry POST (with retry) ─────────────────────────────────
function postToMirrorOnce(message) {
  return new Promise((resolve, reject) => {
    const url       = new URL(config.endpoint);
    const transport = url.protocol === 'https:' ? https : http;
    const data      = JSON.stringify(message);
    const options   = {
      hostname: url.hostname, port: url.port, path: url.pathname, method: 'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(data),
        'X-Source':       `mirror-watcher/${config.adapter}`,
        ...(config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {})
      },
      timeout: 10000
    };
    const req = transport.request(options, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => res.statusCode < 300
        ? resolve({ status: res.statusCode, body })
        : reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 200)}`)));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(data);
    req.end();
  });
}

async function postToMirror(message) {
  let lastErr;
  for (let attempt = 1; attempt <= config.retryAttempts; attempt++) {
    try { return await postToMirrorOnce(message); }
    catch (e) {
      lastErr = e;
      if (attempt < config.retryAttempts) {
        log(`POST failed (attempt ${attempt}/${config.retryAttempts}) — retrying in ${config.retryDelayMs}ms`);
        await new Promise(r => setTimeout(r, config.retryDelayMs));
      }
    }
  }
  throw lastErr;
}

// ─── Telegram Push ───────────────────────────────────────────
async function sendTelegram(text) {
  if (!config.telegramBotToken || !config.telegramChatId) {
    log(`[Notify] Telegram not configured — skipping push`);
    return false;
  }
  try {
    const res = await httpRequest(
      `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`,
      'POST',
      { chat_id: config.telegramChatId, text, parse_mode: 'HTML' }
    );
    if (res.status === 200 && res.body?.ok) {
      log(`[Notify] Telegram sent ✓`);
      return true;
    } else {
      logErr(`Telegram error: ${JSON.stringify(res.body)}`);
      return false;
    }
  } catch (e) {
    logErr('Telegram push failed', e);
    return false;
  }
}

// ─── Settings sync ───────────────────────────────────────────
async function syncSettings() {
  try {
    const res = await mirrorGet('/settings');
    if (res.status === 200 && res.body) {
      const s = res.body;
      if (s.timezone)                      config.userTimezone     = s.timezone;
      if (s.weeklyDigestHour !== undefined) config.weeklyDigestHour = s.weeklyDigestHour;
      if (s.weeklyDigestDay)               config.weeklyDigestDay  = s.weeklyDigestDay;
      log(`Settings synced — tz: ${config.userTimezone}, digest: ${config.weeklyDigestDay} @ ${config.weeklyDigestHour}:00`);
    }
  } catch (e) { logErr('Settings sync failed', e); }
}

// ─── Timezone helper ─────────────────────────────────────────
function nowInTimezone(tz) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour: 'numeric', minute: 'numeric',
      weekday: 'long', hour12: false
    }).formatToParts(new Date());
    const get = type => parts.find(p => p.type === type)?.value;
    return {
      hour:    parseInt(get('hour')    || '0'),
      minute:  parseInt(get('minute') || '0'),
      weekday: (get('weekday') || 'monday').toLowerCase()
    };
  } catch {
    const n = new Date();
    return {
      hour:    n.getUTCHours(),
      minute:  n.getUTCMinutes(),
      weekday: ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][n.getUTCDay()]
    };
  }
}

function todayStr() { return new Date().toISOString().slice(0, 10); }

// ─── Proactive Alert Check ───────────────────────────────────
async function checkAlerts() {
  try {
    const res = await mirrorGet('/proactive');
    if (res.status !== 200 || !res.body) return;

    const { hasAlerts, alerts } = res.body;
    if (!hasAlerts || !alerts?.length) {
      log(`[Alerts] No new alerts`);
      return;
    }

    log(`[Alerts] ${alerts.length} alert(s) — pushing to user`);

    for (const alert of alerts) {
      const isUp = alert.type === 'ascending';
      const msg  = isUp
        ? `◈ Digital Mirror\n\n↑ <b>${capitalize(alert.dimension)}</b> is trending up\n\n${alert.message}`
        : `◈ Digital Mirror\n\n↓ <b>${capitalize(alert.dimension)}</b> needs attention\n\n${alert.message}`;
      await sendTelegram(msg);
    }

    // Acknowledge — prevents re-sending same alerts
    await mirrorPost('/alerts/ack', {});
    state.lastAlertCheck = new Date().toISOString();
    saveState();
  } catch (e) { logErr('Alert check failed', e); }
}

// ─── Weekly Digest ───────────────────────────────────────────
async function sendWeeklyDigest() {
  try {
    const res = await mirrorGet('/direction');
    if (res.status !== 200 || !res.body) return;

    const d    = res.body;
    const dims = d.dimensions || [];

    const ICONS    = { finance:'💰', health:'🏃', career:'🚀', social:'🤝', family:'👨‍👩‍👧‍👦' };
    const dirEmoji = dir => ({ Up:'↑', Down:'↓', Stable:'→' }[dir] || '·');

    const calibrated = dims.filter(d =>
      d.direction7d !== 'Calibrating' && d.direction7d !== 'Insufficient data'
    );

    if (!calibrated.length) {
      log('[Digest] No calibrated dimensions yet — skipping');
      return;
    }

    const lines = calibrated.map(d =>
      `${ICONS[d.dimension]||'◈'} <b>${capitalize(d.dimension)}</b>  ${dirEmoji(d.direction7d)} ${d.direction7d}`
    );

    let msg = `◈ <b>Digital Mirror — Weekly</b>\n\n${lines.join('\n')}`;

    if (d.strongest)
      msg += `\n\n<b>Strongest:</b> ${ICONS[d.strongest.dimension]||''} ${capitalize(d.strongest.dimension)}`;
    if (d.weakest && d.weakest.dimension !== d.strongest?.dimension)
      msg += `\n<b>Weakest:</b> ${ICONS[d.weakest.dimension]||''} ${capitalize(d.weakest.dimension)}`;
    if (d.patterns?.[0])
      msg += `\n\n<i>${d.patterns[0]}</i>`;

    const sent = await sendTelegram(msg);
    if (sent) {
      state.lastWeeklyDigest    = new Date().toISOString();
      state.weeklyDigestSentDate = todayStr();
      saveState();
      log('[Digest] Weekly digest sent ✓');
    }
  } catch (e) { logErr('Weekly digest failed', e); }
}

// ─── Scheduler (runs every 60s) ──────────────────────────────
let alertCheckCounter = 0;

async function schedulerTick() {
  const now = nowInTimezone(config.userTimezone);

  // Weekly digest gate: correct day + hour + first 2 minutes + not sent today
  if (
    now.weekday === config.weeklyDigestDay.toLowerCase() &&
    now.hour    === config.weeklyDigestHour &&
    now.minute  <  2 &&
    state.weeklyDigestSentDate !== todayStr()
  ) {
    log(`[Scheduler] Weekly digest — ${config.weeklyDigestDay} ${config.weeklyDigestHour}:00 ${config.userTimezone}`);
    await sendWeeklyDigest();
  }

  // Alert check every ALERT_CHECK_MINS
  alertCheckCounter++;
  if (alertCheckCounter >= config.alertCheckMins) {
    alertCheckCounter = 0;
    await checkAlerts();
  }
}


// ═══════════════════════════════════════════════════════════════
// ADAPTER: OpenClaw
// Reads JSONL session files from disk
// ═══════════════════════════════════════════════════════════════
const openclawAdapter = {
  name: 'openclaw',
  sessionsDir:   null,
  sessionsIndex: null,

  init(cfg) {
    this.sessionsDir   = path.join(cfg.openclawHome, 'agents/main/sessions');
    this.sessionsIndex = path.join(this.sessionsDir, 'sessions.json');
    if (!fs.existsSync(this.sessionsDir)) throw new Error(`Sessions dir not found: ${this.sessionsDir}`);
    log(`OpenClaw adapter — ${this.sessionsDir}`);
  },

  _getActiveSessionId() {
    try {
      const idx = JSON.parse(fs.readFileSync(this.sessionsIndex, 'utf8'));
      return idx['agent:main:main']?.sessionId || null;
    } catch { return null; }
  },

  _parseUserContent(content) {
    if (!Array.isArray(content)) return null;
    const tb = content.find(b => b.type === 'text');
    if (!tb?.text) return null;
    let text = tb.text;

    let meta = {};
    const mm = text.match(/```json\s*(\{[^}]*\})\s*```/s);
    if (mm) { try { meta = JSON.parse(mm[1]); } catch {} }

    text = text.replace(/^Conversation info \(untrusted metadata\):\s*```json\s*\{[^}]*\}\s*```\s*/s, '');
    if (text.startsWith('System:') || text.startsWith('A scheduled reminder')) return null;
    text = text.trim();
    if (!text || text.length < 3 || text.startsWith('/')) return null;

    return { text, meta };
  },

  getNewMessages(st) {
    const messages = [];
    const sid = this._getActiveSessionId();
    if (!sid) return { messages, newState: {} };

    if (sid !== st.sessionId) {
      const sp = path.join(this.sessionsDir, `${sid}.jsonl`);
      try {
        const size = fs.statSync(sp).size;
        log(`New session: ${sid.slice(0, 8)}… — skipping to end`);
        return { messages: [], newState: { sessionId: sid, byteOffset: size } };
      } catch { return { messages, newState: {} }; }
    }

    const sp = path.join(this.sessionsDir, `${sid}.jsonl`);
    let fileSize;
    try { fileSize = fs.statSync(sp).size; } catch { return { messages, newState: {} }; }
    if (fileSize <= st.byteOffset) return { messages, newState: {} };

    const fd  = fs.openSync(sp, 'r');
    const buf = Buffer.alloc(fileSize - st.byteOffset);
    fs.readSync(fd, buf, 0, buf.length, st.byteOffset);
    fs.closeSync(fd);

    for (const line of buf.toString('utf8').split('\n')) {
      if (!line.trim()) continue;
      let obj;
      try { obj = JSON.parse(line); } catch { continue; }
      if (obj.type !== 'message' || obj.message?.role !== 'user') continue;

      const parsed = this._parseUserContent(obj.message.content);
      if (!parsed) continue;

      messages.push({
        text:      parsed.text,
        timestamp: obj.timestamp,
        source:    'openclaw',
        metadata:  { sessionId: sid.slice(0, 8), userId: parsed.meta.sender || null, channel: 'telegram' }
      });
    }

    return { messages, newState: { sessionId: sid, byteOffset: fileSize } };
  }
};


// ═══════════════════════════════════════════════════════════════
// ADAPTER: Webhook (V2)
// HTTP server — accepts POSTs from any agent framework
// ═══════════════════════════════════════════════════════════════
const webhookAdapter = {
  name: 'webhook',
  server: null,
  queue: [],

  init(cfg) {
    const port = parseInt(cfg.webhookPort || '3100', 10);
    this.server = http.createServer((req, res) => {
      if (req.method === 'POST' && req.url === '/ingest') {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', () => {
          try {
            const d   = JSON.parse(body);
            const msg = {
              text:      d.text || d.message || d.content || '',
              timestamp: d.timestamp || new Date().toISOString(),
              source:    d.source || d.agent || 'webhook',
              metadata:  d.metadata || {}
            };
            if (msg.text.length >= 3) {
              this.queue.push(msg);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: true, queued: this.queue.length }));
            } else {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Text too short or missing' }));
            }
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON' }));
          }
        });
      } else if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', adapter: 'webhook', queued: this.queue.length }));
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });
    this.server.listen(port, '0.0.0.0', () => log(`Webhook adapter on :${port}/ingest`));
  },

  getNewMessages() {
    const messages = [...this.queue];
    this.queue = [];
    return { messages, newState: {} };
  }
};


// ─── Adapter Registry ────────────────────────────────────────
const adapters = { openclaw: openclawAdapter, webhook: webhookAdapter };

// ─── Util ────────────────────────────────────────────────────
function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }


// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════
async function main() {
  console.log('');
  console.log('  ◈ Digital Mirror — Session Watcher v2.0');
  console.log(`  Adapter:       ${config.adapter}`);
  console.log(`  Endpoint:      ${config.endpoint}`);
  console.log(`  API Base:      ${config.apiBase}`);
  console.log(`  Poll:          ${config.pollInterval}ms`);
  console.log(`  Alert check:   every ${config.alertCheckMins} min`);
  console.log(`  Notifications: ${config.telegramBotToken ? 'Telegram ✓' : 'disabled — set TELEGRAM_BOT_TOKEN'}`);
  console.log('');

  const adapter = adapters[config.adapter];
  if (!adapter) {
    logErr(`Unknown adapter: ${config.adapter}. Available: ${Object.keys(adapters).join(', ')}`);
    process.exit(1);
  }

  try { adapter.init(config.adapterConfig); }
  catch (e) { logErr('Adapter init failed', e); process.exit(1); }

  loadState();
  state.adapter = config.adapter;

  // Sync settings from Mirror API
  await syncSettings();

  // Message forwarding
  async function tick() {
    try {
      const { messages, newState } = adapter.getNewMessages(state);
      Object.assign(state, newState);

      for (const msg of messages) {
        try {
          await postToMirror(msg);
          state.messagesSent++;
          state.lastTimestamp = msg.timestamp;
          log(`→ [${state.messagesSent}] "${msg.text.slice(0, 70)}${msg.text.length > 70 ? '…' : ''}"`);
        } catch (e) {
          state.errors++;
          logErr('POST failed', e);
        }
      }

      if (messages.length > 0) saveState();
    } catch (e) { logErr('Tick error', e); }
  }

  await tick();
  setInterval(tick, config.pollInterval);

  // Scheduler — every 60s handles digest + alert gate
  setInterval(schedulerTick, 60 * 1000);

  // Re-sync settings every hour (picks up dashboard changes)
  setInterval(syncSettings, 60 * 60 * 1000);

  const shutdown = (sig) => { log(`${sig} — bye`); saveState(); process.exit(0); };
  process.on('SIGINT',  () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  log('Watching…');
}

main();
