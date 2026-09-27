/**
 * Centralized Business-Type Personalization Configuration & Normalization
 * 
 * Provides single source of truth for:
 * - Normalization of raw/legacy business type strings to canonical keys
 * - Display labels, icons, category badges
 * - Subtle rating prompts and microcopy
 * - Visual theme classes and accent color tokens
 * 
 * Invariants:
 * - Purely presentation-level configuration
 * - Unknown or missing types gracefully map to 'generic'
 * - Zero unsupported experience claims
 */

export const BUSINESS_TYPES = {
  RESTAURANT: 'restaurant',
  CAFE: 'cafe',
  CLUB: 'club',
  BAR: 'bar',
  WAFFLE_SHOP: 'waffle_shop',
  GAMING_ZONE: 'gaming_zone',
  SALON: 'salon',
  GIFT_SHOP: 'gift_shop',
  OPTICAL_STORE: 'optical_store',
  REAL_ESTATE: 'real_estate',
  SWIMMING_POOL: 'swimming_pool',
  GROCERY_STORE: 'grocery_store',
  GENERIC: 'generic'
};

/**
 * Normalizes any incoming business type string (from MongoDB, API, or legacy records)
 * to a supported canonical business type key.
 * 
 * Gracefully maps unknown, null, undefined, or empty values to 'generic'.
 * 
 * @param {string|null|undefined} rawType 
 * @returns {string} One of BUSINESS_TYPES values
 */
export function normalizeBusinessType(rawType) {
  if (!rawType || typeof rawType !== 'string') {
    return BUSINESS_TYPES.GENERIC;
  }

  const t = rawType.toLowerCase().trim().replace(/[-_]+/g, ' ');

  if (!t || t === 'business' || t === 'generic' || t === 'other' || t === 'place') {
    return BUSINESS_TYPES.GENERIC;
  }

  // Waffle Shop
  if (t.includes('waffle')) {
    return BUSINESS_TYPES.WAFFLE_SHOP;
  }

  // Cafe
  if (t.includes('cafe') || t.includes('coffee') || t.includes('espresso') || t.includes('bakery')) {
    return BUSINESS_TYPES.CAFE;
  }

  // Restaurant
  if (t.includes('restaurant') || t.includes('dining') || t.includes('bistro') || t.includes('eatery') || t.includes('food')) {
    return BUSINESS_TYPES.RESTAURANT;
  }

  // Gaming Zone
  if (t.includes('gaming') || t.includes('arcade') || t.includes('esports') || t.includes('games')) {
    return BUSINESS_TYPES.GAMING_ZONE;
  }

  // Salon
  if (t.includes('salon') || t.includes('barber') || t.includes('spa') || t.includes('beauty') || t.includes('hair')) {
    return BUSINESS_TYPES.SALON;
  }

  // Club
  if (t.includes('club') || t.includes('nightclub') || t.includes('disco')) {
    return BUSINESS_TYPES.CLUB;
  }

  // Bar
  if (t.includes('bar') || t.includes('pub') || t.includes('cocktail') || t.includes('lounge') || t.includes('tavern') || t.includes('brewery')) {
    return BUSINESS_TYPES.BAR;
  }

  // Gift Shop
  if (t.includes('gift') || t.includes('souvenir') || t.includes('boutique') || t.includes('stationery')) {
    return BUSINESS_TYPES.GIFT_SHOP;
  }

  // Optical Store
  if (t.includes('optical') || t.includes('optician') || t.includes('optometry') || t.includes('eyewear') || t.includes('glasses')) {
    return BUSINESS_TYPES.OPTICAL_STORE;
  }

  // Real Estate
  if (t.includes('real estate') || t.includes('realtor') || t.includes('property') || t.includes('realty')) {
    return BUSINESS_TYPES.REAL_ESTATE;
  }

  // Swimming Pool
  if (t.includes('pool') || t.includes('swim') || t.includes('aquatic')) {
    return BUSINESS_TYPES.SWIMMING_POOL;
  }

  // Grocery Store
  if (t.includes('grocery') || t.includes('supermarket') || t.includes('mart') || t.includes('market') || t.includes('produce')) {
    return BUSINESS_TYPES.GROCERY_STORE;
  }

  // Safe fallback for unmapped types (e.g. 'pet_shop', 'dentist', etc.)
  return BUSINESS_TYPES.GENERIC;
}

