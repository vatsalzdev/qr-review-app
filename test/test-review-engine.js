import assert from 'node:assert/strict';
import {
  validateReview,
  checkGrounding,
  buildPrompt,
  generateFallbackReview,
  generateReviewWithAi,
  getTypeDescriptor,
  FALLBACK_TEMPLATES
} from '../server/services/aiReviewService.js';

console.log('🧪 Running Test Suite for AI Review Engine (Phase 1.6 Anti-Hallucination Hardening)...\n');

// --------------------------------------------------------------------------
// 1. Test 1-Star Generation
// --------------------------------------------------------------------------
console.log('1. Testing 1-Star Generation (Constructive, calm, indicates areas needing improvement)...');
for (let i = 0; i < 10; i++) {
  const review = generateFallbackReview({ businessName: 'Royal Cafe', rating: 1, businessType: 'cafe' });
  const validation = validateReview(review, { rating: 1, businessName: 'Royal Cafe' });
  assert.equal(validation.isValid, true, `1-star fallback review failed validation: ${validation.reason} -> "${review}"`);
  assert(review.includes('Royal Cafe'), 'Must include business name');
  // Must NOT contain glowing 5-star praise
  assert(!/\b(?:exceptional|outstanding|fantastic|amazing|highly recommend|perfect)\b/i.test(review));
  // Must NOT be abusive or hostile
  assert(!/\b(?:scam|fraud|thieves|sue|disgusting filth)\b/i.test(review));
}
console.log('  ✓ 1-star reviews are constructive, calm, and pass quality validation');

// --------------------------------------------------------------------------
// 2. Test 2-Star Generation
// --------------------------------------------------------------------------
console.log('\n2. Testing 2-Star Generation (Mildly critical but respectful)...');
for (let i = 0; i < 10; i++) {
  const review = generateFallbackReview({ businessName: 'Arcade Arena', rating: 2, businessType: 'gaming zone' });
  const validation = validateReview(review, { rating: 2, businessName: 'Arcade Arena' });
  assert.equal(validation.isValid, true, `2-star fallback review failed validation: ${validation.reason} -> "${review}"`);
  assert(review.includes('Arcade Arena'));
  assert(!/\b(?:exceptional|outstanding|fantastic|perfection)\b/i.test(review));
}
console.log('  ✓ 2-star reviews are mildly critical, respectful, and pass quality validation');

// --------------------------------------------------------------------------
// 3. Test 3-Star Generation
// --------------------------------------------------------------------------
console.log('\n3. Testing 3-Star Generation (Balanced, neutral)...');
for (let i = 0; i < 10; i++) {
  const review = generateFallbackReview({ businessName: 'Demo Waffle Shop', rating: 3, businessType: 'waffle shop' });
  const validation = validateReview(review, { rating: 3, businessName: 'Demo Waffle Shop' });
  assert.equal(validation.isValid, true, `3-star fallback review failed validation: ${validation.reason} -> "${review}"`);
  assert(review.includes('Demo Waffle Shop'));
  assert(!/\b(?:terrible|horrible|disaster)\b/i.test(review));
}
console.log('  ✓ 3-star reviews are balanced and neutral');

// --------------------------------------------------------------------------
// 4. Test 4-Star Generation
// --------------------------------------------------------------------------
console.log('\n4. Testing 4-Star Generation (Clearly positive, restrained)...');
for (let i = 0; i < 10; i++) {
  const review = generateFallbackReview({ businessName: 'Glow Studio', rating: 4, businessType: 'salon' });
  const validation = validateReview(review, { rating: 4, businessName: 'Glow Studio' });
  assert.equal(validation.isValid, true, `4-star fallback review failed validation: ${validation.reason} -> "${review}"`);
  assert(review.includes('Glow Studio'));
  assert(!/\b(?:terrible|horrible|disaster|awful)\b/i.test(review));
}
console.log('  ✓ 4-star reviews are clearly positive, restrained, and natural');

