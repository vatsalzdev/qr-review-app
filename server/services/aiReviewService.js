/**
 * AI-powered review generation service — Phase 1.6 Anti-Hallucination Hardening.
 * Supports Gemini API (via GEMINI_API_KEY / GOOGLE_API_KEY) and OpenAI API (via OPENAI_API_KEY).
 *
 * Implements strict grounding against unsupported experience claims:
 * - General sentiment derived from the rating is permitted.
 * - Concrete experience claims (staff behavior, food/drink, speed, cleanliness, atmosphere,
 *   equipment, prices) are strictly prohibited UNLESS explicitly provided by trusted aiContext.
 * - Business type is contextual vocabulary only, not evidence of specific facts.
 *
 * Retry & Fallback policy:
 * - Attempt 0: Initial generation with explicit grounding contract.
 * - Attempt 1: Single retry with corrective prompt if validation fails.
 * - Attempt 2: Deterministic, 100% grounded fallback templates.
 * - Max retries = 1 (no infinite loops).
 */

import { getBusinessBySlug } from '../db/mongo.js';

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getTypeDescriptor(type = '') {
  const t = String(type || '').toLowerCase().trim().replace(/_/g, ' ');
  if (t.includes('cafe') || t.includes('coffee')) return 'cafe';
  if (t.includes('waffle')) return 'waffle shop';
  if (t.includes('restaurant') || t.includes('dining') || t.includes('food')) return 'restaurant';
  if (t.includes('gaming') || t.includes('arcade')) return 'gaming zone';
  if (t.includes('salon') || t.includes('barber') || t.includes('spa')) return 'salon';
  if (t.includes('bar') || t.includes('pub') || t.includes('club') || t.includes('lounge')) return 'venue';
  if (t.includes('gym') || t.includes('fitness')) return 'gym';
  if (t.includes('hotel') || t.includes('resort')) return 'hotel';
  if (t.includes('pool') || t.includes('swim')) return 'facility';
  if (t.includes('optical')) return 'optical store';
  if (t.includes('gift')) return 'gift shop';
  if (t.includes('retail') || t.includes('store') || t.includes('shop') || t.includes('mart') || t.includes('grocery')) return 'store';
  if (t.includes('real estate')) return 'agency';
  return 'place';
}

/**
 * 100% Grounded, human-natural, rating-aware fallback review templates.
 * When aiContext is empty, these express genuine customer sentiment derived from the rating
 * WITHOUT asserting unprovided concrete claims (no unverified claims about staff, food,
 * cleanliness, speed, atmosphere, equipment, or prices).
 *
 * Every template:
 * - is between 15 and 35 words
 * - expresses grounded sentiment
 * - contains no unsupported factual claims
 * - strictly matches the rating tone
 * - strictly passes quality validation
 */
