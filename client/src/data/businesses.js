// Local JavaScript data/config file containing multiple businesses
// Supports local browser storage (localStorage) for newly created businesses

const STORAGE_KEY = 'qr_review_custom_businesses';

export const businesses = {
  "demo-waffle-shop": {
    name: "Demo Waffle Shop",
    type: "waffle shop",
    googleReviewUrl: "https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4"
  },

  "royal-cafe": {
    name: "Royal Cafe",
    type: "cafe",
    googleReviewUrl: "https://search.google.com/local/writereview?placeid=ChIJ3S4Uqc-uEmsRpdAnqj1k58s"
  },

  "fresh-mart": {
    name: "Fresh Mart",
    type: "grocery store",
    googleReviewUrl: "https://search.google.com/local/writereview?placeid=ChIJyeZ2_D-vEmsRLXo7H7P5v5Q"
  },

  "xyz-bar": {
    name: "XYZ Bar",
    type: "cocktail bar",
    googleReviewUrl: "https://search.google.com/local/writereview?placeid=ChIJdd4hrwug2EcRmSrV3Vo6llI"
  }
};

export function getStoredCustomBusinesses() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.error('Failed to parse custom businesses from localStorage', err);
    return {};
  }
}

export function saveCustomBusiness({ name, slug, googleReviewUrl, type }) {
  if (typeof window === 'undefined') return null;
  const current = getStoredCustomBusinesses();
  const newBusiness = {
    name,
    slug,
    googleReviewUrl,
    type: type || 'business',
    createdAt: new Date().toISOString()
  };
  current[slug] = newBusiness;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch (err) {
    console.error('Failed to save business to localStorage', err);
  }
  return newBusiness;
}

export function getBusinessBySlug(slug) {
  if (!slug) return null;
  const key = slug.toLowerCase();

  // 1. Check custom businesses stored in localStorage first
  const custom = getStoredCustomBusinesses();
  if (custom[key]) {
    return {
      slug: key,
      ...custom[key]
    };
  }

  // 2. Check preset businesses
  if (businesses[key]) {
    return {
      slug: key,
      ...businesses[key]
    };
  }

  return null;
}

export function getAllBusinesses() {
  const custom = getStoredCustomBusinesses();
  const merged = { ...businesses, ...custom };
  return Object.entries(merged).map(([slug, data]) => ({
    slug,
    ...data
  }));
}
