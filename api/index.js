import express from 'express';
import cors from 'cors';
import apiRoutes from '../server/routes/api.js';
import { initDb } from '../server/db/mongo.js';

// Initialize database connection for serverless invocation
initDb().catch((err) => {
  console.warn('Vercel serverless initDb warning:', err.message);
});

const app = express();

app.use(cors());
app.use(express.json());

// Support both /api/... (direct) and rewritten routes
app.use('/api', apiRoutes);
app.use(apiRoutes);

export default app;
