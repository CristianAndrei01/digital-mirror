#!/usr/bin/env node
/**
 * Digital Mirror — Session Watcher v1.1
 * 
 * Adapter-based architecture:
 *   Agent Framework → [Adapter] → Mirror Standard Message → Mirror API
 * 
 * Adapters translate framework-specific formats into Mirror's standard format.
 * Currently supported: openclaw, webhook
 * Future: langchain, crewai, autogen, mirror-agent
 * 
 * Install: /opt/mirror-watcher/
 * Config:  Environment variables or .env
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

// ─── Config ──────────────────────────────────────────────────
const DEFAULT_ENDPOINT = 'http://209.38.220.211:3000/api/entry';
const config = {
  adapter: process.env.MIRROR_ADAPTER || 'openclaw',
  endpoint: process.env.MIRROR_ENDPOINT || DEFAULT_ENDPOINT,
  apiKey: process.env.MIRROR_API_KEY || '',
  pollInterval: parseInt(process.env.POLL_INTERVAL || '2000', 10),
  stateFile: process.env.STATE_FILE || '/opt/mirror-watcher/watcher-state.json',
  retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || '3', 10),
  retryDelayMs: parseInt(process.env.RETRY_DELAY_MS || '5000', 10),
  adapterConfig: {
    openclawHome: process.env.OPENCLAW_HOME || '/home/openclaw/.openclaw',
    webhookPort: process.env.WEBHOOK_PORT || '3100',
  }
};

if (!process.env.MIRROR_ENDPOINT) {
  console.warn(`[WARN] MIRROR_ENDPOINT not set — using hardcoded fallback: ${DEFAULT_ENDPOINT}`);
  console.warn(`[WARN] Set MIRROR_ENDPOINT in environment to suppress this warning.`);
}

// ─── Mirror Standard Message Format ─────────────────────────
// Every adapter must produce this. Mirror API accepts this.
//
// {
//   text: string,           — the raw user message
//   timestamp: string,      — ISO 8601
//   source: string,         — adapter name
//   metadata?: {
//     sessionId?: string,
//     userId?: string,
//     channel?: string,     — telegram, discord, whatsapp, cli
//     agentResponse?: string
//   }
// }

// ─── Logging ─────────────────────────────────────────────────
const LOG = '◈ Mirror';
function log(msg) { console.log(`[${new Date().toISOString().slice(11,19)}] ${LOG} ${msg}`); }
function logErr(msg, e) { console.error(`[${new Date().toISOString().slice(11,19)}] ${LOG} ERROR: ${msg}`, e?.message || ''); }

// ─── State ───────────────────────────────────────────────────
let state = { adapter: null, sessionId: null, byteOffset: 0, lastTimestamp: null, messagesSent: 0, errors: 0, started: new Date().toISOString() };

function loadState() {
  try {
    if (fs.existsSync(config.stateFile)) {
      state = { ...state, ...JSON.parse(fs.readFileSync(config.stateFile, 'utf8')) };
      log(`State loaded — sent: ${state.messagesSent}, offset: ${state.byteOffset}`);
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

// ─── Mirror API Client ──────────────────────────────────────
function postToMirrorOnce(message) {
  return new Promise((resolve, reject) => {
    const url = new URL(config.endpoint);
    const transport = url.protocol === 'https:' ? https : http;
    const data = JSON.stringify(message);
    const options = {
      hostname: url.hostname, port: url.port, path: url.pathname, method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'X-Source': `mirror-watcher/${config.adapter}`,
        ...(config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {})
      },
      timeout: 10000
    };
    const req = transport.request(options, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => res.statusCode < 300 ? resolve({ status: res.statusCode, body }) : reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0,200)}`)));
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
    try {
      return await postToMirrorOnce(message);
    } catch (e) {
      lastErr = e;
      if (attempt < config.retryAttempts) {
        log(`POST failed (attempt ${attempt}/${config.retryAttempts}) — retrying in ${config.retryDelayMs}ms`);
        await new Promise(r => setTimeout(r, config.retryDelayMs));
      }
    }
  }
  throw lastErr;
}


// ═══════════════════════════════════════════════════════════════
// ADAPTER: OpenClaw
// Reads JSONL session files from disk
// ═══════════════════════════════════════════════════════════════
const openclawAdapter = {
  name: 'openclaw',
  sessionsDir: null,
  sessionsIndex: null,

  init(cfg) {
    this.sessionsDir = path.join(cfg.openclawHome, 'agents/main/sessions');
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

    // Extract sender metadata before stripping
    let meta = {};
    const mm = text.match(/```json\s*(\{[^}]*\})\s*```/s);
    if (mm) { try { meta = JSON.parse(mm[1]); } catch {} }

    // Strip OpenClaw metadata wrapper
    text = text.replace(/^Conversation info \(untrusted metadata\):\s*```json\s*\{[^}]*\}\s*```\s*/s, '');

    // Skip system/cron/commands
    if (text.startsWith('System:') || text.startsWith('A scheduled reminder')) return null;
    text = text.trim();
    if (!text || text.length < 3 || text.startsWith('/')) return null;

    return { text, meta };
  },

  getNewMessages(st) {
    const messages = [];
    const sid = this._getActiveSessionId();
    if (!sid) return { messages, newState: {} };

    // Session changed — jump to end (don't reprocess history)
    if (sid !== st.sessionId) {
      const sp = path.join(this.sessionsDir, `${sid}.jsonl`);
      try {
        const size = fs.statSync(sp).size;
        log(`New session: ${sid.slice(0,8)}… — skipping to end`);
        return { messages: [], newState: { sessionId: sid, byteOffset: size } };
      } catch { return { messages, newState: {} }; }
    }

    // Read new bytes
    const sp = path.join(this.sessionsDir, `${sid}.jsonl`);
    let fileSize;
    try { fileSize = fs.statSync(sp).size; } catch { return { messages, newState: {} }; }
    if (fileSize <= st.byteOffset) return { messages, newState: {} };

    const fd = fs.openSync(sp, 'r');
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
        text: parsed.text,
        timestamp: obj.timestamp,
        source: 'openclaw',
        metadata: { sessionId: sid.slice(0,8), userId: parsed.meta.sender || null, channel: 'telegram' }
      });
    }

    return { messages, newState: { sessionId: sid, byteOffset: fileSize } };
  }
};