export const FALLBACK_TEMPLATES = {
  5: [
    (name, desc) => `Really enjoyed my visit to ${name}. Everything went smoothly, and I would definitely come back again.`,
    (name, desc) => `Had a wonderful time at ${name} today. Everything exceeded expectations and made for a truly great experience.`,
    (name, desc) => `Honestly one of the better visits I've had in a while. ${name} was great and I will definitely be back.`,
    (name, desc) => `Really happy with our stop at ${name}. Everything was handled nicely and we had a great time overall.`,
    (name, desc) => `Stopped by ${name} and had a fantastic visit. It was a great experience and I will happily return soon.`,
    (name, desc) => `Everything felt great during our visit to ${name}. Just a really solid experience overall, worth every star.`,
    (name, desc) => `Glad we decided to check out ${name}. It was an enjoyable visit from beginning to end and I'd recommend dropping by.`,
    (name, desc) => `Such a great visit to this ${desc}. ${name} really impressed me and I look forward to coming back again.`,
    (name, desc) => `Had a really good experience at ${name}. Everything went well and I'd gladly come back another time.`,
    (name, desc) => `Very pleased with my time at ${name} today. It turned out to be a wonderful visit and I'd definitely return.`
  ],
  4: [
    (name, desc) => `Really enjoyed the visit to ${name} overall. Everything felt pretty smooth, and I'd be happy to come back.`,
    (name, desc) => `Pretty solid experience at ${name}. Things went well overall, with just a couple of small details that could be polished.`,
    (name, desc) => `Good visit to ${name} today. Left with a positive impression, with only minor things that could be improved.`,
    (name, desc) => `Had a nice time at ${name}. It was a dependable and enjoyable experience overall, and I would gladly stop by again.`,
    (name, desc) => `Quite satisfied with our stop at ${name}. Things went smoothly overall and I had a pleasant time during the visit.`,
    (name, desc) => `Everything was well handled during my time at ${name}. It was an enjoyable visit, leaving just a little room to polish things up.`,
    (name, desc) => `Pleasant stop by this ${desc}. ${name} provided a good experience, with just minor room for small improvements.`,
    (name, desc) => `Overall a very good visit to ${name}. We had a good time and I would definitely consider coming back.`,
    (name, desc) => `Enjoyed visiting ${name}. Things went relatively smoothly throughout, making it a good spot to stop by.`,
    (name, desc) => `Positive experience at ${name} on this visit. Most things went well, with just a few small areas that could be even better.`
  ],
  3: [
    (name, desc) => `It was a decent experience at ${name} overall. Some parts were good, although there is still room to improve.`,
    (name, desc) => `Pretty average visit to ${name}. It met basic expectations, but the overall experience felt middle of the road.`,
    (name, desc) => `Mixed impressions after stopping by ${name}. It wasn't bad, but a few areas could definitely use closer attention.`,
    (name, desc) => `${name} was okay for a quick visit. It worked out fine, though nothing really stood out to make it memorable.`,
    (name, desc) => `Decent spot overall, but my time at ${name} had its ups and downs. A few things could be handled better.`,
    (name, desc) => `Fairly standard experience at ${name}. It was an acceptable stop, but improving consistency would make for a much better visit.`,
    (name, desc) => `An okay visit to ${name} today. Parts of it went smoothly, but other details felt a little overlooked.`,
    (name, desc) => `A middle-of-the-road visit to this ${desc}. ${name} has potential, but the overall execution was just average this time around.`
  ],
  2: [
    (name, desc) => `It was an okay visit to ${name}, but a few things could have been better. The overall experience felt a bit inconsistent.`,
    (name, desc) => `Left ${name} feeling a little underwhelmed today. The visit fell short of what I anticipated and needs some work.`,
    (name, desc) => `A few noticeable issues made the visit to ${name} disappointing. With better attention to consistency, it could be improved.`,
    (name, desc) => `Expected a bit more from ${name} on this visit. The place has promise, but several basics were missed today.`,
    (name, desc) => `The visit to ${name} fell below what I hoped for. Things felt a bit off and the experience could definitely be better.`,
    (name, desc) => `Somewhat disappointing time at ${name}. While parts were okay, the lack of consistency made it hard to fully enjoy the visit.`,
    (name, desc) => `Not quite what I was hoping for from this ${desc}. ${name} has areas that clearly need closer attention and improvement.`,
    (name, desc) => `Felt that ${name} missed the mark on this occasion. The visit did not go as well as expected and needs improvement.`
  ],
  1: [
    (name, desc) => `The experience at ${name} fell short of what I expected. A few things could definitely be improved around the overall visit.`,
    (name, desc) => `Disappointing visit to ${name} today. Things felt quite disorganized and basic expectations were not met during our time here.`,
    (name, desc) => `Had a frustrating visit to ${name}. Several issues came up and there was little attention given to handling them properly.`,
    (name, desc) => `${name} really did not meet expectations this time. Better consistency and more care are definitely needed moving forward.`,
    (name, desc) => `Felt let down by the visit to ${name}. Basic standards were missed and the overall experience felt neglected today.`,
    (name, desc) => `Things did not go well during our stop at ${name}. Hope management takes time to address the issues from this visit.`,
    (name, desc) => `Quite dissatisfied with how things went at ${name}. The setup has potential, but the overall experience was far from acceptable.`,
    (name, desc) => `Unfortunately, our visit to this ${desc} was not good. ${name} had noticeable problems that left a poor impression overall.`
  ]
};

export function generateFallbackReview({ businessName = 'this business', rating = 5, businessType = '', type = '', aiContext = '' }) {
  const cleanName = (businessName || 'this business').trim();
  const validRating = Math.max(1, Math.min(5, Math.round(Number(rating)) || 5));
  const pool = FALLBACK_TEMPLATES[validRating] || FALLBACK_TEMPLATES[5];
  const desc = getTypeDescriptor(businessType || type);
  const randomIndex = Math.floor(Math.random() * pool.length);
  return pool[randomIndex](cleanName, desc);
}

/**
 * Validation regex patterns.
 */
const BANNED_OPENINGS = [
  /^(?:i\s+)?had a (?:great|wonderful|good|fantastic|pleasant|nice) experience at\b/i,
  /^my experience (?:at|with)\b/i,
  /^(?:i\s+)?(?:highly|definitely)\s+recommend\b/i,
  /^overall,?\s+(?:i\s+had|it\s+was|my\s+experience|i\s+would)\b/i,
  /^the staff was\b/i,
  /^(?:i\s+)?absolutely loved\b/i
];

