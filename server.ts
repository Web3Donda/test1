import express, { type Request, type Response, type NextFunction } from 'express';
import { Pool } from 'pg';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://elizaveta:elizaveta@localhost:5432/elizaveta',
});

// Фотки храним локально на VDS, отдаёт их сам Express через /uploads/...
const UPLOADS_DIR = path.resolve(__dirname, '..', 'uploads');
const UPLOADS_PRODUCTS_DIR = path.join(UPLOADS_DIR, 'products');

async function saveProductImage(filename: string, body: Buffer, contentType: string): Promise<string> {
  await fs.mkdir(UPLOADS_PRODUCTS_DIR, { recursive: true });
  const extFromName = (filename.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const extFromType = (contentType.split('/')[1] || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const ext = (extFromName.length >= 2 && extFromName.length <= 5) ? extFromName : (extFromType || 'jpg');
  const key = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  await fs.writeFile(path.join(UPLOADS_PRODUCTS_DIR, key), body);
  return `/uploads/products/${key}`;
}

const ADMIN_PIN = process.env.ADMIN_PIN || '';
const ADMIN_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function makeAdminToken(): string {
  const ts = Date.now().toString();
  const sig = crypto.createHmac('sha256', ADMIN_PIN).update(ts).digest('hex');
  return `${ts}.${sig}`;
}

function verifyAdminToken(token: string): boolean {
  if (!token || !ADMIN_PIN) return false;
  const idx = token.indexOf('.');
  if (idx <= 0) return false;
  const ts = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = crypto.createHmac('sha256', ADMIN_PIN).update(ts).digest('hex');
  if (sig.length !== expected.length) return false;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) return false;
  } catch { return false; }
  const age = Date.now() - parseInt(ts, 10);
  return age >= 0 && age < ADMIN_TOKEN_TTL_MS;
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const raw = (req.headers['authorization'] || '') as string;
  const token = raw.startsWith('Bearer ') ? raw.slice(7) : raw;
  if (verifyAdminToken(token)) return next();
  res.status(403).json({ error: 'Доступ запрещён. Войдите с PIN-кодом администратора.' });
}

function getFormattedDate() {
  const d = new Date();
  const months = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];
  return `${d.getDate()} ${months[d.getMonth()]}, ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function mapOrder(o: any) {
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
    createdAt: o.created_at,
  };
}

const app = express();
app.use(express.json({ limit: '20mb' }));
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

// ─── health ──────────────────────────────────────────────────────────
app.get('/api/heartbeat', async (_req, res) => {
  const r = await pool.query('SELECT COUNT(*)::int AS n FROM products');
  res.json({ ok: true, products: r.rows[0].n, at: new Date().toISOString() });
});

// ─── admin login ─────────────────────────────────────────────────────
app.post('/api/admin/login', (req, res) => {
  const { pin } = req.body || {};
  if (!ADMIN_PIN) return res.status(500).json({ error: 'ADMIN_PIN не настроен.' });
  const pinStr = typeof pin === 'string' ? pin : '';
  if (pinStr.length !== ADMIN_PIN.length) return res.status(401).json({ error: 'Неверный код.' });
  let match = false;
  try { match = crypto.timingSafeEqual(Buffer.from(pinStr), Buffer.from(ADMIN_PIN)); } catch {}
  if (!match) return res.status(401).json({ error: 'Неверный код.' });
  res.json({ token: makeAdminToken() });
});

// ─── products ────────────────────────────────────────────────────────
app.get('/api/products', async (_req, res) => {
  const r = await pool.query('SELECT * FROM products ORDER BY "order"');
  res.json(r.rows);
});

app.post('/api/products', requireAdmin, async (req, res) => {
  const { name, description, price, category, composition, tags, imageSrc, popular, imageClassName } = req.body;
  if (!name || price === undefined) return res.status(400).json({ error: 'Имя и цена обязательны.' });
  const countRes = await pool.query('SELECT COUNT(*)::int AS n FROM products');
  const id = `prod-${Date.now()}`;
  const newProduct = {
    id, name, description: description || '', price: Number(price),
    imageSrc: imageSrc || '', category: category || 'flowers',
    composition: composition || [], tags: tags || [],
    rating: 5.0, popular: !!popular,
    imageClassName: imageClassName || 'object-cover',
    order: countRes.rows[0].n,
  };
  await pool.query(
    `INSERT INTO products (id, name, description, price, "imageSrc", category, composition, tags, rating, popular, "imageClassName", "order")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [newProduct.id, newProduct.name, newProduct.description, newProduct.price, newProduct.imageSrc,
     newProduct.category, JSON.stringify(newProduct.composition), JSON.stringify(newProduct.tags),
     newProduct.rating, newProduct.popular, newProduct.imageClassName, newProduct.order]
  );
  res.json({ success: true, product: newProduct });
});

