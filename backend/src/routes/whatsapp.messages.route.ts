import express, { Router } from 'express';
import { getWhatsappTemplates, whatsappSendTemplateMessage } from '../controllers/whatsapp.messages.controller.js';
import cors from 'cors';

const router: Router = express.Router(); // ✅ fix spelling

// Ensure CORS headers for all message routes (esp. GET /templates)
router.use(
  cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204,
  })
);

router.post('/template-message', whatsappSendTemplateMessage);
router.get('/templates', getWhatsappTemplates);

export default router;
