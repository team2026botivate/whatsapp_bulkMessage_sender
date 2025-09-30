import express, { Router } from 'express';
import { getWhatsappTemplates, whatsappSendTemplateMessage } from '../controllers/whatsapp.messages.controller.js';

const router: Router = express.Router(); // ✅ fix spelling

router.post('/template-message', whatsappSendTemplateMessage);
router.get('/templates', getWhatsappTemplates);

export default router;
