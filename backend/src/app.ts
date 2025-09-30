import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import whatsappRoute from './routes/whatsapp.messages.route.js';
import authRoute from './routes/auth.route.js';
import cors from 'cors';

dotenv.config();

const app = express();

app.use(
  cors({
    origin: process.env.FRONT_END_URL,
    credentials: true,
  })
);
const port = process.env.PORT || 3002;
app.use(express.json());
app.use(cookieParser());

app.use('/api/messages', whatsappRoute);
app.use('/api/auth', authRoute);


app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