// ═══════════════════════════════════════════════════════════════
// ADAPTER: Webhook (V2)
// HTTP server that receives POSTs from any agent framework
// ═══════════════════════════════════════════════════════════════
const webhookAdapter = {
  name: 'webhook',
  server: null,
  queue: [],

  init(cfg) {
    const port = parseInt(cfg.webhookPort || '3100', 10);
    this.server = http.createServer((req, res) => {
      // POST /ingest — accept messages from any agent
      if (req.method === 'POST' && req.url === '/ingest') {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', () => {
          try {
            const d = JSON.parse(body);
            const msg = {
              text: d.text || d.message || d.content || '',
              timestamp: d.timestamp || new Date().toISOString(),
              source: d.source || d.agent || 'webhook',
              metadata: d.metadata || {}
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

      // GET /health
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


// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════
async function main() {
  console.log('');
  console.log('  ◈ Digital Mirror — Session Watcher v1.1');
  console.log(`  Adapter:   ${config.adapter}`);
  console.log(`  Endpoint:  ${config.endpoint}`);
  console.log(`  Poll:      ${config.pollInterval}ms`);
  console.log('');

  const adapter = adapters[config.adapter];
  if (!adapter) { logErr(`Unknown adapter: ${config.adapter}. Available: ${Object.keys(adapters).join(', ')}`); process.exit(1); }

  try { adapter.init(config.adapterConfig); }
  catch (e) { logErr('Adapter init failed', e); process.exit(1); }

  loadState();
  state.adapter = config.adapter;

  async function tick() {
    try {
      const { messages, newState } = adapter.getNewMessages(state);
      Object.assign(state, newState);

      for (const msg of messages) {
        try {
          await postToMirror(msg);
          state.messagesSent++;
          state.lastTimestamp = msg.timestamp;
          log(`→ [${state.messagesSent}] "${msg.text.slice(0,70)}${msg.text.length > 70 ? '…' : ''}"`);
        } catch (e) {
          state.errors++;
          logErr('POST failed', e);
        }
      }

      if (messages.length > 0) saveState();
    } catch (e) { logErr('Tick error', e); }
  }

  await tick();
  const interval = setInterval(tick, config.pollInterval);

  const shutdown = (sig) => { log(`${sig} — bye`); clearInterval(interval); saveState(); process.exit(0); };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  log('Watching…');
}

main();
