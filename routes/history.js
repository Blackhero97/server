// routes/history.js
import express from "express";
import {
  getDailyReport,
  backfillHistory,
} from "../controllers/historyController.js";

const router = express.Router();

// Kunlik hisobot
router.get("/reports/daily", getDailyReport);

// Bir martalik migratsiya (admin uchun)
router.post("/reports/backfill-history", backfillHistory);

export default router;
