/**
 * Digital Mirror — REST API
 */

const express = require('express');
const router = express.Router();

const { parseConversation, getActiveDimensions } = require('./parser');
const {
  updateBaseline, isCalibrated, getWeeklySnapshot,
  getMonthlyReflection, getDimensionReport, formatWeeklyText,
  dimensionLabel, detectAlerts
} = require('./scoring');

const VALID_DIMENSIONS = ['finance', 'health', 'career', 'social', 'family'];
const MAX_TEXT_LENGTH = 3000;

const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 20;

function rateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
  if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + RATE_LIMIT_WINDOW_MS; }
  entry.count++;
  rateLimitMap.set(ip, entry);
  if (rateLimitMap.size > 1000) { for (const [k, v] of rateLimitMap.entries()) { if (now > v.resetAt) rateLimitMap.delete(k); } }
  if (entry.count > RATE_LIMIT_MAX) { return res.status(429).json({ error: 'Too many requests. Max 20 entries per minute.', retryAfter: Math.ceil((entry.resetAt - now) / 1000) }); }
  next();
}

let alertsCache = null;
let alertsCacheAt = 0;
const ALERTS_CACHE_TTL = 5 * 60 * 1000;

function getCachedAlerts(db, dimensions) {
  const now = Date.now();
  if (alertsCache && (now - alertsCacheAt) < ALERTS_CACHE_TTL) return alertsCache;
  alertsCache = detectAlerts(db, dimensions);
  alertsCacheAt = now;
  return alertsCache;
}

function invalidateAlertsCache() { alertsCache = null; alertsCacheAt = 0; }

