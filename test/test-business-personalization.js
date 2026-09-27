import 'dotenv/config';
import assert from 'node:assert/strict';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer-core';

import {
  BUSINESS_TYPES,
  normalizeBusinessType,
  getBusinessPresentation,
  BUSINESS_PRESENTATIONS,
  BUSINESS_TYPE_OPTIONS
} from '../client/src/utils/businessPersonalization.js';

import { getTypeDescriptor } from '../server/services/aiReviewService.js';
import apiRoutes from '../server/routes/api.js';
import { initDb, closeDb, createBusiness, deleteBusinessBySlug } from '../server/db/mongo.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('\n🧪 Running Phase 4 Business-Type Personalization Test Suite...\n');

// ---------------------------------------------------------------------------
// 1. Normalization Unit Tests
// ---------------------------------------------------------------------------
console.log('1. Testing Business Type Normalization...');

// All 13 canonical types
assert.equal(normalizeBusinessType('restaurant'), BUSINESS_TYPES.RESTAURANT);
assert.equal(normalizeBusinessType('Restaurant'), BUSINESS_TYPES.RESTAURANT);
assert.equal(normalizeBusinessType('dining'), BUSINESS_TYPES.RESTAURANT);
assert.equal(normalizeBusinessType('bistro'), BUSINESS_TYPES.RESTAURANT);

assert.equal(normalizeBusinessType('cafe'), BUSINESS_TYPES.CAFE);
assert.equal(normalizeBusinessType('Cafe'), BUSINESS_TYPES.CAFE);
assert.equal(normalizeBusinessType('coffee shop'), BUSINESS_TYPES.CAFE);
assert.equal(normalizeBusinessType('espresso'), BUSINESS_TYPES.CAFE);

assert.equal(normalizeBusinessType('club'), BUSINESS_TYPES.CLUB);
assert.equal(normalizeBusinessType('nightclub'), BUSINESS_TYPES.CLUB);

assert.equal(normalizeBusinessType('bar'), BUSINESS_TYPES.BAR);
assert.equal(normalizeBusinessType('cocktail bar'), BUSINESS_TYPES.BAR);
assert.equal(normalizeBusinessType('pub'), BUSINESS_TYPES.BAR);
assert.equal(normalizeBusinessType('lounge'), BUSINESS_TYPES.BAR);

assert.equal(normalizeBusinessType('waffle_shop'), BUSINESS_TYPES.WAFFLE_SHOP);
assert.equal(normalizeBusinessType('waffle shop'), BUSINESS_TYPES.WAFFLE_SHOP);
assert.equal(normalizeBusinessType('Waffles'), BUSINESS_TYPES.WAFFLE_SHOP);

assert.equal(normalizeBusinessType('gaming_zone'), BUSINESS_TYPES.GAMING_ZONE);
assert.equal(normalizeBusinessType('gaming zone'), BUSINESS_TYPES.GAMING_ZONE);
assert.equal(normalizeBusinessType('arcade'), BUSINESS_TYPES.GAMING_ZONE);

assert.equal(normalizeBusinessType('salon'), BUSINESS_TYPES.SALON);
assert.equal(normalizeBusinessType('hair salon'), BUSINESS_TYPES.SALON);
assert.equal(normalizeBusinessType('spa'), BUSINESS_TYPES.SALON);
assert.equal(normalizeBusinessType('barber'), BUSINESS_TYPES.SALON);

assert.equal(normalizeBusinessType('gift_shop'), BUSINESS_TYPES.GIFT_SHOP);
assert.equal(normalizeBusinessType('gift shop'), BUSINESS_TYPES.GIFT_SHOP);
assert.equal(normalizeBusinessType('boutique'), BUSINESS_TYPES.GIFT_SHOP);

assert.equal(normalizeBusinessType('optical_store'), BUSINESS_TYPES.OPTICAL_STORE);
assert.equal(normalizeBusinessType('optical store'), BUSINESS_TYPES.OPTICAL_STORE);
assert.equal(normalizeBusinessType('optician'), BUSINESS_TYPES.OPTICAL_STORE);

