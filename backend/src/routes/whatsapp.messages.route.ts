import express, { Router } from 'express';
import {
  getWhatsappTemplates,
  whatsappSendTemplateMessage,
  getJobStatus,
} from '../controllers/whatsapp.messages.controller.js';

const router: Router = express.Router();

router.post('/template-message', whatsappSendTemplateMessage);
router.get('/templates', getWhatsappTemplates);
router.get('/job/:jobId', getJobStatus);

export default router;
