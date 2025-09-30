import express, { Router } from 'express';
import { getWhatsappTemplates, whatsappSendTemplateMessage } from '../controllers/whatsapp.messages.controller.js';

const rotuer: Router = express.Router();

rotuer.post('/template-message', whatsappSendTemplateMessage);
rotuer.get('/templates', getWhatsappTemplates);

export default rotuer;