export const BUSINESS_PRESENTATIONS = {
  [BUSINESS_TYPES.RESTAURANT]: {
    key: BUSINESS_TYPES.RESTAURANT,
    label: 'Restaurant',
    icon: '🍽️',
    themeClass: 'theme-restaurant',
    accentColor: '#c2410c',
    accentSoft: '#ffedd5',
    accentDark: '#9a3412',
    promptPrefix: 'How was your visit to',
    promptTemplate: (name) => `How was your visit to ${name}?`,
    ratingPrompt: (name) => `How was your visit to ${name || 'our restaurant'}?`
  },
  [BUSINESS_TYPES.CAFE]: {
    key: BUSINESS_TYPES.CAFE,
    label: 'Cafe',
    icon: '☕',
    themeClass: 'theme-cafe',
    accentColor: '#92400e',
    accentSoft: '#fef3c7',
    accentDark: '#78350f',
    promptPrefix: 'How was your stop at',
    promptTemplate: (name) => `How was your stop at ${name}?`,
    ratingPrompt: (name) => `How was your stop at ${name || 'our cafe'}?`
  },
  [BUSINESS_TYPES.CLUB]: {
    key: BUSINESS_TYPES.CLUB,
    label: 'Club',
    icon: '🪩',
    themeClass: 'theme-club',
    accentColor: '#7c3aed',
    accentSoft: '#ede9fe',
    accentDark: '#6d28d9',
    promptPrefix: 'How was your night at',
    promptTemplate: (name) => `How was your night at ${name}?`,
    ratingPrompt: (name) => `How was your time at ${name || 'our club'}?`
  },
  [BUSINESS_TYPES.BAR]: {
    key: BUSINESS_TYPES.BAR,
    label: 'Bar & Lounge',
    icon: '🍸',
    themeClass: 'theme-bar',
    accentColor: '#0f766e',
    accentSoft: '#ccfbf1',
    accentDark: '#115e59',
    promptPrefix: 'How was your visit to',
    promptTemplate: (name) => `How was your visit to ${name}?`,
    ratingPrompt: (name) => `How was your visit to ${name || 'our bar'}?`
  },
  [BUSINESS_TYPES.WAFFLE_SHOP]: {
    key: BUSINESS_TYPES.WAFFLE_SHOP,
    label: 'Waffle Shop',
    icon: '🧇',
    themeClass: 'theme-waffle_shop',
    accentColor: '#d97706',
    accentSoft: '#fef3c7',
    accentDark: '#b45309',
    promptPrefix: 'How was your visit to',
    promptTemplate: (name) => `How was your visit to ${name}?`,
    ratingPrompt: (name) => `How was your visit to ${name || 'our shop'}?`
  },
  [BUSINESS_TYPES.GAMING_ZONE]: {
    key: BUSINESS_TYPES.GAMING_ZONE,
    label: 'Gaming Zone',
    icon: '🎮',
    themeClass: 'theme-gaming_zone',
    accentColor: '#2563eb',
    accentSoft: '#dbeafe',
    accentDark: '#1d4ed8',
    promptPrefix: 'How was your session at',
    promptTemplate: (name) => `How was your session at ${name}?`,
    ratingPrompt: (name) => `How was your session at ${name || 'our venue'}?`
  },
  [BUSINESS_TYPES.SALON]: {
    key: BUSINESS_TYPES.SALON,
    label: 'Salon & Spa',
    icon: '✂️',
    themeClass: 'theme-salon',
    accentColor: '#be185d',
    accentSoft: '#fce7f3',
    accentDark: '#9d174d',
    promptPrefix: 'How was your visit to',
    promptTemplate: (name) => `How was your visit to ${name}?`,
    ratingPrompt: (name) => `How was your visit to ${name || 'our salon'}?`
  },
  [BUSINESS_TYPES.GIFT_SHOP]: {
    key: BUSINESS_TYPES.GIFT_SHOP,
    label: 'Gift Shop',
    icon: '🎁',
    themeClass: 'theme-gift_shop',
    accentColor: '#0d9488',
    accentSoft: '#ccfbf1',
    accentDark: '#0f766e',
    promptPrefix: 'How was your visit to',
    promptTemplate: (name) => `How was your visit to ${name}?`,
    ratingPrompt: (name) => `How was your visit to ${name || 'our shop'}?`
  },
  [BUSINESS_TYPES.OPTICAL_STORE]: {
    key: BUSINESS_TYPES.OPTICAL_STORE,
    label: 'Optical Store',
    icon: '👓',
    themeClass: 'theme-optical_store',
    accentColor: '#0284c7',
    accentSoft: '#e0f2fe',
    accentDark: '#0369a1',
    promptPrefix: 'How was your visit to',
    promptTemplate: (name) => `How was your visit to ${name}?`,
    ratingPrompt: (name) => `How was your visit to ${name || 'our store'}?`
  },
  [BUSINESS_TYPES.REAL_ESTATE]: {
    key: BUSINESS_TYPES.REAL_ESTATE,
    label: 'Real Estate',
    icon: '🏢',
    themeClass: 'theme-real_estate',
    accentColor: '#1e3a8a',
    accentSoft: '#e2e8f0',
    accentDark: '#172554',
    promptPrefix: 'How was your experience with',
    promptTemplate: (name) => `How was your experience with ${name}?`,
    ratingPrompt: (name) => `How was your experience with ${name || 'our agency'}?`
  },
  [BUSINESS_TYPES.SWIMMING_POOL]: {
    key: BUSINESS_TYPES.SWIMMING_POOL,
    label: 'Swimming Pool',
    icon: '🏊‍♂️',
    themeClass: 'theme-swimming_pool',
    accentColor: '#0891b2',
    accentSoft: '#cffafe',
    accentDark: '#0e7490',
    promptPrefix: 'How was your visit to',
    promptTemplate: (name) => `How was your visit to ${name}?`,
    ratingPrompt: (name) => `How was your visit to ${name || 'our facility'}?`
  },
  [BUSINESS_TYPES.GROCERY_STORE]: {
    key: BUSINESS_TYPES.GROCERY_STORE,
    label: 'Grocery Store',
    icon: '🛒',
    themeClass: 'theme-grocery_store',
    accentColor: '#15803d',
    accentSoft: '#dcfce7',
    accentDark: '#166534',
    promptPrefix: 'How was your shopping trip at',
    promptTemplate: (name) => `How was your shopping trip at ${name}?`,
    ratingPrompt: (name) => `How was your visit to ${name || 'our store'}?`
  },
  [BUSINESS_TYPES.GENERIC]: {
    key: BUSINESS_TYPES.GENERIC,
    label: 'Local Business',
    icon: '🏪',
    themeClass: 'theme-generic',
    accentColor: '#2563eb',
    accentSoft: '#eff6ff',
    accentDark: '#1d4ed8',
    promptPrefix: 'How was your experience at',
    promptTemplate: (name) => `How was your experience at ${name}?`,
    ratingPrompt: (name) => `How was your experience at ${name || 'our shop'}?`
  }
};

