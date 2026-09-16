import express from 'express';
import { getBusinessBySlug, getAllBusinesses } from '../data/businesses.js';

const router = express.Router();

// Get all configured businesses
router.get('/businesses', (req, res) => {
  res.json({
    success: true,
    data: getAllBusinesses()
  });
});

// Get single business by slug (e.g. /api/businesses/demo-waffle-shop)
router.get('/businesses/:slug', (req, res) => {
  const { slug } = req.params;
  const business = getBusinessBySlug(slug);

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
});

// Update Google review URL (allows quick testing of custom business URLs)
router.patch('/businesses/:slug', (req, res) => {
  const { slug } = req.params;
  const { googleReviewUrl } = req.body;
  const business = getBusinessBySlug(slug);

  if (!business) {
    return res.status(404).json({
      success: false,
      error: `Business with slug "${slug}" not found`
    });
  }

  if (googleReviewUrl && typeof googleReviewUrl === 'string') {
    business.googleReviewUrl = googleReviewUrl.trim();
  }

  res.json({
    success: true,
    data: business
  });
});

export default router;
