import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRoutes from './routes/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for Vite dev server
app.use(cors());
app.use(express.json());

// API endpoints
app.use('/api', apiRoutes);

// Serve static frontend in production if built
const clientDistPath = path.resolve(__dirname, '../client/dist');
app.use(express.static(clientDistPath));

// Handle client-side routing fallback (Express 5 compatible)
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  const indexPath = path.join(clientDistPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      // In dev mode before build, return API ready status
      res.status(200).json({
        status: 'API running. Run Vite frontend at port 5173 or run npm run build.'
      });
    }
  });
});

app.listen(PORT, () => {
  console.log(`Review Backend Server running on http://localhost:${PORT}`);
});