module.exports = function createApi(db) {

  router.post('/entry', rateLimit, (req, res) => {
    try {
      let { text } = req.body;
      if (!text || typeof text !== 'string') return res.status(400).json({ error: 'Missing or invalid "text" field' });
      if (text.length > MAX_TEXT_LENGTH) text = text.substring(0, MAX_TEXT_LENGTH);
      const entries = parseConversation(text);
      if (entries.length === 0) return res.json({ logged: 0, message: 'No dimension data detected.' });
      const results = [];
      for (const entry of entries) {
        const id = db.addEntry(entry.dimension, entry.score, entry.rawText, entry.metadata);
        if (isCalibrated(db, entry.dimension)) updateBaseline(db, entry.dimension);
        if (entry.dimension === 'finance' && entry.metadata.amount && entry.metadata.amount.currency) {
          if (!db.getState('base_currency')) db.setState('base_currency', entry.metadata.amount.currency);
        }
        results.push({ id, dimension: entry.dimension, score: entry.score, keywords: entry.metadata.keywords });
      }
      invalidateAlertsCache();
      res.json({ logged: results.length, entries: results, message: `Logged ${results.length} dimension${results.length > 1 ? 's' : ''}: ${results.map(r => dimensionLabel(r.dimension)).join(', ')}` });
    } catch (err) { console.error('POST /entry error:', err); res.status(500).json({ error: 'Internal server error' }); }
  });

  router.get('/direction', (req, res) => {
    try {
      const expanded = req.query.expanded === 'true';
      const dimensions = getActiveDimensions(db);
      const snapshot = getWeeklySnapshot(db, dimensions, expanded);
      snapshot.formatted = formatWeeklyText(snapshot);
      res.json(snapshot);
    } catch (err) { console.error('GET /direction error:', err); res.status(500).json({ error: 'Internal server error' }); }
  });

  router.get('/dimension/:dim', (req, res) => {
    try {
      const dim = req.params.dim.toLowerCase();
      if (!VALID_DIMENSIONS.includes(dim)) return res.status(400).json({ error: `Invalid dimension. Use: ${VALID_DIMENSIONS.join(', ')}` });
      res.json(getDimensionReport(db, dim, req.query.expanded === 'true'));
    } catch (err) { console.error('GET /dimension error:', err); res.status(500).json({ error: 'Internal server error' }); }
  });

  router.get('/monthly', (req, res) => {
    try { res.json(getMonthlyReflection(db, getActiveDimensions(db))); }
    catch (err) { console.error('GET /monthly error:', err); res.status(500).json({ error: 'Internal server error' }); }
  });

  router.get('/history/:dim', (req, res) => {
    try {
      const dim = req.params.dim.toLowerCase();
      if (!VALID_DIMENSIONS.includes(dim)) return res.status(400).json({ error: `Invalid dimension. Use: ${VALID_DIMENSIONS.join(', ')}` });
      const days = Math.min(parseInt(req.query.days || '30'), 90);
      res.json({ dimension: dim, days, scores: db.getDailyScores(dim, days) });
    } catch (err) { console.error('GET /history error:', err); res.status(500).json({ error: 'Internal server error' }); }
  });

  router.post('/context-mode', (req, res) => {
    try {
      const { dimension, reason, days } = req.body;
      if (!reason || typeof reason !== 'string' || reason.trim().length === 0) return res.status(400).json({ error: 'Missing or empty "reason" field' });
      if (dimension && !VALID_DIMENSIONS.includes(dimension.toLowerCase())) return res.status(400).json({ error: `Invalid dimension. Use: ${VALID_DIMENSIONS.join(', ')}` });
      const parsedDays = parseInt(days);
      const duration = Math.min(Math.max(isNaN(parsedDays) ? 5 : parsedDays, 1), 14);
      db.activateContextMode(dimension || null, reason.trim(), duration);
      res.json({ activated: true, reason: reason.trim(), duration, message: `Context mode stored for ${duration} days.` });
    } catch (err) { console.error('POST /context-mode error:', err); res.status(500).json({ error: 'Internal server error' }); }
  });

  router.delete('/context-mode/:id', (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id) || id <= 0) return res.status(400).json({ error: 'Invalid context mode ID' });
      db.deactivateContextMode(id);
      res.json({ deactivated: true });
    } catch (err) { console.error('DELETE /context-mode error:', err); res.status(500).json({ error: 'Internal server error' }); }
  });

  router.get('/context-mode', (req, res) => {
    try { res.json({ active: db.getActiveContextModes() }); }
    catch (err) { console.error('GET /context-mode error:', err); res.status(500).json({ error: 'Internal server error' }); }
  });

  router.get('/alerts', (req, res) => {
    try {
      const dimensions = getActiveDimensions(db);
      const alerts = getCachedAlerts(db, dimensions);
      res.json({ count: alerts.length, alerts, checkedAt: new Date().toISOString() });
    } catch (err) { console.error('GET /alerts error:', err); res.status(500).json({ error: 'Internal server error' }); }
  });

  router.get('/proactive', (req, res) => {
    try {
      const dimensions = getActiveDimensions(db);
      const alerts = getCachedAlerts(db, dimensions);
      const contextModes = db.getActiveContextModes();
      const snapshot = getWeeklySnapshot(db, dimensions);
      const lastAck = db.getState('alerts_last_acked');
      const newAlerts = lastAck ? alerts.filter(a => a.detectedAt > lastAck) : alerts;
      res.json({ hasAlerts: newAlerts.length > 0, alerts: newAlerts, activeContextModes: contextModes, directionSummary: snapshot.dimensions.filter(d => d.direction7d !== 'Calibrating' && d.direction7d !== 'Insufficient data').map(d => ({ dimension: d.dimension, direction: d.direction7d, confidence: d.confidence })), checkedAt: new Date().toISOString() });
    } catch (err) { console.error('GET /proactive error:', err); res.status(500).json({ error: 'Internal server error' }); }
  });

  router.post('/alerts/ack', (req, res) => {
    try { db.setState('alerts_last_acked', new Date().toISOString()); invalidateAlertsCache(); res.json({ acknowledged: true, at: db.getState('alerts_last_acked') }); }
    catch (err) { console.error('POST /alerts/ack error:', err); res.status(500).json({ error: 'Internal server error' }); }
  });

  router.get('/settings', (req, res) => {
    try {
      res.json({ timezone: db.getState('user_timezone') || 'UTC', weeklyDigestHour: parseInt(db.getState('weekly_digest_hour') || '8'), weeklyDigestDay: db.getState('weekly_digest_day') || 'monday', notificationsEnabled: db.getState('notifications_enabled') !== 'false', language: db.getState('user_language') || 'en' });
    } catch (err) { console.error('GET /settings error:', err); res.status(500).json({ error: 'Internal server error' }); }
  });

  router.post('/settings', (req, res) => {
    try {
      const allowed = ['timezone', 'weeklyDigestHour', 'weeklyDigestDay', 'notificationsEnabled', 'language'];
      const updated = [];
      if (req.body.timezone !== undefined) { db.setState('user_timezone', String(req.body.timezone)); updated.push('timezone'); }
      if (req.body.weeklyDigestHour !== undefined) { const h = parseInt(req.body.weeklyDigestHour); if (isNaN(h)) return res.status(400).json({ error: 'weeklyDigestHour must be a number 0-23' }); db.setState('weekly_digest_hour', String(Math.min(Math.max(h, 0), 23))); updated.push('weeklyDigestHour'); }
      if (req.body.weeklyDigestDay !== undefined) { const valid = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']; if (!valid.includes(req.body.weeklyDigestDay.toLowerCase())) return res.status(400).json({ error: `weeklyDigestDay must be one of: ${valid.join(', ')}` }); db.setState('weekly_digest_day', req.body.weeklyDigestDay.toLowerCase()); updated.push('weeklyDigestDay'); }
      if (req.body.notificationsEnabled !== undefined) { db.setState('notifications_enabled', req.body.notificationsEnabled ? 'true' : 'false'); updated.push('notificationsEnabled'); }
      if (req.body.language !== undefined) { db.setState('user_language', String(req.body.language)); updated.push('language'); }
      if (updated.length === 0) return res.status(400).json({ error: `No valid fields. Allowed: ${allowed.join(', ')}` });
      res.json({ updated, settings: { timezone: db.getState('user_timezone') || 'UTC', weeklyDigestHour: parseInt(db.getState('weekly_digest_hour') || '8'), weeklyDigestDay: db.getState('weekly_digest_day') || 'monday', notificationsEnabled: db.getState('notifications_enabled') !== 'false', language: db.getState('user_language') || 'en' }});
    } catch (err) { console.error('POST /settings error:', err); res.status(500).json({ error: 'Internal server error' }); }
  });

  router.get('/export', (req, res) => {
    try {
      const entries = VALID_DIMENSIONS.flatMap(dim => db.getEntries(dim, 3650).map(e => ({ ...e, metadata: e.metadata ? JSON.parse(e.metadata) : null }))).sort((a, b) => a.created_at.localeCompare(b.created_at));
      const dailyScores = {};
      for (const dim of VALID_DIMENSIONS) dailyScores[dim] = db.getDailyScores(dim, 3650);
      const stateKeys = ['calibration_start','calibration_complete','base_currency','user_timezone','weekly_digest_hour','weekly_digest_day','notifications_enabled','user_language','alerts_last_acked'];
      const systemState = {};
      for (const key of stateKeys) { const val = db.getState(key); if (val !== null) systemState[key] = val; }
      const exportData = { meta: { version: '1.1.0', exportedAt: new Date().toISOString(), totalEntries: entries.length, activeDimensions: getActiveDimensions(db), calibrationStart: db.getState('calibration_start') }, systemState, baselines: db.getAllBaselines(), entries, dailyScores, contextModes: db.getActiveContextModes() };
      const filename = `digital-mirror-export-${new Date().toISOString().slice(0,10)}.json`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/json');
      res.json(exportData);
    } catch (err) { console.error('GET /export error:', err); res.status(500).json({ error: 'Internal server error' }); }
  });

  router.get('/status', (req, res) => {
    try {
      const dimensions = getActiveDimensions(db);
      const calibration = {};
      for (const dim of VALID_DIMENSIONS) calibration[dim] = isCalibrated(db, dim);
      res.json({ version: '1.1.0', totalEntries: db.getTotalEntries(), activeDimensions: dimensions, calibration, baseCurrency: db.getState('base_currency') || 'Not detected yet', contextModes: db.getActiveContextModes(), calibrationStart: db.getState('calibration_start'), activeAlerts: getCachedAlerts(db, dimensions).length, settings: { timezone: db.getState('user_timezone') || 'UTC', weeklyDigestHour: parseInt(db.getState('weekly_digest_hour') || '8'), notificationsEnabled: db.getState('notifications_enabled') !== 'false' } });
    } catch (err) { console.error('GET /status error:', err); res.status(500).json({ error: 'Internal server error' }); }
  });

  return router;
};
