// server.js - Kids CRM Backend API
import "dotenv/config.js";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

import childrenRoutes from "./routes/children.js";
import historyRoutes from "./routes/history.js"; // /api/reports/daily yoki /api/history/...
import jetonRoutes from "./routes/jeton.js";
import systemRoutes from "./routes/system.js";
import cookieParser from "cookie-parser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cookieParser()); // <-- Bu qatordan keyin yozing!

/* ========= Asosiy sozlamalar ========= */
app.set("trust proxy", 1);

/* ========= Request loglari (diagnostika) ========= */
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
});

/* ========= CORS sozlamalari =========
   FRONTEND_URL ni vergul bilan ajratib bir nechta domen kiritsa bo'ladi:
   FRONTEND_URL=https://chustkids-crm.netlify.app,https://yourdomain.com
*/
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",").map((s) => s.trim())
  : true; // dev uchun true -> barcha originlarga ruxsat

console.log("🌐 CORS allowed origins:", allowedOrigins);

const corsOptions = {
  origin: function (origin, callback) {
    // Agar origin yo'q bo'lsa (masalan, Postman) yoki allowed origins ro'yxatida bo'lsa
    if (!origin || allowedOrigins === true || allowedOrigins.includes(origin)) {
      console.log("✅ CORS allowed for origin:", origin || "no-origin");
      callback(null, true);
    } else {
      console.log("❌ CORS blocked for origin:", origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Cache-Control",
    "cache-control",
    "Pragma",
    "Expires",
    "X-Requested-With",
    "Accept",
    "Origin",
    "User-Agent",
    "Referer",
  ],
  optionsSuccessStatus: 200, // IE11 uchun
};

app.use(cors(corsOptions));

// Preflight OPTIONS so'rovlari uchun maxsus handler
app.options("*", (req, res) => {
  console.log(
    "🔄 OPTIONS preflight request for:",
    req.path,
    "from:",
    req.get("Origin")
  );
  res.header("Access-Control-Allow-Origin", req.get("Origin") || "*");
  res.header(
    "Access-Control-Allow-Methods",
    "GET,PUT,POST,DELETE,OPTIONS,PATCH"
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Cache-Control, X-Requested-With, Accept, Origin"
  );
  res.header("Access-Control-Allow-Credentials", true);
  res.sendStatus(200);
});

// Barcha response'larga CORS headerlarini qo'shish
app.use((req, res, next) => {
  const origin = req.get("Origin");
  if (origin && (allowedOrigins === true || allowedOrigins.includes(origin))) {
    res.header("Access-Control-Allow-Origin", origin);
  }
  res.header("Access-Control-Allow-Credentials", "true");
  res.header(
    "Access-Control-Allow-Methods",
    "GET,PUT,POST,DELETE,OPTIONS,PATCH"
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Cache-Control, X-Requested-With, Accept, Origin"
  );
  next();
});

/* ========= Body parser ========= */
app.use(express.json({ limit: "1mb" }));

/* ========= Health check ========= */
app.get("/api", (_req, res) => {
  res.send("Kids CRM Backend v2.0 ishlayapti 🚀");
});
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, now: new Date().toISOString(), version: "2.0.0" });
});

/* ========= API Routes ========= */
console.log("📝 Registering routes...");
app.use("/api/children", childrenRoutes);
app.use("/api", historyRoutes);
app.use("/api/jetons", jetonRoutes);
app.use("/api/system", systemRoutes);
console.log(
  "✅ Routes registered: /api/children, /api/history, /api/jetons, /api/system"
);

/* ========= API 404 handler ========= */
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "API route topilmadi" });
});

/* ========= (Ixtiyoriy) Frontend buildni backenddan servis qilish =========
   Agar SERVE_FRONTEND=true yoki ./dist(index.html) mavjud bo'lsa,
   React/Vue buildni statik qilib servis qilamiz. Shu holda CORS umuman kerak bo'lmaydi.
*/
const STATIC_DIR = process.env.STATIC_DIR || "dist"; // yoki 'public'
const shouldServeFrontend =
  process.env.SERVE_FRONTEND === "true" ||
  fs.existsSync(path.join(__dirname, STATIC_DIR, "index.html"));

if (shouldServeFrontend) {
  const staticPath = path.join(__dirname, STATIC_DIR);
  app.use(express.static(staticPath));

  // SPA (React Router) fallback
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  console.log(`Frontend statik servis yoqildi: ${STATIC_DIR}/ ✅`);
} else {
  console.log("Frontend statik servis o'chirilgan (SERVE_FRONTEND=false).");
}

/* ========= MongoDB ulanish va serverni ishga tushirish ========= */
const MONGO_URL =
  process.env.MONGO_URL ||
  process.env.MONGO_URI || // eski nom bilan moslik
  "mongodb://127.0.0.1:27017/kids_crm";

const PORT = Number(process.env.PORT) || 5000;

console.log(
  "🔍 MONGO_URL:",
  MONGO_URL.includes("@") ? "MongoDB Atlas" : MONGO_URL
);

mongoose
  .connect(MONGO_URL)
  .then(() => {
    console.log("MongoDB ulandi ✅");
    app.listen(PORT, () => {
      console.log(`Server ${PORT} portda ishlayapti 🚀`);
    });
  })
  .catch((err) => {
    console.error("MongoDB xato ❌", err);
    process.exit(1);
  });

/* ========= Graceful shutdown ========= */
process.on("SIGINT", async () => {
  console.log("\n⬇️ SIGINT: MongoDB ulanishi yopilmoqda...");
  await mongoose.connection.close();
  process.exit(0);
});