// --------------------------------------------------------------------------
// 5. Test 5-Star Generation
// --------------------------------------------------------------------------
console.log('\n5. Testing 5-Star Generation (Clearly positive, enthusiastic, non-promotional)...');
for (let i = 0; i < 10; i++) {
  const review = generateFallbackReview({ businessName: 'Grand Hotel', rating: 5, businessType: 'hotel' });
  const validation = validateReview(review, { rating: 5, businessName: 'Grand Hotel' });
  assert.equal(validation.isValid, true, `5-star fallback review failed validation: ${validation.reason} -> "${review}"`);
  assert(review.includes('Grand Hotel'));
  assert(!/\b(?:terrible|horrible|disaster|awful)\b/i.test(review));
}
console.log('  ✓ 5-star reviews are clearly positive and enthusiastic without sounding promotional');

// --------------------------------------------------------------------------
// 6. Test Extremely Short AI Output Rejection
// --------------------------------------------------------------------------
console.log('\n6. Testing Extremely Short AI Output Rejection...');
const shortOutputs = ['Good.', 'Nice.', 'Okay place.', 'Great spot.', 'Fine.', 'Loved it.', '5 stars.', 'Terrible.'];
for (const short of shortOutputs) {
  const res = validateReview(short, { rating: 5 });
  assert.equal(res.isValid, false, `Expected "${short}" to be rejected`);
  assert(res.reason.includes('too short') || res.reason.includes('lacks substance'), `Unexpected reason: ${res.reason}`);
}
console.log('  ✓ All extremely short outputs correctly rejected by validator');

// --------------------------------------------------------------------------
// 7. Test Malformed / Broken Output Rejection
// --------------------------------------------------------------------------
console.log('\n7. Testing Malformed / Broken Output Rejection...');
const malformedCases = [
  { text: '', reasonPart: 'empty' },
  { text: '   ', reasonPart: 'empty' },
  { text: '"Really enjoyed visiting Royal Cafe today. Everything went smoothly and the staff was friendly."', reasonPart: 'quotation marks' },
  { text: '**Really enjoyed** visiting Royal Cafe today. Everything went smoothly and the staff was friendly.', reasonPart: 'markdown' },
  { text: '`Really enjoyed` visiting Royal Cafe today. Everything went smoothly and the staff was friendly.', reasonPart: 'markdown' },
  { text: '- Really enjoyed visiting Royal Cafe today.\n- Everything went smoothly and the staff was friendly.', reasonPart: 'markdown' },
  { text: 'As an AI language model, here is your review: The visit to Royal Cafe was pleasant and the atmosphere was nice.', reasonPart: 'AI or meta commentary' },
  { text: 'Here is a review for Royal Cafe: Everything was well organized and the service was attentive throughout.', reasonPart: 'AI or meta commentary' },
  { text: 'Really enjoyed visiting Royal Cafe today and the service was really nice and polite and', reasonPart: 'missing terminal punctuation' },
  { text: 'Really enjoyed visiting Royal Cafe today. Everything went really well...', reasonPart: 'incomplete ellipsis' },
  { text: 'Really enjoyed visiting Royal Cafe today. The experience was really good with.', reasonPart: 'hanging conjunction' },
  { text: 'Really enjoyed visiting Royal Cafe today. Spent $45 on lunch and it was great.', reasonPart: 'fabricated details' },
  { text: 'Really enjoyed visiting Royal Cafe today. Waited 45 minutes to get our food.', reasonPart: 'fabricated details' },
  { text: 'Really enjoyed visiting Royal Cafe today. Waiter John was really attentive throughout.', reasonPart: 'fabricated details' },
  { text: 'Had a great experience at Royal Cafe. The team was exceptionally welcoming and attentive.', reasonPart: 'repetitive boilerplate' },
  { text: 'My experience at Royal Cafe was very pleasant. The team was attentive and the environment was calm.', reasonPart: 'repetitive boilerplate' },
  { text: 'I highly recommend Royal Cafe to everyone. The quality was great and service was prompt.', reasonPart: 'repetitive boilerplate' },
  { text: 'Everything at Royal Cafe was handled with genuine care and professionalism. Great job.', reasonPart: 'corporate AI marketing clichés' },
  { text: 'Super happy with Royal Cafe today. Exceptional team and absolutely perfect experience.', rating: 1, reasonPart: 'overly positive praise' }
];

