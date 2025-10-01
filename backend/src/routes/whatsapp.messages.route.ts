import express, { Router } from 'express';
import { getWhatsappTemplates, whatsappSendTemplateMessage } from '../controllers/whatsapp.messages.controller.js';

const router: Router = express.Router(); // ✅ fix spelling

// Ensure CORS headers for all message routes (esp. GET /templates)


router.post('/template-message', whatsappSendTemplateMessage);
router.get('/templates', getWhatsappTemplates);

export default router;