app.put('/api/products/:id', requireAdmin, async (req, res) => {
  const fields = req.body || {};
  const allowed = ['name','description','price','imageSrc','category','composition','tags','rating','popular','imageClassName','order'];
  const sets: string[] = [];
  const vals: any[] = [];
  let i = 1;
  for (const k of allowed) {
    if (k in fields) {
      sets.push(`"${k}" = $${i++}`);
      vals.push(k === 'composition' || k === 'tags' ? JSON.stringify(fields[k]) : fields[k]);
    }
  }
  if (!sets.length) return res.status(400).json({ error: 'Нет полей для обновления.' });
  vals.push(req.params.id);
  const r = await pool.query(`UPDATE products SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, vals);
  res.json({ success: true, product: r.rows[0] });
});

app.delete('/api/products/:id', requireAdmin, async (req, res) => {
  await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

app.post('/api/products/reorder', requireAdmin, async (req, res) => {
  const orders: Array<{ id: string; order: number }> = req.body?.orders || [];
  for (const item of orders) {
    await pool.query('UPDATE products SET "order" = $1 WHERE id = $2', [Number(item.order), item.id]);
  }
  res.json({ success: true });
});

// ─── orders ──────────────────────────────────────────────────────────
app.get('/api/orders', requireAdmin, async (_req, res) => {
  const r = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
  res.json(r.rows.map(mapOrder));
});

app.post('/api/order', async (req, res) => {
  const { customerName, customerPhone, deliveryType, address, cardMessage, totalPrice, items, date, time, paymentMethod } = req.body;
  if (!customerName || !customerPhone) return res.status(400).json({ error: 'Заполните имя и телефон.' });
  const orderId = `ELZ-${Math.floor(100000 + Math.random() * 900000)}`;
  const statusLog = [{ status: 'pending', timestamp: getFormattedDate(), note: 'Заказ оформлен на сайте.' }];
  await pool.query(
    `INSERT INTO orders (order_id, customer_name, customer_phone, delivery_type, address, date, time, card_message, total_price, items, status, status_log, payment_method, payment_status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [orderId, customerName, customerPhone, deliveryType || 'delivery', address || '',
     date || 'Сегодня', time || 'В ближайшее время', cardMessage || '', totalPrice || 0,
     JSON.stringify(items || []), 'pending', JSON.stringify(statusLog),
     paymentMethod || 'cash', 'pending_confirmation']
  );
  res.json({ success: true, orderId, message: `Спасибо, ${customerName}! Менеджер свяжется с вами.` });
});

app.get('/api/order/:id', async (req, res) => {
  const r = await pool.query('SELECT * FROM orders WHERE order_id = $1', [req.params.id]);
  if (!r.rows[0]) return res.status(404).json({ error: 'Заказ не найден.' });
  res.json(mapOrder(r.rows[0]));
});

app.delete('/api/orders/:id', requireAdmin, async (req, res) => {
  await pool.query('DELETE FROM orders WHERE order_id = $1', [req.params.id]);
  res.json({ success: true });
});

app.post('/api/orders/:id/status', requireAdmin, async (req, res) => {
  const { status, note, paymentStatus } = req.body;
  const cur = await pool.query('SELECT * FROM orders WHERE order_id = $1', [req.params.id]);
  if (!cur.rows[0]) return res.status(404).json({ error: 'Заказ не найден.' });
  const order = cur.rows[0];
  const sets: string[] = [];
  const vals: any[] = [];
  let i = 1;
  if (status) {
    sets.push(`status = $${i++}`); vals.push(status);
    const statusLog = [...(order.status_log || []), { status, timestamp: getFormattedDate(), note: note || 'Статус обновлён.' }];
    sets.push(`status_log = $${i++}`); vals.push(JSON.stringify(statusLog));
  }
  if (paymentStatus) { sets.push(`payment_status = $${i++}`); vals.push(paymentStatus); }
  if (!sets.length) return res.json({ success: true, order: mapOrder(order) });
  vals.push(req.params.id);
  const r = await pool.query(`UPDATE orders SET ${sets.join(', ')} WHERE order_id = $${i} RETURNING *`, vals);
  res.json({ success: true, order: mapOrder(r.rows[0]) });
});

app.post('/api/orders/:id/pay', requireAdmin, async (req, res) => {
  const cur = await pool.query('SELECT * FROM orders WHERE order_id = $1', [req.params.id]);
  if (!cur.rows[0]) return res.status(404).json({ error: 'Заказ не найден.' });
  const order = cur.rows[0];
  const statusLog = [...(order.status_log || []), { status: order.status, timestamp: getFormattedDate(), note: 'Оплата получена (тестовый режим).' }];
  const r = await pool.query(
    'UPDATE orders SET payment_status = $1, status_log = $2 WHERE order_id = $3 RETURNING *',
    ['paid', JSON.stringify(statusLog), req.params.id]
  );
  res.json({ success: true, order: mapOrder(r.rows[0]) });
});

// ─── reviews & categories ────────────────────────────────────────────
app.get('/api/reviews', async (_req, res) => {
  const r = await pool.query('SELECT * FROM reviews ORDER BY id DESC');
  res.json(r.rows);
});

app.post('/api/reviews', async (req, res) => {
  const { author, rating, comment } = req.body;
  if (!author || !rating || !comment) return res.status(400).json({ error: 'Заполните все поля.' });
  const date = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  const r = await pool.query(
    'INSERT INTO reviews (author, rating, comment, date) VALUES ($1,$2,$3,$4) RETURNING *',
    [author, Number(rating), comment, date]
  );
  res.json({ success: true, review: r.rows[0] });
});

app.get('/api/categories', async (_req, res) => {
  const r = await pool.query('SELECT * FROM categories');
  res.json(r.rows);
});

app.post('/api/categories', requireAdmin, async (req, res) => {
  const { id, label } = req.body;
  if (!id || !label) return res.status(400).json({ error: 'id и label обязательны.' });
  await pool.query(
    'INSERT INTO categories (id, label) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label',
    [id, label]
  );
  res.json({ success: true });
});

app.delete('/api/categories/:id', requireAdmin, async (req, res) => {
  await pool.query('DELETE FROM categories WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

// ─── upload (локальное хранилище на VDS) ─────────────────────────────
app.post('/api/upload', requireAdmin, async (req, res) => {
  const { filename, contentType, dataBase64 } = req.body || {};
  if (!dataBase64) return res.status(400).json({ error: 'Нет данных изображения.' });
  const buffer = Buffer.from(dataBase64, 'base64');
  try {
    const url = await saveProductImage(filename || 'img.jpg', buffer, contentType || 'image/jpeg');
    res.json({ url });
  } catch (e: any) {
    res.status(500).json({ error: `Upload: ${e.message}` });
  }
});

// ─── YooKassa ────────────────────────────────────────────────────────
app.get('/api/yookassa/check-payment/:id', async (req, res) => {
  const cur = await pool.query('SELECT * FROM orders WHERE order_id = $1', [req.params.id]);
  if (!cur.rows[0]) return res.status(404).json({ error: 'Заказ не найден.' });
  const order = cur.rows[0];
  if (order.payment_status === 'paid') return res.json({ success: true, status: 'succeeded', order: mapOrder(order) });
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secret = process.env.YOOKASSA_SECRET_KEY;
  if (order.payment_id && shopId && secret) {
    try {
      const auth = Buffer.from(`${shopId}:${secret}`).toString('base64');
      const ykRes = await fetch(`https://api.yookassa.ru/v3/payments/${order.payment_id}`, {
        headers: { Authorization: `Basic ${auth}` },
      });
      const payment: any = await ykRes.json();
      if (ykRes.ok && payment.status === 'succeeded') {
        const statusLog = [...(order.status_log || []), { status: order.status, timestamp: getFormattedDate(), note: 'Онлайн-оплата ЮKassa получена.' }];
        const upd = await pool.query(
          'UPDATE orders SET payment_status = $1, status_log = $2 WHERE order_id = $3 RETURNING *',
          ['paid', JSON.stringify(statusLog), req.params.id]
        );
        return res.json({ success: true, status: 'succeeded', order: mapOrder(upd.rows[0]) });
      }
      return res.json({ success: true, status: payment.status || 'pending', order: mapOrder(order) });
    } catch {
      return res.json({ success: true, status: 'pending', order: mapOrder(order) });
    }
  }
  res.json({ success: true, status: 'pending', order: mapOrder(order) });
});

app.post('/api/yookassa/create-payment', async (req, res) => {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secret = process.env.YOOKASSA_SECRET_KEY;
  if (!shopId || !secret) return res.status(400).json({ error: 'Онлайн-оплата ЮKassa не настроена.' });
  const { orderId } = req.body || {};
  if (!orderId) return res.status(400).json({ error: 'Не указан номер заказа.' });
  const cur = await pool.query('SELECT * FROM orders WHERE order_id = $1', [orderId]);
  if (!cur.rows[0]) return res.status(404).json({ error: 'Заказ не найден.' });
  const order = cur.rows[0];
  const auth = Buffer.from(`${shopId}:${secret}`).toString('base64');
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
  const returnUrl = `${proto}://${req.headers.host}/?order=${encodeURIComponent(orderId)}`;
  const idempotenceKey = `${orderId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  // Чек по 54-ФЗ — обязателен в live-режиме ЮKassa.
  // items: каждый товар + (если есть) платная доставка отдельной строкой.
  const items: Array<any> = [];
  for (const it of (order.items as any[] || [])) {
    const qty = Number(it.quantity || 1);
    const itemTotal = Number(it.product?.price || 0);
    if (!itemTotal || !qty) continue;
    items.push({
      description: String(it.product?.name || 'Товар').slice(0, 128),
      quantity: qty.toFixed(2),
      amount: { value: itemTotal.toFixed(2), currency: 'RUB' },
      vat_code: 1, // НДС не облагается (УСН / самозанятый)
      payment_mode: 'full_prepayment',
      payment_subject: 'commodity',
    });
  }
  const itemsSum = items.reduce(
    (s, it) => s + Number(it.amount.value) * Number(it.quantity),
    0,
  );
  const deliveryPrice = Math.max(0, Number(order.total_price || 0) - itemsSum);
  if (deliveryPrice > 0) {
    items.push({
      description: 'Доставка',
      quantity: '1.00',
      amount: { value: deliveryPrice.toFixed(2), currency: 'RUB' },
      vat_code: 1,
      payment_mode: 'full_prepayment',
      payment_subject: 'service',
    });
  }
  // ЮKassa требует customer.phone в формате 79xxxxxxxxx (11 цифр, +7).
  const customer: Record<string, string> = {};
  let phoneDigits = String(order.customer_phone || '').replace(/\D/g, '');
  if (phoneDigits.length === 11 && phoneDigits.startsWith('8')) phoneDigits = '7' + phoneDigits.slice(1);
  if (phoneDigits.length === 10) phoneDigits = '7' + phoneDigits;
  if (phoneDigits.length === 11 && phoneDigits.startsWith('7')) {
    customer.phone = phoneDigits;
  }
  if (!customer.phone) {
    return res.status(400).json({ error: 'Не указан корректный телефон покупателя (требуется для чека).' });
  }

  const ykRes = await fetch('https://api.yookassa.ru/v3/payments', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Idempotence-Key': idempotenceKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: { value: Number(order.total_price || 0).toFixed(2), currency: 'RUB' },
      capture: true,
      confirmation: { type: 'redirect', return_url: returnUrl },
      description: `Заказ ${orderId} — Цветы Елизавета`,
      metadata: { orderId },
      receipt: {
        customer,
        items: items.length ? items : [{
          description: `Заказ ${orderId}`,
          quantity: '1.00',
          amount: { value: Number(order.total_price || 0).toFixed(2), currency: 'RUB' },
          vat_code: 1,
          payment_mode: 'full_prepayment',
          payment_subject: 'commodity',
        }],
      },
    }),
  });
  const payment: any = await ykRes.json();
  if (!ykRes.ok) return res.status(502).json({ error: payment.description || 'Ошибка создания платежа ЮKassa.' });
  await pool.query('UPDATE orders SET payment_id = $1 WHERE order_id = $2', [payment.id, orderId]);
  res.json({ confirmationUrl: payment.confirmation?.confirmation_url, paymentId: payment.id });
});

app.post('/api/yookassa/webhook', async (req, res) => {
  try {
    const paymentObj = (req.body && req.body.object) || {};
    const paymentId = paymentObj.id;
    const shopId = process.env.YOOKASSA_SHOP_ID;
    const secret = process.env.YOOKASSA_SECRET_KEY;
    if (paymentId && shopId && secret) {
      const auth = Buffer.from(`${shopId}:${secret}`).toString('base64');
      const ykRes = await fetch(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
        headers: { Authorization: `Basic ${auth}` },
      });
      const payment: any = await ykRes.json();
      const orderId = payment?.metadata?.orderId || paymentObj?.metadata?.orderId;
      if (ykRes.ok && payment.status === 'succeeded' && orderId) {
        const cur = await pool.query('SELECT * FROM orders WHERE order_id = $1', [orderId]);
        const order = cur.rows[0];
        if (order && order.payment_status !== 'paid') {
          const statusLog = [...(order.status_log || []), { status: order.status, timestamp: getFormattedDate(), note: 'Онлайн-оплата ЮKassa подтверждена (вебхук).' }];
          await pool.query(
            'UPDATE orders SET payment_status = $1, status_log = $2 WHERE order_id = $3',
            ['paid', JSON.stringify(statusLog), orderId]
          );
        }
      }
    }
  } catch (e) {
    console.error('YooKassa webhook error:', e);
  }
  res.status(200).json({ received: true });
});

// ─── static (built frontend) ─────────────────────────────────────────
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '7d', immutable: true }));
app.use(express.static(path.join(__dirname, '..', 'dist')));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: err.message || 'Internal error' });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, '127.0.0.1', () => {
  console.log(`Server listening on http://127.0.0.1:${port}`);
});
