import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import whatsappRoute from './routes/whatsapp.messages.route.js';
import authRoute from './routes/auth.route.js';
import cors from 'cors';

dotenv.config();

const app = express();

const allowedOrigins =
  process.env.NODE_ENV === "production"
    ? [process.env.FRONT_END_URL as string] // sirf prod URL allow
    : ["http://localhost:3000"];  // dev ke liye  

app.use(
  cors({
    origin: allowedOrigins as string[],
    credentials: true,
    exposedHeaders: ["auth-token"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "auth-token"],
  })
);
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
