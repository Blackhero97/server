// controllers/childrenController.js
import Child from "../models/Child.js";
import History from "../models/History.js";
import Jeton from "../models/Jeton.js";
import { v4 as uuidv4 } from "uuid";
import { printReceiptOS } from "../services/osPrinter.js";

// ====== Konfiguratsiya (ENV) ======
const BASE_COST = Number(process.env.BASE_COST) || 50000; // 1 soat narx
const PER_MINUTE_COST = BASE_COST / 60; // minut narxi
const ROUND_TO = Number(process.env.ROUND_TO ?? 100); // 0 => integer
const ROUND_STRATEGY = (process.env.ROUND_STRATEGY || "ceil").toLowerCase();

// ====== Yordamchi funksiyalar ======
const roundAmount = (amount) => {
  if (!ROUND_TO || ROUND_TO <= 0) return Math.round(amount);
  const q = amount / ROUND_TO;
  if (ROUND_STRATEGY === "floor") return Math.floor(q) * ROUND_TO;
  if (ROUND_STRATEGY === "round") return Math.round(q) * ROUND_TO;
  return Math.ceil(q) * ROUND_TO;
};

const minutesBetween = (a, b) =>
  Math.ceil(Math.max(0, b.getTime() - a.getTime()) / (1000 * 60));

const buildReceipt = ({ child, result, tokenAtCheckout }) => {
  const entry = new Date(child.entry_time);
  const paidUntil = new Date(result.paid_until || child.entry_time);
  const exit = new Date(result.exit_time);

  const includedMin = minutesBetween(entry, paidUntil);
  const extraMin = exit > paidUntil ? minutesBetween(paidUntil, exit) : 0;

  const baseAmount = child.base_amount || roundAmount(BASE_COST);
  const finalTotal = result.paid_amount;
  const extraFee = Math.max(0, finalTotal - baseAmount);

  return {
    sessionId: String(child._id),
    token: tokenAtCheckout || child.token_code || null,
    currency: "UZS",
    entry_time: entry,
    paid_until: paidUntil,
    exit_time: exit,
    included_minutes: includedMin,
    extra_minutes: extraMin,
    per_minute: PER_MINUTE_COST,
    base_amount: baseAmount,
    extra_fee: Math.round(extraFee),
    total: Math.round(finalTotal),
    rounding: { round_to: ROUND_TO, strategy: ROUND_STRATEGY },
    printed_at: new Date(),
  };
};

// VIP jetonlar uchun checkout logikasi
const computeCheckout = ({ child, nowDate, jetonTariff = "standard" }) => {
  const entry = new Date(child.entry_time);
  const exit = nowDate;
  const baseAmount = child.base_amount || roundAmount(BASE_COST);

  // VIP jetonlar uchun qo'shimcha to'lov yo'q
  if (jetonTariff === "vip") {
    return {
      paid_until: entry,
      exit_time: exit,
      paid_amount: baseAmount,
    };
  }

  // Standard jetonlar uchun vaqt hisoblanadi
  const paidUntil = new Date(child.entry_time.getTime() + 60 * 60 * 1000); // +1 soat

  if (exit <= paidUntil) {
    return {
      paid_until: paidUntil,
      exit_time: exit,
      paid_amount: baseAmount,
    };
  }

  const extraMin = minutesBetween(paidUntil, exit);

  // ✨ YANGI TARIF LOGIKASI: Birinchi 10 daqiqa bepul, keyingi har daqiqa 5000 so'm
  let extraFee = 0;
  if (extraMin > 10) {
    // Faqat 10 daqiqadan keyin to'lov hisoblanadi
    const chargeableMinutes = extraMin - 10;
    extraFee = roundAmount(chargeableMinutes * PER_MINUTE_COST);
  }
  // Aks holda extraFee = 0 (birinchi 10 daqiqa bepul)

  return {
    paid_until: paidUntil,
    exit_time: exit,
    paid_amount: baseAmount + extraFee,
  };
};

// ======== API Endpointlar ========