for (const tc of malformedCases) {
  const res = validateReview(tc.text, { rating: tc.rating || 5, businessName: 'Royal Cafe' });
  assert.equal(res.isValid, false, `Expected text to be rejected: "${tc.text}"`);
  assert(res.reason.toLowerCase().includes(tc.reasonPart.toLowerCase()), `Expected reason to mention "${tc.reasonPart}", got: "${res.reason}"`);
}
console.log('  ✓ All malformed, broken, markdown, AI meta, quotation-wrapped, and corporate clichés rejected');

// --------------------------------------------------------------------------
// 8. Test Retry Behavior
// --------------------------------------------------------------------------
console.log('\n8. Testing Retry Behavior...');
let attemptCounter = 0;
const recordedCalls = [];
const mockWithSuccessfulRetry = async (params) => {
  attemptCounter++;
  recordedCalls.push(params);
  if (params.attempt === 0) {
    // Attempt 0 fails validation (too short)
    return 'Good.';
  }
  // Attempt 1 succeeds with grounded sentiment
  return 'Really enjoyed my visit to Royal Cafe. Everything went smoothly, and I would definitely come back again.';
};

attemptCounter = 0;
recordedCalls.length = 0;
const retryResult = await generateReviewWithAi({
  businessName: 'Royal Cafe',
  rating: 5,
  _mockProvider: mockWithSuccessfulRetry
});

assert.equal(attemptCounter, 2, 'Should have made exactly 2 attempts (initial + retry)');
assert.equal(recordedCalls[0].isRetry, false);
assert.equal(recordedCalls[1].isRetry, true);
assert(recordedCalls[1].failureReason.includes('too short'));
assert.equal(
  retryResult,
  'Really enjoyed my visit to Royal Cafe. Everything went smoothly, and I would definitely come back again.'
);
console.log('  ✓ Retry triggered on initial validation failure and accepted on valid retry output');

// --------------------------------------------------------------------------
// 9. Test Fallback Behavior
// --------------------------------------------------------------------------
console.log('\n9. Testing Fallback Behavior...');
let fallbackCounter = 0;
const mockAlwaysFailing = async (params) => {
  fallbackCounter++;
  return 'Nice.'; // both attempt 0 and attempt 1 fail validation
};

const fallbackResult = await generateReviewWithAi({
  businessName: 'Royal Cafe',
  rating: 4,
  businessType: 'cafe',
  _mockProvider: mockAlwaysFailing
});

assert.equal(fallbackCounter, 2, 'Should attempt initial and retry before fallback');
assert(fallbackResult.length > 20);
assert(fallbackResult.includes('Royal Cafe'));
const fbValidation = validateReview(fallbackResult, { rating: 4, businessName: 'Royal Cafe' });
assert.equal(fbValidation.isValid, true, `Fallback review must be valid: ${fbValidation.reason}`);
console.log('  ✓ Gracefully fell back to human-natural template review:', fallbackResult);

// Verify EVERY single template in FALLBACK_TEMPLATES passes validation with empty context
console.log('  Verifying all fallback templates in all star tiers pass quality & grounding validation with empty context...');
for (const [star, templates] of Object.entries(FALLBACK_TEMPLATES)) {
  const ratingNum = Number(star);
  for (let idx = 0; idx < templates.length; idx++) {
    const fn = templates[idx];
    const text = fn('Royal Cafe', 'cafe');
    const val = validateReview(text, { rating: ratingNum, businessName: 'Royal Cafe', businessType: 'cafe', aiContext: '' });
    assert.equal(val.isValid, true, `Template [${star}★ #${idx}] failed validation: ${val.reason} -> "${text}"`);
    const wordCount = text.split(/\s+/).length;
    assert(wordCount >= 15 && wordCount <= 40, `Template [${star}★ #${idx}] word count ${wordCount} outside 15-40: "${text}"`);
  }
}
console.log('  ✓ All 44 fallback templates across 1-5 stars strictly satisfy all quality & grounding rules');

