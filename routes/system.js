import express from "express";
import Child from "../models/Child.js";
import History from "../models/History.js";
import Jeton from "../models/Jeton.js";

const router = express.Router();

// Database statistikasi
router.get("/stats", async (req, res) => {
  try {
    const childrenCount = await Child.countDocuments();
    const historyCount = await History.countDocuments();
    const jetonsCount = await Jeton.countDocuments();
    const activeChildren = await Child.countDocuments({ exit_time: null });

    res.json({
      children: childrenCount,
      history: historyCount,
      jetons: jetonsCount,
      activeChildren,
      lastUpdate: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Statistikani olishda xatolik:", err);
    res
      .status(500)
      .json({ error: "Statistikani olishda xatolik: " + err.message });
  }
});

// Barcha ma'lumotlarni o'chirish (XAVFLI!)
router.delete("/clear-all", async (req, res) => {
  try {
    await Child.deleteMany({});
    await History.deleteMany({});
    await Jeton.deleteMany({});

    console.log("⚠️  Barcha ma'lumotlar o'chirildi!");
    res.json({
      message: "Barcha ma'lumotlar muvaffaqiyatli o'chirildi",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Ma'lumotlarni o'chirishda xatolik:", err);
    res
      .status(500)
      .json({ error: "Ma'lumotlarni o'chirishda xatolik: " + err.message });
  }
});

// Children ma'lumotlarini o'chirish
router.delete("/clear-children", async (req, res) => {
  try {
    const result = await Child.deleteMany({});
    console.log(`⚠️  ${result.deletedCount} ta children o'chirildi`);
    res.json({
      message: `${result.deletedCount} ta children muvaffaqiyatli o'chirildi`,
      deletedCount: result.deletedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Children o'chirishda xatolik:", err);
    res
      .status(500)
      .json({ error: "Children o'chirishda xatolik: " + err.message });
  }
});

// History ma'lumotlarini o'chirish
router.delete("/clear-history", async (req, res) => {
  try {
    const result = await History.deleteMany({});
    console.log(`⚠️  ${result.deletedCount} ta history o'chirildi`);
    res.json({
      message: `${result.deletedCount} ta history muvaffaqiyatli o'chirildi`,
      deletedCount: result.deletedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("History o'chirishda xatolik:", err);
    res
      .status(500)
      .json({ error: "History o'chirishda xatolik: " + err.message });
  }
});

// Jetonlarni o'chirish
router.delete("/clear-jetons", async (req, res) => {
  try {
    const result = await Jeton.deleteMany({});
    console.log(`⚠️  ${result.deletedCount} ta jeton o'chirildi`);
    res.json({
      message: `${result.deletedCount} ta jeton muvaffaqiyatli o'chirildi`,
      deletedCount: result.deletedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Jetonlarni o'chirishda xatolik:", err);
    res
      .status(500)
      .json({ error: "Jetonlarni o'chirishda xatolik: " + err.message });
  }
});

export default router;
