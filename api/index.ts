import express from 'express';
import 'dotenv/config';
import { productsList, reviewsList } from '../src/data.js';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  getDocFromServer
} from 'firebase/firestore';
import { db, OperationType } from '../src/firebase-server.js';

const app = express();

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ limit: '15mb', extended: true }));

interface Order {
  orderId: string;
  customerName: string;
  customerPhone: string;
  deliveryType: 'delivery' | 'pickup';
  address?: string;
  date?: string;
  time?: string;
  cardMessage?: string;
  totalPrice: number;
  items: {
    productId: string;
    name: string;
    quantity: number;
    price: number;
  }[];
  status: 'pending' | 'assembling' | 'assembled' | 'delivering' | 'delivered' | 'cancelled';
  statusLog: { status: string; timestamp: string; note: string }[];
  createdAt: string;
  paymentMethod?: 'cash' | 'yookassa' | string;
  paymentStatus?: 'unpaid' | 'paid' | 'pending_confirmation' | string;
}

const mockOrdersList: Order[] = [
  {
    orderId: 'ELZ-482103',
    customerName: 'Анна Петрова',
    customerPhone: '+7 (912) 345-67-89',
    deliveryType: 'delivery',
    address: 'г. Челябинск, ул. Ленина, д. 45, кв. 112',
    date: 'Сегодня',
    time: '14:00 - 16:00',
    cardMessage: 'Любимой мамочке в день рождения!',
    totalPrice: 3885,
    items: [
      { productId: 'flower-1', name: 'Роза Нина Эквадор', quantity: 15, price: 220 },
      { productId: 'green-1', name: 'Эвкалипт', quantity: 3, price: 150 }
    ],
    status: 'delivered',
    statusLog: [
      { status: 'pending', timestamp: '22 Мая, 11:20', note: 'Заказ успешно принят на сайте' },
      { status: 'delivered', timestamp: '22 Мая, 14:15', note: 'Букет успешно и красиво вручен получателю! ✨' }
    ],
    createdAt: '2026-05-22T11:20:00.000Z'
  }
];

