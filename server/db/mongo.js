import { MongoClient } from 'mongodb';

let client = null;
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

/**
 * Initialize MongoDB connection using official driver if MONGODB_URI is configured.
 */
export async function initDb() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.log('📦 [Database] MONGODB_URI not provided; running with in-memory business store.');
    return;
  }

  try {
    if (!client) {
      client = new MongoClient(uri, {
        serverSelectionTimeoutMS: 5000
      });
      await client.connect();
      db = client.db();
      businessesCollection = db.collection('businesses');

      // Create unique index on slug
      await businessesCollection.createIndex({ slug: 1 }, { unique: true });

      // Seed initial businesses if collection is empty
      const count = await businessesCollection.countDocuments();
      if (count === 0) {
        await businessesCollection.insertMany(PRESET_BUSINESSES.map(b => ({ ...b })));
        console.log('🌱 [Database] Seeded initial businesses into MongoDB Atlas.');
      }

      console.log('✅ [Database] Connected successfully to MongoDB Atlas (businesses collection ready).');
    }
  } catch (err) {
    console.warn('⚠️ [Database] Failed to connect to MongoDB Atlas:', err.message);
    console.log('📦 [Database] Falling back to in-memory business store.');
    businessesCollection = null;
  }
}

/**
 * Find business document by unique slug.
 */
export async function getBusinessBySlug(slug) {
  if (!slug) return null;
  const cleanSlug = slug.toLowerCase().trim();

  if (businessesCollection) {
    try {
      const doc = await businessesCollection.findOne({ slug: cleanSlug });
      if (doc) {
        const { _id, ...rest } = doc;
        return rest;
      }
      return null;
    } catch (err) {
      console.error('Error fetching business by slug from MongoDB:', err);
    }
  }

  const found = memoryStore.get(cleanSlug);
  return found ? { ...found } : null;
}

/**
 * Create a new business document.
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

  if (businessesCollection) {
    try {
      await businessesCollection.updateOne(
        { slug: cleanSlug },
        { $set: businessDoc },
        { upsert: true }
      );
      const saved = await businessesCollection.findOne({ slug: cleanSlug });
      const { _id, ...rest } = saved || businessDoc;
      return rest;
    } catch (err) {
      console.error('Error saving business to MongoDB:', err);
      throw err;
    }
  }

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

  if (businessesCollection) {
    try {
      const res = await businessesCollection.findOneAndUpdate(
        { slug: cleanSlug },
        { $set: { status, updatedAt: now } },
        { returnDocument: 'after' }
      );
      if (res) {
        const { _id, ...rest } = res;
        return rest;
      }
      return null;
    } catch (err) {
      console.error('Error updating business status in MongoDB:', err);
      throw err;
    }
  }

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

  if (businessesCollection) {
    try {
      const res = await businessesCollection.findOneAndUpdate(
        { slug: cleanSlug },
        { $set: { googleReviewUrl: googleReviewUrl.trim(), updatedAt: now } },
        { returnDocument: 'after' }
      );
      if (res) {
        const { _id, ...rest } = res;
        return rest;
      }
      return null;
    } catch (err) {
      console.error('Error updating business Google URL in MongoDB:', err);
    }
  }

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
  if (businessesCollection) {
    try {
      const list = await businessesCollection.find({}).toArray();
      return list.map(({ _id, ...rest }) => rest);
    } catch (err) {
      console.error('Error fetching all businesses from MongoDB:', err);
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
    isConnected: Boolean(businessesCollection),
    databaseName: db ? db.databaseName : 'memory',
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
  if (businessesCollection) {
    try {
      const res = await businessesCollection.deleteOne({ slug: cleanSlug });
      return res.deletedCount > 0;
    } catch (err) {
      console.error('Error deleting business from MongoDB:', err);
      throw err;
    }
  }
  return memoryStore.delete(cleanSlug);
}

/**
 * Cleanly close database connection.
 */
export async function closeDb() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    businessesCollection = null;
  }
}
