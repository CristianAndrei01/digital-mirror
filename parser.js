/**
 * Digital Mirror — Conversation Parser
 * 
 * Extracts life dimension data from natural conversation text.
 * Returns structured entries with dimension, estimated score, and context.
 * 
 * This is the v1 rule-based parser. Future versions may use LLM extraction.
 */

const DIMENSIONS = {
  finance: {
    keywords: [
      'spent', 'paid', 'bought', 'cost', 'price', 'money', 'salary', 'income',
      'invest', 'save', 'saving', 'debt', 'loan', 'rent', 'mortgage', 'bill',
      'expense', 'budget', 'earn', 'earned', 'revenue', 'profit', 'loss',
      'subscription', 'insurance', 'tax', 'refund', 'tip', 'donation',
      'crypto', 'stock', 'dividend', 'bonus', 'raise', 'payment', 'transfer',
      '$', '€', '£', 'usd', 'eur', 'ron', 'gbp'
    ],
    positive: [
      'saved', 'earned', 'profit', 'bonus', 'raise', 'income', 'revenue',
      'refund', 'dividend', 'under budget', 'good deal', 'discount', 'invested'
    ],
    negative: [
      'overspent', 'expensive', 'broke', 'debt', 'overdraft', 'lost money',
      'waste', 'overpriced', 'unexpected bill', 'fine', 'penalty', 'scam'
    ]
  },
  health: {
    keywords: [
      'gym', 'workout', 'exercise', 'run', 'running', 'walk', 'walked',
      'sleep', 'slept', 'tired', 'energy', 'sick', 'ill', 'doctor',
      'medicine', 'vitamin', 'protein', 'meal', 'ate', 'eating', 'diet',
      'weight', 'yoga', 'meditation', 'swim', 'cycling', 'bike',
      'headache', 'pain', 'stress', 'anxiety', 'therapy', 'mental health',
      'water', 'hydration', 'alcohol', 'smoking', 'steps', 'stretch',
      'recovery', 'injury', 'hospital', 'checkup', 'blood test'
    ],
    positive: [
      'gym', 'workout', 'exercise', 'ran', 'good sleep', 'slept well',
      'energetic', 'healthy meal', 'meditation', 'yoga', 'recovery',
      'feeling great', 'feeling good', 'rested', 'active', 'hydrated',
      'personal best', 'pb', 'pr'
    ],
    negative: [
      'sick', 'ill', 'tired', 'exhausted', 'insomnia', 'no sleep',
      'bad sleep', 'pain', 'headache', 'hangover', 'skipped gym',
      'junk food', 'fast food', 'stressed', 'burned out', 'burnout',
      'anxiety', 'depressed', 'injury', 'injured'
    ]
  },
  career: {
    keywords: [
      'meeting', 'meetings', 'work', 'project', 'deadline', 'client',
      'presentation', 'email', 'call', 'conference', 'pitch', 'proposal',
      'launch', 'shipped', 'deploy', 'code', 'design', 'review',
      'feedback', 'promotion', 'fired', 'hire', 'hired', 'interview',
      'contract', 'deal', 'partner', 'startup', 'business', 'company',
      'learning', 'course', 'book', 'reading', 'study', 'certification',
      'mentor', 'networking event', 'workshop', 'webinar',
      'productivity', 'focus', 'deep work', 'delivered'
    ],
    positive: [
      'shipped', 'launched', 'delivered', 'promotion', 'closed deal',
      'new client', 'great meeting', 'productive', 'deep work', 'focus',
      'learned', 'certification', 'finished', 'completed', 'milestone',
      'positive feedback', 'good review', 'hired'
    ],
    negative: [
      'fired', 'laid off', 'rejected', 'failed', 'missed deadline',
      'bad meeting', 'unproductive', 'procrastinated', 'stuck',
      'conflict', 'burnout', 'overwhelmed', 'lost client', 'cancelled'
    ]
  },
  social: {
    keywords: [
      'friends', 'friend', 'dinner out', 'drinks', 'bar', 'party',
      'hangout', 'hung out', 'met up', 'coffee with', 'lunch with',
      'beers', 'networking', 'community', 'club', 'event', 'concert',
      'movie', 'game night', 'call with', 'caught up', 'reunion',
      'neighbors', 'colleagues', 'team dinner', 'birthday party',
      'wedding', 'celebration', 'volunteering', 'group', 'tribe'
    ],
    positive: [
      'great time', 'fun night', 'good conversation', 'reconnected',
      'new friend', 'met someone', 'amazing dinner', 'laughed',
      'deep conversation', 'community', 'volunteered', 'helped'
    ],
    negative: [
      'lonely', 'alone', 'cancelled plans', 'ghosted', 'argument',
      'fight with friend', 'toxic', 'drained', 'no one', 'isolated',
      'stood up', 'boring', 'awkward'
    ]
  },
  family: {
    keywords: [
      'wife', 'husband', 'spouse', 'partner', 'kids', 'children', 'son',
      'daughter', 'baby', 'toddler', 'family', 'homework',
      'bedtime', 'school', 'parent', 'parenting', 'mom', 'dad',
      'mother', 'father', 'brother', 'sister', 'family dinner',
      'family time', 'date night', 'marriage', 'anniversary',
      'pregnant', 'pregnancy', 'nursery', 'pediatrician', 'diaper',
      'playground', 'soccer practice', 'recital', 'report card'
    ],
    positive: [
      'family dinner', 'date night', 'played with kids', 'homework together',
      'quality time', 'family walk', 'anniversary', 'bedtime story',
      'kids laughing', 'proud moment', 'family movie', 'cooked together',
      'good talk with wife', 'good talk with husband'
    ],
    negative: [
      'argument with wife', 'argument with husband', 'fight at home',
      'kids sick', 'missed recital', 'too busy for family', 'guilt',
      'no time for kids', 'divorce', 'separation', 'custody'
    ]
  }
};