// --------------------------------------------------------------------------
// 10. Test aiContext Support
// --------------------------------------------------------------------------
console.log('\n10. Testing aiContext Support...');
const contextPrompt = buildPrompt({
  businessName: 'Arcade Universe',
  rating: 5,
  businessType: 'gaming zone',
  aiContext: 'Family-friendly gaming zone with a casual atmosphere.'
});
assert(contextPrompt.includes('Family-friendly gaming zone with a casual atmosphere.'));
assert(contextPrompt.includes('Arcade Universe'));
assert(contextPrompt.includes('gaming zone'));
console.log('  ✓ buildPrompt properly incorporates aiContext');

// Empty aiContext check
const emptyContextPrompt = buildPrompt({
  businessName: 'Royal Cafe',
  rating: 5,
  aiContext: ''
});
assert(!emptyContextPrompt.includes('Business Context ('));
assert(emptyContextPrompt.includes('Royal Cafe'));
const emptyContextReview = generateFallbackReview({ businessName: 'Royal Cafe', rating: 5, aiContext: '' });
assert.equal(validateReview(emptyContextReview, { rating: 5, aiContext: '' }).isValid, true);
console.log('  ✓ Empty aiContext generates normally without errors');

// --------------------------------------------------------------------------
// 11. Test Business Type Support
// --------------------------------------------------------------------------
console.log('\n11. Testing Business Type Support...');
assert.equal(getTypeDescriptor('waffle shop'), 'waffle shop');
assert.equal(getTypeDescriptor('Cafe & Bakery'), 'cafe');
assert.equal(getTypeDescriptor('Gaming Zone'), 'gaming zone');
assert.equal(getTypeDescriptor('Hair Salon'), 'salon');
assert.equal(getTypeDescriptor('Grocery Store'), 'store');
assert.equal(getTypeDescriptor('Cocktail Bar'), 'venue');
assert.equal(getTypeDescriptor('Fitness Gym'), 'gym');
assert.equal(getTypeDescriptor('Boutique Hotel'), 'hotel');

const typePrompt = buildPrompt({
  businessName: 'Pixel World',
  rating: 4,
  businessType: 'gaming zone'
});
assert(typePrompt.includes('gaming zone'));
console.log('  ✓ Business types properly categorized and incorporated into generation prompts');

// --------------------------------------------------------------------------
// 12. Test No Infinite Retries
// --------------------------------------------------------------------------
console.log('\n12. Testing No Infinite Retries (Max: initial + 1 retry + fallback)...');
let loopGuardAttempts = 0;
const endlessBadAi = async () => {
  loopGuardAttempts++;
  return 'Bad.';
};

const terminatedResult = await generateReviewWithAi({
  businessName: 'Test Biz',
  rating: 3,
  _mockProvider: endlessBadAi
});

assert.equal(loopGuardAttempts, 2, 'Must never exceed 2 provider attempts (1 initial + 1 retry)');
assert(terminatedResult.includes('Test Biz'));
console.log('  ✓ Verified strictly maximum 1 retry; no infinite loops possible');

// --------------------------------------------------------------------------
// 13. Test API Response Contract
// --------------------------------------------------------------------------
console.log('\n13. Testing API Response Contract Compatibility...');
const sampleReview = await generateReviewWithAi({
  businessName: 'Royal Cafe',
  rating: 5
});
assert(typeof sampleReview === 'string');
assert(sampleReview.length > 20);
const mockApiResponse = {
  success: true,
  review: sampleReview,
  data: { review: sampleReview }
};
assert.equal(mockApiResponse.success, true);
assert.equal(typeof mockApiResponse.review, 'string');
assert.equal(mockApiResponse.review, mockApiResponse.data.review);
console.log('  ✓ API response contract maintained: { success: true, review, data: { review } }');

