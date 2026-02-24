/**
 * Digital Mirror — Scoring Engine
 * 
 * Calculates direction (Up/Stable/Down), stability, and consistency
 * per dimension, relative to user's own baseline.
 * 
 * All thresholds are adaptive — no fixed global values.
 * Based on Narrative Bible v3 specification.
 */

const SIGMA_MULTIPLIER = parseFloat(process.env.SIGMA_MULTIPLIER || '0.4');
const CALIBRATION_DAYS = parseInt(process.env.CALIBRATION_DAYS || '14');

// --- MATH HELPERS ---

function mean(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, v) => sum + v, 0) / arr.length;
}

function stdDev(arr) {
  if (arr.length < 2) return 0;
  const avg = mean(arr);
  const squaredDiffs = arr.map(v => Math.pow(v - avg, 2));
  return Math.sqrt(squaredDiffs.reduce((sum, v) => sum + v, 0) / (arr.length - 1));
}

function slope(values) {
  if (values.length < 2) return 0;
  const n = values.length;
  const xMean = (n - 1) / 2;
  const yMean = mean(values);
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (values[i] - yMean);
    denominator += Math.pow(i - xMean, 2);
  }
  return denominator === 0 ? 0 : numerator / denominator;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

// --- BASELINE ---

function calculateBaseline(dailyScores) {
  const scores = dailyScores.map(d => d.avg_score);
  if (scores.length < 3) return null;

  const slopes = [];
  for (let i = 2; i < scores.length; i++) {
    const window = scores.slice(i - 2, i + 1);
    slopes.push(slope(window));
  }

  return {
    mean: round1(mean(scores)),
    stdDev: round1(stdDev(scores)),
    slopeMean: round1(mean(slopes)),
    slopeStd: round1(stdDev(slopes) || 0.1),
    dataPoints: scores.length
  };
}

function isCalibrated(db, dimension) {
  const daysWithData = db.getDaysWithData(dimension, CALIBRATION_DAYS);
  return daysWithData >= Math.ceil(CALIBRATION_DAYS / 2);
}

function updateBaseline(db, dimension) {
  const dailyScores = db.getDailyScores(dimension, 30);
  const stats = calculateBaseline(dailyScores);
  if (stats) {
    db.saveBaseline(dimension, stats);
  }
  return stats;
}

// --- DIRECTION ---

function calculateDirection(db, dimension) {
  const baseline = db.getBaseline(dimension);
  const daily7 = db.getDailyScores(dimension, 7);
  const daily30 = db.getDailyScores(dimension, 30);

  if (daily7.length < 2) {
    return {
      direction7d: 'Insufficient data',
      direction30d: 'Insufficient data',
      slope7d: 0,
      slope30d: 0,
      calibrated: false
    };
  }

  const scores7 = daily7.map(d => d.avg_score);
  const scores30 = daily30.map(d => d.avg_score);

  const slope7d = round1(slope(scores7));
  const slope30d = round1(slope(scores30));

  const slopeStd = baseline ? Math.max(baseline.slope_std, 0.1) : 0.5;
  const threshold = slopeStd * SIGMA_MULTIPLIER;

  return {
    direction7d: classifyDirection(slope7d, threshold),
    direction30d: classifyDirection(slope30d, threshold),
    slope7d,
    slope30d,
    threshold: round1(threshold),
    calibrated: !!baseline
  };
}

function classifyDirection(slopeValue, threshold) {
  if (slopeValue > threshold) return 'Up';
  if (slopeValue < -threshold) return 'Down';
  return 'Stable';
}

// --- STABILITY ---

function calculateStability(db, dimension) {
  const baseline = db.getBaseline(dimension);
  const daily14 = db.getDailyScores(dimension, 14);

  if (daily14.length < 3 || !baseline) {
    return { stability: 'Calibrating', ratio: null };
  }

  const scores = daily14.map(d => d.avg_score);
  const currentStd = stdDev(scores);
  const baselineStd = Math.max(baseline.std_dev, 0.1);
  const ratio = round1(currentStd / baselineStd);

  let stability;
  if (ratio <= 1.0) stability = 'Stable';
  else if (ratio <= 1.5) stability = 'Moderate variability';
  else stability = 'Variable';

  return { stability, ratio };
}

// --- CONSISTENCY ---

function calculateConsistency(db, dimension, days = 14) {
  const daysWithData = db.getDaysWithData(dimension, days);
  const ratio = daysWithData / days;

  let confidence;
  if (ratio >= 0.7) confidence = 'high';
  else if (ratio >= 0.4) confidence = 'moderate';
  else confidence = 'low';

  return {
    daysWithData,
    totalDays: days,
    ratio: round1(ratio),
    confidence
  };
}

// --- HEALTHY VARIANCE CEILING ---

