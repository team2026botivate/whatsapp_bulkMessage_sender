import express, { Router } from 'express';
import { login } from '../controllers/auth.controller.js';

const router: Router = express.Router(); // ✅ fix spelling

router.post('/login', login);

export default router;