assert.equal(normalizeBusinessType('real_estate'), BUSINESS_TYPES.REAL_ESTATE);
assert.equal(normalizeBusinessType('real estate'), BUSINESS_TYPES.REAL_ESTATE);
assert.equal(normalizeBusinessType('realtor'), BUSINESS_TYPES.REAL_ESTATE);

assert.equal(normalizeBusinessType('swimming_pool'), BUSINESS_TYPES.SWIMMING_POOL);
assert.equal(normalizeBusinessType('swimming pool'), BUSINESS_TYPES.SWIMMING_POOL);
assert.equal(normalizeBusinessType('pool'), BUSINESS_TYPES.SWIMMING_POOL);

assert.equal(normalizeBusinessType('grocery_store'), BUSINESS_TYPES.GROCERY_STORE);
assert.equal(normalizeBusinessType('grocery store'), BUSINESS_TYPES.GROCERY_STORE);
assert.equal(normalizeBusinessType('supermarket'), BUSINESS_TYPES.GROCERY_STORE);

assert.equal(normalizeBusinessType('generic'), BUSINESS_TYPES.GENERIC);

// Graceful fallback tests
assert.equal(normalizeBusinessType('pet_shop'), BUSINESS_TYPES.GENERIC, 'Unknown pet_shop should map to generic');
assert.equal(normalizeBusinessType('dentist'), BUSINESS_TYPES.GENERIC, 'Unknown dentist should map to generic');
assert.equal(normalizeBusinessType('car_wash'), BUSINESS_TYPES.GENERIC, 'Unknown car_wash should map to generic');
assert.equal(normalizeBusinessType('business'), BUSINESS_TYPES.GENERIC, 'Legacy business string should map to generic');
assert.equal(normalizeBusinessType(null), BUSINESS_TYPES.GENERIC, 'null should map to generic');
assert.equal(normalizeBusinessType(undefined), BUSINESS_TYPES.GENERIC, 'undefined should map to generic');
assert.equal(normalizeBusinessType(''), BUSINESS_TYPES.GENERIC, 'Empty string should map to generic');
assert.equal(normalizeBusinessType('   '), BUSINESS_TYPES.GENERIC, 'Whitespace string should map to generic');
assert.equal(normalizeBusinessType(123), BUSINESS_TYPES.GENERIC, 'Non-string type should map to generic');

console.log('  ✓ All 13 canonical types and edge-case fallbacks correctly normalized.');

// ---------------------------------------------------------------------------
// 2. Presentation Object Completeness & Safety
// ---------------------------------------------------------------------------
console.log('2. Testing Presentation Configuration Completeness & Grounding Safety...');

const ALL_KEYS = Object.values(BUSINESS_TYPES);
assert.equal(ALL_KEYS.length, 13, 'Must support exactly 13 canonical business types');

for (const key of ALL_KEYS) {
  const pres = getBusinessPresentation(key);
  assert.ok(pres, `Presentation must exist for key: ${key}`);
  assert.equal(pres.key, key);
  assert.ok(pres.label && typeof pres.label === 'string', `${key}: label must be a string`);
  assert.ok(pres.icon && typeof pres.icon === 'string', `${key}: icon must be a non-empty string`);
  assert.ok(pres.themeClass && pres.themeClass.startsWith('theme-'), `${key}: themeClass must start with theme-`);
  assert.ok(pres.accentColor && pres.accentColor.startsWith('#'), `${key}: accentColor must be hex`);
  assert.ok(pres.accentSoft && pres.accentSoft.startsWith('#'), `${key}: accentSoft must be hex`);
  assert.ok(pres.promptPrefix && typeof pres.promptPrefix === 'string', `${key}: promptPrefix must be a string`);
  assert.ok(typeof pres.ratingPrompt === 'function', `${key}: ratingPrompt must be a function`);

  // Verify microcopy does NOT make unsupported claims (no food, staff, service, price claims)
  const renderedPrompt = pres.ratingPrompt('The Bistro');
  assert.ok(renderedPrompt.includes('The Bistro'), `${key}: prompt must include the business name`);
  assert.ok(!renderedPrompt.toLowerCase().includes('delicious'), `${key}: prompt must not claim delicious`);
  assert.ok(!renderedPrompt.toLowerCase().includes('friendly'), `${key}: prompt must not claim friendly`);
  assert.ok(!renderedPrompt.toLowerCase().includes('clean'), `${key}: prompt must not claim clean`);
  assert.ok(!renderedPrompt.toLowerCase().includes('cheap'), `${key}: prompt must not claim cheap`);
  assert.ok(!renderedPrompt.toLowerCase().includes('amazing service'), `${key}: prompt must not claim amazing service`);
}