const CORPORATE_AI_CLICHES = [
  /\bgenuine care and professionalism\b/i,
  /\bmeaningful difference\b/i,
  /\bfrom start to finish\b/i,
  /\bworth returning to\b/i,
  /\bthoroughly enjoyable\b/i,
  /\btop-notch\b/i,
  /\bexceptionally welcoming\b/i,
  /\bI will happily be coming back\b/i
];

const META_COMMENTARY_PATTERNS = [
  /\bas an ai\b/i,
  /\bai language model\b/i,
  /\bi am an ai\b/i,
  /\bgenerated by\b/i,
  /\bhere (?:is|'s) (?:a|the|your)\b/i,
  /\bsure! here\b/i,
  /\bhope this helps\b/i,
  /\b(?:customer\s+)?review:\s*$/im,
  /^review:\s+/i,
  /\bmeta(?:-|\s+)?(?:commentary|instruction|text)\b/i,
  /\b(?:system\s+prompt|per (?:the|your) prompt)\b/i
];

const MARKDOWN_PATTERNS = [
  /\*\*|__/,
  /(?:^|[^\w])\*(?!\s)[^*]+(?<!\s)\*(?:[^\w]|$)/,
  /`/,
  /^#+\s/m,
  /^\s*[-*+]\s/m,
  /^\s*\d+\.\s/m,
  /\[.*?\]\(.*?\)/,
  /<\/?[a-z][\s\S]*>/i
];

const FABRICATED_DETAIL_PATTERNS = [
  /(?:\$|₹|€|£)\s*\d+|\b\d+\s*(?:dollars|bucks|rupees|cents|usd|inr|eur)\b/i,
  /\b(?:waited|waiting|wait)\s+(?:for\s+)?(?:about\s+|around\s+)?\d+\s*(?:minutes|mins|hours|hrs)\b/i,
  /\b(?:[Ww]aiter|[Ww]aitress|[Cc]ashier|[Mm]anager|[Bb]artender|[Ss]tylist|[Ss]erver)\s+[A-Z][a-z]+\b/,
  /\b[Ss]houtout to [A-Z][a-z]+\b/,
  /\b(?:on my birthday|for our anniversary|last tuesday|yesterday morning)\b/i
];

const PROFANITY_PATTERN = /\b(?:fuck|shit|bitch|asshole|bastard|crap)\b/i;

const KNOWN_TYPE_DESCRIPTORS = [
  'waffle shop',
  'coffee shop',
  'gaming zone',
  'optical store',
  'gift shop',
  'grocery store',
  'cocktail bar',
  'hair salon',
  'restaurant',
  'cafe',
  'salon',
  'venue',
  'gym',
  'hotel',
  'store',
  'shop',
  'bar',
  'club'
];

/**
 * Checks for unsupported experience claims in reviewText against trusted context.
 * Returns { isGrounded: boolean, reason: string | null }
 */
export function checkGrounding(reviewText, aiContext = '', businessName = '', businessType = '') {
  let text = String(reviewText || '').toLowerCase();
  const context = String(aiContext || '').toLowerCase();

  // Strip businessName and its individual word tokens (>= 3 chars) to avoid false positives
  // (e.g. "Arcade Arena", "The Bistro Table", "Demo Waffle Shop", "BFF Cold Coffee")
  if (businessName && businessName.trim()) {
    const escapedName = businessName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text.replace(new RegExp(escapedName, 'gi'), ' ');
    const tokens = businessName.trim().split(/\s+/).filter(t => t.length >= 3);
    for (const token of tokens) {
      const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      text = text.replace(new RegExp(`\\b${escapedToken}\\b`, 'gi'), ' ');
    }
  }

  // Strip known venue type descriptors to allow natural framing (e.g. "visit to this waffle shop")
  for (const desc of KNOWN_TYPE_DESCRIPTORS) {
    const escapedDesc = desc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text.replace(new RegExp(`\\b${escapedDesc}\\b`, 'gi'), ' ');
  }

  if (businessType && businessType.trim()) {
    const escapedType = businessType.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text.replace(new RegExp(`\\b${escapedType}\\b`, 'gi'), ' ');
  }

  // 1. Food / Drink / Menu / Product specifics
  const foodKeywords = /\b(?:food|dish|dishes|meal|meals|menu|produce|tasty|delicious|crispy|flavorful|flavourful|coffee|waffle|waffles|burger|burgers|pastries|pastry|cocktails?|drinks?|entrees?|desserts?|appetizers?|haircut|styling)\b/i;
  if (foodKeywords.test(text)) {
    const hasFoodContext = /\b(?:food|dish|dishes|meal|menu|produce|fresh|tasty|delicious|coffee|waffle|waffles|burger|burgers|pastr|cocktail|drink|brunch|dining|haircut|styling|hair)\b/i.test(context);
    if (!hasFoodContext) {
      return { isGrounded: false, reason: 'Mentions food, drinks, or product specifics not in trusted context' };
    }
  }

  // 2. Staff / People claims (e.g. staff was friendly, friendly team, welcoming staff, polite servers)
  const staffKeywords = /\b(?:staff|team|crew|waiter|waitress|servers?|cashiers?|employees?|bartenders?|stylist)\b/i;
  const staffAttributions = /\b(?:friendly|helpful|attentive|welcoming|polite|rude|courteous|unhelpful)\b/i;
  if (staffKeywords.test(text) || staffAttributions.test(text)) {
    const hasStaffContext = /\b(?:staff|team|crew|people|friendly|welcoming|helpful|attentive|polite|courteous|host|stylist|bartender)\b/i.test(context);
    if (!hasStaffContext) {
      return { isGrounded: false, reason: 'Claims staff behavior or people traits not in trusted context' };
    }
  }

  // 3. Atmosphere / Ambience / Vibe claims (e.g. atmosphere was lively, relaxed vibe, chill ambience)
  const atmosphereKeywords = /\b(?:atmosphere|ambience|vibe|decor|music)\b/i;
  const atmosphereTraits = /\b(?:lively|peaceful|cozy|chill|noisy|loud)\b/i;
  if (atmosphereKeywords.test(text) || atmosphereTraits.test(text)) {
    const hasAtmosphereContext = /\b(?:atmosphere|ambience|vibe|decor|music|relaxed|relaxing|casual|lively|peaceful|cozy|chill)\b/i.test(context);
    if (!hasAtmosphereContext) {
      return { isGrounded: false, reason: 'Claims specific atmosphere or vibe not in trusted context' };
    }
  }

  // 4. Cleanliness / Hygiene claims (e.g. clean, spotless, hygienic, dirty, tidy)
  const cleanlinessKeywords = /\b(?:clean|cleanliness|spotless|hygienic|dirty|tidy|messy|unclean)\b/i;
  if (cleanlinessKeywords.test(text)) {
    const hasCleanlinessContext = /\b(?:clean|cleanliness|spotless|hygienic|tidy)\b/i.test(context);
    if (!hasCleanlinessContext) {
      return { isGrounded: false, reason: 'Claims cleanliness or hygiene not in trusted context' };
    }
  }

  // 5. Speed / Wait times / Service quality (e.g. fast service, service was fast, quick checkout, slow service)
  const speedKeywords = /\b(?:fast|quick|speedy|slow|delayed|immediate|prompt)\s+(?:service|checkout|delivery|pace|response|food)\b/i;
  const servicePredicates = /\bservice\s+(?:was|is|felt)\s+(?:fast|quick|speedy|slow|delayed|prompt|friendly|attentive|great|poor|good|bad)\b/i;
  const waitKeywords = /\b(?:arrived|brought|served)\s+(?:quickly|fast|slowly|immediately)\b/i;
  if (speedKeywords.test(text) || servicePredicates.test(text) || waitKeywords.test(text)) {
    const hasSpeedContext = /\b(?:service|quick|fast|speed|slow|prompt|checkout|immediate)\b/i.test(context);
    if (!hasSpeedContext) {
      return { isGrounded: false, reason: 'Claims service speed or wait times not in trusted context' };
    }
  }

  // 6. Equipment / Facilities / Games / Furniture
  const equipmentKeywords = /\b(?:equipment|machines?|games?|arcade|seating|chairs?|tables?|facilities|pool|amenities)\b/i;
  if (equipmentKeywords.test(text)) {
    const hasEquipmentContext = /\b(?:equipment|machine|game|games|arcade|seat|chair|table|facility|facilities|pool|amenit)\b/i.test(context);
    if (!hasEquipmentContext) {
      return { isGrounded: false, reason: 'Claims equipment, games, or facilities not in trusted context' };
    }
  }

  // 7. Price / Value
  const priceKeywords = /\b(?:affordable|expensive|overpriced|cheap|worth every penny|good value|great value|cost a lot)\b/i;
  const pricePhrases = /\bprices?\s+(?:were|are|was)\s+(?:fair|reasonable|high|low|great|good|bad)\b/i;
  if (priceKeywords.test(text) || pricePhrases.test(text)) {
    const hasPriceContext = /\b(?:price|prices|affordable|cheap|value|cost)\b/i.test(context);
    if (!hasPriceContext) {
      return { isGrounded: false, reason: 'Claims pricing or value not in trusted context' };
    }
  }

  return { isGrounded: true, reason: null };
}

/**
 * Server-side Quality & Grounding Validation for generated customer reviews.
 * Returns { isValid: boolean, reason: string | null }
 */
export function validateReview(reviewText, { rating = 5, businessName = '', businessType = '', aiContext = '' } = {}) {
  if (!reviewText || typeof reviewText !== 'string' || !reviewText.trim()) {
    return { isValid: false, reason: 'Review is empty or not a string' };
  }

  const rawTrimmed = reviewText.trim();

  // Quotation marks wrapping
  if (/^["'“‘].*["'”’]$/.test(rawTrimmed)) {
    return { isValid: false, reason: 'Review is wrapped in quotation marks' };
  }

  // Markdown or HTML
  for (const pattern of MARKDOWN_PATTERNS) {
    if (pattern.test(rawTrimmed)) {
      return { isValid: false, reason: 'Contains markdown, HTML, or code formatting' };
    }
  }

  // AI / Meta commentary
  for (const pattern of META_COMMENTARY_PATTERNS) {
    if (pattern.test(rawTrimmed)) {
      return { isValid: false, reason: 'Contains AI or meta commentary' };
    }
  }

  // Profanity
  if (PROFANITY_PATTERN.test(rawTrimmed)) {
    return { isValid: false, reason: 'Contains profane or hostile language' };
  }

  // Fabricated details
  for (const pattern of FABRICATED_DETAIL_PATTERNS) {
    if (pattern.test(rawTrimmed)) {
      return { isValid: false, reason: 'Contains prohibited fabricated details (price, wait time, employee name, event)' };
    }
  }

  // Terminal punctuation & sentence completeness
  if (!/[.!?]$/.test(rawTrimmed)) {
    return { isValid: false, reason: 'Review is incomplete (missing terminal punctuation)' };
  }
  if (/\.\.\.$|--$/.test(rawTrimmed)) {
    return { isValid: false, reason: 'Review ends with incomplete ellipsis or trailing dash' };
  }
  if (/\b(?:and|but|or|so|because|with|the|a|an)\s*[.!?]$/i.test(rawTrimmed)) {
    return { isValid: false, reason: 'Review ends on a hanging conjunction or preposition' };
  }

  // Word count check (Target: generally around 15–40 words; allow 12–55 safely)
  const words = rawTrimmed.split(/\s+/).filter(Boolean);
  if (words.length < 12) {
    return { isValid: false, reason: `Review is too short (${words.length} words; minimum is 12)` };
  }
  if (words.length > 55) {
    return { isValid: false, reason: `Review is too long (${words.length} words; maximum is 55)` };
  }

  // Sentence count & substance check:
  // Allows 1 complete, substantive sentence (>= 14 words) or multiple natural sentences.
  // Rejects tiny fragments (< 14 words for single sentence).
  const sentences = rawTrimmed.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
  if (sentences.length === 1 && words.length < 14) {
    return { isValid: false, reason: 'Review lacks substance (single sentence must have at least 14 words)' };
  }

  // Banned repetitive boilerplate openings
  for (const pattern of BANNED_OPENINGS) {
    if (pattern.test(rawTrimmed)) {
      return { isValid: false, reason: 'Starts with repetitive boilerplate opening' };
    }
  }

  // Corporate AI cliché check
  for (const pattern of CORPORATE_AI_CLICHES) {
    if (pattern.test(rawTrimmed)) {
      return { isValid: false, reason: 'Contains corporate AI marketing clichés' };
    }
  }

  // Rating semantic correspondence
  const r = Math.max(1, Math.min(5, Math.round(Number(rating)) || 5));
  if (r === 1) {
    if (/\b(?:exceptional|outstanding|fantastic|amazing|loved it|love this place|highly recommend|perfect|perfection|flawless|5 stars|five stars)\b/i.test(rawTrimmed)) {
      return { isValid: false, reason: '1-star review contains overly positive praise' };
    }
    if (/\b(?:scam|fraud|thieves|sue\b|lawsuit|disgusting filth|poisoned?)\b/i.test(rawTrimmed)) {
      return { isValid: false, reason: '1-star review contains hostile, abusive, or defamatory accusations' };
    }
  } else if (r === 2) {
    if (/\b(?:exceptional|outstanding|fantastic|amazing|perfection|flawless|loved everything)\b/i.test(rawTrimmed)) {
      return { isValid: false, reason: '2-star review contains glowing 5-star praise' };
    }
    if (/\b(?:scam|fraud|thieves|disgusting filth|poisoned?)\b/i.test(rawTrimmed)) {
      return { isValid: false, reason: '2-star review contains hostile language' };
    }
  } else if (r >= 4) {
    if (/\b(?:terrible|horrible|disaster|awful|worst|unacceptable|substandard|waste of time)\b/i.test(rawTrimmed)) {
      return { isValid: false, reason: 'High-star review contains overly negative criticism' };
    }
  }

  // Anti-Hallucination & Experience Grounding check against trusted context
  const groundingResult = checkGrounding(rawTrimmed, aiContext, businessName, businessType);
  if (!groundingResult.isGrounded) {
    return { isValid: false, reason: groundingResult.reason };
  }

  return { isValid: true, reason: null };
}

/**
 * Builds the AI generation prompt with explicit grounding contract.
 * Enforces that concrete experience details require trusted business context.
 */
export function buildPrompt({
  businessName = '',
  rating = 5,
  businessType = '',
  aiContext = '',
  isRetry = false,
  failureReason = ''
} = {}) {
  const name = businessName || 'this business';
  const r = Math.max(1, Math.min(5, Math.round(Number(rating)) || 5));
  const desc = getTypeDescriptor(businessType);

  const TONE_MAP = {
    1: 'Genuinely dissatisfied, calm, and constructive. Clearly communicates that the experience fell short. Respectful, factual, and completely non-hostile. No insults, profanity, or defamatory claims.',
    2: 'Disappointed but respectful and mildly critical. Mentions that a few things could have been better while keeping a conversational, polite tone.',
    3: 'Genuinely mixed and neutral. An ordinary middle-of-the-road review noting both good aspects and room to improve.',
    4: 'Clearly positive, restrained, and believable. Sounds satisfied without sounding like an advertisement.',
    5: 'Clearly happy with natural enthusiasm. Genuine customer satisfaction without sounding promotional or like marketing copy.'
  };

  const hasContext = Boolean(aiContext && aiContext.trim());
  const contextDirective = hasContext
    ? `TRUSTED BUSINESS CONTEXT (Only these details may be mentioned as facts):\n"${aiContext.trim()}"\nYou may naturally incorporate and paraphrase these trusted details. Do NOT invent any facts outside this context.`
    : `NO TRUSTED BUSINESS CONTEXT PROVIDED:\nYou MUST express the customer's general sentiment from the rating only. Do NOT invent or assume any specific experiences.`;

  const retryDirective = isRetry
    ? `\nCRITICAL RETRY CORRECTION: Your previous output failed validation (${failureReason || 'introduced unsupported experience claims'}). You MUST strictly follow the grounding contract. ${hasContext ? 'Only reference details explicitly supported by the trusted context.' : 'Do not invent specific claims about staff, food, cleanliness, atmosphere, equipment, or speed. Express sentiment generally.'} Length: 15 to 35 words. Reflect the exact ${r}-star rating tone.\n`
    : '';

  return `You are a real customer writing an authentic, grounded Google review on your phone.
${retryDirective}
Business Name: ${name}
Business Type: ${businessType ? `${businessType} (${desc})` : desc}
Rating: ${r} out of 5 stars

${contextDirective}

Target Tone for ${r} Stars:
${TONE_MAP[r]}

STRICT GROUNDING & ANTI-HALLUCINATION CONTRACT:
1. THE RATING GIVES GENERAL SENTIMENT, NOT FACTUAL DETAILS.
   5 stars means positive sentiment; it does NOT imply fast service, friendly staff, delicious food, clean space, or lively atmosphere.
   1 star means dissatisfied sentiment; it does NOT imply rude staff, dirty space, or slow service.
2. BUSINESS TYPE IS CONTEXTUAL VOCABULARY, NOT EVIDENCE OF WHAT HAPPENED.
   A restaurant does NOT imply good food. A gaming zone does NOT imply fun games. A salon does NOT imply great haircuts.
3. CONCRETE EXPERIENCE CLAIMS REQUIRE TRUSTED CONTEXT:
   - Only mention specific customer-experience details when they are explicitly supported by trusted business context.
   - Do NOT infer or invent service quality, staff behavior, cleanliness, atmosphere, products, food quality, speed, prices, facilities, equipment, events, or other concrete experiences.
   - When trusted context is absent, use general sentiment language rather than inventing specifics (e.g., "Really enjoyed my visit", "I had a great experience overall and would definitely come back", "Things could have been better", "The visit fell short of what I expected").

CORE STYLE PRINCIPLE:
Think: REAL CUSTOMER > MARKETING COPY > AI WRITING
Write conversational, simple, believable language.
Avoid corporate or AI clichés ("from start to finish", "genuine care and professionalism", "thoroughly enjoyable", "top-notch", "meaningful difference", "worth returning to").
Do not start every review with the business name.

LENGTH & FORMAT:
- Length: 15 to 35 words total.
- Structure: 1 to 2 complete, natural sentences.
- Output ONLY the plain text of the review. No quotes, no markdown, no meta-commentary.`;
}

function cleanOutput(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/^```[a-z]*\s*/i, '')
    .replace(/```\s*$/i, '')
    .replace(/^["'“‘]+|["'”’]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function callGemini(apiKey, { businessName, rating, businessType, aiContext, isRetry = false, failureReason = '' }) {
  const prompt = buildPrompt({ businessName, rating, businessType, aiContext, isRetry, failureReason });
  const controller = new AbortController();
  const timeoutMs = isRetry ? 4000 : 5000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: isRetry ? 0.3 : 0.7,
          maxOutputTokens: 120
        }
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Gemini API error status: ${response.status}`);
    }

    const data = await response.json();
    const review = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (review) {
      return review;
    }
    throw new Error('Empty response from Gemini');
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callOpenAI(apiKey, { businessName, rating, businessType, aiContext, isRetry = false, failureReason = '' }) {
  const prompt = buildPrompt({ businessName, rating, businessType, aiContext, isRetry, failureReason });
  const controller = new AbortController();
  const timeoutMs = isRetry ? 4000 : 5000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You write concise, authentic customer reviews. Output ONLY 1-2 sentences of plain review text (15-35 words) strictly grounded in provided context with no quotes, markdown, or meta-commentary.'
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 120,
        temperature: isRetry ? 0.3 : 0.7
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error status: ${response.status}`);
    }

    const data = await response.json();
    const review = data.choices?.[0]?.message?.content?.trim();
    if (review) {
      return review;
    }
    throw new Error('Empty response from OpenAI');
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Main review generation function.
 * Orchestrates Gemini / OpenAI with server-side validation, single retry, and fallback.
 */
