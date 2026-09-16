// Business configuration repository
// Kept separate from UI and route logic so a database or headless CMS can be wired up later.

export const businesses = [
  {
    id: 'b1',
    name: 'Demo Waffle Shop',
    slug: 'demo-waffle-shop',
    category: 'Artisanal Waffle & Dessert Café',
    location: '124 Maple Street, Downtown',
    // Configurable Google Review link - opens Google Place review flow
    googleReviewUrl: 'https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4',
    ratingGoal: '5.0',
    avatarEmoji: '🧇'
  }
];

export function getBusinessBySlug(slug) {
  if (!slug) return null;
  return businesses.find(b => b.slug.toLowerCase() === slug.toLowerCase()) || null;
}

export function getAllBusinesses() {
  return businesses;
}
