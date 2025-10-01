import { Request, Response } from 'express';

export const login = (req: Request, res: Response) => {
  try {
    const { email, password } = req.body || {};

    if (!email) {
      return res.status(400).json({ success: false, message: 'email is required' });
    }

    if (!password) {
      return res.status(400).json({ success: false, message: 'password is required' });
    }

    if (
      email === 'satyendratandan3921@gmail.com' &&
      password === 'satyendra@botivate.in@8871527519'
    ) {
      const token = 'qwertyuiopasdfghjkl;zxcvbnm';
      res
        .cookie('auth-token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production', // HTTPS required
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
          maxAge: 24 * 60 * 60 * 1000,
          path: '/',
        })
        .status(200)
        .json({ success: true, message: 'Login successful' });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};