// --------------------------------------------------------------------------
// 14. Phase 1.5 Specific Naturalness Scenarios & Variation Check
// --------------------------------------------------------------------------
console.log('\n14. Testing Phase 1.5 Specific Naturalness Scenarios...');
const naturalScenarios = [
  { name: 'The Bistro Table', type: 'restaurant', rating: 1 },
  { name: 'The Bistro Table', type: 'restaurant', rating: 2 },
  { name: 'The Bistro Table', type: 'restaurant', rating: 3 },
  { name: 'The Bistro Table', type: 'restaurant', rating: 4 },
  { name: 'The Bistro Table', type: 'restaurant', rating: 5 },
  { name: 'Pixel Arcade', type: 'gaming zone', rating: 2 },
  { name: 'Luxe Hair Studio', type: 'salon', rating: 4 },
  { name: 'Golden Crisp Waffles', type: 'waffle shop', rating: 5 }
];

for (const sc of naturalScenarios) {
  const rev = generateFallbackReview({ businessName: sc.name, rating: sc.rating, businessType: sc.type, aiContext: '' });
  const val = validateReview(rev, { rating: sc.rating, businessName: sc.name, businessType: sc.type, aiContext: '' });
  assert.equal(val.isValid, true, `Scenario failed: ${sc.type} ${sc.rating}★: ${val.reason} -> "${rev}"`);
  assert(rev.includes(sc.name));
  assert(!/\b(?:from start to finish|genuine care and professionalism|top-notch|meaningful difference)\b/i.test(rev));
  console.log(`  ✓ ${sc.type.padEnd(12)} ${sc.rating}★: "${rev}"`);
}

console.log('\n15. Testing Multi-Generation Structural Variation for Same Business/Rating...');
const bistro5StarPool = [];
for (let i = 0; i < 20; i++) {
  const r = generateFallbackReview({ businessName: 'The Bistro Table', rating: 5, businessType: 'restaurant', aiContext: '' });
  bistro5StarPool.push(r);
}
const uniqueBistroReviews = new Set(bistro5StarPool);
assert(uniqueBistroReviews.size >= 4, `Expected at least 4 unique review variations in 20 generations, got ${uniqueBistroReviews.size}`);

// Verify variations have different opening words
const openings = bistro5StarPool.map(r => r.split(/\s+/).slice(0, 3).join(' '));
const uniqueOpenings = new Set(openings);
assert(uniqueOpenings.size >= 3, `Expected diverse opening phrases, got ${uniqueOpenings.size}`);
console.log(`  ✓ Multi-generation variation confirmed (${uniqueBistroReviews.size} unique variations, ${uniqueOpenings.size} unique opening patterns)`);

// --------------------------------------------------------------------------
// 16. Phase 1.6 Anti-Hallucination & Experience Grounding Tests
// --------------------------------------------------------------------------
console.log('\n16. Testing Phase 1.6 Anti-Hallucination & Experience Grounding...');

// A. Negative Cases: Reject unsupported concrete claims when aiContext is empty
const unsupportedWhenEmpty = [
  'The service was fast and friendly during our visit to The Bistro Table this afternoon.',
  'The atmosphere was lively and the staff was welcoming at The Bistro Table during our visit.',
  'The food was fresh and delicious at The Bistro Table, really enjoyed our visit today.',
  'The equipment worked perfectly and the games were really fun at Pixel Arcade during our stop.',
  'The haircut turned out great and the stylist was super attentive at Luxe Hair Studio today.',
  'The place was super clean and spotless throughout our entire visit to The Bistro Table today.',
  'The prices were very affordable and great value for our visit to The Bistro Table today.'
];

for (const claim of unsupportedWhenEmpty) {
  const val = validateReview(claim, { rating: 5, businessName: 'The Bistro Table', aiContext: '' });
  assert.equal(val.isValid, false, `Expected unsupported claim to be rejected when context is empty: "${claim}"`);
  assert(val.reason.includes('not in trusted context'), `Reason must specify missing context, got: "${val.reason}"`);
}
console.log('  ✓ Correctly rejected 7 unsupported concrete claims when aiContext is empty');

