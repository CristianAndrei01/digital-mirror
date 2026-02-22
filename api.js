/**
 * Digital Mirror — REST API
 */

const express = require('express');
const router = express.Router();

const { parseConversation, getActiveDimensions } = require('./parser');
const {
  updateBaseline, isCalibrated, getWeeklySnapshot,
  getMonthlyReflection, getDimensionReport, formatWeeklyText, dimensionLabel
} = require('./scoring');

const VALID_DIMENSIONS = ['finance', 'health', 'career', 'social', 'family'];

module.exports = function createApi(db) {

  // LOG ENTRY — parse conversation and store dimension data
  router.post('/entry', (req, res) => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid "text" field' });
      }

      const entries = parseConversation(text);
      if (entries.length === 0) {
        return res.json({ logged: 0, message: 'No dimension data detected.' });
      }

      const results = [];
      for (const entry of entries) {
        const id = db.addEntry(entry.dimension, entry.score, entry.rawText, entry.metadata);
        if (isCalibrated(db, entry.dimension)) updateBaseline(db, entry.dimension);

        // Auto-detect base currency from first finance entry
        if (entry.dimension === 'finance' && entry.metadata.amount && entry.metadata.amount.currency) {
          const existingCurrency = db.getState('base_currency');
          if (!existingCurrency) {
            db.setState('base_currency', entry.metadata.amount.currency);
          }
        }

        results.push({ id, dimension: entry.dimension, score: entry.score, keywords: entry.metadata.keywords });
      }

      res.json({
        logged: results.length,
        entries: results,
        message: `Logged ${results.length} dimension${results.length > 1 ? 's' : ''}: ${results.map(r => dimensionLabel(r.dimension)).join(', ')}`
      });
    } catch (err) {
      console.error('POST /entry error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // WEEKLY DIRECTION SNAPSHOT
  router.get('/direction', (req, res) => {
    try {
      const expanded = req.query.expanded === 'true';
      const dimensions = getActiveDimensions(db);
      const snapshot = getWeeklySnapshot(db, dimensions, expanded);
      snapshot.formatted = formatWeeklyText(snapshot);
      res.json(snapshot);
    } catch (err) {
      console.error('GET /direction error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // SINGLE DIMENSION REPORT
  router.get('/dimension/:dim', (req, res) => {
    try {
      const dim = req.params.dim.toLowerCase();
      if (!VALID_DIMENSIONS.includes(dim)) {
        return res.status(400).json({ error: `Invalid dimension. Use: ${VALID_DIMENSIONS.join(', ')}` });
      }
      const report = getDimensionReport(db, dim, req.query.expanded === 'true');
      res.json(report);
    } catch (err) {
      console.error('GET /dimension error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // MONTHLY REFLECTION
  router.get('/monthly', (req, res) => {
    try {
      const dimensions = getActiveDimensions(db);
      res.json(getMonthlyReflection(db, dimensions));
    } catch (err) {
      console.error('GET /monthly error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // HISTORY — daily scores for a dimension
  router.get('/history/:dim', (req, res) => {
    try {
      const dim = req.params.dim.toLowerCase();
      if (!VALID_DIMENSIONS.includes(dim)) {
        return res.status(400).json({ error: `Invalid dimension. Use: ${VALID_DIMENSIONS.join(', ')}` });
      }
      const days = Math.min(parseInt(req.query.days || '30'), 90);
      res.json({ dimension: dim, days, scores: db.getDailyScores(dim, days) });
    } catch (err) {
      console.error('GET /history error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // CONTEXT MODE — activate
  // Note: Context mode is stored and returned via API.
  // Threshold adjustment based on context mode is a V2 feature.
  router.post('/context-mode', (req, res) => {
    try {
      const { dimension, reason, days } = req.body;
      if (!reason) return res.status(400).json({ error: 'Missing "reason" field' });
      if (dimension && !VALID_DIMENSIONS.includes(dimension.toLowerCase())) {
        return res.status(400).json({ error: `Invalid dimension. Use: ${VALID_DIMENSIONS.join(', ')}` });
      }
      const duration = Math.min(Math.max(parseInt(days || '5'), 1), 14);
      db.activateContextMode(dimension || null, reason, duration);
      res.json({
        activated: true,
        reason,
        duration,
        message: `Context mode stored for ${duration} days. Note: adaptive threshold adjustment is a V2 feature.`
      });
    } catch (err) {
      console.error('POST /context-mode error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // CONTEXT MODE — deactivate
  router.delete('/context-mode/:id', (req, res) => {
    try {
      db.deactivateContextMode(parseInt(req.params.id));
      res.json({ deactivated: true });
    } catch (err) {
      console.error('DELETE /context-mode error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // CONTEXT MODE — list active
  router.get('/context-mode', (req, res) => {
    try {
      res.json({ active: db.getActiveContextModes() });
    } catch (err) {
      console.error('GET /context-mode error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // SYSTEM STATUS
  router.get('/status', (req, res) => {
    try {
      const dimensions = getActiveDimensions(db);
      const calibration = {};
      for (const dim of VALID_DIMENSIONS) {
        calibration[dim] = isCalibrated(db, dim);
      }

      res.json({
        version: '1.0.0',
        totalEntries: db.getTotalEntries(),
        activeDimensions: dimensions,
        calibration,
        baseCurrency: db.getState('base_currency') || 'Not detected yet',
        contextModes: db.getActiveContextModes(),
        calibrationStart: db.getState('calibration_start')
      });
    } catch (err) {
      console.error('GET /status error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
};