function getFormattedDate() {
  const d = new Date();
  const months = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
  return `${d.getDate()} ${months[d.getMonth()]}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ── API ROUTES ─────────────────────────────────────────────────────────────────

app.post('/api/order', async (req, res) => {
  const { customerName, customerPhone, deliveryType, address, cardMessage, totalPrice, items, date, time, paymentMethod } = req.body;
  if (!customerName || !customerPhone) {
    return res.status(400).json({ error: 'Пожалуйста, заполните имя и номер телефона.' });
  }
  const orderId = `ELZ-${Math.floor(100000 + Math.random() * 900000)}`;
  const finalPaymentMethod = paymentMethod || 'cash';
  const finalPaymentStatus = req.body.paymentStatus || (finalPaymentMethod === 'yookassa' ? 'unpaid' : 'pending_confirmation');
  const statusNote = finalPaymentMethod === 'yookassa'
    ? 'Оформлено на сайте. Ожидает онлайн-оплаты через сервис ЮKassa.'
    : 'Оформлено на сайте. Менеджер свяжется с вами для подтверждения.';
  const newOrder: Order = {
    orderId, customerName, customerPhone,
    deliveryType: deliveryType || 'delivery',
    address: address || 'Челябинск',
    date: date || 'Сегодня',
    time: time || 'В ближайшие 2 часа',
    cardMessage: cardMessage || '',
    totalPrice: totalPrice || 0,
    items: items || [],
    status: 'pending',
    statusLog: [{ status: 'pending', timestamp: getFormattedDate(), note: statusNote }],
    createdAt: new Date().toISOString(),
    paymentMethod: finalPaymentMethod,
    paymentStatus: finalPaymentStatus
  };
  try { await setDoc(doc(db, 'orders', orderId), newOrder); } catch (e) { console.warn('Firestore write failed:', e); }
  mockOrdersList.unshift(newOrder);
  res.json({
    success: true, orderId,
    paymentMethod: finalPaymentMethod,
    paymentStatus: finalPaymentStatus,
    totalPrice: newOrder.totalPrice,
    message: deliveryType === 'pickup'
      ? `Спасибо, ${customerName}! Ждём вас на ул. Масленникова, д. 6/1.`
      : `Спасибо, ${customerName}! Менеджер свяжется с вами по номеру ${customerPhone}.`
  });
});

app.get('/api/orders', async (req, res) => {
  try {
    const snap = await getDocs(collection(db, 'orders'));
    const list = snap.docs.map(d => d.data());
    const mergedMap = new Map();
    mockOrdersList.forEach((o: any) => mergedMap.set(o.orderId, o));
    list.forEach((o: any) => mergedMap.set(o.orderId, o));
    const merged = Array.from(mergedMap.values()).sort((a: any, b: any) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    res.json(merged);
  } catch { res.json(mockOrdersList); }
});

app.get('/api/products', async (req, res) => {
  try {
    const snap = await getDocs(collection(db, 'products'));
    let list = snap.docs.map(d => d.data());
    if (list.length === 0) list = [...productsList];
    list.sort((a: any, b: any) => {
      const oA = a.order ?? 9999, oB = b.order ?? 9999;
      return oA !== oB ? oA - oB : (a.id || '').localeCompare(b.id || '');
    });
    res.json(list);
  } catch { res.json(productsList); }
});

const defaultCategories = [
  { id: 'flowers', label: 'Цветы поштучно' },
  { id: 'greens', label: 'Декоративная зелень' },
  { id: 'balloons', label: 'Гелиевые шары' },
  { id: 'author', label: 'Авторские букеты' },
  { id: 'roses', label: 'Пионовидные розы' },
  { id: 'spring', label: 'Весенняя коллекция' },
  { id: 'boxes', label: 'Шляпные коробки' }
];
let mockCategories = [...defaultCategories];

app.get('/api/categories', async (req, res) => {
  try {
    const snap = await getDocs(collection(db, 'categories'));
    let list = snap.docs.map(d => d.data());
    if (list.length === 0) {
      for (const cat of defaultCategories) await setDoc(doc(db, 'categories', cat.id), cat).catch(() => {});
      list = [...defaultCategories];
    }
    const mergedMap = new Map();
    mockCategories.forEach((c: any) => mergedMap.set(c.id, c));
    list.forEach((c: any) => mergedMap.set(c.id, c));
    res.json(Array.from(mergedMap.values()));
  } catch { res.json(mockCategories); }
});

app.post('/api/categories', async (req, res) => {
  const { id, label } = req.body;
  if (!id || !label) return res.status(400).json({ error: 'Идентификатор и название обязательны.' });
  const cat = { id, label };
  try { await setDoc(doc(db, 'categories', id), cat); } catch (e) { console.warn(e); }
  if (!mockCategories.some(c => c.id === id)) mockCategories.push(cat);
  res.json({ success: true, category: cat });
});

app.delete('/api/categories/:id', async (req, res) => {
  const { id } = req.params;
  try { await deleteDoc(doc(db, 'categories', id)); } catch (e) { console.warn(e); }
  mockCategories = mockCategories.filter(c => c.id !== id);
  res.json({ success: true });
});

app.post('/api/products', async (req, res) => {
  const { name, description, price, category, composition, tags, imageSrc, popular, imageClassName } = req.body;
  if (!name || price === undefined) return res.status(400).json({ error: 'Имя и цена обязательны.' });
  const id = `prod-${Date.now()}`;
  let targetOrder = productsList.length;
  try { const snap = await getDocs(collection(db, 'products')); targetOrder = snap.size; } catch {}
  const newProduct = {
    id, name,
    description: description || '',
    price: Number(price),
    imageSrc: imageSrc || 'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?q=80&w=600&auto=format&fit=crop',
    category: category || 'flowers',
    composition: Array.isArray(composition) ? composition : (composition ? composition.split(',').map((s: string) => s.trim()) : []),
    tags: Array.isArray(tags) ? tags : (tags ? tags.split(',').map((s: string) => s.trim()) : []),
    rating: 5.0, popular: !!popular,
    imageClassName: imageClassName || 'object-cover',
    order: targetOrder
  };
  try { await setDoc(doc(db, 'products', id), newProduct); } catch (e) { console.warn(e); }
  res.json({ success: true, product: newProduct });
});

app.put('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  const { name, description, price, category, composition, tags, imageSrc, popular, imageClassName, order } = req.body;
  try {
    const docRef = doc(db, 'products', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const updated = {
        ...docSnap.data(),
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price: Number(price) }),
        ...(category !== undefined && { category }),
        ...(composition !== undefined && { composition: Array.isArray(composition) ? composition : composition.split(',').map((s: string) => s.trim()) }),
        ...(tags !== undefined && { tags: Array.isArray(tags) ? tags : tags.split(',').map((s: string) => s.trim()) }),
        ...(imageSrc !== undefined && { imageSrc }),
        ...(popular !== undefined && { popular: !!popular }),
        ...(imageClassName !== undefined && { imageClassName }),
        ...(order !== undefined && { order: Number(order) })
      };
      await setDoc(docRef, updated);
      return res.json({ success: true, product: updated });
    }
    res.status(404).json({ error: 'Товар не найден.' });
  } catch (e) { res.status(500).json({ error: 'Ошибка обновления.' }); }
});

app.post('/api/products/reorder', async (req, res) => {
  const { orders } = req.body;
  if (!orders || !Array.isArray(orders)) return res.status(400).json({ error: 'Массив orders обязателен.' });
  try {
    for (const item of orders) {
      if (!item.id) continue;
      const docRef = doc(db, 'products', item.id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) await setDoc(docRef, { ...docSnap.data(), order: Number(item.order) });
    }
  } catch (e) { console.warn(e); }
  res.json({ success: true });
});

app.delete('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const docRef = doc(db, 'products', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) { await deleteDoc(docRef); return res.json({ success: true }); }
    res.status(404).json({ error: 'Товар не найден.' });
  } catch { res.status(500).json({ error: 'Ошибка удаления.' }); }
});

app.get('/api/order/:id', async (req, res) => {
  const trackingId = req.params.id.trim();
  try {
    const docSnap = await getDoc(doc(db, 'orders', trackingId));
    if (docSnap.exists()) return res.json(docSnap.data());
    const snap = await getDocs(collection(db, 'orders'));
    const matched = snap.docs.find(d => d.id.toUpperCase() === trackingId.toUpperCase());
    if (matched) return res.json(matched.data());
  } catch (e) { console.warn(e); }
  const fallback = mockOrdersList.find(o => o.orderId.toUpperCase() === trackingId.toUpperCase());
  if (fallback) return res.json(fallback);
  res.status(404).json({ error: 'Заказ не найден. Проверьте формат ELZ-XXXXXX.' });
});

app.post('/api/orders/:id/status', async (req, res) => {
  const orderId = req.params.id;
  const { status, note, paymentStatus } = req.body;
  const validStatuses = ['pending', 'assembling', 'assembled', 'delivering', 'delivered', 'cancelled'];
  if (status && !validStatuses.includes(status)) return res.status(400).json({ error: 'Некорректный статус.' });
  const defaultNotes: Record<string, string> = {
    pending: 'Заказ ожидает подтверждения',
    assembling: 'Флористы собирают ваш букет',
    assembled: 'Букет собран и упакован',
    delivering: 'Курьер везёт заказ',
    delivered: 'Букет вручен получателю ✨',
    cancelled: 'Заказ отменён'
  };
  try {
    const docRef = doc(db, 'orders', orderId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const orderData = docSnap.data();
      const newStatus = status || orderData.status;
      const finalNote = note || defaultNotes[status] || 'Статус обновлён.';
      const statusLog = [...(orderData.statusLog || []), { status: newStatus, timestamp: getFormattedDate(), note: finalNote }];
      const updated = { ...orderData, status: newStatus, statusLog, ...(paymentStatus && { paymentStatus }) };
      await setDoc(docRef, updated);
      return res.json({ success: true, order: updated });
    }
  } catch (e) { console.warn(e); }
  res.status(404).json({ error: 'Заказ не найден.' });
});

app.post('/api/orders/:id/pay', async (req, res) => {
  const orderId = req.params.id;
  try {
    const docRef = doc(db, 'orders', orderId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const orderData = docSnap.data();
      const statusLog = [...(orderData.statusLog || []), {
        status: orderData.status, timestamp: getFormattedDate(),
        note: '💳 Оплата принята (тестовый режим). Заказ передан флористам!'
      }];
      const updated = { ...orderData, paymentStatus: 'paid', statusLog };
      await setDoc(docRef, updated);
      return res.json({ success: true, order: updated });
    }
  } catch (e) { console.warn(e); }
  res.status(404).json({ error: 'Заказ не найден.' });
});

const YOOKASSA_SHOP_ID = process.env.YOOKASSA_SHOP_ID || '';
const YOOKASSA_SECRET_KEY = process.env.YOOKASSA_SECRET_KEY || '';

app.post('/api/yookassa/create-payment', async (req, res) => {
  const { orderId } = req.body;
  if (!orderId) return res.status(400).json({ error: 'orderId обязателен' });
  let order: any = null;
  try { const s = await getDoc(doc(db, 'orders', orderId)); if (s.exists()) order = s.data(); } catch {}
  if (!order) order = mockOrdersList.find(o => o.orderId === orderId);
  if (!order) return res.status(404).json({ error: 'Заказ не найден.' });

  if (YOOKASSA_SHOP_ID && YOOKASSA_SECRET_KEY) {
    try {
      const auth = Buffer.from(`${YOOKASSA_SHOP_ID}:${YOOKASSA_SECRET_KEY}`).toString('base64');
      const payload = {
        amount: { value: `${order.totalPrice}.00`, currency: 'RUB' },
        capture: true,
        confirmation: { type: 'redirect', return_url: `${process.env.APP_URL || ''}/order-tracker?id=${orderId}` },
        description: `Заказ ${orderId} — Цветочный салон Елизавета`,
        metadata: { orderId }
      };
      const r = await fetch('https://api.yookassa.ru/v3/payments', {
        method: 'POST',
        headers: { 'Authorization': `Basic ${auth}`, 'Idempotence-Key': `${orderId}-${Date.now()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!r.ok) throw new Error(`YooKassa HTTP ${r.status}`);
      const data = await r.json() as any;
      return res.json({ success: true, realPayment: true, confirmationUrl: data.confirmation?.confirmation_url, paymentId: data.id });
    } catch (e: any) { return res.status(500).json({ error: 'Ошибка ЮKassa: ' + e.message }); }
  }

  return res.json({ success: true, realPayment: false, confirmationUrl: null, message: 'Симулятор ЮKassa.' });
});

