import express from "express";
import Jeton from "../models/Jeton.js";

const router = express.Router();

// Barcha jetonlarni olish
router.get("/", async (req, res) => {
  try {
    const jetons = await Jeton.find().sort({ createdAt: -1 });
    res.json(jetons);
  } catch (err) {
    console.error("Jetonlarni olishda xatolik:", err);
    res
      .status(500)
      .json({ error: "Jetonlarni olishda xatolik: " + err.message });
  }
});

// Yangi jeton qo'shish
router.post("/", async (req, res) => {
  try {
    const { code, child_name, parent_phone, isActive } = req.body;

    // Jeton kodi mavjudligini tekshirish
    const existingJeton = await Jeton.findOne({ code });
    if (existingJeton) {
      return res.status(400).json({ error: "Bu jeton kodi allaqachon mavjud" });
    }

    const jeton = new Jeton({
      code,
      child_name,
      parent_phone,
      isActive: isActive !== undefined ? isActive : true,
    });

    await jeton.save();
    res.json(jeton);
  } catch (err) {
    console.error("Jeton qo'shishda xatolik:", err);
    res.status(500).json({ error: "Jeton qo'shishda xatolik: " + err.message });
  }
});

// Jetonni ID bo'yicha olish
router.get("/:id", async (req, res) => {
  try {
    const jeton = await Jeton.findById(req.params.id);
    if (!jeton) return res.status(404).json({ error: "Jeton topilmadi" });
    res.json(jeton);
  } catch (err) {
    console.error("Jetonni olishda xatolik:", err);
    res.status(500).json({ error: "Jetonni olishda xatolik: " + err.message });
  }
});

// Jetonni o'zgartirish
router.put("/:id", async (req, res) => {
  try {
    const { code, child_name, parent_phone, isActive } = req.body;

    // Agar kod o'zgarayotgan bo'lsa, boshqa jetonda bunday kod bor-yo'qligini tekshirish
    if (code) {
      const existingJeton = await Jeton.findOne({
        code,
        _id: { $ne: req.params.id },
      });
      if (existingJeton) {
        return res
          .status(400)
          .json({ error: "Bu jeton kodi allaqachon mavjud" });
      }
    }

    const jeton = await Jeton.findByIdAndUpdate(
      req.params.id,
      { code, child_name, parent_phone, isActive },
      { new: true }
    );

    if (!jeton) return res.status(404).json({ error: "Jeton topilmadi" });
    res.json(jeton);
  } catch (err) {
    console.error("Jetonni o'zgartirishda xatolik:", err);
    res
      .status(500)
      .json({ error: "Jetonni o'zgartirishda xatolik: " + err.message });
  }
});

// Jetonni o'chirish
router.delete("/:id", async (req, res) => {
  try {
    const jeton = await Jeton.findByIdAndDelete(req.params.id);
    if (!jeton) return res.status(404).json({ error: "Jeton topilmadi" });
    res.json({ ok: true, message: "Jeton o'chirildi" });
  } catch (err) {
    console.error("Jetonni o'chirishda xatolik:", err);
    res
      .status(500)
      .json({ error: "Jetonni o'chirishda xatolik: " + err.message });
  }
});

// Barcha jetonlarni o'chirish (admin)
router.delete("/", async (req, res) => {
  try {
    await Jeton.deleteMany({});
    res.json({ ok: true, message: "Barcha jetonlar o'chirildi" });
  } catch (err) {
    console.error("Jetonlarni o'chirishda xatolik:", err);
    res
      .status(500)
      .json({ error: "Jetonlarni o'chirishda xatolik: " + err.message });
  }
});

// Jeton kodini validatsiya qilish (barcode scan uchun)
router.post("/validate", async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: "Jeton kodi talab qilinadi" });
    }

    const jeton = await Jeton.findOne({ code: code.trim() });
    if (!jeton) {
      return res.status(404).json({
        error: "Jeton topilmadi",
        valid: false,
      });
    }

    if (!jeton.isActive) {
      return res.status(400).json({
        error: "Jeton nofaol holatda",
        valid: false,
        jeton,
      });
    }

    // Ishlatilganlik hisoblagichini yangilash
    await Jeton.findByIdAndUpdate(jeton._id, {
      $inc: { usageCount: 1 },
      $set: { lastUsed: new Date() },
    });

    res.json({
      valid: true,
      message: "Jeton yaroqli",
      jeton: {
        ...jeton.toObject(),
        usageCount: jeton.usageCount + 1,
        lastUsed: new Date(),
      },
    });
  } catch (err) {
    console.error("Jeton validatsiyasida xatolik:", err);
    res.status(500).json({
      error: "Jeton validatsiyasida xatolik: " + err.message,
      valid: false,
    });
  }
});

export default router;
