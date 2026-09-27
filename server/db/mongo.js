import { MongoClient } from 'mongodb';

let client = null;
let clientPromise = null;
let db = null;
let businessesCollection = null;

// Initial preset businesses
const PRESET_BUSINESSES = [
  {
    name: "Demo Waffle Shop",
    slug: "demo-waffle-shop",
    type: "waffle shop",
    googleReviewUrl: "https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4",
    status: "active",
    aiContext: "Waffles, brunch, coffee",
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: "Royal Cafe",
    slug: "royal-cafe",
    type: "cafe",
    googleReviewUrl: "https://search.google.com/local/writereview?placeid=ChIJ3S4Uqc-uEmsRpdAnqj1k58s",
    status: "active",
    aiContext: "Specialty coffee, pastries, relaxing ambience",
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: "Fresh Mart",
    slug: "fresh-mart",
    type: "grocery store",
    googleReviewUrl: "https://search.google.com/local/writereview?placeid=ChIJyeZ2_D-vEmsRLXo7H7P5v5Q",
    status: "active",
    aiContext: "Fresh produce, quick checkout, quality groceries",
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: "XYZ Bar",
    slug: "xyz-bar",
    type: "cocktail bar",
    googleReviewUrl: "https://search.google.com/local/writereview?placeid=ChIJdd4hrwug2EcRmSrV3Vo6llI",
    status: "active",
    aiContext: "Craft cocktails, great night vibe",
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

// In-memory store fallback when MONGODB_URI is not set (e.g. offline testing/CI)
const memoryStore = new Map(PRESET_BUSINESSES.map(b => [b.slug, { ...b }]));

// High-speed, write-invalidated in-memory cache for business documents
const BUSINESS_CACHE_TTL_MS = 60000; // 60 seconds TTL
const businessCache = new Map(); // slug -> { doc, expiresAt }

export function invalidateBusinessCache(slug) {
  if (slug) {
    businessCache.delete(slug.toLowerCase().trim());
  } else {
    businessCache.clear();
  }
}

let indexesChecked = false;
async function ensureIndexesAndSeed(col) {
  if (indexesChecked || !col) return;
  indexesChecked = true;
  try {
    await col.createIndex({ slug: 1 }, { unique: true });
  } catch (idxErr) {
    console.warn('⚠️ [Database] Index verification warning:', idxErr.message);
  }

  try {
    const count = await col.countDocuments();
    if (count === 0) {
      await col.insertMany(PRESET_BUSINESSES.map(b => ({ ...b })));
      console.log('🌱 [Database] Seeded initial businesses into MongoDB Atlas.');
    }
  } catch (seedErr) {
    console.warn('⚠️ [Database] Seed verification warning:', seedErr.message);
  }
}

/**
 * Initialize MongoDB connection using official driver if MONGODB_URI is configured.
 * Thread-safe and serverless-safe: reuses existing connection across invocations.
 */
export async function initDb() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
      console.warn('⚠️ [Database] MONGODB_URI is not configured in environment variables.');
    } else {
      console.log('📦 [Database] MONGODB_URI not provided; running with in-memory business store.');
    }
    return null;
  }

  if (businessesCollection) {
    return businessesCollection;
  }

  if (clientPromise) {
    return clientPromise;
  }

  clientPromise = (async () => {
    try {
      if (!client) {
        client = new MongoClient(uri, {
          serverSelectionTimeoutMS: 5000,
          connectTimeoutMS: 5000,
          maxPoolSize: 10
        });
      }
      await client.connect();
      db = client.db();
      businessesCollection = db.collection('businesses');

      // Trigger index and seed check in background so connection is returned immediately
      ensureIndexesAndSeed(businessesCollection).catch(err => {
        console.warn('⚠️ [Database] Background index/seed warning:', err.message);
      });

      console.log('✅ [Database] Connected successfully to MongoDB Atlas (businesses collection ready).');
      return businessesCollection;
    } catch (err) {
      console.error('⚠️ [Database] Failed to connect to MongoDB Atlas:', err.message);
      // Clean up failed state so subsequent attempts can retry connecting
      client = null;
      clientPromise = null;
      db = null;
      businessesCollection = null;
      throw err;
    }
  })();

  return clientPromise;
}

