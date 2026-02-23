/**
 * Digital Mirror — Server
 * Direction engine for life.
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const MirrorDatabase = require('./src/database');
const createApi = require('./src/api');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';
const DB_PATH = process.env.DB_PATH || './data/mirror.db';
const API_KEY = process.env.MIRROR_API_KEY || '';
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || '';

const db = new MirrorDatabase(path.resolve(DB_PATH));

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// ─── Rate Limiting ────────────────────────────────────────────
// Simple in-memory rate limiter: max 60 requests/minute per IP
const rateLimitMap = new Map();
function rateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowMs = 60 * 1000;
  const max = 60;

  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, { count: 1, start: now });
    return next();
  }

  const entry = rateLimitMap.get(ip);
  if (now - entry.start > windowMs) {
    rateLimitMap.set(ip, { count: 1, start: now });
    return next();
  }

  entry.count++;
  if (entry.count > max) {
    return res.status(429).json({ error: 'Too many requests. Limit: 60/minute.' });
  }
  next();
}

// Clean up rate limit map every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now - entry.start > 60 * 1000) rateLimitMap.delete(ip);
  }
}, 5 * 60 * 1000);

// ─── API Key Auth ─────────────────────────────────────────────
// If MIRROR_API_KEY is set, all /api/* requests must include it
function apiAuth(req, res, next) {
  if (!API_KEY) return next(); // no key configured = open
  const auth = req.headers['authorization'] || '';
  const key = auth.startsWith('Bearer ') ? auth.slice(7) : req.headers['x-api-key'] || '';
  if (key === API_KEY) return next();
  return res.status(401).json({ error: 'Unauthorized. Include Authorization: Bearer YOUR_API_KEY' });
}

// ─── Dashboard Auth ───────────────────────────────────────────
// If DASHBOARD_PASSWORD is set, dashboard requires HTTP Basic Auth
function dashboardAuth(req, res, next) {
  if (!DASHBOARD_PASSWORD) return next(); // no password = open
  const auth = req.headers['authorization'] || '';
  if (auth.startsWith('Basic ')) {
    const decoded = Buffer.from(auth.slice(6), 'base64').toString();
    const [, pass] = decoded.split(':');
    if (pass === DASHBOARD_PASSWORD) return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="Digital Mirror"');
  return res.status(401).send('Unauthorized');
}

// ─── Routes ───────────────────────────────────────────────────
app.use('/api', rateLimit, apiAuth, createApi(db));

app.get('/dashboard', dashboardAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard', 'dashboard.html'));
});
app.use('/dashboard', dashboardAuth, express.static(path.join(__dirname, 'dashboard')));

app.get('/', (req, res) => res.redirect('/dashboard'));

app.get('/health', (req, res) => res.json({ status: 'ok', version: '1.0.0' }));

// ─── Start ────────────────────────────────────────────────────
app.listen(PORT, HOST, () => {
  console.log('');
  console.log('  ◈ Digital Mirror v1.0.0');
  console.log(`  http://${HOST}:${PORT}`);
  console.log(`  Dashboard: http://${HOST}:${PORT}/dashboard`);
  console.log(`  API:       http://${HOST}:${PORT}/api/status`);
  console.log(`  Database:  ${DB_PATH}`);
  console.log(`  API Auth:  ${API_KEY ? 'enabled' : 'disabled (set MIRROR_API_KEY to enable)'}`);
  console.log(`  Dashboard: ${DASHBOARD_PASSWORD ? 'password protected' : 'open (set DASHBOARD_PASSWORD to protect)'}`);
  console.log('');
});

process.on('SIGINT', () => { db.close(); process.exit(0); });
process.on('SIGTERM', () => { db.close(); process.exit(0); });
