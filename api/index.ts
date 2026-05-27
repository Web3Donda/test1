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
      return res.json(data || []);
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
      return res.json(data);
    }

    // POST /api/orders/:id/status
    const statusMatch = url.match(/^\/api\/orders\/([^/]+)\/status$/);
    if (statusMatch && method === 'POST') {
      const { status, note, paymentStatus } = req.body;
      const { data: order } = await supabase.from('orders').select('*').eq('order_id', statusMatch[1]).single();
      if (!order) return res.status(404).json({ error: 'Заказ не найден.' });
      const statusLog = [...(order.status_log || []), { status, timestamp: getFormattedDate(), note: note || 'Статус обновлён.' }];
      const { data } = await supabase.from('orders').update({ status, status_log: statusLog, ...(paymentStatus && { payment_status: paymentStatus }) }).eq('order_id', statusMatch[1]).select().single();
      return res.json({ success: true, order: data });
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

    return res.status(404).json({ error: 'Not found' });
  } catch (e: any) {
    console.error('API error:', e);
    return res.status(500).json({ error: e.message });
  }
}
