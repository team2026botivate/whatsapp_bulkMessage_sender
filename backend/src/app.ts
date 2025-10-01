import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import whatsappRoute from './routes/whatsapp.messages.route.js';
import authRoute from './routes/auth.route.js';
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
].map(normalizeOrigin);

const allowedOrigins =
  process.env.NODE_ENV === 'production'
    ? envOrigins.length
      ? envOrigins
      : defaultProdOrigins
    : ['http://localhost:3000']; // development

// Middleware to handle CORS
app.use(
  cors({
    // Only allow known frontend origins
    origin: allowedOrigins,
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
app.use('/api/auth', authRoute);

// Test route
app.get('/', (req, res) => {
  res.json({ success: true, message: 'Server is running' });
});

// Start server
const port = process.env.PORT || 3002;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