app.post('/api/payments/yookassa-webhook', async (req, res) => {
  const e = req.body;
  if (e?.event === 'payment.succeeded') {
    const orderId = e.object?.metadata?.orderId;
    if (orderId) {
      try {
        const docRef = doc(db, 'orders', orderId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const d = snap.data();
          await setDoc(docRef, { ...d, paymentStatus: 'paid', statusLog: [...(d.statusLog || []), { status: d.status, timestamp: getFormattedDate(), note: '💳 Платёж подтверждён вебхуком ЮKassa ✨' }] });
        }
      } catch {}
    }
  }
  res.status(200).send('OK');
});

app.get('/api/reviews', async (req, res) => {
  try {
    const snap = await getDocs(collection(db, 'reviews'));
    let list = snap.docs.map(d => d.data());
    if (list.length === 0) list = [...reviewsList];
    else list.sort((a: any, b: any) => b.id.localeCompare(a.id));
    res.json(list);
  } catch { res.json(reviewsList); }
});

app.post('/api/reviews', async (req, res) => {
  const { author, rating, comment } = req.body;
  if (!author || !rating || !comment) return res.status(400).json({ error: 'Заполните все поля.' });
  const id = `review-${Date.now()}`;
  const newReview = { id, author, rating: Number(rating), comment, date: new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) };
  try { await setDoc(doc(db, 'reviews', id), newReview); } catch (e) { console.warn(e); }
  res.json({ success: true, review: newReview });
});

// Export for Vercel serverless
export default app;