// Fallback presentation safety
const unknownPres = getBusinessPresentation('unsupported_type_xyz');
assert.equal(unknownPres.key, BUSINESS_TYPES.GENERIC, 'Unknown presentation should return generic');
assert.equal(unknownPres.label, 'Local Business');
assert.equal(unknownPres.icon, '🏪');

const nullPres = getBusinessPresentation(null);
assert.equal(nullPres.key, BUSINESS_TYPES.GENERIC, 'Null presentation should return generic');

console.log('  ✓ All 13 presentations verified complete, accessible, and free of unsupported claims.');

// ---------------------------------------------------------------------------
// 3. AI Service Descriptor Compatibility
// ---------------------------------------------------------------------------
console.log('3. Testing AI Service Descriptor Mapping...');

assert.equal(getTypeDescriptor('restaurant'), 'restaurant');
assert.equal(getTypeDescriptor('cafe'), 'cafe');
assert.equal(getTypeDescriptor('waffle_shop'), 'waffle shop');
assert.equal(getTypeDescriptor('waffle shop'), 'waffle shop');
assert.equal(getTypeDescriptor('gaming_zone'), 'gaming zone');
assert.equal(getTypeDescriptor('salon'), 'salon');
assert.equal(getTypeDescriptor('bar'), 'venue');
assert.equal(getTypeDescriptor('club'), 'venue');
assert.equal(getTypeDescriptor('optical_store'), 'optical store');
assert.equal(getTypeDescriptor('gift_shop'), 'gift shop');
assert.equal(getTypeDescriptor('real_estate'), 'agency');
assert.equal(getTypeDescriptor('real estate'), 'agency');
assert.equal(getTypeDescriptor('swimming_pool'), 'facility');
assert.equal(getTypeDescriptor('grocery_store'), 'store');
assert.equal(getTypeDescriptor('generic'), 'place');
assert.equal(getTypeDescriptor(''), 'place');

console.log('  ✓ AI review service descriptors successfully handle all normalized types and underscores.');

// ---------------------------------------------------------------------------
// 4. API End-to-End Type Propagation & Customer Rendering
// ---------------------------------------------------------------------------
console.log('4. Testing API Type Propagation and Live Browser Customer Rendering...');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', apiRoutes);

const clientDistPath = path.resolve(__dirname, '../client/dist');
app.use(express.static(clientDistPath));
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

