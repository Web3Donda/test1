import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, getDoc, deleteDoc, orderBy, query } from 'firebase/firestore';

const firebaseConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  appId: process.env.FIREBASE_APP_ID,
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
};

function getDb() {
  const app = getApps()[0] || initializeApp(firebaseConfig);
  return getFirestore(app, process.env.FIREBASE_DATABASE_ID || '(default)');
}

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
    const db = getDb();

    // GET /api/products
    if (url === '/api/products' && method === 'GET') {
      const snap = await getDocs(query(collection(db, 'products'), orderBy('order')));
      return res.json(snap.docs.map(d => d.data()));
    }

    // POST /api/products
    if (url === '/api/products' && method === 'POST') {
      const { name, description, price, category, composition, tags, imageSrc, popular, imageClassName } = req.body;
      if (!name || price === undefined) return res.status(400).json({ error: 'Имя и цена обязательны.' });
      const snap = await getDocs(collection(db, 'products'));
      const id = `prod-${Date.now()}`;
      const newProduct = {
        id, name,
        description: description || '',
        price: Number(price),
        imageSrc: imageSrc || '',
        category: category || 'flowers',
        composition: Array.isArray(composition) ? composition : (composition ? composition.split(',').map((s: string) => s.trim()) : []),
        tags: Array.isArray(tags) ? tags : (tags ? tags.split(',').map((s: string) => s.trim()) : []),
        rating: 5.0,
        popular: !!popular,
        imageClassName: imageClassName || 'object-cover',
        order: snap.size,
      };
      await setDoc(doc(db, 'products', id), newProduct);
      return res.json({ success: true, product: newProduct });
    }

    // PUT /api/products/:id
    const productMatch = url.match(/^\/api\/products\/([^/]+)$/);
    if (productMatch && method === 'PUT') {
      const id = productMatch[1];
      const docRef = doc(db, 'products', id);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return res.status(404).json({ error: 'Товар не найден.' });
      const updated = { ...docSnap.data(), ...req.body };
      await setDoc(docRef, updated);
      return res.json({ success: true, product: updated });
    }

    // DELETE /api/products/:id
    if (productMatch && method === 'DELETE') {
      await deleteDoc(doc(db, 'products', productMatch[1]));
      return res.json({ success: true });
    }

    // POST /api/products/reorder
    if (url === '/api/products/reorder' && method === 'POST') {
      const { orders } = req.body;
      for (const item of (orders || [])) {
        const docRef = doc(db, 'products', item.id);
        const snap = await getDoc(docRef);
        if (snap.exists()) await setDoc(docRef, { ...snap.data(), order: Number(item.order) });
      }
      return res.json({ success: true });
    }

    // GET /api/orders
    if (url === '/api/orders' && method === 'GET') {
      const snap = await getDocs(collection(db, 'orders'));
      const list = snap.docs.map(d => d.data()).sort((a: any, b: any) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      return res.json(list);
    }

    // POST /api/order
    if (url === '/api/order' && method === 'POST') {
      const { customerName, customerPhone, deliveryType, address, cardMessage, totalPrice, items, date, time, paymentMethod } = req.body;
      if (!customerName || !customerPhone) return res.status(400).json({ error: 'Заполните имя и телефон.' });
      const orderId = `ELZ-${Math.floor(100000 + Math.random() * 900000)}`;
      const newOrder = {
        orderId, customerName, customerPhone,
        deliveryType: deliveryType || 'delivery',
        address: address || '',
        date: date || 'Сегодня',
        time: time || 'В ближайшее время',
        cardMessage: cardMessage || '',
        totalPrice: totalPrice || 0,
        items: items || [],
        status: 'pending',
        statusLog: [{ status: 'pending', timestamp: getFormattedDate(), note: 'Заказ оформлен на сайте.' }],
        createdAt: new Date().toISOString(),
        paymentMethod: paymentMethod || 'cash',
        paymentStatus: 'pending_confirmation',
      };
      await setDoc(doc(db, 'orders', orderId), newOrder);
      return res.json({ success: true, orderId, message: `Спасибо, ${customerName}! Менеджер свяжется с вами.` });
    }

    // GET /api/order/:id
    const orderMatch = url.match(/^\/api\/order\/([^/]+)$/);
    if (orderMatch && method === 'GET') {
      const docSnap = await getDoc(doc(db, 'orders', orderMatch[1]));
      if (!docSnap.exists()) return res.status(404).json({ error: 'Заказ не найден.' });
      return res.json(docSnap.data());
    }

    // POST /api/orders/:id/status
    const statusMatch = url.match(/^\/api\/orders\/([^/]+)\/status$/);
    if (statusMatch && method === 'POST') {
      const { status, note, paymentStatus } = req.body;
      const docRef = doc(db, 'orders', statusMatch[1]);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return res.status(404).json({ error: 'Заказ не найден.' });
      const data = docSnap.data()!;
      const statusLog = [...(data.statusLog || []), { status, timestamp: getFormattedDate(), note: note || 'Статус обновлён.' }];
      const updated = { ...data, status, statusLog, ...(paymentStatus && { paymentStatus }) };
      await setDoc(docRef, updated);
      return res.json({ success: true, order: updated });
    }

    // GET /api/reviews
    if (url === '/api/reviews' && method === 'GET') {
      const snap = await getDocs(collection(db, 'reviews'));
      return res.json(snap.docs.map(d => d.data()));
    }

    // POST /api/reviews
    if (url === '/api/reviews' && method === 'POST') {
      const { author, rating, comment } = req.body;
      if (!author || !rating || !comment) return res.status(400).json({ error: 'Заполните все поля.' });
      const id = `review-${Date.now()}`;
      const newReview = { id, author, rating: Number(rating), comment, date: new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) };
      await setDoc(doc(db, 'reviews', id), newReview);
      return res.json({ success: true, review: newReview });
    }

    // GET /api/categories
    if (url === '/api/categories' && method === 'GET') {
      const snap = await getDocs(collection(db, 'categories'));
      return res.json(snap.docs.map(d => d.data()));
    }

    // POST /api/categories
    if (url === '/api/categories' && method === 'POST') {
      const { id, label } = req.body;
      if (!id || !label) return res.status(400).json({ error: 'id и label обязательны.' });
      await setDoc(doc(db, 'categories', id), { id, label });
      return res.json({ success: true });
    }

    // DELETE /api/categories/:id
    const catMatch = url.match(/^\/api\/categories\/([^/]+)$/);
    if (catMatch && method === 'DELETE') {
      await deleteDoc(doc(db, 'categories', catMatch[1]));
      return res.json({ success: true });
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (e: any) {
    console.error('API error:', e);
    return res.status(500).json({ error: e.message });
  }
}
