// server.ts
import express from "express";
import { Pool } from "pg";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://elizaveta:elizaveta@localhost:5432/elizaveta"
});
var TIMEWEB_BUCKET = "elizaveta";
var TIMEWEB_PUBLIC_BASE = `https://${TIMEWEB_BUCKET}.s3.twcstorage.ru`;
var timewebS3 = process.env.TIMEWEB_S3_KEY ? new S3Client({
  region: "ru-1",
  endpoint: "https://s3.twcstorage.ru",
  credentials: {
    accessKeyId: process.env.TIMEWEB_S3_KEY,
    secretAccessKey: process.env.TIMEWEB_S3_SECRET || ""
  },
  forcePathStyle: false
}) : null;
async function uploadToTimeweb(key, body, contentType) {
  if (!timewebS3) throw new Error("Timeweb S3 \u043D\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D (\u043D\u0435\u0442 TIMEWEB_S3_KEY).");
  await timewebS3.send(new PutObjectCommand({
    Bucket: TIMEWEB_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType
  }));
  return `${TIMEWEB_PUBLIC_BASE}/${key}`;
}
var ADMIN_PIN = process.env.ADMIN_PIN || "";
var ADMIN_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1e3;
function makeAdminToken() {
  const ts = Date.now().toString();
  const sig = crypto.createHmac("sha256", ADMIN_PIN).update(ts).digest("hex");
  return `${ts}.${sig}`;
}
function verifyAdminToken(token) {
  if (!token || !ADMIN_PIN) return false;
  const idx = token.indexOf(".");
  if (idx <= 0) return false;
  const ts = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = crypto.createHmac("sha256", ADMIN_PIN).update(ts).digest("hex");
  if (sig.length !== expected.length) return false;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) return false;
  } catch {
    return false;
  }
  const age = Date.now() - parseInt(ts, 10);
  return age >= 0 && age < ADMIN_TOKEN_TTL_MS;
}
function requireAdmin(req, res, next) {
  const raw = req.headers["authorization"] || "";
  const token = raw.startsWith("Bearer ") ? raw.slice(7) : raw;
  if (verifyAdminToken(token)) return next();
  res.status(403).json({ error: "\u0414\u043E\u0441\u0442\u0443\u043F \u0437\u0430\u043F\u0440\u0435\u0449\u0451\u043D. \u0412\u043E\u0439\u0434\u0438\u0442\u0435 \u0441 PIN-\u043A\u043E\u0434\u043E\u043C \u0430\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u0430." });
}
function getFormattedDate() {
  const d = /* @__PURE__ */ new Date();
  const months = ["\u042F\u043D\u0432", "\u0424\u0435\u0432", "\u041C\u0430\u0440", "\u0410\u043F\u0440", "\u041C\u0430\u0439", "\u0418\u044E\u043D", "\u0418\u044E\u043B", "\u0410\u0432\u0433", "\u0421\u0435\u043D", "\u041E\u043A\u0442", "\u041D\u043E\u044F", "\u0414\u0435\u043A"];
  return `${d.getDate()} ${months[d.getMonth()]}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function mapOrder(o) {
  if (!o) return o;
  return {
    orderId: o.order_id,
    customerName: o.customer_name,
    customerPhone: o.customer_phone,
    deliveryType: o.delivery_type,
    address: o.address,
    date: o.date,
    time: o.time,
    cardMessage: o.card_message,
    totalPrice: Number(o.total_price),
    items: o.items || [],
    status: o.status,
    statusLog: o.status_log || [],
    paymentMethod: o.payment_method,
    paymentStatus: o.payment_status,
    createdAt: o.created_at
  };
}
var app = express();
app.use(express.json({ limit: "20mb" }));
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  next();
});
app.get("/api/heartbeat", async (_req, res) => {
  const r = await pool.query("SELECT COUNT(*)::int AS n FROM products");
  res.json({ ok: true, products: r.rows[0].n, at: (/* @__PURE__ */ new Date()).toISOString() });
});
app.post("/api/admin/login", (req, res) => {
  const { pin } = req.body || {};
  if (!ADMIN_PIN) return res.status(500).json({ error: "ADMIN_PIN \u043D\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D." });
  const pinStr = typeof pin === "string" ? pin : "";
  if (pinStr.length !== ADMIN_PIN.length) return res.status(401).json({ error: "\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u043A\u043E\u0434." });
  let match = false;
  try {
    match = crypto.timingSafeEqual(Buffer.from(pinStr), Buffer.from(ADMIN_PIN));
  } catch {
  }
  if (!match) return res.status(401).json({ error: "\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u043A\u043E\u0434." });
  res.json({ token: makeAdminToken() });
});
app.get("/api/products", async (_req, res) => {
  const r = await pool.query('SELECT * FROM products ORDER BY "order"');
  res.json(r.rows);
});
app.post("/api/products", requireAdmin, async (req, res) => {
  const { name, description, price, category, composition, tags, imageSrc, popular, imageClassName } = req.body;
  if (!name || price === void 0) return res.status(400).json({ error: "\u0418\u043C\u044F \u0438 \u0446\u0435\u043D\u0430 \u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u044B." });
  const countRes = await pool.query("SELECT COUNT(*)::int AS n FROM products");
  const id = `prod-${Date.now()}`;
  const newProduct = {
    id,
    name,
    description: description || "",
    price: Number(price),
    imageSrc: imageSrc || "",
    category: category || "flowers",
    composition: composition || [],
    tags: tags || [],
    rating: 5,
    popular: !!popular,
    imageClassName: imageClassName || "object-cover",
    order: countRes.rows[0].n
  };
  await pool.query(
    `INSERT INTO products (id, name, description, price, "imageSrc", category, composition, tags, rating, popular, "imageClassName", "order")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      newProduct.id,
      newProduct.name,
      newProduct.description,
      newProduct.price,
      newProduct.imageSrc,
      newProduct.category,
      JSON.stringify(newProduct.composition),
      JSON.stringify(newProduct.tags),
      newProduct.rating,
      newProduct.popular,
      newProduct.imageClassName,
      newProduct.order
    ]
  );
  res.json({ success: true, product: newProduct });
});
app.put("/api/products/:id", requireAdmin, async (req, res) => {
  const fields = req.body || {};
  const allowed = ["name", "description", "price", "imageSrc", "category", "composition", "tags", "rating", "popular", "imageClassName", "order"];
  const sets = [];
  const vals = [];
  let i = 1;
  for (const k of allowed) {
    if (k in fields) {
      sets.push(`"${k}" = $${i++}`);
      vals.push(k === "composition" || k === "tags" ? JSON.stringify(fields[k]) : fields[k]);
    }
  }
  if (!sets.length) return res.status(400).json({ error: "\u041D\u0435\u0442 \u043F\u043E\u043B\u0435\u0439 \u0434\u043B\u044F \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F." });
  vals.push(req.params.id);
  const r = await pool.query(`UPDATE products SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`, vals);
  res.json({ success: true, product: r.rows[0] });
});
app.delete("/api/products/:id", requireAdmin, async (req, res) => {
  await pool.query("DELETE FROM products WHERE id = $1", [req.params.id]);
  res.json({ success: true });
});
app.post("/api/products/reorder", requireAdmin, async (req, res) => {
  const orders = req.body?.orders || [];
  for (const item of orders) {
    await pool.query('UPDATE products SET "order" = $1 WHERE id = $2', [Number(item.order), item.id]);
  }
  res.json({ success: true });
});
app.get("/api/orders", requireAdmin, async (_req, res) => {
  const r = await pool.query("SELECT * FROM orders ORDER BY created_at DESC");
  res.json(r.rows.map(mapOrder));
});
app.post("/api/order", async (req, res) => {
  const { customerName, customerPhone, deliveryType, address, cardMessage, totalPrice, items, date, time, paymentMethod } = req.body;
  if (!customerName || !customerPhone) return res.status(400).json({ error: "\u0417\u0430\u043F\u043E\u043B\u043D\u0438\u0442\u0435 \u0438\u043C\u044F \u0438 \u0442\u0435\u043B\u0435\u0444\u043E\u043D." });
  const orderId = `ELZ-${Math.floor(1e5 + Math.random() * 9e5)}`;
  const statusLog = [{ status: "pending", timestamp: getFormattedDate(), note: "\u0417\u0430\u043A\u0430\u0437 \u043E\u0444\u043E\u0440\u043C\u043B\u0435\u043D \u043D\u0430 \u0441\u0430\u0439\u0442\u0435." }];
  await pool.query(
    `INSERT INTO orders (order_id, customer_name, customer_phone, delivery_type, address, date, time, card_message, total_price, items, status, status_log, payment_method, payment_status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [
      orderId,
      customerName,
      customerPhone,
      deliveryType || "delivery",
      address || "",
      date || "\u0421\u0435\u0433\u043E\u0434\u043D\u044F",
      time || "\u0412 \u0431\u043B\u0438\u0436\u0430\u0439\u0448\u0435\u0435 \u0432\u0440\u0435\u043C\u044F",
      cardMessage || "",
      totalPrice || 0,
      JSON.stringify(items || []),
      "pending",
      JSON.stringify(statusLog),
      paymentMethod || "cash",
      "pending_confirmation"
    ]
  );
  res.json({ success: true, orderId, message: `\u0421\u043F\u0430\u0441\u0438\u0431\u043E, ${customerName}! \u041C\u0435\u043D\u0435\u0434\u0436\u0435\u0440 \u0441\u0432\u044F\u0436\u0435\u0442\u0441\u044F \u0441 \u0432\u0430\u043C\u0438.` });
});
app.get("/api/order/:id", async (req, res) => {
  const r = await pool.query("SELECT * FROM orders WHERE order_id = $1", [req.params.id]);
  if (!r.rows[0]) return res.status(404).json({ error: "\u0417\u0430\u043A\u0430\u0437 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D." });
  res.json(mapOrder(r.rows[0]));
});
app.delete("/api/orders/:id", requireAdmin, async (req, res) => {
  await pool.query("DELETE FROM orders WHERE order_id = $1", [req.params.id]);
  res.json({ success: true });
});
app.post("/api/orders/:id/status", requireAdmin, async (req, res) => {
  const { status, note, paymentStatus } = req.body;
  const cur = await pool.query("SELECT * FROM orders WHERE order_id = $1", [req.params.id]);
  if (!cur.rows[0]) return res.status(404).json({ error: "\u0417\u0430\u043A\u0430\u0437 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D." });
  const order = cur.rows[0];
  const sets = [];
  const vals = [];
  let i = 1;
  if (status) {
    sets.push(`status = $${i++}`);
    vals.push(status);
    const statusLog = [...order.status_log || [], { status, timestamp: getFormattedDate(), note: note || "\u0421\u0442\u0430\u0442\u0443\u0441 \u043E\u0431\u043D\u043E\u0432\u043B\u0451\u043D." }];
    sets.push(`status_log = $${i++}`);
    vals.push(JSON.stringify(statusLog));
  }
  if (paymentStatus) {
    sets.push(`payment_status = $${i++}`);
    vals.push(paymentStatus);
  }
  if (!sets.length) return res.json({ success: true, order: mapOrder(order) });
  vals.push(req.params.id);
  const r = await pool.query(`UPDATE orders SET ${sets.join(", ")} WHERE order_id = $${i} RETURNING *`, vals);
  res.json({ success: true, order: mapOrder(r.rows[0]) });
});
app.post("/api/orders/:id/pay", requireAdmin, async (req, res) => {
  const cur = await pool.query("SELECT * FROM orders WHERE order_id = $1", [req.params.id]);
  if (!cur.rows[0]) return res.status(404).json({ error: "\u0417\u0430\u043A\u0430\u0437 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D." });
  const order = cur.rows[0];
  const statusLog = [...order.status_log || [], { status: order.status, timestamp: getFormattedDate(), note: "\u041E\u043F\u043B\u0430\u0442\u0430 \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u0430 (\u0442\u0435\u0441\u0442\u043E\u0432\u044B\u0439 \u0440\u0435\u0436\u0438\u043C)." }];
  const r = await pool.query(
    "UPDATE orders SET payment_status = $1, status_log = $2 WHERE order_id = $3 RETURNING *",
    ["paid", JSON.stringify(statusLog), req.params.id]
  );
  res.json({ success: true, order: mapOrder(r.rows[0]) });
});
app.get("/api/reviews", async (_req, res) => {
  const r = await pool.query("SELECT * FROM reviews ORDER BY id DESC");
  res.json(r.rows);
});
app.post("/api/reviews", async (req, res) => {
  const { author, rating, comment } = req.body;
  if (!author || !rating || !comment) return res.status(400).json({ error: "\u0417\u0430\u043F\u043E\u043B\u043D\u0438\u0442\u0435 \u0432\u0441\u0435 \u043F\u043E\u043B\u044F." });
  const date = (/* @__PURE__ */ new Date()).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  const r = await pool.query(
    "INSERT INTO reviews (author, rating, comment, date) VALUES ($1,$2,$3,$4) RETURNING *",
    [author, Number(rating), comment, date]
  );
  res.json({ success: true, review: r.rows[0] });
});
app.get("/api/categories", async (_req, res) => {
  const r = await pool.query("SELECT * FROM categories");
  res.json(r.rows);
});
app.post("/api/categories", requireAdmin, async (req, res) => {
  const { id, label } = req.body;
  if (!id || !label) return res.status(400).json({ error: "id \u0438 label \u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u044B." });
  await pool.query(
    "INSERT INTO categories (id, label) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label",
    [id, label]
  );
  res.json({ success: true });
});
app.delete("/api/categories/:id", requireAdmin, async (req, res) => {
  await pool.query("DELETE FROM categories WHERE id = $1", [req.params.id]);
  res.json({ success: true });
});
app.post("/api/upload", requireAdmin, async (req, res) => {
  const { filename, contentType, dataBase64 } = req.body || {};
  if (!dataBase64) return res.status(400).json({ error: "\u041D\u0435\u0442 \u0434\u0430\u043D\u043D\u044B\u0445 \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u044F." });
  const ext = String(filename || "img.jpg").split(".").pop() || "jpg";
  const key = `products/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const buffer = Buffer.from(dataBase64, "base64");
  try {
    const publicUrl = await uploadToTimeweb(key, buffer, contentType || "image/jpeg");
    res.json({ url: publicUrl });
  } catch (e) {
    res.status(500).json({ error: `Timeweb: ${e.message}` });
  }
});
app.get("/api/yookassa/check-payment/:id", async (req, res) => {
  const cur = await pool.query("SELECT * FROM orders WHERE order_id = $1", [req.params.id]);
  if (!cur.rows[0]) return res.status(404).json({ error: "\u0417\u0430\u043A\u0430\u0437 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D." });
  const order = cur.rows[0];
  if (order.payment_status === "paid") return res.json({ success: true, status: "succeeded", order: mapOrder(order) });
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secret = process.env.YOOKASSA_SECRET_KEY;
  if (order.payment_id && shopId && secret) {
    try {
      const auth = Buffer.from(`${shopId}:${secret}`).toString("base64");
      const ykRes = await fetch(`https://api.yookassa.ru/v3/payments/${order.payment_id}`, {
        headers: { Authorization: `Basic ${auth}` }
      });
      const payment = await ykRes.json();
      if (ykRes.ok && payment.status === "succeeded") {
        const statusLog = [...order.status_log || [], { status: order.status, timestamp: getFormattedDate(), note: "\u041E\u043D\u043B\u0430\u0439\u043D-\u043E\u043F\u043B\u0430\u0442\u0430 \u042EKassa \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u0430." }];
        const upd = await pool.query(
          "UPDATE orders SET payment_status = $1, status_log = $2 WHERE order_id = $3 RETURNING *",
          ["paid", JSON.stringify(statusLog), req.params.id]
        );
        return res.json({ success: true, status: "succeeded", order: mapOrder(upd.rows[0]) });
      }
      return res.json({ success: true, status: payment.status || "pending", order: mapOrder(order) });
    } catch {
      return res.json({ success: true, status: "pending", order: mapOrder(order) });
    }
  }
  res.json({ success: true, status: "pending", order: mapOrder(order) });
});
app.post("/api/yookassa/create-payment", async (req, res) => {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secret = process.env.YOOKASSA_SECRET_KEY;
  if (!shopId || !secret) return res.status(400).json({ error: "\u041E\u043D\u043B\u0430\u0439\u043D-\u043E\u043F\u043B\u0430\u0442\u0430 \u042EKassa \u043D\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D\u0430." });
  const { orderId } = req.body || {};
  if (!orderId) return res.status(400).json({ error: "\u041D\u0435 \u0443\u043A\u0430\u0437\u0430\u043D \u043D\u043E\u043C\u0435\u0440 \u0437\u0430\u043A\u0430\u0437\u0430." });
  const cur = await pool.query("SELECT * FROM orders WHERE order_id = $1", [orderId]);
  if (!cur.rows[0]) return res.status(404).json({ error: "\u0417\u0430\u043A\u0430\u0437 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D." });
  const order = cur.rows[0];
  const auth = Buffer.from(`${shopId}:${secret}`).toString("base64");
  const proto = req.headers["x-forwarded-proto"] || "https";
  const returnUrl = `${proto}://${req.headers.host}/?order=${encodeURIComponent(orderId)}`;
  const idempotenceKey = `${orderId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const ykRes = await fetch("https://api.yookassa.ru/v3/payments", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Idempotence-Key": idempotenceKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: { value: Number(order.total_price || 0).toFixed(2), currency: "RUB" },
      capture: true,
      confirmation: { type: "redirect", return_url: returnUrl },
      description: `\u0417\u0430\u043A\u0430\u0437 ${orderId} \u2014 \u0426\u0432\u0435\u0442\u044B \u0415\u043B\u0438\u0437\u0430\u0432\u0435\u0442\u0430`,
      metadata: { orderId }
    })
  });
  const payment = await ykRes.json();
  if (!ykRes.ok) return res.status(502).json({ error: payment.description || "\u041E\u0448\u0438\u0431\u043A\u0430 \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u044F \u043F\u043B\u0430\u0442\u0435\u0436\u0430 \u042EKassa." });
  await pool.query("UPDATE orders SET payment_id = $1 WHERE order_id = $2", [payment.id, orderId]);
  res.json({ confirmationUrl: payment.confirmation?.confirmation_url, paymentId: payment.id });
});
app.post("/api/yookassa/webhook", async (req, res) => {
  try {
    const paymentObj = req.body && req.body.object || {};
    const paymentId = paymentObj.id;
    const shopId = process.env.YOOKASSA_SHOP_ID;
    const secret = process.env.YOOKASSA_SECRET_KEY;
    if (paymentId && shopId && secret) {
      const auth = Buffer.from(`${shopId}:${secret}`).toString("base64");
      const ykRes = await fetch(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
        headers: { Authorization: `Basic ${auth}` }
      });
      const payment = await ykRes.json();
      const orderId = payment?.metadata?.orderId || paymentObj?.metadata?.orderId;
      if (ykRes.ok && payment.status === "succeeded" && orderId) {
        const cur = await pool.query("SELECT * FROM orders WHERE order_id = $1", [orderId]);
        const order = cur.rows[0];
        if (order && order.payment_status !== "paid") {
          const statusLog = [...order.status_log || [], { status: order.status, timestamp: getFormattedDate(), note: "\u041E\u043D\u043B\u0430\u0439\u043D-\u043E\u043F\u043B\u0430\u0442\u0430 \u042EKassa \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0430 (\u0432\u0435\u0431\u0445\u0443\u043A)." }];
          await pool.query(
            "UPDATE orders SET payment_status = $1, status_log = $2 WHERE order_id = $3",
            ["paid", JSON.stringify(statusLog), orderId]
          );
        }
      }
    }
  } catch (e) {
    console.error("YooKassa webhook error:", e);
  }
  res.status(200).json({ received: true });
});
app.use(express.static(path.join(__dirname, "..", "dist")));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(__dirname, "..", "dist", "index.html"));
});
app.use((err, _req, res, _next) => {
  console.error("Server error:", err);
  res.status(500).json({ error: err.message || "Internal error" });
});
var port = Number(process.env.PORT || 3e3);
app.listen(port, "127.0.0.1", () => {
  console.log(`Server listening on http://127.0.0.1:${port}`);
});