/**
 * Returns the business presentation object for a given business type.
 * Always returns a valid presentation; never null or undefined.
 * 
 * @param {string|null|undefined} rawType 
 * @returns {typeof BUSINESS_PRESENTATIONS[keyof typeof BUSINESS_PRESENTATIONS]}
 */
export function getBusinessPresentation(rawType) {
  const normalizedKey = normalizeBusinessType(rawType);
  return BUSINESS_PRESENTATIONS[normalizedKey] || BUSINESS_PRESENTATIONS[BUSINESS_TYPES.GENERIC];
}

/**
 * Supported business type options formatted for dropdowns (e.g. Developer Portal)
 */
export const BUSINESS_TYPE_OPTIONS = [
  { value: 'generic', label: 'Generic / Other Local Business' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'cafe', label: 'Cafe / Coffee Shop' },
  { value: 'club', label: 'Club / Nightlife' },
  { value: 'bar', label: 'Bar & Lounge' },
  { value: 'waffle_shop', label: 'Waffle Shop / Bakery' },
  { value: 'gaming_zone', label: 'Gaming Zone / Arcade' },
  { value: 'salon', label: 'Salon & Spa' },
  { value: 'gift_shop', label: 'Gift Shop' },
  { value: 'optical_store', label: 'Optical Store' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'swimming_pool', label: 'Swimming Pool / Facility' },
  { value: 'grocery_store', label: 'Grocery Store / Market' }
];