function checkVarianceCeiling(db, dimension) {
  const daily7 = db.getDailyScores(dimension, 7);
  const daily30 = db.getDailyScores(dimension, 30);

  if (daily7.length < 5 || daily30.length < 14) return null;

  const std7 = stdDev(daily7.map(d => d.avg_score));
  const std30 = stdDev(daily30.map(d => d.avg_score));

  if (std30 === 0) return null;

  const ratio = std7 / std30;

  if (ratio > 1.8) {
    return {
      triggered: true,
      dimension,
      ratio: round1(ratio),
      message: `Sustained variability detected in ${dimension}. This is outside your historical range.`
    };
  }

  return { triggered: false };
}

// --- FULL DIMENSION REPORT ---

function getDimensionReport(db, dimension, expanded = false) {
  const direction = calculateDirection(db, dimension);
  const stability = calculateStability(db, dimension);
  const consistency = calculateConsistency(db, dimension);
  const variance = checkVarianceCeiling(db, dimension);

  const report = {
    dimension,
    direction7d: direction.direction7d,
    direction30d: direction.direction30d,
    stability: stability.stability,
    confidence: consistency.confidence,
    daysWithData: `${consistency.daysWithData}/${consistency.totalDays}`,
    calibrated: direction.calibrated
  };

  if (expanded) {
    report.expanded = {
      slope7d: direction.slope7d,
      slope30d: direction.slope30d,
      threshold: direction.threshold,
      stabilityRatio: stability.ratio,
      consistencyRatio: consistency.ratio,
      varianceCeiling: variance
    };
  }

  return report;
}

// --- ALERT ENGINE ---

const ALERT_STREAK_DAYS = parseInt(process.env.ALERT_STREAK_DAYS || '3');

/**
 * Detect proactive alerts per dimension.
 * Returns array of alert objects for dimensions with 3+ consecutive days of movement.
 */
function detectAlerts(db, dimensions) {
  const alerts = [];

  for (const dimension of dimensions) {
    const daily = db.getDailyScores(dimension, 7);
    if (daily.length < ALERT_STREAK_DAYS) continue;

    const recent = daily.slice(-ALERT_STREAK_DAYS).map(d => d.avg_score);

    let allDown = true;
    let allUp = true;
    for (let i = 1; i < recent.length; i++) {
      if (recent[i] >= recent[i - 1]) allDown = false;
      if (recent[i] <= recent[i - 1]) allUp = false;
    }

    const baseline = db.getBaseline(dimension);
    const baselineMean = baseline ? baseline.mean : null;

    if (allDown) {
      const drop = round1(recent[0] - recent[recent.length - 1]);
      alerts.push({
        dimension,
        type: 'declining',
        streak: ALERT_STREAK_DAYS,
        message: getDecliningMessage(dimension),
        severity: drop > 2 ? 'high' : 'moderate',
        delta: -drop,
        baselineMean,
        detectedAt: new Date().toISOString()
      });
    } else if (allUp) {
      const rise = round1(recent[recent.length - 1] - recent[0]);
      alerts.push({
        dimension,
        type: 'ascending',
        streak: ALERT_STREAK_DAYS,
        message: getMotivationalMessage(dimension),
        severity: 'positive',
        delta: rise,
        baselineMean,
        detectedAt: new Date().toISOString()
      });
    }
  }

  return alerts;
}

/**
 * Motivational message for ascending dimension.
 */
function getMotivationalMessage(dimension) {
  const messages = {
    finance:  'Your finances are moving in the right direction — whatever you changed this week, keep going.',
    health:   'Three days of momentum in Health. The streak is real — protect it.',
    career:   'Career is trending up. You\'re building something. Stay consistent.',
    social:   'Social energy rising. Connection compounds — keep showing up.',
    family:   'Family time trending up. This is the one that matters most — keep going.'
  };
  return messages[dimension] || `${dimensionLabel(dimension)} is trending upward. Keep going.`;
}

/**
 * Alert message for declining dimension.
 */
function getDecliningMessage(dimension) {
  const messages = {
    finance:  'Finance has been slipping for 3 days. Worth a quick look — small patterns compound.',
    health:   'Health signal dropping. Not a judgment — just a pattern. One good day resets the streak.',
    career:   'Career signal below your baseline for 3 days. Might be a busy patch — or worth a check.',
    social:   'Social has been declining. Isolation is sneaky. Even a short call counts.',
    family:   'Family dimension trending down. You know what to do.'
  };
  return messages[dimension] || `${dimensionLabel(dimension)} has been declining for ${ALERT_STREAK_DAYS} days.`;
}

// --- WEEKLY SNAPSHOT ---

