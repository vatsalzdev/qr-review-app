import express from 'express';
import {
  getBusinessBySlug,
  getAllBusinesses,
  createBusiness,
  updateBusinessStatus,
  updateBusinessGoogleUrl,
  getDbInfo,
  initDb
} from '../db/mongo.js';
import { generateReviewWithAi } from '../services/aiReviewService.js';

const router = express.Router();

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Diagnostic endpoint to check database connection status safely without exposing secrets
router.get(['/db-status', '/health'], async (req, res) => {
  if (process.env.MONGODB_URI && !getDbInfo().isConnected) {
    try {
      await initDb();
    } catch (_) {}
  }
  const dbInfo = getDbInfo();
  res.json({
    success: true,
    ...dbInfo
  });
});

// Get all configured businesses
router.get('/businesses', async (req, res) => {
  try {
    const list = await getAllBusinesses();
    res.json({
      success: true,
      data: list
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch businesses' });
  }
});

// Get single business by slug (e.g. /api/businesses/royal-cafe)
router.get('/businesses/:slug', async (req, res) => {
  const { slug } = req.params;
  try {
    const business = await getBusinessBySlug(slug);

    if (!business) {
      return res.status(404).json({
        success: false,
        error: `Business with slug "${slug}" not found`
      });
    }

    res.json({
      success: true,
      data: business
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Database error fetching business' });
  }
});

// Create a new business in MongoDB
router.post('/businesses', async (req, res) => {
  try {
    const { name, googleReviewUrl, slug, aiContext, type } = req.body || {};

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Business name is required'
      });
    }

    if (!googleReviewUrl || typeof googleReviewUrl !== 'string' || !googleReviewUrl.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Valid Google review URL is required'
      });
    }

    const businessSlug = (slug && typeof slug === 'string' ? slug.trim() : slugify(name));
    if (!businessSlug) {
      return res.status(400).json({
        success: false,
        error: 'Could not generate a valid slug from business name'
      });
    }

    const created = await createBusiness({
      name: name.trim(),
      slug: businessSlug,
      googleReviewUrl: googleReviewUrl.trim(),
      aiContext: aiContext || '',
      type: type || 'business'
    });

    res.status(201).json({
      success: true,
      data: created
    });
  } catch (err) {
    console.error('Error creating business:', err.message);
    const isDbUnavailable = err.message && err.message.includes('Database is currently unavailable');
    res.status(isDbUnavailable ? 503 : 500).json({
      success: false,
      error: 'Business could not be saved. Please try again.'
    });
  }
});

// Update business status (e.g. "active" | "suspended")
router.patch('/businesses/:slug/status', async (req, res) => {
  const { slug } = req.params;
  const { status } = req.body || {};

  if (!status || !['active', 'suspended'].includes(status)) {
    return res.status(400).json({
      success: false,
      error: 'Status must be either "active" or "suspended"'
    });
  }

  try {
    const updated = await updateBusinessStatus(slug, status);
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: `Business with slug "${slug}" not found`
      });
    }

    res.json({
      success: true,
      data: updated
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update business status' });
  }
});

// Update Google review URL (allows quick testing of custom business URLs)
router.patch('/businesses/:slug', async (req, res) => {
  const { slug } = req.params;
  const { googleReviewUrl } = req.body;

  if (!googleReviewUrl || typeof googleReviewUrl !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'googleReviewUrl string is required'
    });
  }

  try {
    const updated = await updateBusinessGoogleUrl(slug, googleReviewUrl.trim());

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: `Business with slug "${slug}" not found`
      });
    }

    res.json({
      success: true,
      data: updated
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update Google review URL' });
  }
});

// AI Review Generation endpoint
router.post(['/generate-review', '/reviews/generate'], async (req, res) => {
  try {
    const { businessName, rating } = req.body || {};

    if (!rating || Number(rating) < 1 || Number(rating) > 5) {
      return res.status(400).json({
        success: false,
        error: 'A rating between 1 and 5 is required'
      });
    }

    const review = await generateReviewWithAi({
      businessName: typeof businessName === 'string' ? businessName : '',
      rating: Number(rating)
    });

    res.json({
      success: true,
      review,
      data: { review }
    });
  } catch (err) {
    console.error('Error in review generation endpoint:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to generate review'
    });
  }
});

export default router;
