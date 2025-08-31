// routes/children.js
import express from "express";
import {
  getChildren,
  getChildByQr,
  getChildByCode,
  checkoutChild,
  extendTime,
  scanByToken,
  getHistoryByToken,
  reprintReceipt,
  deleteChild,
  deleteAllChildren,
} from "../controllers/childrenController.js";

const router = express.Router();

/* =========================
   PUBLIC ROUTES (no auth)
   ========================= */

// QR token bilan check-in/out toggle
router.get(
  "/scan/:token",
  (req, res, next) => {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    res.removeHeader && res.removeHeader("ETag");
    next();
  },
  scanByToken
);

/* =========================
   AUTHENTICATED ROUTES
   ========================= */

// Bolalar ro'yxati
router.get("/", getChildren);

// Eski tizim mosligi
router.get("/qr/:qr_code", getChildByQr);
router.get("/by-code/:code", getChildByCode);

// Qo'lda amal qilishlar
router.put("/checkout/:id", checkoutChild);
router.put("/extend/:id", extendTime);

// Jeton tarixi
router.get("/history/:token", getHistoryByToken);

// Chekni qayta chop etish
router.post("/:id/reprint", reprintReceipt);

// Barcha sessiyalarni o'chirish (admin/test uchun) - BIRINCHI
router.delete("/clear", deleteAllChildren);

// Bitta sessiyani o'chirish - IKKINCHI
router.delete("/:id", deleteChild);

export default router;