/**
 * Ensure database is connected if MONGODB_URI is configured.
 */
async function ensureDb() {
  if (!businessesCollection && process.env.MONGODB_URI) {
    try {
      await initDb();
    } catch (err) {
      console.error('⚠️ [Database] ensureDb connection failure:', err.message);
    }
  }
}

/**
 * Find business document by unique slug.
 * Optimized with projection and write-invalidated short-lived cache.
 */
export async function getBusinessBySlug(slug) {
  if (!slug) return null;
  const cleanSlug = slug.toLowerCase().trim();

  // Fast-path: Check write-invalidated in-memory cache
  const cached = businessCache.get(cleanSlug);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.doc;
  }

  await ensureDb();

  if (businessesCollection) {
    try {
      const doc = await businessesCollection.findOne(
        { slug: cleanSlug },
        { projection: { _id: 0 } }
      );
      if (doc) {
        businessCache.set(cleanSlug, {
          doc,
          expiresAt: Date.now() + BUSINESS_CACHE_TTL_MS
        });
        return doc;
      }
      return null;
    } catch (err) {
      console.error('Error fetching business by slug from MongoDB:', err.message);
      throw err;
    }
  }

  // Offline / local development fallback
  const found = memoryStore.get(cleanSlug);
  return found ? { ...found } : null;
}

/**
 * Create a new business document.
 * In production or whenever MONGODB_URI is set, this requires true database persistence.
 * Never creates fake success in transient memory.
 */
export async function createBusiness({ name, slug, googleReviewUrl, aiContext = '', type = 'business' }) {
  if (!name || !slug || !googleReviewUrl) {
    throw new Error('Name, slug, and googleReviewUrl are required');
  }

  const cleanSlug = slug.toLowerCase().trim();
  const now = new Date();

  const businessDoc = {
    name: name.trim(),
    slug: cleanSlug,
    googleReviewUrl: googleReviewUrl.trim(),
    status: 'active',
    aiContext: (aiContext || '').trim(),
    type: type || 'business',
    createdAt: now,
    updatedAt: now
  };

  await ensureDb();

    if (businessesCollection) {
    try {
      await businessesCollection.updateOne(
        { slug: cleanSlug },
        { $set: businessDoc },
        { upsert: true }
      );
      invalidateBusinessCache(cleanSlug);
      const saved = await businessesCollection.findOne({ slug: cleanSlug });
      const { _id, ...rest } = saved || businessDoc;
      return rest;
    } catch (err) {
      console.error('Error saving business to MongoDB:', err.message);
      throw err;
    }
  }

  // Production or configured MongoDB must never mask failure with fake in-memory success
  if (process.env.MONGODB_URI || process.env.NODE_ENV === 'production' || process.env.VERCEL) {
    throw new Error('Database is currently unavailable. Business could not be saved to MongoDB Atlas.');
  }

  // Offline / test fallback ONLY when MONGODB_URI is intentionally unset
  invalidateBusinessCache(cleanSlug);
  memoryStore.set(cleanSlug, businessDoc);
  return { ...businessDoc };
}

/**
 * Update business status: "active" | "suspended"
 */
