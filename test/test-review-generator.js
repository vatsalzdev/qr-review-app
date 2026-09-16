import assert from 'node:assert/strict';
import { generateReview, formatAspects, formatCustomNote } from '../client/src/services/reviewGenerator.js';
import { generateSlug } from '../client/src/utils/slugify.js';
import { getBusinessBySlug, getAllBusinesses } from '../server/data/businesses.js';

console.log('🧪 Running Test Suite for Multi-Business QR Restaurant Review App...\n');

// 0. Test Slug Generation
console.log('0. Testing Slug Generation...');
assert.equal(generateSlug('Royal Cafe'), 'royal-cafe');
assert.equal(generateSlug("Bob's Waffle Shop"), 'bobs-waffle-shop');
assert.equal(generateSlug('Fresh Mart Jaipur'), 'fresh-mart-jaipur');
assert.equal(generateSlug('  Special & Unique @ Place! '), 'special-unique-place');
console.log('  ✓ Slug generator converts business names to clean URL slugs');

// 1. Test Business Data Store
console.log('1. Testing Business Data Store...');
const businesses = getAllBusinesses();
assert(businesses.length >= 3, 'Should have at least 3 businesses configured');

const slugs = ['demo-waffle-shop', 'royal-cafe', 'fresh-mart'];
for (const slug of slugs) {
  const biz = getBusinessBySlug(slug);
  assert(biz !== null, `Business ${slug} should exist`);
  assert(biz.name.length > 0, `Business ${slug} should have a name`);
  assert(biz.type.length > 0, `Business ${slug} should have a type`);
  assert(biz.googleReviewUrl.length > 0, `Business ${slug} should have a googleReviewUrl`);
  console.log(`  ✓ Business ${biz.name} (${biz.type}) loaded successfully`);
}

// 2. Test Dynamic Review Generation for Multiple Businesses
console.log('\n2. Testing Dynamic Review Generation for Multiple Businesses...');

// Royal Cafe
const cafe5Star = generateReview({
  businessName: 'Royal Cafe',
  rating: 5,
  likedAspects: ['Food', 'Service']
});
assert.equal(
  cafe5Star,
  'Really enjoyed my experience at Royal Cafe. The food and service were great.'
);
console.log('  ✓ Royal Cafe 5-star review:', cafe5Star);

// Fresh Mart
const mart4Star = generateReview({
  businessName: 'Fresh Mart',
  rating: 4,
  likedAspects: ['Cleanliness', 'Price'],
  specificFeedback: 'Great fresh produce and quick checkout'
});
assert.equal(
  mart4Star,
  'Had a really good experience at Fresh Mart. I especially enjoyed the cleanliness and price. Great fresh produce and quick checkout.'
);
console.log('  ✓ Fresh Mart 4-star review with note:', mart4Star);

// Demo Waffle Shop
const waffle3Star = generateReview({
  businessName: 'Demo Waffle Shop',
  rating: 3,
  likedAspects: ['Food']
});
assert.equal(
  waffle3Star,
  'My experience at Demo Waffle Shop was decent. I liked the food, although there is some room for improvement.'
);
console.log('  ✓ Demo Waffle Shop 3-star review:', waffle3Star);

console.log('\n🎉 ALL MULTI-BUSINESS REVIEW GENERATOR TESTS PASSED!\n');
