import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import whatsappRoute from './routes/whatsapp.messages.route.js';
import cors from 'cors';

dotenv.config();

const app = express();
// Trust first proxy (needed for secure cookies behind proxies/CDNs)
const allowedOrigins = [
  "http://localhost:3000",
  "https://whatsapp-bulk-message-sender-brown.vercel.app"
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.set('trust proxy', 1);

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