export const getChildren = async (_req, res) => {
  try {
    const children = await Child.find({}).sort({ entry_time: -1 });
    res.json({ children });
  } catch (e) {
    console.error("getChildren error:", e);
    res.status(500).json({ error: "Ma'lumotlarni olishda xatolik" });
  }
};

export const getChildByQr = async (req, res) => {
  try {
    const { qr } = req.params;
    const child = await Child.findOne({ qr_code: qr });
    if (!child) {
      return res.status(404).json({ error: "QR kod topilmadi" });
    }
    res.json({ child });
  } catch (e) {
    console.error("getChildByQr error:", e);
    res.status(500).json({ error: "QR kod orqali qidirishda xatolik" });
  }
};

export const getChildByCode = async (req, res) => {
  try {
    const { code } = req.params;
    const child = await Child.findOne({ token_code: code });
    if (!child) {
      return res.status(404).json({ error: "Token kod topilmadi" });
    }
    res.json({ child });
  } catch (e) {
    console.error("getChildByCode error:", e);
    res.status(500).json({ error: "Token kod orqali qidirishda xatolik" });
  }
};

export const checkoutChild = async (req, res) => {
  try {
    const { id } = req.params;
    const child = await Child.findById(id);

    if (!child) {
      return res.status(404).json({ error: "Sessiya topilmadi" });
    }

    if (child.exit_time) {
      return res
        .status(400)
        .json({ error: "Bu sessiya allaqachon yakunlangan" });
    }

    const nowDate = new Date();
    const result = computeCheckout({ child, nowDate });

    // Child modelini yangilash
    await Child.findByIdAndUpdate(id, {
      exit_time: result.exit_time,
      paid_until: result.paid_until,
      paid_amount: result.paid_amount,
    });

    // History ga qo'shish
    const historyEntry = new History({
      child_id: child._id,
      session_id: uuidv4(),
      token_code: child.token_code,
      jeton_name: child.jeton_name,
      entry_time: child.entry_time,
      exit_time: result.exit_time,
      paid_until: result.paid_until,
      base_amount: child.base_amount,
      paid_amount: result.paid_amount,
    });
    await historyEntry.save();

    const receipt = buildReceipt({ child, result });

    res.json({
      ok: true,
      action: "checkout",
      message: "Sessiya muvaffaqiyatli yakunlandi",
      receipt,
    });
  } catch (e) {
    console.error("Checkout xatosi:", e);
    res.status(500).json({ error: "Checkout jarayonida xatolik" });
  }
};

export const extendTime = async (req, res) => {
  try {
    const { id } = req.params;
    const { minutes } = req.body;

    if (!minutes || minutes <= 0) {
      return res.status(400).json({ error: "Vaqt miqdori noto'g'ri" });
    }

    const child = await Child.findById(id);
    if (!child || child.exit_time) {
      return res.status(404).json({ error: "Faol sessiya topilmadi" });
    }

    const extensionCost = roundAmount(minutes * PER_MINUTE_COST);
    const newPaidUntil = new Date(
      (child.paid_until || child.entry_time).getTime() + minutes * 60 * 1000
    );

    await Child.findByIdAndUpdate(id, {
      paid_until: newPaidUntil,
      base_amount: (child.base_amount || 0) + extensionCost,
    });

    res.json({
      ok: true,
      message: `${minutes} daqiqa qo'shildi`,
      cost: extensionCost,
      new_paid_until: newPaidUntil,
    });
  } catch (e) {
    console.error("Vaqt uzaytirishda xatolik:", e);
    res.status(500).json({ error: "Vaqt uzaytirishda xatolik" });
  }
};

