// middlewares/auth.js
import jwt from "jsonwebtoken";

/** Majburiy autentifikatsiya middleware */
export function auth(req, res, next) {
  // CORS preflight so'rovi (auth talab qilinmaydi)
  if (req.method === "OPTIONS") return res.sendStatus(204);

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error("❌ JWT_SECRET environment o'rnatilmagan");
    return res.status(500).json({ message: "Server konfiguratsiya xatosi" });
  }

  // 1) Authorization: Bearer <token>
  const header = req.headers.authorization || "";
  const [scheme, tokenFromHeader] = header.split(" ");

  // 2) Cookie (ixtiyoriy): cookie_parser bo'lsa req.cookies.jwt
  const tokenFromCookie = req.cookies?.jwt;

  const token =
    scheme === "Bearer" && tokenFromHeader ? tokenFromHeader : tokenFromCookie;

  if (!token) {
    return res.status(401).json({ message: "Jeton yo‘q yoki noto‘g‘ri" });
  }

  try {
    // clockTolerance: 60s — soat farqlari uchun kichik bufer
    const payload = jwt.verify(token, secret, { clockTolerance: 60 });
    req.user = payload; // masalan: { id, role, ... }
    return next();
  } catch (_err) {
    return res
      .status(401)
      .json({ message: "Jeton yaroqsiz yoki muddati tugagan" });
  }
}

/** Ixtiyoriy: role tekshirish */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user?.role || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Ruxsat yo‘q" });
    }
    next();
  };
}
