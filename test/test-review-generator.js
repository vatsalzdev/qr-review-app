import assert from 'node:assert/strict';
import { generateReview, formatAspects, formatCustomNote } from '../client/src/services/reviewGenerator.js';
import { getBusinessBySlug, getAllBusinesses } from '../server/data/businesses.js';

console.log('🧪 Running Test Suite for QR Restaurant Review App...\n');

// 1. Test Business Data Store
console.log('1. Testing Business Data Store...');
const demoBiz = getBusinessBySlug('demo-waffle-shop');
assert(demoBiz !== null, 'demo-waffle-shop should exist');
assert.equal(demoBiz.name, 'Demo Waffle Shop');
assert.equal(demoBiz.slug, 'demo-waffle-shop');
assert(demoBiz.googleReviewUrl.includes('search.google.com'), 'googleReviewUrl should be configured');

const allBiz = getAllBusinesses();
assert.equal(allBiz.length >= 1, true, 'At least 1 business should be returned');
console.log('  ✓ Business repository queries pass');

// 2. Test Fallback Review Templates (Exact match with user specification)
console.log('\n2. Testing Exact Fallback Review Templates (No aspects or custom notes)...');

const fallback5 = generateReview({ businessName: 'Demo Waffle Shop', rating: 5 });
assert.equal(
  fallback5,
  'Really enjoyed my experience at Demo Waffle Shop. The food and service were great, and the ambience was lovely.',
  '5-star fallback should match prompt example'
);
console.log('  ✓ 5-star fallback passes:', fallback5);

const fallback4 = generateReview({ businessName: 'Demo Waffle Shop', rating: 4 });
assert.equal(
  fallback4,
  'Had a really good experience at Demo Waffle Shop. I especially enjoyed the food and service.',
  '4-star fallback should match prompt example'
);
console.log('  ✓ 4-star fallback passes:', fallback4);

const fallback3 = generateReview({ businessName: 'Demo Waffle Shop', rating: 3 });
assert.equal(
  fallback3,
  'My experience at Demo Waffle Shop was decent. I liked the food and ambience, although there is some room for improvement.',
  '3-star fallback should match prompt example'
);
console.log('  ✓ 3-star fallback passes:', fallback3);

const fallback2 = generateReview({ businessName: 'Demo Waffle Shop', rating: 2 });
assert.equal(
  fallback2,
  'The experience was below what I expected. I liked the food, but there are areas that could be improved.',
  '2-star fallback should match prompt example'
);
console.log('  ✓ 2-star fallback passes:', fallback2);

const fallback1 = generateReview({ businessName: 'Demo Waffle Shop', rating: 1 });
assert.equal(
  fallback1,
  'My experience at Demo Waffle Shop was disappointing. There are several areas that could be improved.',
  '1-star fallback should match prompt example'
);
console.log('  ✓ 1-star fallback passes:', fallback1);

// 3. Test Dynamic Aspect Incorporation (No hallucinated details)
console.log('\n3. Testing Dynamic Customer Aspects Incorporation...');

const dynamicReview5 = generateReview({
  businessName: 'Demo Waffle Shop',
  rating: 5,
  likedAspects: ['Food', 'Cleanliness']
});
assert.equal(
  dynamicReview5,
  'Really enjoyed my experience at Demo Waffle Shop. The food and cleanliness were great.',
  '5-star review should reflect only selected aspects'
);
console.log('  ✓ 5-star with custom aspects:', dynamicReview5);

const singleAspectReview = generateReview({
  businessName: 'Demo Waffle Shop',
  rating: 5,
  likedAspects: ['Service']
});
assert.equal(
  singleAspectReview,
  'Really enjoyed my experience at Demo Waffle Shop. The service was great.',
  'Single aspect should use singular "was"'
);
console.log('  ✓ Single aspect formatting:', singleAspectReview);

// 4. Test Customer Specific Note Incorporation
console.log('\n4. Testing Customer Note Incorporation...');

const reviewWithNote = generateReview({
  businessName: 'Demo Waffle Shop',
  rating: 5,
  likedAspects: ['Food', 'Service'],
  specificFeedback: 'Loved the chocolate waffle and friendly service'
});
assert.equal(
  reviewWithNote,
  'Really enjoyed my experience at Demo Waffle Shop. The food and service were great. Loved the chocolate waffle and friendly service.',
  'Should incorporate specific note with punctuation'
);
console.log('  ✓ Review with specific customer note:', reviewWithNote);

// 5. Test Low Rating with specific feedback
console.log('\n5. Testing Low Rating with specific feedback...');

const reviewLowRating = generateReview({
  businessName: 'Demo Waffle Shop',
  rating: 2,
  likedAspects: ['Food'],
  specificFeedback: 'The seating area was crowded and wait was long'
});
assert.equal(
  reviewLowRating,
  'The experience was below what I expected. I liked the food, but there are areas that could be improved. The seating area was crowded and wait was long.',
  'Should balance low rating with customer feedback'
);
console.log('  ✓ 2-star with specific feedback:', reviewLowRating);

console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!\n');
