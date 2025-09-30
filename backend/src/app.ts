import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import whatsappRoute from './routes/whatsapp.messages.route.js';
import authRoute from './routes/auth.route.js';
import cors from 'cors';

dotenv.config();

const app = express();

// Allowed frontend origins
const allowedOrigins = process.env.NODE_ENV === "production"
  ? [process.env.FRONT_END_URL as string] // production
  : ["http://localhost:3000"];           // development

// Middleware to handle CORS
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
  })
);

// Note: Explicit catch-all OPTIONS handler not needed; cors() above handles preflight in Express 5

// Parse JSON and cookies
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api/messages', whatsappRoute);
app.use('/api/auth', authRoute);

// Test route
app.get('/', (req, res) => {
  res.json({ success: true, message: "Server is running" });
});

// Start server
const port = process.env.PORT || 3002;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
