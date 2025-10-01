import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import whatsappRoute from './routes/whatsapp.messages.route.js';
import cors from 'cors';

dotenv.config();

const app = express();
// Trust first proxy (needed for secure cookies behind proxies/CDNs)
app.set('trust proxy', 1);

// Allowed frontend origins
const normalizeOrigin = (s: string) => s.trim().replace(/\/$/, '').toLowerCase();
const envOrigins = (process.env.FRONT_END_URLS || process.env.FRONT_END_URL || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .map(normalizeOrigin);

// Fallback defaults for production if env not set
const defaultProdOrigins = [
  'https://whatsapp-bulk-message-sender-brown.vercel.app',
  'https://whatsapp-bulk-message-sender-26ome4p8k.vercel.app',
  "https://whatsapp-bulk-message-sender-brown.vercel.app/login",

].map(normalizeOrigin);

// Build a union of env-provided, defaults, and localhost (do not rely solely on NODE_ENV)
const allowedOrigins = Array.from(
  new Set([
    ...defaultProdOrigins,
    ...envOrigins,
    normalizeOrigin('http://localhost:3000'),
  ])
);


console.log('Allowed CORS origins:', allowedOrigins);
app.use(
  cors({
    // Only allow known frontend origins
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // allow non-browser tools
      const normalized = normalizeOrigin(origin);
      const allowed = allowedOrigins.includes(normalized);
      if (allowed) return callback(null, true);
      // Do not error; respond without CORS headers so browser blocks instead of 500
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204,
  })
);

// Ensure caches respect per-origin responses
app.use((req, res, next) => {
  res.header('Vary', 'Origin');
  next();
});

// Note: Explicit catch-all OPTIONS handler not needed; cors() above handles preflight in Express 5

// Parse JSON and cookies
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api/messages', whatsappRoute);

// Test route
app.get('/', (req, res) => {
  res.json({ success: true, message: 'Server is running' });
});

// Global error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  const status = err.status || 500;
  res.status(status).json({ success: false, message: err.message || 'Internal Server Error' });
});

// Start server
const port = process.env.PORT || 3002;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