export const scanByToken = async (req, res) => {
  try {
    const { token } = req.params;
    let cleanCode = token?.trim();

    if (!cleanCode) {
      return res.status(400).json({ error: "Token kodi bo'sh" });
    }

    // Jeton ma'lumotlarini olish
    const jetonData = await Jeton.findOne({ code: cleanCode });
    if (!jetonData) {
      return res.status(404).json({ error: "Jeton topilmadi" });
    }

    const existing = await Child.findOne({
      token_code: cleanCode,
      exit_time: null,
    });

    if (existing) {
      // Checkout qilish - VIP/standard tariff bilan
      const nowDate = new Date();
      const result = computeCheckout({
        child: existing,
        nowDate,
        jetonTariff: jetonData.tariff,
      });

      await Child.findByIdAndUpdate(existing._id, {
        exit_time: result.exit_time,
        paid_until: result.paid_until,
        paid_amount: result.paid_amount,
      });

      // History ga qo'shish
      const historyEntry = new History({
        child_id: existing._id,
        session_id: uuidv4(),
        token_code: existing.token_code,
        jeton_name: existing.jeton_name,
        entry_time: existing.entry_time,
        exit_time: result.exit_time,
        paid_until: result.paid_until,
        base_amount: existing.base_amount,
        paid_amount: result.paid_amount,
      });
      await historyEntry.save();

      // Chek chiqarish
      const receipt = buildReceipt({
        child: existing,
        result,
        tokenAtCheckout: cleanCode,
      });

      try {
        await printReceiptOS(receipt);
      } catch (printErr) {
        console.error("Chek chiqarishda xatolik:", printErr);
      }

      return res.json({
        ok: true,
        action: "checkout",
        message: "Sessiya yakunlandi",
        receipt,
      });
    } else {
      // Yangi sessiya boshlash
      const qrCode = `QR-${cleanCode}-${Date.now()}`;
      const baseAmount = roundAmount(jetonData.price || BASE_COST);

      const newChild = new Child({
        qr_code: qrCode,
        token_code: cleanCode,
        jeton_name: jetonData.name,
        entry_time: new Date(),
        paid_until: new Date(Date.now() + 60 * 60 * 1000), // +1 soat
        base_amount: baseAmount,
      });

      await newChild.save();

      return res.json({
        ok: true,
        action: "checkin",
        message: "Sessiya boshlandi",
        child: newChild,
        jeton: jetonData,
      });
    }
  } catch (e) {
    console.error("scanByToken xatosi:", e);
    res.status(500).json({ error: "Server xatosi: " + e.message });
  }
};

export const getHistoryByToken = async (req, res) => {
  try {
    const { token } = req.params;
    const history = await History.find({ token_code: token }).sort({
      entry_time: -1,
    });

    res.json({
      ok: true,
      history,
      total: history.length,
    });
  } catch (e) {
    console.error("Tarix olishda xatolik:", e);
    res.status(500).json({ error: "Tarix olishda xatolik" });
  }
};

export const reprintReceipt = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const historyItem = await History.findOne({ session_id: sessionId });
    if (!historyItem) {
      return res.status(404).json({ error: "Sessiya tarixi topilmadi" });
    }

    const receipt = buildReceipt({
      child: historyItem,
      result: {
        exit_time: historyItem.exit_time,
        paid_until: historyItem.paid_until,
        paid_amount: historyItem.paid_amount,
      },
    });

    await printReceiptOS(receipt);

    res.json({
      ok: true,
      message: "Chek qayta chiqarildi",
      receipt,
    });
  } catch (e) {
    console.error("Chekni qayta chiqarishda xatolik:", e);
    res.status(500).json({ error: "Chekni qayta chiqarishda xatolik" });
  }
};

// 🗑️ Sessiyalarni o'chirish
export const deleteChild = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Child.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ error: "Sessiya topilmadi" });
    }

    res.json({
      ok: true,
      message: "Sessiya muvaffaqiyatli o'chirildi",
      deleted: deleted,
    });
  } catch (e) {
    console.error("Sessiyani o'chirishda xatolik:", e);
    res.status(500).json({ error: "Server xatosi: " + e.message });
  }
};

export const deleteAllChildren = async (req, res) => {
  try {
    await Child.deleteMany({});
    res.json({ ok: true, message: "Barcha sessiyalar o'chirildi" });
  } catch (e) {
    console.error("Barcha sessiyalarni o'chirishda xatolik:", e);
    res.status(500).json({ error: "O'chirishda xatolik" });
  }
};
