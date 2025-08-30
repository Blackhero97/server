// controllers/childrenController.js
import Child from "../models/Child.js";
import History from "../models/History.js";
import Jeton from "../models/Jeton.js";
import { v4 as uuidv4 } from "uuid";
import { printReceiptOS } from "../services/osPrinter.js"; // ⬅️ OS spool orqali chop etish

// ====== Konfiguratsiya (ENV) ======
const BASE_COST = Number(process.env.BASE_COST) || 50000; // 1 soat narxi
const PER_MINUTE_COST = BASE_COST / 60; // minut narxi
const ROUND_TO = Number(process.env.ROUND_TO ?? 100); // 0 => integer
const ROUND_STRATEGY = (process.env.ROUND_STRATEGY || "ceil").toLowerCase();

// ====== Yordamchi ======
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

  const includedMin = minutesBetween(entry, paidUntil); // odatda 60
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

const computeCheckout = (
  entry_time,
  paid_until_or_null,
  paid_amount_or_null,
  exit_time = new Date()
) => {
  const paid_until = paid_until_or_null || entry_time;
  let paid_amount = paid_amount_or_null || roundAmount(BASE_COST);

  if (exit_time > paid_until) {
    const extraMs = exit_time.getTime() - paid_until.getTime();
    const extraMin = Math.ceil(extraMs / (1000 * 60)); // yuqoriga
    paid_amount += extraMin * PER_MINUTE_COST;
  }
  paid_amount = roundAmount(paid_amount);
  return { exit_time, paid_until, paid_amount };
};

// 📋 Hamma sessiyalar
export const getChildren = async (_req, res) => {
  try {
    const children = await Child.find().sort({ entry_time: -1 });
    res.json(children);
  } catch (err) {
    console.error("❌ Ro‘yxatni olishda xato:", err.message);
    res.status(500).json({ error: "Server xatosi: " + err.message });
  }
};

// 🔎 QR orqali (ixtiyoriy)
export const getChildByQr = async (req, res) => {
  try {
    const { qr_code } = req.params;
    const child = await Child.findOne({ qr_code });
    if (!child) return res.status(404).json({ error: "Topilmadi" });
    res.json(child);
  } catch (err) {
    console.error("❌ QR orqali olishda xato:", err.message);
    res.status(500).json({ error: "Server xatosi: " + err.message });
  }
};

// 🔎 Kod orqali — avval qr_code, topilmasa _id
export const getChildByCode = async (req, res) => {
  try {
    const { code } = req.params;
    let child = await Child.findOne({ qr_code: code });
    if (!child) {
      try {
        child = await Child.findById(code);
      } catch {}
    }
    if (!child) return res.status(404).json({ error: "Topilmadi" });
    res.json(child);
  } catch (err) {
    console.error("❌ getChildByCode xato:", err.message);
    res.status(500).json({ error: "Server xatosi: " + err.message });
  }
};

// ✅ Manual checkout (ixtiyoriy)
export const checkoutChild = async (req, res) => {
  try {
    const { id } = req.params;
    const extraMinutes = Number(req.body?.extraMinutes || 0);

    const child = await Child.findById(id);
    if (!child) return res.status(404).json({ error: "Topilmadi" });
    if (child.exit_time)
      return res.status(400).json({ error: "Allaqachon chiqqan" });

    const paid_until_pre = child.paid_until || child.entry_time;
    const paid_until =
      extraMinutes > 0
        ? new Date(paid_until_pre.getTime() + extraMinutes * 60 * 1000)
        : paid_until_pre;

    const result = computeCheckout(
      child.entry_time,
      paid_until,
      child.paid_amount,
      new Date()
    );

    child.exit_time = result.exit_time;
    child.paid_until = result.paid_until;
    child.paid_amount = result.paid_amount;
    const tokenAtCheckout = child.token_code;
    child.token_code = null;

    await child.save();

    // HISTORY
    await History.findOneAndUpdate(
      { sessionId: child._id },
      {
        $set: {
          exit_time: result.exit_time,
          paid_amount: result.paid_amount,
          token_code: tokenAtCheckout || undefined,
        },
        $setOnInsert: { entry_time: child.entry_time },
      },
      { upsert: true, new: true }
    );

    const receipt = buildReceipt({ child, result, tokenAtCheckout });

    // 🖨️ OS-printerga jo‘natamiz (PRINTER_NAME bo‘lsa shu, bo‘lmasa default)
    try {
      await printReceiptOS(receipt);
    } catch (e) {
      console.error("🖨️ Print error:", e.message);
    }

    res.json({ action: "checkout", child, receipt });
  } catch (err) {
    console.error("❌ Checkout xatolik:", err.message);
    res.status(500).json({ error: "Server xatosi: " + err.message });
  }
};

// ⏰ Manual extend (ixtiyoriy)
export const extendTime = async (req, res) => {
  try {
    const { id } = req.params;
    const minutes = Number(req.body?.minutes || 60);

    const child = await Child.findById(id);
    if (!child) return res.status(404).json({ error: "Topilmadi" });

    const extraMs = Math.max(0, minutes) * 60 * 1000;
    child.paid_until = child.paid_until
      ? new Date(child.paid_until.getTime() + extraMs)
      : new Date(Date.now() + extraMs);

    await child.save();
    res.json(child);
  } catch (err) {
    console.error("❌ Extend xato:", err.message);
    res.status(500).json({ error: "Server xatosi: " + err.message });
  }
};

