const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class MirrorDatabase {
  constructor(dbPath) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.init();
  }

  init() {
    this.db.exec(`
      -- Raw entries extracted from conversations
      CREATE TABLE IF NOT EXISTS entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dimension TEXT NOT NULL CHECK(dimension IN ('finance','health','career','social','family')),
        score REAL NOT NULL CHECK(score >= 0 AND score <= 10),
        raw_text TEXT,
        metadata TEXT,
        source TEXT DEFAULT 'conversation',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- Daily aggregated scores per dimension
      CREATE TABLE IF NOT EXISTS daily_scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dimension TEXT NOT NULL,
        date TEXT NOT NULL,
        avg_score REAL NOT NULL,
        entry_count INTEGER NOT NULL DEFAULT 1,
        UNIQUE(dimension, date)
      );

      -- Baseline snapshots per dimension
      CREATE TABLE IF NOT EXISTS baselines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dimension TEXT NOT NULL,
        mean REAL NOT NULL,
        std_dev REAL NOT NULL,
        slope_mean REAL,
        slope_std REAL,
        data_points INTEGER NOT NULL,
        calculated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(dimension)
      );

      -- Context mode sessions
      CREATE TABLE IF NOT EXISTS context_modes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dimension TEXT,
        reason TEXT,
        started_at TEXT NOT NULL DEFAULT (datetime('now')),
        expires_at TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1
      );

      -- System state
      CREATE TABLE IF NOT EXISTS system_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_entries_dimension_date ON entries(dimension, created_at);
      CREATE INDEX IF NOT EXISTS idx_daily_dimension_date ON daily_scores(dimension, date);
    `);

    // Initialize system state
    const calibrationStart = this.getState('calibration_start');
    if (!calibrationStart) {
      this.setState('calibration_start', new Date().toISOString());
      this.setState('calibration_complete', 'false');
    }
  }

  // --- ENTRIES ---

  addEntry(dimension, score, rawText = null, metadata = null) {
    const stmt = this.db.prepare(`
      INSERT INTO entries (dimension, score, raw_text, metadata)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(dimension, score, rawText, metadata ? JSON.stringify(metadata) : null);

    // Update daily aggregate
    this.updateDailyScore(dimension);

    return result.lastInsertRowid;
  }

  getEntries(dimension, days = 14) {
    return this.db.prepare(`
      SELECT * FROM entries
      WHERE dimension = ?
      AND created_at >= datetime('now', ?)
      ORDER BY created_at DESC
    `).all(dimension, `-${days} days`);
  }

  getEntriesForDate(dimension, date) {
    return this.db.prepare(`
      SELECT * FROM entries
      WHERE dimension = ?
      AND date(created_at) = ?
      ORDER BY created_at
    `).all(dimension, date);
  }

  // --- DAILY SCORES ---

  updateDailyScore(dimension) {
    const today = new Date().toISOString().split('T')[0];
    const entries = this.getEntriesForDate(dimension, today);

    if (entries.length === 0) return;

    const avg = entries.reduce((sum, e) => sum + e.score, 0) / entries.length;

    this.db.prepare(`
      INSERT INTO daily_scores (dimension, date, avg_score, entry_count)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(dimension, date) DO UPDATE SET
        avg_score = excluded.avg_score,
        entry_count = excluded.entry_count
    `).run(dimension, today, Math.round(avg * 10) / 10, entries.length);
  }

  getDailyScores(dimension, days = 30) {
    return this.db.prepare(`
      SELECT * FROM daily_scores
      WHERE dimension = ?
      AND date >= date('now', ?)
      ORDER BY date ASC
    `).all(dimension, `-${days} days`);
  }

  getDaysWithData(dimension, days = 14) {
    const result = this.db.prepare(`
      SELECT COUNT(DISTINCT date) as count FROM daily_scores
      WHERE dimension = ?
      AND date >= date('now', ?)
    `).get(dimension, `-${days} days`);
    return result.count;
  }

  // --- BASELINES ---

  saveBaseline(dimension, stats) {
    this.db.prepare(`
      INSERT INTO baselines (dimension, mean, std_dev, slope_mean, slope_std, data_points)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(dimension) DO UPDATE SET
        mean = excluded.mean,
        std_dev = excluded.std_dev,
        slope_mean = excluded.slope_mean,
        slope_std = excluded.slope_std,
        data_points = excluded.data_points,
        calculated_at = datetime('now')
    `).run(dimension, stats.mean, stats.stdDev, stats.slopeMean || 0, stats.slopeStd || 0, stats.dataPoints);
  }

  getBaseline(dimension) {
    return this.db.prepare(`
      SELECT * FROM baselines WHERE dimension = ?
    `).get(dimension);
  }

  getAllBaselines() {
    return this.db.prepare(`SELECT * FROM baselines`).all();
  }

  // --- CONTEXT MODE ---

  activateContextMode(dimension, reason, durationDays = 5) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    return this.db.prepare(`
      INSERT INTO context_modes (dimension, reason, expires_at)
      VALUES (?, ?, ?)
    `).run(dimension, reason, expiresAt.toISOString());
  }

  getActiveContextModes() {
    // Auto-expire old ones
    this.db.prepare(`
      UPDATE context_modes SET active = 0
      WHERE active = 1 AND expires_at < datetime('now')
    `).run();

    return this.db.prepare(`
      SELECT * FROM context_modes WHERE active = 1
    `).all();
  }

  deactivateContextMode(id) {
    this.db.prepare(`UPDATE context_modes SET active = 0 WHERE id = ?`).run(id);
  }

  // --- SYSTEM STATE ---

  getState(key) {
    const row = this.db.prepare(`SELECT value FROM system_state WHERE key = ?`).get(key);
    return row ? row.value : null;
  }

  setState(key, value) {
    this.db.prepare(`
      INSERT INTO system_state (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
    `).run(key, String(value));
  }

  // --- STATS ---

  getActiveDimensions() {
    const rows = this.db.prepare(`
      SELECT DISTINCT dimension FROM entries
      WHERE created_at >= datetime('now', '-30 days')
    `).all();
    return rows.map(r => r.dimension);
  }

  getTotalEntries() {
    return this.db.prepare(`SELECT COUNT(*) as count FROM entries`).get().count;
  }

  close() {
    this.db.close();
  }
}

module.exports = MirrorDatabase;
