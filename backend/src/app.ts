import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import whatsappRoute from './routes/whatsapp.messages.route.js';
import authRoute from './routes/auth.route.js';
import cors from 'cors';

dotenv.config();

const app = express();

const allowedOrigins = process.env.NODE_ENV === "production"
  ? [process.env.FRONT_END_URL as string]
  : ["http://localhost:3000"];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) callback(null, true);
      else callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // allow preflight
  })
);

// Handle OPTIONS requests globally
app.options("*", cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
}));

const port = process.env.PORT || 3002;
app.use(express.json());
app.use(cookieParser());

app.use('/api/messages', whatsappRoute);
app.use('/api/auth', authRoute);
app.get('/', (req, res) => {
  res.json({ success: true , message:"Server is running"});
});


app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
