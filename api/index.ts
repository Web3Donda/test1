import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

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
    // GET /api/products
    if (url === '/api/products' && method === 'GET') {
      const { data } = await supabase.from('products').select('*').order('order');
      return res.json(data || []);
    }

    // POST /api/products
    if (url === '/api/products' && method === 'POST') {
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
      const { data } = await supabase.from('products').update(req.body).eq('id', productMatch[1]).select().single();
      return res.json({ success: true, product: data });
    }

    // DELETE /api/products/:id
    if (productMatch && method === 'DELETE') {
      await supabase.from('products').delete().eq('id', productMatch[1]);
      return res.json({ success: true });
    }

    // POST /api/products/reorder
    if (url === '/api/products/reorder' && method === 'POST') {
      for (const item of (req.body.orders || [])) {
        await supabase.from('products').update({ order: Number(item.order) }).eq('id', item.id);
      }
      return res.json({ success: true });
    }

    // GET /api/orders
    if (url === '/api/orders' && method === 'GET') {
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
      await supabase.from('orders').delete().eq('order_id', orderDeleteMatch[1]);
      return res.json({ success: true });
    }

    // POST /api/orders/:id/status
    const statusMatch = url.match(/^\/api\/orders\/([^/]+)\/status$/);
    if (statusMatch && method === 'POST') {
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
      const { id, label } = req.body;
      if (!id || !label) return res.status(400).json({ error: 'id и label обязательны.' });
      await supabase.from('categories').upsert({ id, label });
      return res.json({ success: true });
    }

    // DELETE /api/categories/:id
    const catMatch = url.match(/^\/api\/categories\/([^/]+)$/);
    if (catMatch && method === 'DELETE') {
      await supabase.from('categories').delete().eq('id', catMatch[1]);
      return res.json({ success: true });
    }

    // POST /api/upload — загрузка фото товара в Supabase Storage (серверный ключ)
    if (url === '/api/upload' && method === 'POST') {
      const { filename, contentType, dataBase64 } = req.body || {};
      if (!dataBase64) return res.status(400).json({ error: 'Нет данных изображения.' });
      const ext = String(filename || 'img.jpg').split('.').pop() || 'jpg';
      const path = `products/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const buffer = Buffer.from(dataBase64, 'base64');
      const { error } = await supabase.storage.from('product-images').upload(path, buffer, {
        contentType: contentType || 'image/jpeg',
        upsert: false,
      });
      if (error) return res.status(500).json({ error: `Storage: ${error.message}` });
      const { data } = supabase.storage.from('product-images').getPublicUrl(path);
      return res.json({ url: data.publicUrl });
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