// 🔁 JETON TOGGLE (scan)
export const scanByToken = async (req, res) => {
  try {
    const { token } = req.params;

    // Jeton ma'lumotlarini olish
    const jeton = await Jeton.findOne({ 
      $or: [{ code: token }, { code: token.toUpperCase() }],
      isActive: true 
    });

    if (!jeton) {
      return res.status(404).json({ 
        error: "Jeton topilmadi yoki nofaol",
        token 
      });
    }

    // 1) Aktiv sessiya bormi?
    const active = await Child.findOne({
      token_code: token,
      $or: [{ exit_time: null }, { exit_time: { $exists: false } }],
    });

    if (active) {
      // CHIQISH
      const result = computeCheckout(
        active.entry_time,
        active.paid_until || active.entry_time,
        active.paid_amount,
        new Date()
      );

      active.exit_time = result.exit_time;
      active.paid_until = result.paid_until;
      active.paid_amount = result.paid_amount;
      const tokenAtCheckout = active.token_code;
      active.token_code = null;

      // Jeton ma'lumotlarini qo'shish
      active.jeton_name = jeton.name;
      active.jeton_tariff = jeton.tariff;

      await active.save();

      // Jeton statistikasini yangilash
      jeton.usageCount += 1;
      jeton.lastUsed = new Date();
      await jeton.save();

      // HISTORY
      await History.findOneAndUpdate(
        { sessionId: active._id },
        {
          $set: {
            exit_time: result.exit_time,
            paid_amount: result.paid_amount,
            token_code: tokenAtCheckout || undefined,
            jeton_name: jeton.name,
            jeton_tariff: jeton.tariff,
          },
          $setOnInsert: { entry_time: active.entry_time },
        },
        { upsert: true, new: true }
      );

      const receipt = buildReceipt({ child: active, result, tokenAtCheckout });

      // 🖨️ OS-printer
      try {
        await printReceiptOS(receipt);
      } catch (e) {
        console.error("🖨️ Print error:", e.message);
      }

      return res.json({
        action: "checkout",
        child: active,
        receipt,
        message: "Chiqish rasmiylashtirildi",
      });
    }

    // 2) KIRISH - jeton tarifi bo'yicha
    const entry_time = new Date();
    
    // Jeton tarifi bo'yicha vaqt va narxni belgilash
    let paid_until, base_amount;
    
    if (jeton.tariff === 'vip') {
      // VIP jeton: cheksiz vaqt
      paid_until = new Date(entry_time.getTime() + 24 * 60 * 60 * 1000); // 24 soat
      base_amount = roundAmount(jeton.price || 50000);
    } else {
      // Standard jeton: 1 soat
      const duration = jeton.duration || 60; // daqiqa
      paid_until = new Date(entry_time.getTime() + duration * 60 * 1000);
      base_amount = roundAmount(jeton.price || 30000);
    }

    const paid_amount = base_amount;

    const anon = new Child({
      token_code: token,
      qr_code: uuidv4(),
      entry_time,
      paid_until,
      paid_amount,
      base_amount,
      exit_time: null,
      // Jeton ma'lumotlarini qo'shish
      jeton_name: jeton.name,
      jeton_tariff: jeton.tariff,
      jeton_price: jeton.price,
    });

    await anon.save();

    // Jeton statistikasini yangilash
    jeton.usageCount += 1;
    jeton.lastUsed = new Date();
    await jeton.save();

    // HISTORY: boshlanish
    await History.create({
      sessionId: anon._id,
      token_code: token,
      entry_time,
    });

    return res.json({
      action: "checkin",
      child: anon,
      message: "Kirish 1 soat oldindan rasmiylashtirildi",
    });
  } catch (err) {
    console.error("❌ scanByToken xato:", err.message);
    res.status(500).json({ error: "Server xatosi: " + err.message });
  }
};

// 🗂 Jeton bo‘yicha tarix
export const getHistoryByToken = async (req, res) => {
  try {
    const { token } = req.params;
    const sessions = await History.find({ token_code: token }).sort({
      entry_time: -1,
    });
    if (!sessions.length)
      return res
        .status(404)
        .json({ error: "Bu jeton bo‘yicha sessiya topilmadi" });
    res.json(sessions);
  } catch (err) {
    console.error("❌ getHistoryByToken xato:", err.message);
    res.status(500).json({ error: "Server xatosi: " + err.message });
  }
};

// 🖨️ Chekni qayta chop etish
export const reprintReceipt = async (req, res) => {
  try {
    const { id } = req.params;
    const child = await Child.findById(id);
    if (!child) return res.status(404).json({ error: "Topilmadi" });
    if (!child.exit_time)
      return res
        .status(400)
        .json({ error: "Sessiya hali yakunlanmagan — avval checkout qiling" });

    const result = {
      exit_time: child.exit_time,
      paid_until: child.paid_until || child.entry_time,
      paid_amount: child.paid_amount,
    };

    const hist = await History.findOne({ sessionId: child._id });
    const tokenAtCheckout = hist?.token_code || null;

    const receipt = buildReceipt({ child, result, tokenAtCheckout });

    try {
      await printReceiptOS(receipt);
    } catch (e) {
      console.error("🖨️ Reprint error:", e.message);
      return res
        .status(500)
        .json({ error: "Chop etishda xato", detail: e.message, receipt });
    }

    res.json({ ok: true, receipt });
  } catch (err) {
    console.error("❌ reprintReceipt xato:", err.message);
    res.status(500).json({ error: "Server xatosi: " + err.message });
  }
};

export const deleteAllChildren = async (req, res) => {
  try {
    await Child.deleteMany({});
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "O‘chirishda xatolik" });
  }
};