// B. Partial context: Reject unsupported claims when only SOME facts are provided
const partialContextReview = 'We appreciated the friendly staff during our visit, but the food was delicious and the place was spotless.';
const valPartial = validateReview(partialContextReview, { rating: 5, businessName: 'The Bistro Table', aiContext: 'Friendly staff' });
assert.equal(valPartial.isValid, false, 'Expected review with unmentioned food and cleanliness to be rejected');
assert(valPartial.reason.includes('not in trusted context'), `Reason must specify missing context, got: "${valPartial.reason}"`);
console.log('  ✓ Correctly rejected review with unsupported food/cleanliness when context only had "Friendly staff"');

// C. Positive Cases: Allow general sentiment when context is empty
const groundedSentimentWhenEmpty = [
  'Really enjoyed my visit to The Bistro Table. I had a great experience overall and would definitely come back.',
  'Had a really good experience at The Bistro Table. I would happily visit again.',
  'It was a decent experience at The Bistro Table overall. Some parts were good, although there is still room to improve.',
  'The experience at The Bistro Table fell short of what I expected. A few things could definitely be improved around the overall visit.'
];

for (const sentiment of groundedSentimentWhenEmpty) {
  const val = validateReview(sentiment, { rating: 5, businessName: 'The Bistro Table', aiContext: '' });
  assert.equal(val.isValid, true, `General sentiment must be allowed when context is empty: "${val.reason}" -> "${sentiment}"`);
}
console.log('  ✓ Correctly allowed 4 general sentiment reviews when context is empty');

// D. Positive Cases: Allow supported facts when aiContext is provided
const supportedContextReviews = [
  {
    review: 'Really enjoyed my visit to The Bistro Table. The friendly staff and relaxed atmosphere made it a pleasant experience.',
    businessName: 'The Bistro Table',
    context: 'Friendly staff, relaxed atmosphere.'
  },
  {
    review: 'Enjoyed stopping by Pixel Arcade today. The casual atmosphere made the visit enjoyable.',
    businessName: 'Pixel Arcade',
    context: 'Casual atmosphere.'
  },
  {
    review: 'Had a wonderful time at Demo Waffle Shop. The fresh waffles and great coffee made it memorable.',
    businessName: 'Demo Waffle Shop',
    context: 'Fresh waffles, coffee, brunch.'
  }
];

for (const sc of supportedContextReviews) {
  const val = validateReview(sc.review, { rating: 5, businessName: sc.businessName, aiContext: sc.context });
  assert.equal(val.isValid, true, `Supported review must pass validation: ${val.reason} -> "${sc.review}"`);
}
console.log('  ✓ Correctly allowed reviews incorporating explicitly supported context facts');

// E. Retry triggered specifically on grounding failure
let groundingRetryCounter = 0;
let retryReceivedFailureReason = '';
const mockGroundingFailure = async (params) => {
  groundingRetryCounter++;
  if (params.attempt === 0) {
    // Attempt 0 hallucinates food when no context exists
    return 'The food was fresh and delicious at The Bistro Table, really enjoyed our visit today.';
  }
  retryReceivedFailureReason = params.failureReason;
  // Attempt 1 corrects to pure general sentiment
  return 'Really enjoyed my visit to The Bistro Table. I had a great experience overall and would definitely come back.';
};

const groundingRetryRes = await generateReviewWithAi({
  businessName: 'The Bistro Table',
  rating: 5,
  aiContext: '',
  _mockProvider: mockGroundingFailure
});

assert.equal(groundingRetryCounter, 2, 'Should execute 1 retry after grounding failure');
assert(retryReceivedFailureReason.includes('not in trusted context'), `Retry should inform of grounding failure, got: "${retryReceivedFailureReason}"`);
assert.equal(groundingRetryRes, 'Really enjoyed my visit to The Bistro Table. I had a great experience overall and would definitely come back.');
console.log('  ✓ Grounding failure properly triggers retry with corrective reason and recovers cleanly');

console.log('\n🎉 ALL AI REVIEW ENGINE TESTS PASSED (PHASE 1.6 ANTI-HALLUCINATION HARDENED)!\n');
