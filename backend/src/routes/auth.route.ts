import express, { Router } from 'express';
import { login } from '../controllers/auth.controller.js';

const rotuer: Router = express.Router();

rotuer.post('/login', login);

export default rotuer;