export async function updateBusinessStatus(slug, status) {
  if (!slug || !['active', 'suspended'].includes(status)) {
    throw new Error('Valid slug and status ("active" | "suspended") are required');
  }

  const cleanSlug = slug.toLowerCase().trim();
  const now = new Date();

  await ensureDb();

  if (businessesCollection) {
    try {
      const res = await businessesCollection.findOneAndUpdate(
        { slug: cleanSlug },
        { $set: { status, updatedAt: now } },
        { returnDocument: 'after' }
      );
      invalidateBusinessCache(cleanSlug);
      if (res) {
        const { _id, ...rest } = res;
        return rest;
      }
      return null;
    } catch (err) {
      console.error('Error updating business status in MongoDB:', err.message);
      throw err;
    }
  }

  if (process.env.MONGODB_URI || process.env.NODE_ENV === 'production' || process.env.VERCEL) {
    throw new Error('Database is currently unavailable. Could not update business status.');
  }

  invalidateBusinessCache(cleanSlug);
  const found = memoryStore.get(cleanSlug);
  if (!found) return null;
  found.status = status;
  found.updatedAt = now;
  memoryStore.set(cleanSlug, found);
  return { ...found };
}

/**
 * Update business Google review URL.
 */
export async function updateBusinessGoogleUrl(slug, googleReviewUrl) {
  if (!slug || !googleReviewUrl) return null;
  const cleanSlug = slug.toLowerCase().trim();
  const now = new Date();

  await ensureDb();

  if (businessesCollection) {
    try {
      const res = await businessesCollection.findOneAndUpdate(
        { slug: cleanSlug },
        { $set: { googleReviewUrl: googleReviewUrl.trim(), updatedAt: now } },
        { returnDocument: 'after' }
      );
      invalidateBusinessCache(cleanSlug);
      if (res) {
        const { _id, ...rest } = res;
        return rest;
      }
      return null;
    } catch (err) {
      console.error('Error updating business Google URL in MongoDB:', err.message);
      throw err;
    }
  }

  if (process.env.MONGODB_URI || process.env.NODE_ENV === 'production' || process.env.VERCEL) {
    throw new Error('Database is currently unavailable. Could not update business Google URL.');
  }

  invalidateBusinessCache(cleanSlug);
  const found = memoryStore.get(cleanSlug);
  if (!found) return null;
  found.googleReviewUrl = googleReviewUrl.trim();
  found.updatedAt = now;
  memoryStore.set(cleanSlug, found);
  return { ...found };
}

/**
 * Return all businesses.
 */
export async function getAllBusinesses() {
  await ensureDb();

  if (businessesCollection) {
    try {
      const list = await businessesCollection.find({}).toArray();
      return list.map(({ _id, ...rest }) => rest);
    } catch (err) {
      console.error('Error fetching all businesses from MongoDB:', err.message);
      throw err;
    }
  }

  return Array.from(memoryStore.values()).map(b => ({ ...b }));
}

/**
 * Return metadata about the active database connection (database name, collection name, connected status).
 * Does NOT expose URI or credentials.
 */
export function getDbInfo() {
  return {
    isConfigured: Boolean(process.env.MONGODB_URI),
    isConnected: Boolean(businessesCollection),
    databaseName: db ? db.databaseName : (process.env.MONGODB_URI ? null : 'memory'),
    collectionName: 'businesses',
    isAtlas: Boolean(businessesCollection)
  };
}

/**
 * Delete a business document by slug (used for cleaning temporary test records).
 */
export async function deleteBusinessBySlug(slug) {
  if (!slug) return false;
  const cleanSlug = slug.toLowerCase().trim();

  await ensureDb();
  invalidateBusinessCache(cleanSlug);

  if (businessesCollection) {
    try {
      const res = await businessesCollection.deleteOne({ slug: cleanSlug });
      return res.deletedCount > 0;
    } catch (err) {
      console.error('Error deleting business from MongoDB:', err.message);
      throw err;
    }
  }

  return memoryStore.delete(cleanSlug);
}

/**
 * Cleanly close database connection.
 */
export async function closeDb() {
  invalidateBusinessCache();
  if (client) {
    await client.close();
    client = null;
    clientPromise = null;
    db = null;
    businessesCollection = null;
  }
}
