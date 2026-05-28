import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

// Timeweb Cloud S3 (российский CDN — нужен чтобы фото грузились с мобильных
// операторов без ВПН, т.к. Supabase Storage живёт на AWS и операторы его режут).
const TIMEWEB_BUCKET = 'elizaveta';
const TIMEWEB_PUBLIC_BASE = `https://${TIMEWEB_BUCKET}.s3.twcstorage.ru`;

const timewebS3 = process.env.TIMEWEB_S3_KEY ? new S3Client({
  region: 'ru-1',
  endpoint: 'https://s3.twcstorage.ru',
  credentials: {
    accessKeyId: process.env.TIMEWEB_S3_KEY,
    secretAccessKey: process.env.TIMEWEB_S3_SECRET || '',
  },
  forcePathStyle: false,
}) : null;

async function uploadToTimeweb(key: string, body: Buffer, contentType: string): Promise<string> {
  if (!timewebS3) throw new Error('Timeweb S3 не настроен (нет TIMEWEB_S3_KEY).');
  await timewebS3.send(new PutObjectCommand({
    Bucket: TIMEWEB_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
  return `${TIMEWEB_PUBLIC_BASE}/${key}`;
}

// Авторизация админки: PIN проверяется на сервере, после успеха выдаём
// подписанный HMAC-токен на 7 дней. Все защищённые эндпоинты сверяют его.
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

function requireAdmin(req: VercelRequest, res: VercelResponse): boolean {
  const raw = (req.headers['authorization'] || req.headers['Authorization'] || '') as string;
  const token = raw.startsWith('Bearer ') ? raw.slice(7) : raw;
  if (verifyAdminToken(token)) return true;
  res.status(403).json({ error: 'Доступ запрещён. Войдите с PIN-кодом администратора.' });
  return false;
}

function getFormattedDate() {
  const d = new Date();
  const months = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];
  return `${d.getDate()} ${months[d.getMonth()]}, ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

// Приводим строку заказа из БД (snake_case) к формату фронта (camelCase)
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
    totalPrice: o.total_price,
    items: o.items || [],
    status: o.status,
    statusLog: o.status_log || [],
    paymentMethod: o.payment_method,
    paymentStatus: o.payment_status,
    createdAt: o.created_at,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = (req.url || '').replace(/\?.*$/, '');
  const method = req.method || 'GET';

  try {
    // POST /api/admin/login — обмен PIN на 7-дневный HMAC-токен админки.
    if (url === '/api/admin/login' && method === 'POST') {
      const { pin } = req.body || {};
      if (!ADMIN_PIN) return res.status(500).json({ error: 'ADMIN_PIN не настроен на сервере.' });
      const pinStr = typeof pin === 'string' ? pin : '';
      if (pinStr.length !== ADMIN_PIN.length) return res.status(401).json({ error: 'Неверный код.' });
      let match = false;
      try { match = crypto.timingSafeEqual(Buffer.from(pinStr), Buffer.from(ADMIN_PIN)); } catch {}
      if (!match) return res.status(401).json({ error: 'Неверный код.' });
      return res.json({ token: makeAdminToken() });
    }

    // GET /api/heartbeat — пинг по крону раз в 4 дня, не даёт Supabase Free
    // уйти в auto-pause после 7 дней неактивности.
    if (url === '/api/heartbeat' && method === 'GET') {
      const { count } = await supabase.from('products').select('*', { count: 'exact', head: true });
      return res.json({ ok: true, products: count, at: new Date().toISOString() });
    }

    // GET /api/products
    if (url === '/api/products' && method === 'GET') {
      const { data } = await supabase.from('products').select('*').order('order');
      return res.json(data || []);
    }

    // POST /api/products
    if (url === '/api/products' && method === 'POST') {
      if (!requireAdmin(req, res)) return;
      const { name, description, price, category, composition, tags, imageSrc, popular, imageClassName } = req.body;
      if (!name || price === undefined) return res.status(400).json({ error: 'Имя и цена обязательны.' });
      const { count } = await supabase.from('products').select('*', { count: 'exact', head: true });
      const id = `prod-${Date.now()}`;
      const newProduct = {
        id, name, description: description || '', price: Number(price),
        imageSrc: imageSrc || '', category: category || 'flowers',
        composition: composition || [], tags: tags || [],
        rating: 5.0, popular: !!popular,
        imageClassName: imageClassName || 'object-cover',
        order: count || 0,
      };
      await supabase.from('products').insert(newProduct);
      return res.json({ success: true, product: newProduct });
    }

    // PUT /api/products/:id
    const productMatch = url.match(/^\/api\/products\/([^/]+)$/);
    if (productMatch && method === 'PUT') {
      if (!requireAdmin(req, res)) return;
      const { data } = await supabase.from('products').update(req.body).eq('id', productMatch[1]).select().single();
      return res.json({ success: true, product: data });
    }

    // DELETE /api/products/:id
    if (productMatch && method === 'DELETE') {
      if (!requireAdmin(req, res)) return;
      await supabase.from('products').delete().eq('id', productMatch[1]);
      return res.json({ success: true });
    }

    // POST /api/products/reorder
    if (url === '/api/products/reorder' && method === 'POST') {
      if (!requireAdmin(req, res)) return;
      for (const item of (req.body.orders || [])) {
        await supabase.from('products').update({ order: Number(item.order) }).eq('id', item.id);
      }
      return res.json({ success: true });
    }

    // GET /api/orders — содержит ПДн клиентов, только админка.
    if (url === '/api/orders' && method === 'GET') {
      if (!requireAdmin(req, res)) return;
      const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
      return res.json((data || []).map(mapOrder));
    }

    // POST /api/order
    if (url === '/api/order' && method === 'POST') {
      const { customerName, customerPhone, deliveryType, address, cardMessage, totalPrice, items, date, time, paymentMethod } = req.body;
      if (!customerName || !customerPhone) return res.status(400).json({ error: 'Заполните имя и телефон.' });
      const orderId = `ELZ-${Math.floor(100000 + Math.random() * 900000)}`;
      const newOrder = {
        order_id: orderId, customer_name: customerName, customer_phone: customerPhone,
        delivery_type: deliveryType || 'delivery', address: address || '',
        date: date || 'Сегодня', time: time || 'В ближайшее время',
        card_message: cardMessage || '', total_price: totalPrice || 0,
        items: items || [], status: 'pending',
        status_log: [{ status: 'pending', timestamp: getFormattedDate(), note: 'Заказ оформлен на сайте.' }],
        payment_method: paymentMethod || 'cash', payment_status: 'pending_confirmation',
      };
      await supabase.from('orders').insert(newOrder);
      return res.json({ success: true, orderId, message: `Спасибо, ${customerName}! Менеджер свяжется с вами.` });
    }

    // GET /api/order/:id
    const orderMatch = url.match(/^\/api\/order\/([^/]+)$/);
    if (orderMatch && method === 'GET') {
      const { data } = await supabase.from('orders').select('*').eq('order_id', orderMatch[1]).single();
      if (!data) return res.status(404).json({ error: 'Заказ не найден.' });
      return res.json(mapOrder(data));
    }

    // DELETE /api/orders/:id — удалить заказ
    const orderDeleteMatch = url.match(/^\/api\/orders\/([^/]+)$/);
    if (orderDeleteMatch && method === 'DELETE') {
      if (!requireAdmin(req, res)) return;
      await supabase.from('orders').delete().eq('order_id', orderDeleteMatch[1]);
      return res.json({ success: true });
    }

    // POST /api/orders/:id/status
    const statusMatch = url.match(/^\/api\/orders\/([^/]+)\/status$/);
    if (statusMatch && method === 'POST') {
      if (!requireAdmin(req, res)) return;
      const { status, note, paymentStatus } = req.body;
      const { data: order } = await supabase.from('orders').select('*').eq('order_id', statusMatch[1]).single();
      if (!order) return res.status(404).json({ error: 'Заказ не найден.' });
      const statusLog = [...(order.status_log || []), { status, timestamp: getFormattedDate(), note: note || 'Статус обновлён.' }];
      const { data } = await supabase.from('orders').update({ status, status_log: statusLog, ...(paymentStatus && { payment_status: paymentStatus }) }).eq('order_id', statusMatch[1]).select().single();
      return res.json({ success: true, order: mapOrder(data) });
    }

    // GET /api/reviews
    if (url === '/api/reviews' && method === 'GET') {
      const { data } = await supabase.from('reviews').select('*').order('id', { ascending: false });
      return res.json(data || []);
    }

    // POST /api/reviews
    if (url === '/api/reviews' && method === 'POST') {
      const { author, rating, comment } = req.body;
      if (!author || !rating || !comment) return res.status(400).json({ error: 'Заполните все поля.' });
      const { data } = await supabase.from('reviews').insert({ author, rating: Number(rating), comment, date: new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) }).select().single();
      return res.json({ success: true, review: data });
    }

    // GET /api/categories
    if (url === '/api/categories' && method === 'GET') {
      const { data } = await supabase.from('categories').select('*');
      return res.json(data || []);
    }

    // POST /api/categories
    if (url === '/api/categories' && method === 'POST') {
      if (!requireAdmin(req, res)) return;
      const { id, label } = req.body;
      if (!id || !label) return res.status(400).json({ error: 'id и label обязательны.' });
      await supabase.from('categories').upsert({ id, label });
      return res.json({ success: true });
    }

    // DELETE /api/categories/:id
    const catMatch = url.match(/^\/api\/categories\/([^/]+)$/);
    if (catMatch && method === 'DELETE') {
      if (!requireAdmin(req, res)) return;
      await supabase.from('categories').delete().eq('id', catMatch[1]);
      return res.json({ success: true });
    }

    // POST /api/upload — загрузка фото товара в Timeweb S3 (российский CDN)
    if (url === '/api/upload' && method === 'POST') {
      if (!requireAdmin(req, res)) return;
      const { filename, contentType, dataBase64 } = req.body || {};
      if (!dataBase64) return res.status(400).json({ error: 'Нет данных изображения.' });
      const ext = String(filename || 'img.jpg').split('.').pop() || 'jpg';
      const key = `products/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const buffer = Buffer.from(dataBase64, 'base64');
      try {
        const publicUrl = await uploadToTimeweb(key, buffer, contentType || 'image/jpeg');
        return res.json({ url: publicUrl });
      } catch (e: any) {
        return res.status(500).json({ error: `Timeweb: ${e.message}` });
      }
    }

    // POST /api/migrate-to-timeweb — одноразовый перенос всех фото товаров
    // с Supabase/Unsplash на Timeweb S3 (российский CDN, открывается без ВПН).
    if (url === '/api/migrate-to-timeweb' && method === 'POST') {
      const { token } = req.body || {};
      if (token !== 'fix-mobile-images-2026-elizaveta') {
        return res.status(403).json({ error: 'forbidden' });
      }
      if (!timewebS3) {
        return res.status(500).json({ error: 'Timeweb S3 не настроен на Vercel (нет TIMEWEB_S3_KEY/SECRET).' });
      }

      const { data: products, error: fetchErr } = await supabase
        .from('products')
        .select('id, name, "imageSrc"');
      if (fetchErr) return res.status(500).json({ error: `Fetch: ${fetchErr.message}` });

      const results = await Promise.all((products || []).map(async (p: any) => {
        const src: string = p.imageSrc || '';

        if (src.includes('twcstorage.ru')) return { id: p.id, status: 'already-timeweb' };
        if (!src || src.startsWith('/src/')) return { id: p.id, status: 'skipped-broken', src };

        try {
          const imgRes = await fetch(src);
          if (!imgRes.ok) return { id: p.id, status: 'download-failed', code: imgRes.status };
          const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
          const arrayBuffer = await imgRes.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          const extRaw = (contentType.split('/')[1] || 'jpg').replace(/[^a-z0-9]/gi, '').slice(0, 5);
          const ext = extRaw || 'jpg';
          const key = `products/${p.id}-${Date.now()}.${ext}`;

          const publicUrl = await uploadToTimeweb(key, buffer, contentType);

          const { error: updErr } = await supabase
            .from('products')
            .update({ imageSrc: publicUrl })
            .eq('id', p.id);
          if (updErr) return { id: p.id, status: 'db-update-failed', error: updErr.message };

          return { id: p.id, name: p.name, status: 'migrated', bytes: buffer.length, url: publicUrl };
        } catch (e: any) {
          return { id: p.id, status: 'error', error: e.message };
        }
      }));

      const summary = {
        total: results.length,
        migrated: results.filter(r => r.status === 'migrated').length,
        alreadyTimeweb: results.filter(r => r.status === 'already-timeweb').length,
        skippedBroken: results.filter(r => r.status === 'skipped-broken').length,
        failed: results.filter(r => !['migrated', 'already-timeweb', 'skipped-broken'].includes(r.status)).length,
      };

      return res.json({ success: true, summary, results });
    }

    // POST /api/migrate-images — одноразовая миграция base64 → Supabase Storage
    // Чинит фото товаров, которые лежат в БД как data:image/...;base64,... —
    // на мобильном Safari такие строки больше ~2 МБ молча не рендерятся.
    if (url === '/api/migrate-images' && method === 'POST') {
      const { token } = req.body || {};
      if (token !== 'fix-mobile-images-2026-elizaveta') {
        return res.status(403).json({ error: 'forbidden' });
      }

      const { data: products, error: fetchErr } = await supabase.from('products').select('id, "imageSrc"');
      if (fetchErr) return res.status(500).json({ error: `Fetch: ${fetchErr.message}` });

      const migrated: any[] = [];
      const skippedBroken: any[] = [];
      const failed: any[] = [];
      let alreadyOk = 0;

      for (const p of products || []) {
        const src: string = p.imageSrc || '';

        if (src.startsWith('data:')) {
          const match = src.match(/^data:([^;]+);base64,(.+)$/);
          if (!match) {
            skippedBroken.push({ id: p.id, reason: 'invalid data URL' });
            continue;
          }
          const contentType = match[1] || 'image/jpeg';
          const base64 = match[2];
          const ext = (contentType.split('/')[1] || 'jpg').replace(/[^a-z0-9]/gi, '') || 'jpg';
          const path = `products/migrated-${p.id}-${Date.now()}.${ext}`;
          const buffer = Buffer.from(base64, 'base64');

          const { error: upErr } = await supabase.storage
            .from('product-images')
            .upload(path, buffer, { contentType, upsert: false });
          if (upErr) {
            failed.push({ id: p.id, step: 'upload', error: upErr.message });
            continue;
          }

          const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(path);
          const publicUrl = urlData.publicUrl;

          const { error: updErr } = await supabase
            .from('products')
            .update({ imageSrc: publicUrl })
            .eq('id', p.id);
          if (updErr) {
            failed.push({ id: p.id, step: 'db-update', error: updErr.message });
            continue;
          }

          migrated.push({ id: p.id, bytes: buffer.length, url: publicUrl });
        } else if (src.startsWith('/src/assets/')) {
          // Dev-only Vite paths — в проде не существуют, надо перезагрузить вручную через админку.
          skippedBroken.push({ id: p.id, reason: 'dev-only path, re-upload via admin', src });
        } else {
          alreadyOk++;
        }
      }

      return res.json({
        success: true,
        summary: {
          total: (products || []).length,
          migrated: migrated.length,
          alreadyOk,
          skippedBroken: skippedBroken.length,
          failed: failed.length,
        },
        migrated,
        skippedBroken,
        failed,
      });
    }

    // POST /api/orders/:id/pay — тестовое подтверждение оплаты (без реальной ЮKassa)
    const payMatch = url.match(/^\/api\/orders\/([^/]+)\/pay$/);
    if (payMatch && method === 'POST') {
      if (!requireAdmin(req, res)) return;
      const { data: order } = await supabase.from('orders').select('*').eq('order_id', payMatch[1]).single();
      if (!order) return res.status(404).json({ error: 'Заказ не найден.' });
      const statusLog = [...(order.status_log || []), { status: order.status, timestamp: getFormattedDate(), note: 'Оплата получена (тестовый режим).' }];
      const { data } = await supabase.from('orders')
        .update({ payment_status: 'paid', status_log: statusLog })
        .eq('order_id', payMatch[1]).select().single();
      return res.json({ success: true, order: mapOrder(data) });
    }

    // GET /api/yookassa/check-payment/:id — статус оплаты заказа (опрашиваем ЮKassa)
    const checkMatch = url.match(/^\/api\/yookassa\/check-payment\/([^/]+)$/);
    if (checkMatch && method === 'GET') {
      const { data: order } = await supabase.from('orders').select('*').eq('order_id', checkMatch[1]).single();
      if (!order) return res.status(404).json({ error: 'Заказ не найден.' });

      // Уже оплачен — ничего не спрашиваем
      if (order.payment_status === 'paid') {
        return res.json({ success: true, status: 'succeeded', order: mapOrder(order) });
      }

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
            const { data: updated } = await supabase.from('orders')
              .update({ payment_status: 'paid', status_log: statusLog })
              .eq('order_id', checkMatch[1]).select().single();
            return res.json({ success: true, status: 'succeeded', order: mapOrder(updated) });
          }
          return res.json({ success: true, status: payment.status || 'pending', order: mapOrder(order) });
        } catch {
          return res.json({ success: true, status: 'pending', order: mapOrder(order) });
        }
      }
      return res.json({ success: true, status: 'pending', order: mapOrder(order) });
    }

    // POST /api/yookassa/create-payment — создаём платёж и отдаём ссылку на оплату
    if (url === '/api/yookassa/create-payment' && method === 'POST') {
      const shopId = process.env.YOOKASSA_SHOP_ID;
      const secret = process.env.YOOKASSA_SECRET_KEY;
      if (!shopId || !secret) {
        return res.status(400).json({ error: 'Онлайн-оплата ЮKassa не настроена.' });
      }
      const { orderId } = req.body || {};
      if (!orderId) return res.status(400).json({ error: 'Не указан номер заказа.' });
      const { data: order } = await supabase.from('orders').select('*').eq('order_id', orderId).single();
      if (!order) return res.status(404).json({ error: 'Заказ не найден.' });

      const auth = Buffer.from(`${shopId}:${secret}`).toString('base64');
      const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
      const returnUrl = `${proto}://${req.headers.host}/?order=${encodeURIComponent(orderId)}`;
      const idempotenceKey = `${orderId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const ykRes = await fetch('https://api.yookassa.ru/v3/payments', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Idempotence-Key': idempotenceKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: { value: Number(order.total_price || 0).toFixed(2), currency: 'RUB' },
          capture: true,
          confirmation: { type: 'redirect', return_url: returnUrl },
          description: `Заказ ${orderId} — Цветы Елизавета`,
          metadata: { orderId },
        }),
      });
      const payment: any = await ykRes.json();
      if (!ykRes.ok) {
        return res.status(502).json({ error: payment.description || 'Ошибка создания платежа ЮKassa.' });
      }
      await supabase.from('orders').update({ payment_id: payment.id }).eq('order_id', orderId);
      return res.json({ confirmationUrl: payment.confirmation?.confirmation_url, paymentId: payment.id });
    }

    // POST /api/yookassa/webhook — уведомление от ЮKassa о смене статуса платежа
    if (url === '/api/yookassa/webhook' && method === 'POST') {
      try {
        const paymentObj = (req.body && req.body.object) || {};
        const paymentId = paymentObj.id;
        const shopId = process.env.YOOKASSA_SHOP_ID;
        const secret = process.env.YOOKASSA_SECRET_KEY;
        // Не доверяем телу вслепую — перепроверяем платёж напрямую у ЮKassa
        if (paymentId && shopId && secret) {
          const auth = Buffer.from(`${shopId}:${secret}`).toString('base64');
          const ykRes = await fetch(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
            headers: { Authorization: `Basic ${auth}` },
          });
          const payment: any = await ykRes.json();
          const orderId = payment?.metadata?.orderId || paymentObj?.metadata?.orderId;
          if (ykRes.ok && payment.status === 'succeeded' && orderId) {
            const { data: order } = await supabase.from('orders').select('*').eq('order_id', orderId).single();
            if (order && order.payment_status !== 'paid') {
              const statusLog = [...(order.status_log || []), { status: order.status, timestamp: getFormattedDate(), note: 'Онлайн-оплата ЮKassa подтверждена (вебхук).' }];
              await supabase.from('orders').update({ payment_status: 'paid', status_log: statusLog }).eq('order_id', orderId);
            }
          }
        }
      } catch (e) {
        console.error('YooKassa webhook error:', e);
      }
      // Всегда 200, иначе ЮKassa будет повторять отправку
      return res.status(200).json({ received: true });
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (e: any) {
    console.error('API error:', e);
    return res.status(500).json({ error: e.message });
  }
}
