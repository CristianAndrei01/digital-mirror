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

const db = new MirrorDatabase(path.resolve(DB_PATH));

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// API routes
app.use('/api', createApi(db));

// Dashboard — served explicitly to avoid confusion with landing page index.html
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard', 'dashboard.html'));
});
app.use('/dashboard', express.static(path.join(__dirname, 'dashboard')));

// Root redirect
app.get('/', (req, res) => res.redirect('/dashboard'));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', version: '1.1.0' }));

// Start
app.listen(PORT, HOST, () => {
  console.log('');
  console.log('  ◈ Digital Mirror v1.1.0');
  console.log(`  http://${HOST}:${PORT}`);
  console.log(`  Dashboard: http://${HOST}:${PORT}/dashboard`);
  console.log(`  API:       http://${HOST}:${PORT}/api/status`);
  console.log(`  Database:  ${DB_PATH}`);
  console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => { db.close(); process.exit(0); });
process.on('SIGTERM', () => { db.close(); process.exit(0); });
