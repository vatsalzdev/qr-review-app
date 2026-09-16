/**
 * Converts a business name into a URL-safe, clean slug.
 *
 * Examples:
 * - "Royal Cafe" -> "royal-cafe"
 * - "Bob's Waffle Shop" -> "bobs-waffle-shop"
 * - "Fresh Mart Jaipur" -> "fresh-mart-jaipur"
 */
export function generateSlug(name = '') {
  return name
    .toString()
    .normalize('NFD') // Normalize accented characters (e.g. é -> e)
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/'s\b/g, 's') // Bob's -> bobs
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, '') // Trim leading and trailing hyphens
    .replace(/-+/g, '-'); // Collapse multiple hyphens
}