/**
 * Parse a conversation message and extract dimension entries.
 * Returns array of { dimension, score, rawText, metadata }
 */
function parseConversation(text) {
  if (!text || typeof text !== 'string') return [];

  const lower = text.toLowerCase();
  const entries = [];
  const detected = {};

  // Detect which dimensions are present
  for (const [dimension, config] of Object.entries(DIMENSIONS)) {
    let relevance = 0;
    let sentiment = 0;
    const matchedKeywords = [];

    // Check keywords (deduplicated to avoid double-counting)
    const uniqueKeywords = [...new Set(config.keywords)];
    for (const keyword of uniqueKeywords) {
      if (lower.includes(keyword)) {
        relevance++;
        matchedKeywords.push(keyword);
      }
    }

    // Check positive signals
    for (const pos of config.positive) {
      if (lower.includes(pos)) sentiment++;
    }

    // Check negative signals
    for (const neg of config.negative) {
      if (lower.includes(neg)) sentiment--;
    }

    if (relevance >= 2 || (relevance === 1 && sentiment !== 0)) {
      detected[dimension] = { relevance, sentiment, matchedKeywords };
    }
  }

  // Convert detections to scored entries
  for (const [dimension, data] of Object.entries(detected)) {
    const score = calculateScore(data.sentiment, data.relevance);
    const amount = extractAmount(text, dimension);

    entries.push({
      dimension,
      score,
      rawText: text.substring(0, 500), // cap raw text storage
      metadata: {
        keywords: data.matchedKeywords,
        sentiment: data.sentiment,
        relevance: data.relevance,
        amount: amount
      }
    });
  }

  return entries;
}

/**
 * Calculate a 0-10 score based on sentiment and relevance.
 * 5 = neutral baseline. Above = positive, below = negative.
 */
function calculateScore(sentiment, relevance) {
  // Base score is 5 (neutral)
  let score = 5;

  // Sentiment shifts the score
  // Each positive/negative match shifts by ~0.8, capped
  score += sentiment * 0.8;

  // Relevance boosts confidence but doesn't change direction
  // More keywords = more confident in the signal
  if (relevance >= 3) score += Math.sign(sentiment) * 0.3;

  // Clamp to 0-10
  return Math.round(Math.max(0, Math.min(10, score)) * 10) / 10;
}

/**
 * Extract monetary amounts from text.
 * Returns { value, currency } or null.
 */
function extractAmount(text, dimension) {
  if (dimension !== 'finance') return null;

  // Match patterns like: $450, 450$, 200 EUR, €50, 1,200.50
  const patterns = [
    /\$\s?([\d,]+\.?\d*)/g,
    /€\s?([\d,]+\.?\d*)/g,
    /£\s?([\d,]+\.?\d*)/g,
    /([\d,]+\.?\d*)\s*(?:usd|eur|ron|gbp|dollars?|euros?|lei)/gi,
    /(?:spent|paid|cost|bought|earned|saved|received)\s+\$?([\d,]+\.?\d*)/gi
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match) {
      const value = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(value) && value > 0) {
        const currency = detectCurrency(text);
        return { value, currency };
      }
    }
  }
  return null;
}

/**
 * Detect currency from text.
 * Returns ISO 4217 code. Returns null if no currency detected (caller uses base currency).
 */
function detectCurrency(text) {
  const lower = text.toLowerCase();
  if (lower.includes('ron') || lower.includes('lei')) return 'RON';
  if (lower.includes('€') || lower.includes('eur')) return 'EUR';
  if (lower.includes('£') || lower.includes('gbp')) return 'GBP';
  if (lower.includes('chf') || lower.includes('francs')) return 'CHF';
  if (lower.includes('pln') || lower.includes('zloty')) return 'PLN';
  if (lower.includes('czk') || lower.includes('koruna')) return 'CZK';
  if (lower.includes('huf') || lower.includes('forint')) return 'HUF';
  if (lower.includes('sek') || lower.includes('krona')) return 'SEK';
  if (lower.includes('nok') || lower.includes('krone')) return 'NOK';
  if (lower.includes('jpy') || lower.includes('yen') || lower.includes('¥')) return 'JPY';
  if (lower.includes('cny') || lower.includes('yuan')) return 'CNY';
  if (lower.includes('inr') || lower.includes('rupee') || lower.includes('₹')) return 'INR';
  if (lower.includes('aud')) return 'AUD';
  if (lower.includes('cad')) return 'CAD';
  if (lower.includes('$') || lower.includes('usd') || lower.includes('dollar')) return 'USD';
  return null; // no currency detected — caller will use user's base currency
}

/**
 * Check if text contains family-related content.
 * Used for auto-activation of Family dimension.
 */
function hasFamilyContext(text) {
  const lower = text.toLowerCase();
  return DIMENSIONS.family.keywords.some(kw => lower.includes(kw));
}

/**
 * Get all available dimensions based on historical data.
 * Family only appears if user has mentioned family context.
 */
function getActiveDimensions(db) {
  const allActive = db.getActiveDimensions();
  // Core 4 always present, family only if detected
  const core = ['finance', 'health', 'career', 'social'];
  if (allActive.includes('family')) core.push('family');
  return core;
}

module.exports = {
  parseConversation,
  hasFamilyContext,
  getActiveDimensions,
  DIMENSIONS
};
