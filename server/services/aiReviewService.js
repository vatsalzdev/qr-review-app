/**
 * AI-powered review generation service.
 * Supports Gemini API (via GEMINI_API_KEY / GOOGLE_API_KEY) and OpenAI API (via OPENAI_API_KEY).
 * If no API key is provided, or if the external API call fails, falls back gracefully to a
 * high-quality, varied local review generator that adheres strictly to the rating tone guidelines
 * and avoids repetitive openings and fake specific facts.
 */

const FALLBACK_REVIEWS = {
  5: [
    (name) => `Really impressed by ${name}. The service was warm and attentive, and the overall quality was exceptional. Highly recommended!`,
    (name) => `Everything about our visit to ${name} was top-notch. Great atmosphere, friendly staff, and wonderful attention to detail throughout.`,
    (name) => `${name} consistently delivers excellent quality. Welcoming team and fantastic vibe from start to finish.`,
    (name) => `Outstanding experience at ${name}. The staff was incredibly helpful and made the visit memorable. Will definitely be returning!`,
    (name) => `Such a pleasant visit to ${name}. Super clean, great customer care, and wonderful overall atmosphere. Worth every star!`,
    (name) => `Top-tier experience with ${name}. Prompt service, very welcoming staff, and high standards across the board.`
  ],
  4: [
    (name) => `Pleasant visit to ${name}. The atmosphere was comfortable, and the staff was both prompt and polite throughout.`,
    (name) => `Really solid experience at ${name}. Friendly team and everything went smoothly overall. Just minor details that could be polished.`,
    (name) => `Enjoyed my time at ${name}. Good overall quality and welcoming service. Definitely a dependable spot.`,
    (name) => `Very good visit to ${name}. Staff was courteous, the space was tidy, and the overall experience was positive.`,
    (name) => `Good impression of ${name}. Welcoming customer service and nice ambience, with just a little room to improve.`,
    (name) => `${name} provided a smooth and enjoyable visit. Friendly staff and good attention to customer needs.`
  ],
  3: [
    (name) => `An average visit to ${name}. The staff was polite and parts of the experience were nice, but there is noticeable room for improvement.`,
    (name) => `Mixed feelings about ${name}. Some aspects were decent, though the overall consistency could definitely be better.`,
    (name) => `Fairly standard experience at ${name}. Met basic expectations, but didn't quite leave a lasting impression.`,
    (name) => `${name} was okay overall. Friendly service, but a few areas felt like they could use closer attention to detail.`,
    (name) => `Decent overall experience at ${name}. It wasn't bad, but a few tweaks to service and quality would go a long way.`
  ],
  2: [
    (name) => `Unfortunately, the visit to ${name} fell below expectations. Several areas need closer attention and better consistency.`,
    (name) => `Disappointing visit to ${name}. While the staff was polite, the overall quality and pace did not meet expectations.`,
    (name) => `The experience at ${name} was underwhelming. A few key things could be handled much better.`,
    (name) => `Below average experience at ${name}. Found the service and overall attention lacking compared to what was anticipated.`,
    (name) => `Expected a higher standard from ${name}. Communication and quality were both inconsistent during this visit.`
  ],
  1: [
    (name) => `Very disappointing experience at ${name}. Basic standards were not met and the service felt neglected.`,
    (name) => `Substandard visit to ${name}. Multiple issues arose and basic expectations were not satisfied.`,
    (name) => `Frustrating experience with ${name}. The quality and attention to customer service fell well short of acceptable levels.`,
    (name) => `Cannot recommend ${name} based on this visit. Significant issues with service and overall consistency.`,
    (name) => `Poor experience at ${name}. Lack of attention to detail and communication was quite disappointing.`
  ]
};

export function generateFallbackReview({ businessName = 'this place', rating = 5 }) {
  const cleanName = (businessName || 'this place').trim();
  const validRating = Math.max(1, Math.min(5, Number(rating) || 5));
  const pool = FALLBACK_REVIEWS[validRating] || FALLBACK_REVIEWS[5];
  const randomIndex = Math.floor(Math.random() * pool.length);
  return pool[randomIndex](cleanName);
}

function buildPrompt(businessName, rating) {
  return `You are writing a short, authentic Google review for a customer based ONLY on the star rating provided.

Business Name: ${businessName}
Rating: ${rating} out of 5 stars

Tone guidelines based on rating:
- 5 stars: Very positive experience. Enthusiastic and genuine.
- 4 stars: Positive experience, but slightly more restrained/natural than 5 stars.
- 3 stars: Mixed/mediocre experience. Mention both positives and areas that could be better.
- 2 stars: Mostly negative experience, but natural, polite, and non-abusive.
- 1 star: Strongly negative experience, factual, concise, and non-abusive.

STRICT REQUIREMENTS:
1. Length: 1 to 3 short, natural sentences (under 55 words total).
2. DO NOT invent fake specific facts (no specific employee names, no exact wait times, no specific dish/item names, no prices, no fabricated events). Focus on service, atmosphere, quality, or overall experience.
3. DO NOT use repetitive openings like "Had a great experience at...", "I had a wonderful experience at...", or "My experience was...". Vary sentence structure.
4. Output ONLY the raw review text. No quotes, no markdown, no emojis unless natural, no headers or explanations.`;
}

async function callGemini(apiKey, businessName, rating) {
  const prompt = buildPrompt(businessName, rating);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;
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
          temperature: 0.7,
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
      return review.replace(/^["']|["']$/g, '').trim();
    }
    throw new Error('Empty response from Gemini');
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callOpenAI(apiKey, businessName, rating) {
  const prompt = buildPrompt(businessName, rating);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You write concise, authentic customer reviews. Output ONLY the review text with no quotes or meta-commentary.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 120,
        temperature: 0.7
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error status: ${response.status}`);
    }

    const data = await response.json();
    const review = data.choices?.[0]?.message?.content?.trim();
    if (review) {
      return review.replace(/^["']|["']$/g, '').trim();
    }
    throw new Error('Empty response from OpenAI');
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function generateReviewWithAi({ businessName, rating }) {
  const cleanName = (businessName || 'this business').trim();
  const validRating = Math.max(1, Math.min(5, Math.round(Number(rating)) || 5));

  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (geminiKey) {
    try {
      const aiReview = await callGemini(geminiKey, cleanName, validRating);
      if (aiReview) return aiReview;
    } catch (err) {
      console.warn('Gemini API call failed, using fallback generator:', err.message);
    }
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    try {
      const aiReview = await callOpenAI(openaiKey, cleanName, validRating);
      if (aiReview) return aiReview;
    } catch (err) {
      console.warn('OpenAI API call failed, using fallback generator:', err.message);
    }
  }

  return generateFallbackReview({ businessName: cleanName, rating: validRating });
}
