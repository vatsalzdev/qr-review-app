import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import apiRoutes from '../server/routes/api.js';
import { initDb } from '../server/db/mongo.js';

const app = express();

app.use(cors());
app.use(express.json());

// Ensure database connection is initialized for serverless invocations before handling routes
app.use(async (req, res, next) => {
  if (process.env.MONGODB_URI) {
    try {
      await initDb();
    } catch (err) {
      console.error('Vercel serverless initDb error:', err.message);
    }
  }
  next();
});

// Support both /api/... (direct) and rewritten routes
app.use('/api', apiRoutes);
app.use(apiRoutes);

export default app;