function getWeeklySnapshot(db, dimensions, expanded = false) {
  const reports = dimensions.map(d => getDimensionReport(db, d, expanded));

  // Find strongest and weakest
  // Use copies to avoid in-place sort mutation
  const directionOrder = { 'Up': 2, 'Stable': 1, 'Down': 0, 'Insufficient data': -1, 'Calibrating': -1 };
  const scored = reports
    .filter(r => r.direction7d !== 'Insufficient data')
    .map(r => ({ ...r, score: directionOrder[r.direction7d] || 0 }));

  const strongest = [...scored].sort((a, b) => b.score - a.score)[0] || null;
  const weakest = [...scored].sort((a, b) => a.score - b.score)[0] || null;

  // Detect patterns
  const patterns = [];
  for (const r of reports) {
    if (r.direction7d === 'Stable' && r.direction30d === 'Stable') {
      patterns.push(`${dimensionLabel(r.dimension)} plateau detected`);
    }
    if (r.direction7d === 'Down' && r.direction30d === 'Up') {
      patterns.push(`${dimensionLabel(r.dimension)} short-term dip within uptrend`);
    }
    if (r.direction7d === 'Up' && r.direction30d === 'Down') {
      patterns.push(`${dimensionLabel(r.dimension)} recovering from decline`);
    }
  }

  return {
    timestamp: new Date().toISOString(),
    dimensions: reports,
    strongest: strongest ? { dimension: strongest.dimension, direction: strongest.direction7d, stability: strongest.stability } : null,
    weakest: weakest ? { dimension: weakest.dimension, direction: weakest.direction7d, stability: weakest.stability } : null,
    patterns: patterns.length > 0 ? patterns : null
  };
}

// --- MONTHLY REFLECTION ---

function getMonthlyReflection(db, dimensions) {
  const reports = dimensions.map(d => getDimensionReport(db, d, true));

  const directions = reports.map(r => r.direction30d).filter(d => d !== 'Insufficient data');
  const upCount = directions.filter(d => d === 'Up').length;
  const downCount = directions.filter(d => d === 'Down').length;

  let overall;
  if (upCount > downCount + 1) overall = 'Ascending';
  else if (downCount > upCount + 1) overall = 'Descending';
  else overall = 'Stable';

  const stabilities = reports.map(r => r.stability);
  const stableCount = stabilities.filter(s => s === 'Stable').length;
  let avgStability;
  if (stableCount > stabilities.length / 2) avgStability = 'Stable';
  else avgStability = 'Moderate';

  // Total data quality
  const totalDays = reports.reduce((sum, r) => {
    const parts = r.daysWithData.split('/');
    return sum + parseInt(parts[0]);
  }, 0);
  const maxDays = reports.length * 30;
  const dataQuality = totalDays / maxDays >= 0.6 ? 'Good' : totalDays / maxDays >= 0.3 ? 'Moderate' : 'Low';

  return {
    timestamp: new Date().toISOString(),
    overall,
    avgStability,
    dataQuality: `${dataQuality} (entries on ${totalDays} dimension-days)`,
    dimensions: reports,
    patterns: identifyMonthlyPatterns(reports)
  };
}

function identifyMonthlyPatterns(reports) {
  const patterns = [];
  for (const r of reports) {
    if (r.direction30d === 'Up' && r.stability === 'Stable') {
      patterns.push(`${dimensionLabel(r.dimension)} ascending consistently`);
    }
    if (r.direction30d === 'Down' && r.stability === 'Variable') {
      patterns.push(`${dimensionLabel(r.dimension)} volatile and declining`);
    }
  }
  return patterns.length > 0 ? patterns : null;
}

// --- HELPERS ---

const DIMENSION_LABELS = {
  finance: '💰 Finance',
  health: '🏃 Health',
  career: '🚀 Career',
  social: '🤝 Social',
  family: '👨‍👩‍👧‍👦 Family'
};

function dimensionLabel(dim) {
  return DIMENSION_LABELS[dim] || dim;
}

// --- FORMAT OUTPUT ---

function formatWeeklyText(snapshot) {
  let out = '◈ WEEKLY DIRECTION\n\n';

  for (const d of snapshot.dimensions) {
    const label = dimensionLabel(d.dimension).padEnd(18);
    const dir = `Direction: ${d.direction7d}`.padEnd(18);
    const stab = `Stability: ${d.stability}`;
    const conf = d.confidence === 'low' ? ' (low confidence)' : '';
    out += `  ${label} ${dir} ${stab}${conf}\n`;
  }

  if (snapshot.strongest) {
    out += `\n  Strongest:  ${dimensionLabel(snapshot.strongest.dimension)} — ${snapshot.strongest.direction}, ${snapshot.strongest.stability}`;
  }
  if (snapshot.weakest && snapshot.weakest.dimension !== snapshot.strongest?.dimension) {
    out += `\n  Weakest:    ${dimensionLabel(snapshot.weakest.dimension)} — ${snapshot.weakest.direction}, ${snapshot.weakest.stability}`;
  }

  if (snapshot.patterns) {
    out += `\n\n  Pattern:    ${snapshot.patterns[0]}`;
  }

  return out;
}

module.exports = {
  calculateBaseline,
  updateBaseline,
  isCalibrated,
  calculateDirection,
  calculateStability,
  calculateConsistency,
  checkVarianceCeiling,
  getDimensionReport,
  getWeeklySnapshot,
  getMonthlyReflection,
  formatWeeklyText,
  detectAlerts,
  getMotivationalMessage,
  getDecliningMessage,
  dimensionLabel,
  DIMENSION_LABELS
};
