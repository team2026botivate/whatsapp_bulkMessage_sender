import { Request, Response } from "express";

export const login = (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email ) {
    return res.status(400).json({ success: false, message: " email are required" });
  }

  if (!password ) {
    return res.status(400).json({ success: false, message: " password are required" });
  }

  if (
    email === "satyendratandan3921@gmail.com" &&
    password === "satyendra@botivate.in@8871527519"
  ) {
    res
      .cookie("auth-token", "qwertyuiopasdfghjkl;zxcvbnm,./", {
        httpOnly: true,
        secure: true,       // ✅ HTTPS required
        sameSite: "none",   // ✅ for cross-domain cookies
        maxAge: 24 * 60 * 60 * 1000,
      })
      .status(200)
      .json({ success: true, message: "Login successful" });
  } else {
    res.status(401).json({ success: false, message: "Invalid credentials" });
  }
};