export async function generateReviewWithAi({
  businessName = '',
  rating = 5,
  businessType = '',
  type = '',
  aiContext = '',
  slug = '',
  _mockProvider = null,
  returnDetails = false
} = {}) {
  const startTime = performance.now();
  let aiGenerationMs = 0;
  let validationMs = 0;
  let retryCount = 0;
  let fallbackUsed = false;
  let modelUsed = 'none';

  const formatResult = (reviewText) => {
    if (!returnDetails) return reviewText;
    return {
      review: reviewText,
      metrics: {
        aiGenerationMs,
        validationMs,
        retryCount,
        fallbackUsed,
        modelUsed,
        totalMs: Math.round(performance.now() - startTime)
      }
    };
  };

  const cleanName = (businessName || '').trim() || 'this business';
  const validRating = Math.max(1, Math.min(5, Math.round(Number(rating)) || 5));
  let effectiveType = (businessType || type || '').trim();
  let effectiveContext = (aiContext || '').trim();

  // If businessType or aiContext not supplied, attempt lookup by slug or businessName
  if (!effectiveType || !effectiveContext) {
    try {
      const bizSlug = slug ? slugify(slug) : slugify(cleanName);
      if (bizSlug) {
        const found = await getBusinessBySlug(bizSlug);
        if (found) {
          if (!effectiveType && found.type) effectiveType = found.type;
          if (!effectiveContext && found.aiContext) effectiveContext = found.aiContext;
        }
      }
    } catch (_) {}
  }

  // Support test mock provider injection for deterministic testing of retry/fallback
  if (_mockProvider && typeof _mockProvider === 'function') {
    modelUsed = 'mock';
    try {
      // Attempt 0: initial
      const mockT0 = performance.now();
      const mockResult0 = await _mockProvider({
        attempt: 0,
        businessName: cleanName,
        rating: validRating,
        businessType: effectiveType,
        aiContext: effectiveContext,
        isRetry: false
      });
      aiGenerationMs += Math.round(performance.now() - mockT0);
      const cleaned0 = cleanOutput(mockResult0);
      const valT0 = performance.now();
      const validation0 = validateReview(cleaned0, {
        rating: validRating,
        businessName: cleanName,
        businessType: effectiveType,
        aiContext: effectiveContext
      });
      validationMs += Math.round(performance.now() - valT0);

      if (validation0.isValid) {
        return formatResult(cleaned0);
      }

      // Attempt 1: retry
      retryCount++;
      const mockT1 = performance.now();
      const mockResult1 = await _mockProvider({
        attempt: 1,
        businessName: cleanName,
        rating: validRating,
        businessType: effectiveType,
        aiContext: effectiveContext,
        isRetry: true,
        failureReason: validation0.reason
      });
      aiGenerationMs += Math.round(performance.now() - mockT1);
      const cleaned1 = cleanOutput(mockResult1);
      const valT1 = performance.now();
      const validation1 = validateReview(cleaned1, {
        rating: validRating,
        businessName: cleanName,
        businessType: effectiveType,
        aiContext: effectiveContext
      });
      validationMs += Math.round(performance.now() - valT1);

      if (validation1.isValid) {
        return formatResult(cleaned1);
      }
    } catch (_) {}

    fallbackUsed = true;
    return formatResult(generateFallbackReview({
      businessName: cleanName,
      rating: validRating,
      businessType: effectiveType,
      aiContext: effectiveContext
    }));
  }

  // 1. Try Gemini API
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (geminiKey) {
    modelUsed = 'gemini';
    try {
      // Attempt 0: Initial call
      const gT0 = performance.now();
      const raw0 = await callGemini(geminiKey, {
        businessName: cleanName,
        rating: validRating,
        businessType: effectiveType,
        aiContext: effectiveContext,
        isRetry: false
      });
      aiGenerationMs += Math.round(performance.now() - gT0);
      const cleaned0 = cleanOutput(raw0);
      const valT0 = performance.now();
      const validation0 = validateReview(cleaned0, {
        rating: validRating,
        businessName: cleanName,
        businessType: effectiveType,
        aiContext: effectiveContext
      });
      validationMs += Math.round(performance.now() - valT0);

      if (validation0.isValid) {
        return formatResult(cleaned0);
      }

      console.warn(`[AI Review] Gemini output failed validation (${validation0.reason}). Attempting retry...`);

      // Attempt 1: Single retry with stricter prompt
      try {
        retryCount++;
        const gT1 = performance.now();
        const raw1 = await callGemini(geminiKey, {
          businessName: cleanName,
          rating: validRating,
          businessType: effectiveType,
          aiContext: effectiveContext,
          isRetry: true,
          failureReason: validation0.reason
        });
        aiGenerationMs += Math.round(performance.now() - gT1);
        const cleaned1 = cleanOutput(raw1);
        const valT1 = performance.now();
        const validation1 = validateReview(cleaned1, {
          rating: validRating,
          businessName: cleanName,
          businessType: effectiveType,
          aiContext: effectiveContext
        });
        validationMs += Math.round(performance.now() - valT1);

        if (validation1.isValid) {
          return formatResult(cleaned1);
        }

        console.warn(`[AI Review] Gemini retry failed validation (${validation1.reason}). Falling back to template generator.`);
      } catch (retryErr) {
        console.warn('[AI Review] Gemini retry call error:', retryErr.message);
      }
    } catch (err) {
      console.warn('[AI Review] Gemini API call error:', err.message);
    }
  }

  // 2. Try OpenAI API if configured
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    modelUsed = 'openai';
    try {
      const oT0 = performance.now();
      const raw0 = await callOpenAI(openaiKey, {
        businessName: cleanName,
        rating: validRating,
        businessType: effectiveType,
        aiContext: effectiveContext,
        isRetry: false
      });
      aiGenerationMs += Math.round(performance.now() - oT0);
      const cleaned0 = cleanOutput(raw0);
      const valT0 = performance.now();
      const validation0 = validateReview(cleaned0, {
        rating: validRating,
        businessName: cleanName,
        businessType: effectiveType,
        aiContext: effectiveContext
      });
      validationMs += Math.round(performance.now() - valT0);

      if (validation0.isValid) {
        return formatResult(cleaned0);
      }

      console.warn(`[AI Review] OpenAI output failed validation (${validation0.reason}). Attempting retry...`);

      try {
        retryCount++;
        const oT1 = performance.now();
        const raw1 = await callOpenAI(openaiKey, {
          businessName: cleanName,
          rating: validRating,
          businessType: effectiveType,
          aiContext: effectiveContext,
          isRetry: true,
          failureReason: validation0.reason
        });
        aiGenerationMs += Math.round(performance.now() - oT1);
        const cleaned1 = cleanOutput(raw1);
        const valT1 = performance.now();
        const validation1 = validateReview(cleaned1, {
          rating: validRating,
          businessName: cleanName,
          businessType: effectiveType,
          aiContext: effectiveContext
        });
        validationMs += Math.round(performance.now() - valT1);

        if (validation1.isValid) {
          return formatResult(cleaned1);
        }
      } catch (retryErr) {
        console.warn('[AI Review] OpenAI retry call error:', retryErr.message);
      }
    } catch (err) {
      console.warn('[AI Review] OpenAI API call error:', err.message);
    }
  }

  // 3. Fallback: High quality deterministic rating-aware & type-aware template generator
  fallbackUsed = true;
  return formatResult(generateFallbackReview({
    businessName: cleanName,
    rating: validRating,
    businessType: effectiveType,
    aiContext: effectiveContext
  }));
}