const PORT = 5115;
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const server = app.listen(PORT, async () => {
  let browser;
  try {
    await initDb();

    // Create test business with explicit type: gaming_zone
    await createBusiness({
      name: 'Pixel Play Test',
      slug: 'pixel-play-test',
      googleReviewUrl: 'https://search.google.com/local/writereview?placeid=TEST_PIXEL_123',
      type: 'gaming_zone'
    });

    // Create test business without type (simulating legacy document)
    await createBusiness({
      name: 'Legacy Shop Test',
      slug: 'legacy-shop-test',
      googleReviewUrl: 'https://search.google.com/local/writereview?placeid=TEST_LEGACY_123',
      type: ''
    });

    // Verify GET /api/businesses/pixel-play-test propagates type
    const resGaming = await fetch(`http://localhost:${PORT}/api/businesses/pixel-play-test`);
    const dataGaming = await resGaming.json();
    assert.equal(dataGaming.success, true);
    assert.equal(dataGaming.data.type, 'gaming_zone', 'API must return business type');

    // Launch headless browser to test customer rendering
    browser = await puppeteer.launch({
      executablePath: edgePath,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

    // Test 4A: Gaming Zone Business Page
    await page.goto(`http://localhost:${PORT}/r/pixel-play-test`, { waitUntil: 'networkidle0' });

    // Verify canvas theme class
    const canvasThemeClass = await page.$eval('.mobile-canvas', el => el.className);
    assert.ok(canvasThemeClass.includes('theme-gaming_zone'), `Canvas should have theme-gaming_zone, got: ${canvasThemeClass}`);

    // Verify avatar emoji
    const avatarEmoji = await page.$eval('.shop-avatar span', el => el.textContent.trim());
    assert.equal(avatarEmoji, '🎮', `Gaming Zone avatar should be 🎮, got: ${avatarEmoji}`);

    // Verify business type pill
    const pillText = await page.$eval('.business-type-pill', el => el.textContent.trim());
    assert.equal(pillText, 'Gaming Zone', `Pill should say Gaming Zone, got: ${pillText}`);

    // Verify rating prompt microcopy
    const promptText = await page.$eval('.rating-prompt', el => el.textContent.trim());
    assert.ok(promptText.includes('How was your session at'), `Prompt should use gaming microcopy, got: ${promptText}`);
    assert.ok(promptText.includes('Pixel Play Test'), `Prompt must retain primary business name: ${promptText}`);

    console.log('  ✓ Gaming Zone: theme class, 🎮 avatar, category pill, and session microcopy rendered.');

    // Test 4B: Legacy Business Page (no type in document)
    await page.goto(`http://localhost:${PORT}/r/legacy-shop-test`, { waitUntil: 'networkidle0' });

    const legacyThemeClass = await page.$eval('.mobile-canvas', el => el.className);
    assert.ok(legacyThemeClass.includes('theme-generic'), `Legacy business should fallback to theme-generic, got: ${legacyThemeClass}`);

    const legacyAvatar = await page.$eval('.shop-avatar span', el => el.textContent.trim());
    assert.equal(legacyAvatar, '🏪', `Legacy business avatar should fallback to 🏪, got: ${legacyAvatar}`);

    const legacyPill = await page.$eval('.business-type-pill', el => el.textContent.trim());
    assert.equal(legacyPill, 'Local Business', `Legacy pill should say Local Business, got: ${legacyPill}`);

    const legacyPrompt = await page.$eval('.rating-prompt', el => el.textContent.trim());
    assert.ok(legacyPrompt.includes('How was your experience at Legacy Shop Test?'), `Legacy prompt: ${legacyPrompt}`);

    console.log('  ✓ Legacy business with empty type safely rendered generic theme without error.');

    // Test 4C: Preset Waffle Shop Page
    await page.goto(`http://localhost:${PORT}/r/demo-waffle-shop`, { waitUntil: 'networkidle0' });
    const waffleAvatar = await page.$eval('.shop-avatar span', el => el.textContent.trim());
    assert.equal(waffleAvatar, '🧇', `Waffle shop avatar should be 🧇, got: ${waffleAvatar}`);
    const wafflePill = await page.$eval('.business-type-pill', el => el.textContent.trim());
    assert.equal(wafflePill, 'Waffle Shop', `Waffle shop pill should be Waffle Shop, got: ${wafflePill}`);

    console.log('  ✓ Preset Demo Waffle Shop seamlessly rendered waffle theme.');

    // Test 4D: Preset Royal Cafe Page
    await page.goto(`http://localhost:${PORT}/r/royal-cafe`, { waitUntil: 'networkidle0' });
    const cafeAvatar = await page.$eval('.shop-avatar span', el => el.textContent.trim());
    assert.equal(cafeAvatar, '☕', `Cafe avatar should be ☕, got: ${cafeAvatar}`);
    const cafePill = await page.$eval('.business-type-pill', el => el.textContent.trim());
    assert.equal(cafePill, 'Cafe', `Cafe pill should be Cafe, got: ${cafePill}`);

    console.log('  ✓ Preset Royal Cafe seamlessly rendered cafe theme.');

    await page.close();

    // Clean up test businesses
    await deleteBusinessBySlug('pixel-play-test');
    await deleteBusinessBySlug('legacy-shop-test');

    console.log('\n🎉 ALL PHASE 4 BUSINESS-TYPE PERSONALIZATION TESTS PASSED!\n');
  } catch (err) {
    console.error('Phase 4 Test failed:', err);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    await closeDb();
    server.close();
  }
});
