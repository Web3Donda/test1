import React, { useState, useEffect, useRef } from 'react';
import { 
  ShoppingBag, 
  Send, 
  Star, 
  Phone, 
  Truck, 
  Clock, 
  Eye, 
  Trash2, 
  MessageSquare, 
  Check, 
  Heart, 
  Search, 
  HelpCircle, 
  ChevronRight, 
  ChevronDown,
  Info, 
  Award, 
  Leaf, 
  Gift,
  X,
  MapPin,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Map,
  ExternalLink,
  UploadCloud,
  Image,
  GripVertical,
  ArrowUp,
  ArrowDown,
  CreditCard
} from 'lucide-react';
import { Product, CartItem, Review } from './types.js';
import TransparentLogo from './components/TransparentLogo.js';
import { uploadProductImage } from './supabase-storage.js';

// Шлёт fetch с заголовком авторизации админки. Если сервер вернул 401/403 —
// чистим протухший токен, чтобы при следующем заходе PIN запросили заново.
const adminFetch = (input: RequestInfo, init: RequestInit = {}): Promise<Response> => {
  const token = localStorage.getItem('adminToken') || '';
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
    Authorization: `Bearer ${token}`,
  };
  return fetch(input, { ...init, headers }).then((res) => {
    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem('adminToken');
    }
    return res;
  });
};

export const parseImageClassNameToStyle = (classNameStr: string = ''): React.CSSProperties => {
  const style: React.CSSProperties = {
    objectFit: 'cover'
  };
  if (!classNameStr) return style;

  const posMatch = classNameStr.match(/\[object-position:\s*([\d.]+)%\s*_\s*([\d.]+)%\]/);
  if (posMatch) {
    style.objectPosition = `${posMatch[1]}% ${posMatch[2]}%`;
  } else {
    const yMatch = classNameStr.match(/\[object-position:\s*center\s*_\s*([\d.]+)%\]/);
    if (yMatch) {
      style.objectPosition = `center ${yMatch[1]}%`;
    }
  }

  const transformMatch = classNameStr.match(/\[transform:\s*scale\(([\d.]+)\)\]/);
  if (transformMatch) {
    style.transform = `scale(${transformMatch[1]})`;
  }

  return style;
};

import vkIcon from './assets/images/vk.png';
import designShowcaseImg from './assets/images/flowerss.jpg';

const MONTHS_RU = [
  { value: 'any', label: 'Все месяцы' },
  { value: '01', label: 'Январь' },
  { value: '02', label: 'Февраль' },
  { value: '03', label: 'Март' },
  { value: '04', label: 'Апрель' },
  { value: '05', label: 'Май' },
  { value: '06', label: 'Июнь' },
  { value: '07', label: 'Июль' },
  { value: '08', label: 'Август' },
  { value: '09', label: 'Сентябрь' },
  { value: '10', label: 'Октябрь' },
  { value: '11', label: 'Ноябрь' },
  { value: '12', label: 'Декабрь' },
];

const getOrderDateInfo = (order: any, type: 'createdAt' | 'delivery') => {
  if (type === 'createdAt') {
    const raw = order.createdAt;
    if (!raw) return { year: '', month: '', fullDate: '' };
    try {
      const dObj = new Date(raw);
      if (isNaN(dObj.getTime())) return { year: '', month: '', fullDate: '' };
      const y = dObj.getFullYear().toString();
      const m = String(dObj.getMonth() + 1).padStart(2, '0');
      const d = String(dObj.getDate()).padStart(2, '0');
      return {
        year: y,
        month: m,
        fullDate: `${y}-${m}-${d}`
      };
    } catch {
      return { year: '', month: '', fullDate: '' };
    }
  } else {
    const raw = order.date; // "YYYY-MM-DD"
    if (!raw) return { year: '', month: '', fullDate: '' };
    const parts = raw.split('-');
    if (parts.length === 3) {
      return {
        year: parts[0],
        month: parts[1],
        fullDate: raw
      };
    }
    // fallback parsing
    try {
      const dObj = new Date(raw);
      if (isNaN(dObj.getTime())) return { year: '', month: '', fullDate: '' };
      const y = dObj.getFullYear().toString();
      const m = String(dObj.getMonth() + 1).padStart(2, '0');
      const d = String(dObj.getDate()).padStart(2, '0');
      return {
        year: y,
        month: m,
        fullDate: `${y}-${m}-${d}`
      };
    } catch {
      return { year: '', month: '', fullDate: '' };
    }
  }
};

export default function App() {
  // Store lists in states
  const [products, setProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);

  // Dynamic Categories State
  const [categories, setCategories] = useState<{ id: string; label: string }[]>([
    { id: 'flowers', label: 'Цветы поштучно' },
    { id: 'greens', label: 'Декоративная зелень' },
    { id: 'balloons', label: 'Гелиевые шары' },
    { id: 'author', label: 'Авторские букеты' },
    { id: 'roses', label: 'Пионовидные розы' },
    { id: 'spring', label: 'Весенняя коллекция' },
    { id: 'boxes', label: 'Шляпные коробки' }
  ]);
  const [newCategoryId, setNewCategoryId] = useState<string>('');
  const [newCategoryLabel, setNewCategoryLabel] = useState<string>('');
  const [isCategorySaving, setIsCategorySaving] = useState<boolean>(false);
  const [categoryFormError, setCategoryFormError] = useState<string>('');

  // Favorites (Избранные букеты) State
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('elizabeth_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('elizabeth_favorites', JSON.stringify(favorites));
    } catch (e) {
      console.error('Failed to save favorites to localStorage:', e);
    }
  }, [favorites]);
  
  // Filtering and Searching
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<number>(10000);
  const [oracleMood, setOracleMood] = useState<'passion' | 'tenderness' | 'harmony' | 'mystery'>('harmony');

  // Shopping Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [commentInput, setCommentInput] = useState<string>('');
  const [cardMessageInput, setCardMessageInput] = useState<string>('');
  
  // Custom Postcard & Comment per item creation state values
  const [selectedProductForCartSetup, setSelectedProductForCartSetup] = useState<Product | null>(null);
  const [pendingCardMessage, setPendingCardMessage] = useState<string>('');
  const [pendingComment, setPendingComment] = useState<string>('');

  // Review interaction state
  const [newReview, setNewReview] = useState({
    author: '',
    rating: 5,
    comment: ''
  });
  const [reviewSuccessMessage, setReviewSuccessMessage] = useState<string>('');

  // Main Active Product Details Modal
  const [selectedDetailProduct, setSelectedDetailProduct] = useState<Product | null>(null);

  // Craft Process Modal State
  const [isCraftModalOpen, setIsCraftModalOpen] = useState<boolean>(false);
  const [activeProcessStep, setActiveProcessStep] = useState<number>(0);

  // Public Offer Modal State
  const [isOfferModalOpen, setIsOfferModalOpen] = useState<boolean>(false);
  const [offerModalTab, setOfferModalTab] = useState<'offer' | 'agreement'>('offer');

  // Check if shop is currently open (08:00 - 21:00 in Chelyabinsk time / UTC+5)
  const isShopOpen = (() => {
    const utcDate = new Date();
    // Chelyabinsk is always UTC+5 (no daylight saving time in Russia)
    const chelyabinskTime = new Date(utcDate.getTime() + (5 * 60 * 60 * 1000));
    const hours = chelyabinskTime.getUTCHours();
    return hours >= 8 && hours < 21;
  })();

  // Checkout State
  const [isCheckoutDrawerOpen, setIsCheckoutDrawerOpen] = useState<boolean>(false);
  const [checkoutForm, setCheckoutForm] = useState({
    name: '',
    phone: '',
    deliveryType: 'delivery' as 'delivery' | 'pickup',
    // При доставке доступна только онлайн-оплата ЮKassa (требование салона).
    // Кэш-вариант появляется только при самовывозе.
    address: '',
    date: new Date().toISOString().split('T')[0],
    time: '12:00 - 14:00',
    cardMessage: '',
    district: 'leninsky',
    paymentMethod: 'yookassa' as 'cash' | 'yookassa'
  });
  const [orderProcessing, setOrderProcessing] = useState<boolean>(false);
  const [isTermsAccepted, setIsTermsAccepted] = useState<boolean>(true);
  const [orderResult, setOrderResult] = useState<{
    success: boolean;
    orderId: string;
    message: string;
    paymentMethod?: string;
    paymentStatus?: string;
    totalPrice?: number;
  } | null>(null);

  // NEW: Admin Panel & Order Tracking state
  const [isPinModalOpen, setIsPinModalOpen] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');

  const [isAdminOpen, setIsAdminOpen] = useState<boolean>(false);
  const [adminOrders, setAdminOrders] = useState<any[]>([]);
  const [adminSearch, setAdminSearch] = useState<string>('');
  const [adminDateFilterType, setAdminDateFilterType] = useState<'createdAt' | 'delivery'>('createdAt');
  const [adminYearFilter, setAdminYearFilter] = useState<string>('any');
  const [adminMonthFilter, setAdminMonthFilter] = useState<string>('any');
  const [adminDayFilter, setAdminDayFilter] = useState<string>(''); // YYYY-MM-DD
  const [adminLoading, setAdminLoading] = useState<boolean>(false);
  const [adminUpdatingId, setAdminUpdatingId] = useState<string | null>(null);
  const [customStatusNote, setCustomStatusNote] = useState<string>('');

  const [isTrackingOpen, setIsTrackingOpen] = useState<boolean>(false);
  const [trackingIdInput, setTrackingIdInput] = useState<string>('');
  const [trackedOrder, setTrackedOrder] = useState<any | null>(null);
  const [trackingLoading, setTrackingLoading] = useState<boolean>(false);
  const [trackingError, setTrackingError] = useState<string>('');

  // NEW: YooKassa simulation states
  const [yooKassaOrderId, setYooKassaOrderId] = useState<string | null>(null);
  const [yooKassaAmount, setYooKassaAmount] = useState<number>(0);
  const [isYooKassaPaying, setIsYooKassaPaying] = useState<boolean>(false);
  const [yooKassaSuccess, setYooKassaSuccess] = useState<boolean>(false);
  const [initiatePaying, setInitiatePaying] = useState<boolean>(false);
  const [yooKassaRealUrls, setYooKassaRealUrls] = useState<Record<string, string>>({});
  const [yooCardNumber, setYooCardNumber] = useState<string>('');
  const [yooCardExpiry, setYooCardExpiry] = useState<string>('');
  const [yooCardCvc, setYooCardCvc] = useState<string>('');

  // Persistent recent orders list
  const [myRecentOrders, setMyRecentOrders] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('my_recent_orders');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Catalog product management states
  const [adminTab, setAdminTab] = useState<'orders' | 'catalog'>('orders');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isProductFormOpen, setIsProductFormOpen] = useState<boolean>(false);
  const [productForm, setProductForm] = useState({
    id: '',
    name: '',
    description: '',
    price: 0,
    category: 'flowers',
    composition: '',
    tags: '',
    imageSrc: '',
    popular: false,
    imageClassName: 'object-cover'
  });
  const [productFormSaving, setProductFormSaving] = useState<boolean>(false);
  const [productFormError, setProductFormError] = useState<string>('');
  const [isDraggingImage, setIsDraggingImage] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [inAppAlertMessage, setInAppAlertMessage] = useState<string | null>(null);
  const [isMobileCategoryOpen, setIsMobileCategoryOpen] = useState<boolean>(false);

  const [imgOffsetY, setImgOffsetY] = useState<number>(50); // 0 to 100
  const [imgOffsetX, setImgOffsetX] = useState<number>(50); // 0 to 100
  const [imgZoom, setImgZoom] = useState<number>(100);       // 100 to 200

  const parseImagePosition = (className: string) => {
    let y = 50;
    let x = 50;
    let z = 100;

    if (className) {
      // Look for [object-position:X%_Y%]
      const posMatch = className.match(/\[object-position:\s*([\d.]+)%\s*_\s*([\d.]+)%\]/);
      if (posMatch) {
        x = Math.round(parseFloat(posMatch[1]));
        y = Math.round(parseFloat(posMatch[2]));
      } else {
        const yMatch = className.match(/\[object-position:\s*center\s*_\s*([\d.]+)%\]/);
        if (yMatch) {
          y = Math.round(parseFloat(yMatch[1]));
        }
      }

      // Look for [transform:scale(S)]
      const zoomMatch = className.match(/\[transform:\s*scale\(([\d.]+)\)\]/);
      if (zoomMatch) {
        z = Math.round(parseFloat(zoomMatch[1]) * 100);
      }
    }
    return { x, y, z };
  };

  // Sync controls to model imageClassName
  useEffect(() => {
    if (productForm.imageSrc) {
      const zoomVal = (imgZoom / 100).toFixed(2);
      const newClassName = `object-cover [object-position:${imgOffsetX}%_${imgOffsetY}%] [transform:scale(${zoomVal})]`;
      setProductForm(prev => {
        if (prev.imageClassName === newClassName) return prev;
        return {
          ...prev,
          imageClassName: newClassName
        };
      });
    }
  }, [imgOffsetY, imgOffsetX, imgZoom, productForm.imageSrc]);

  // Drag handlers for direct image panning in crop preview
  const [isDraggingOffset, setIsDraggingOffset] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const dragStartOffsets = useRef({ x: 50, y: 50 });

  const handleDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOffset(true);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    dragStartOffsets.current = { x: imgOffsetX, y: imgOffsetY };
  };

  const handleDragMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingOffset) return;
    e.preventDefault();
    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    const deltaX = e.clientX - dragStartPos.current.x;
    const deltaY = e.clientY - dragStartPos.current.y;

    // Direct panning: dragging left moves view right (+offset), dragging right moves view left (-offset)
    let newX = dragStartOffsets.current.x - (deltaX / rect.width) * 100;
    let newY = dragStartOffsets.current.y - (deltaY / rect.height) * 100;

    newX = Math.max(0, Math.min(100, newX));
    newY = Math.max(0, Math.min(100, newY));

    setImgOffsetX(Math.round(newX));
    setImgOffsetY(Math.round(newY));
  };

  const handleDragEnd = () => {
    setIsDraggingOffset(false);
  };

  const handleTouchStartOffset = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1) {
      setIsDraggingOffset(true);
      dragStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      dragStartOffsets.current = { x: imgOffsetX, y: imgOffsetY };
    }
  };

  const handleTouchMoveOffset = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDraggingOffset || e.touches.length !== 1) return;
    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    const deltaX = e.touches[0].clientX - dragStartPos.current.x;
    const deltaY = e.touches[0].clientY - dragStartPos.current.y;

    let newX = dragStartOffsets.current.x - (deltaX / rect.width) * 100;
    let newY = dragStartOffsets.current.y - (deltaY / rect.height) * 100;

    newX = Math.max(0, Math.min(100, newX));
    newY = Math.max(0, Math.min(100, newY));

    setImgOffsetX(Math.round(newX));
    setImgOffsetY(Math.round(newY));
  };

  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const MAX_SIZE = 1920;
        let w = img.width, h = img.height;
        if (w > MAX_SIZE || h > MAX_SIZE) {
          if (w > h) { h = Math.round(h * MAX_SIZE / w); w = MAX_SIZE; }
          else { w = Math.round(w * MAX_SIZE / h); h = MAX_SIZE; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(url);
          resolve(blob ? new File([blob], file.name, { type: 'image/jpeg' }) : file);
        }, 'image/jpeg', 0.85);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  };

  const handleImageFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setProductFormError('Допустимы только файлы изображений (PNG, JPG, JPEG, WEBP).');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setProductFormError('Файл слишком большой. Максимум 50 МБ.');
      return;
    }
    setProductFormError('Сжатие и загрузка фото...');
    try {
      const compressed = await compressImage(file);
      const url = await uploadProductImage(compressed);
      setProductForm(prev => ({ ...prev, imageSrc: url }));
      setProductFormError('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setProductFormError(`Ошибка загрузки фото: ${msg}`);
    }
  };

  const defaultCategories = [
    { id: 'flowers', label: 'Цветы поштучно' },
    { id: 'greens', label: 'Декоративная зелень' },
    { id: 'balloons', label: 'Гелиевые шары' },
    { id: 'author', label: 'Авторские букеты' },
    { id: 'roses', label: 'Пионовидные розы' },
    { id: 'spring', label: 'Весенняя коллекция' },
    { id: 'boxes', label: 'Шляпные коробки' }
  ];

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Не удалось загрузить товары из базы.', err);
      setProducts([]);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setCategories(data.map((c: any) => ({ id: c.id, label: c.label })));
        return;
      }
    } catch (err) {
      console.error('Не удалось загрузить категории из базы — показываю значения по умолчанию.', err);
    }
    setCategories(defaultCategories);
  };

  const fetchReviews = async () => {
    try {
      const res = await fetch('/api/reviews');
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      setReviews(Array.isArray(data) ? data.map((r: any) => ({
        id: String(r.id),
        author: r.author,
        rating: Number(r.rating),
        comment: r.comment,
        date: r.date,
      })) : []);
    } catch (err) {
      console.error('Не удалось загрузить отзывы из базы.', err);
      setReviews([]);
    }
  };

  // --- Dynamic Catalog Custom Reordering & Sorting Actions ---
  const [draggedProductId, setDraggedProductId] = useState<string | null>(null);
  const [draggedOverProductId, setDraggedOverProductId] = useState<string | null>(null);

  const handleProductDragStart = (e: React.DragEvent, id: string) => {
    setDraggedProductId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleProductDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (draggedProductId && draggedProductId !== id) {
      setDraggedOverProductId(id);
    }
  };

  const handleProductDragEnd = () => {
    setDraggedProductId(null);
    setDraggedOverProductId(null);
  };

  const handleProductDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedProductId || draggedProductId === targetId) return;

    const fromIndex = products.findIndex(p => p.id === draggedProductId);
    const toIndex = products.findIndex(p => p.id === targetId);

    if (fromIndex !== -1 && toIndex !== -1) {
      const updatedProducts = [...products];
      const [removed] = updatedProducts.splice(fromIndex, 1);
      updatedProducts.splice(toIndex, 0, removed);

      const productsWithNewOrder = updatedProducts.map((p, index) => ({
        ...p,
        order: index
      }));

      // Optimistic locally-reflected update
      setProducts(productsWithNewOrder);

      try {
        await adminFetch('/api/products/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orders: productsWithNewOrder.map((prod, idx) => ({ id: prod.id, order: idx }))
          })
        });
      } catch (err) {
        console.error('Failed to save manual drag drop catalog sorting to backend:', err);
      }
    }

    handleProductDragEnd();
  };

  const moveProductUp = async (productId: string) => {
    const fromIndex = products.findIndex(p => p.id === productId);
    if (fromIndex <= 0) return;

    const updatedProducts = [...products];
    const temp = updatedProducts[fromIndex];
    updatedProducts[fromIndex] = updatedProducts[fromIndex - 1];
    updatedProducts[fromIndex - 1] = temp;

    const productsWithNewOrder = updatedProducts.map((p, index) => ({
      ...p,
      order: index
    }));

    setProducts(productsWithNewOrder);

    try {
      await adminFetch('/api/products/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orders: productsWithNewOrder.map((prod, idx) => ({ id: prod.id, order: idx }))
        })
      });
    } catch (err) {
      console.error('Failed to move product up on backend:', err);
    }
  };

  const moveProductDown = async (productId: string) => {
    const fromIndex = products.findIndex(p => p.id === productId);
    if (fromIndex === -1 || fromIndex >= products.length - 1) return;

    const updatedProducts = [...products];
    const temp = updatedProducts[fromIndex];
    updatedProducts[fromIndex] = updatedProducts[fromIndex + 1];
    updatedProducts[fromIndex + 1] = temp;

    const productsWithNewOrder = updatedProducts.map((p, index) => ({
      ...p,
      order: index
    }));

    setProducts(productsWithNewOrder);

    try {
      await adminFetch('/api/products/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orders: productsWithNewOrder.map((prod, idx) => ({ id: prod.id, order: idx }))
        })
      });
    } catch (err) {
      console.error('Failed to move product down on backend:', err);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchReviews();
  }, []);

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name.trim() || productForm.price <= 0) {
      setProductFormError('Пожалуйста, укажите верное название и корректную стоимость букета.');
      return;
    }
    setProductFormSaving(true);
    setProductFormError('');

    try {
      const isEdit = !!productForm.id;
      const url = isEdit ? `/api/products/${productForm.id}` : '/api/products';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await adminFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...productForm,
          price: Number(productForm.price),
          composition: productForm.composition ? productForm.composition.split(',').map(s => s.trim()).filter(Boolean) : [],
          tags: productForm.tags ? productForm.tags.split(',').map(s => s.trim()).filter(Boolean) : [],
        })
      });

      if (res.ok) {
        await fetchProducts();
        setIsProductFormOpen(false);
        setEditingProduct(null);
      } else {
        const errData = await res.json();
        setProductFormError(errData.error || 'Произошла непредвиденная ошибка на сервере.');
      }
    } catch (err) {
      setProductFormError('Проблемы с подключением к серверу.');
    } finally {
      setProductFormSaving(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryId.trim() || !newCategoryLabel.trim()) {
      setCategoryFormError('Пожалуйста, заполните оба поля: ID категории и Название.');
      return;
    }

    setCategoryFormError('');
    setIsCategorySaving(true);

    try {
      const res = await adminFetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newCategoryId.trim(),
          label: newCategoryLabel.trim()
        })
      });

      if (res.ok) {
        await fetchCategories();
        setNewCategoryId('');
        setNewCategoryLabel('');
      } else {
        const errData = await res.json();
        setCategoryFormError(errData.error || 'Ошибка при сохранении категории на сервере.');
      }
    } catch (err) {
      console.error('Failed to create category on backend:', err);
      setCategoryFormError('Не удалось соединиться с сервером.');
    } finally {
      setIsCategorySaving(false);
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    try {
      const res = await adminFetch(`/api/categories/${catId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        await fetchCategories();
        if (selectedCategory === catId) {
          setSelectedCategory('all');
        }
        setInAppAlertMessage('Категория успешно удалена');
      } else {
        setInAppAlertMessage('Не удалось удалить категорию');
      }
    } catch (err) {
      console.error('Failed to delete category:', err);
      setInAppAlertMessage('Ошибка при соединении с сервером');
    }
  };

  const toggleFavorite = (productId: string) => {
    setFavorites(prev => {
      const isFav = prev.includes(productId);
      if (isFav) {
        return prev.filter(id => id !== productId);
      } else {
        return [...prev, productId];
      }
    });
  };

  const handleDeleteProduct = (productId: string) => {
    const prod = products.find(p => p.id === productId);
    if (prod) {
      setProductToDelete(prod);
    }
  };

  const openAddProductForm = () => {
    setProductForm({
      id: '',
      name: '',
      description: '',
      price: 0,
      category: 'flowers',
      composition: '',
      tags: '',
      imageSrc: '',
      popular: false,
      imageClassName: 'object-cover'
    });
    setImgOffsetX(50);
    setImgOffsetY(50);
    setImgZoom(100);
    setEditingProduct(null);
    setProductFormError('');
    setIsProductFormOpen(true);
  };

  const openEditProductForm = (prod: Product) => {
    const parsed = parseImagePosition(prod.imageClassName || 'object-cover');
    setProductForm({
      id: prod.id,
      name: prod.name,
      description: prod.description || '',
      price: prod.price,
      category: prod.category || 'flowers',
      composition: (prod.composition || []).join(', '),
      tags: (prod.tags || []).join(', '),
      imageSrc: prod.imageSrc || '',
      popular: !!prod.popular,
      imageClassName: prod.imageClassName || 'object-cover'
    });
    setImgOffsetX(parsed.x);
    setImgOffsetY(parsed.y);
    setImgZoom(parsed.z);
    setEditingProduct(prod);
    setProductFormError('');
    setIsProductFormOpen(true);
  };

  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playNewOrderDing = () => {
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;
      // Двухтональный «динь-дон»
      ([[880, 0], [1320, 0.16]] as [number, number][]).forEach(([freq, offset]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.35, now + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.45);
      });
    } catch {}
  };

  const fetchAdminOrders = async (silent = false) => {
    if (!silent) setAdminLoading(true);
    try {
      const res = await adminFetch('/api/orders');
      if (res.ok) {
        const data = await res.json();
        const incomingIds: string[] = (data || []).map((o: any) => o.orderId).filter(Boolean);
        // Если появился заказ, которого не было — играем «дзынь» (но не на самой первой загрузке)
        if (knownOrderIdsRef.current.size > 0 && incomingIds.some(id => !knownOrderIdsRef.current.has(id))) {
          playNewOrderDing();
        }
        knownOrderIdsRef.current = new Set(incomingIds);
        setAdminOrders(data);
      }
    } catch (err) {
      console.error('Failed to fetch admin orders', err);
    } finally {
      if (!silent) setAdminLoading(false);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isAdminOpen) {
      // Разблокируем звук в рамках пользовательского жеста (открытие админки)
      try {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        if (Ctx) {
          if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
          if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
        }
      } catch {}
      fetchAdminOrders(false);
      interval = setInterval(() => {
        fetchAdminOrders(true);
      }, 7000); // Poll every 7 seconds for florist screen real-time order lists
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isAdminOpen]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isTrackingOpen && trackedOrder?.orderId) {
      interval = setInterval(async () => {
        try {
          if (trackedOrder.paymentMethod === 'yookassa' && trackedOrder.paymentStatus !== 'paid') {
            const checkRes = await fetch(`/api/yookassa/check-payment/${trackedOrder.orderId}`);
            if (checkRes.ok) {
              const checkData = await checkRes.json();
              if (checkData.order) {
                setTrackedOrder(checkData.order);
                return;
              }
            }
          }

          const res = await fetch(`/api/order/${trackedOrder.orderId}`);
          if (res.ok) {
            const data = await res.json();
            setTrackedOrder(data);
          }
        } catch (err) {
          console.error('Real-time tracking synchronization failed', err);
        }
      }, 5000); // Poll every 5 seconds when customer tracking modal is open
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTrackingOpen, trackedOrder?.orderId, trackedOrder?.paymentMethod, trackedOrder?.paymentStatus]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isCheckoutDrawerOpen && orderResult?.orderId && orderResult?.paymentMethod === 'yookassa') {
      interval = setInterval(async () => {
        try {
          const checkRes = await fetch(`/api/yookassa/check-payment/${orderResult.orderId}`);
          if (checkRes.ok) {
            const checkData = await checkRes.json();
            const actualPaid = checkData.success && checkData.status === 'succeeded';
            if (actualPaid !== yooKassaSuccess) {
              setYooKassaSuccess(actualPaid);
              setOrderResult(prev => prev ? {
                ...prev,
                message: actualPaid 
                  ? 'Заказ успешно оплачен онлайн через ЮKassa! Наши флористы уже приступают к сборке 🌸'
                  : 'Спасибо! Заказ успешно сформирован и ожидает онлайн-оплаты. Пожалуйста, внесите оплату для передачи заказа флористам.'
              } : null);
              
              // Also sync tracking modal if open
              if (trackedOrder && trackedOrder.orderId === orderResult.orderId) {
                setTrackedOrder(checkData.order);
              }
              
              // Sync admin views dynamically
              try {
                await fetchAdminOrders();
              } catch {}
            }
          }
        } catch (err) {
          console.error('Checkout drawer payment polling failed:', err);
        }
      }, 3000); // Poll every 3 seconds for extremely fast responsive confirmation updates
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isCheckoutDrawerOpen, orderResult?.orderId, orderResult?.paymentMethod, yooKassaSuccess, trackedOrder]);

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    setAdminUpdatingId(orderId);
    try {
      const res = await adminFetch(`/api/orders/${orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, note: customStatusNote || undefined })
      });
      if (res.ok) {
        await fetchAdminOrders();
        setCustomStatusNote('');
        
        // If currently tracking this order in tracking modal, reload it
        if (trackedOrder && trackedOrder.orderId === orderId) {
          await handleTrackOrderById(orderId);
        }
      } else {
        const err = await res.json();
        alert(err.error || 'Ошибка смены статуса.');
      }
    } catch (err) {
      console.error(err);
      alert('Ошибка соединения с сервером.');
    } finally {
      setAdminUpdatingId(null);
    }
  };

  const handleUpdateOrderPaymentStatus = async (orderId: string, paymentStatus: string) => {
    setAdminUpdatingId(orderId);
    try {
      const res = await adminFetch(`/api/orders/${orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentStatus })
      });
      if (res.ok) {
        await fetchAdminOrders();
        
        // If currently tracking this order in tracking modal, reload it
        if (trackedOrder && trackedOrder.orderId === orderId) {
          await handleTrackOrderById(orderId);
        }
      } else {
        const err = await res.json();
        alert(err.error || 'Ошибка изменения статуса оплаты.');
      }
    } catch (err) {
      console.error(err);
      alert('Ошибка соединения с сервером.');
    } finally {
      setAdminUpdatingId(null);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!window.confirm(`Удалить заказ ${orderId}? Это действие необратимо.`)) return;
    setAdminUpdatingId(orderId);
    try {
      const res = await adminFetch(`/api/orders/${orderId}`, { method: 'DELETE' });
      if (res.ok) {
        knownOrderIdsRef.current.delete(orderId);
        await fetchAdminOrders();
        if (trackedOrder && trackedOrder.orderId === orderId) {
          setIsTrackingOpen(false);
          setTrackedOrder(null);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Ошибка удаления заказа.');
      }
    } catch (err) {
      console.error(err);
      alert('Ошибка соединения с сервером.');
    } finally {
      setAdminUpdatingId(null);
    }
  };

  const handleStartPayment = async (orderId: string, amount: number) => {
    setInitiatePaying(true);
    try {
      const res = await fetch('/api/yookassa/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.confirmationUrl) {
          // Store the real payment URL for manual action / backup button
          setYooKassaRealUrls(prev => ({
            ...prev,
            [orderId]: data.confirmationUrl
          }));
          // Open in a new window/tab to completely bypass iframe security restrictions
          window.open(data.confirmationUrl, '_blank');
        } else {
          alert('Ошибка платежного сервиса: ссылка на оплату от ЮKassa не получена.');
        }
      } else {
        const err = await res.json();
        alert(err.error || 'Возникла ошибка при создании сессии в ЮKassa. Повторите попытку.');
      }
    } catch (err) {
      console.error('YooKassa payment init error:', err);
      alert('Ошибка соединения с сервером платежей ЮKassa.');
    } finally {
      setInitiatePaying(false);
    }
  };

  const handleConfirmYooKassaPayment = async (orderId: string) => {
    setIsYooKassaPaying(true);
    try {
      const res = await adminFetch(`/api/orders/${orderId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        const result = await res.json();
        setYooKassaSuccess(true);
        
        // Refresh admin views if admin data is already fetched
        try {
          await fetchAdminOrders();
        } catch {
          // ignore
        }
        
        // Refresh matching tracked order
        if (trackedOrder && trackedOrder.orderId === orderId) {
          setTrackedOrder(result.order);
        }
        
        // Update orderResult in sidebar too
        if (orderResult && orderResult.orderId === orderId) {
          setOrderResult({
            ...orderResult,
            message: 'Заказ успешно оплачен онлайн через ЮKassa! Наши флористы уже приступают к сборке 🌸'
          });
        }
      } else {
        const err = await res.json();
        alert(err.error || 'Ошибка при подтверждении оплаты.');
      }
    } catch (err) {
      console.error('YooKassa API simulation error:', err);
      alert('Ошибка сети при проведении онлайн-оплаты.');
    } finally {
      setIsYooKassaPaying(false);
    }
  };

  const handleTrackOrderById = async (orderId: string) => {
    if (!orderId.trim()) return;
    setTrackingLoading(true);
    setTrackingError('');
    try {
      const res = await fetch(`/api/order/${orderId.trim()}`);
      if (res.ok) {
        const data = await res.json();
        setTrackedOrder(data);
        setIsTrackingOpen(true);
      } else {
        const err = await res.json();
        setTrackingError(err.error || 'Заказ не найден.');
        setTrackedOrder(null);
        setIsTrackingOpen(true);
      }
    } catch (err) {
      console.error(err);
      setTrackingError('Ошибка связи с сервером отслеживания.');
      setTrackedOrder(null);
      setIsTrackingOpen(true);
    } finally {
      setTrackingLoading(false);
    }
  };

  // Promo Code State
  const [promoCode, setPromoCode] = useState<string>('');
  const [promoDiscount, setPromoDiscount] = useState<number>(0); // 0% to 100%
  const [promoApplied, setPromoApplied] = useState<boolean>(false);
  const [promoError, setPromoError] = useState<string>('');

  // Handle promo code application
  const applyPromo = () => {
    setPromoError('');
    if (promoCode.trim().toUpperCase() === 'ELIZAVETA10') {
      setPromoDiscount(10);
      setPromoApplied(true);
    } else if (promoCode.trim() !== '') {
      setPromoError('Неверный промокод. Попробуйте ELIZAVETA10');
    }
  };

  // Add Item with setup configuration parameters
  const triggerCartSetup = (product: Product) => {
    setSelectedProductForCartSetup(product);
    setPendingCardMessage('');
    setPendingComment('');
  };

  const confirmAddToCart = () => {
    if (!selectedProductForCartSetup) return;
    
    // Check if item is already in cart
    const existingIndex = cart.findIndex(item => item.product.id === selectedProductForCartSetup.id);
    if (existingIndex > -1) {
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      // Overwrite/append message and comments if entered
      if (pendingCardMessage) updated[existingIndex].cardMessage = pendingCardMessage;
      if (pendingComment) updated[existingIndex].comment = pendingComment;
      setCart(updated);
    } else {
      setCart([...cart, {
        product: selectedProductForCartSetup,
        quantity: 1,
        cardMessage: pendingCardMessage || undefined,
        comment: pendingComment || undefined
      }]);
    }

    // Reset setup wizard
    setSelectedProductForCartSetup(null);
    setPendingCardMessage('');
    setPendingComment('');
    setIsCartOpen(true); // Open the cart view right away for pleasant feedback
  };

  // Quick Direct Add to Cart without setup configuration (e.g. from recommended bots list)
  const addDirectToCart = (product: Product) => {
    const existingIndex = cart.findIndex(item => item.product.id === product.id);
    if (existingIndex > -1) {
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      setCart(updated);
    } else {
      setCart([...cart, {
        product,
        quantity: 1
      }]);
    }
    setIsCartOpen(true);
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, delta: number) => {
    const updated = cart.map(item => {
      if (item.product.id === productId) {
        const nextQty = item.quantity + delta;
        return { ...item, quantity: nextQty < 1 ? 1 : nextQty };
      }
      return item;
    });
    setCart(updated);
  };

  // District pricing for Chelyabinsk
  const DISTRICT_PRICES: Record<string, { name: string; price: number }> = {
    leninsky: { name: 'Ленинский район', price: 350 },
    central: { name: 'Центральный район', price: 490 },
    kurchatov: { name: 'Курчатовский район', price: 490 },
    kalinin: { name: 'Калининский район', price: 490 },
    soviet: { name: 'Советский район', price: 490 },
    traktor: { name: 'Тракторозаводский район', price: 490 },
    metal: { name: 'Металлургический район', price: 490 },
    remote: { name: 'В отдаленные районы (от 650 ₽)', price: 650 },
  };

  // Calculate prices
  const itemsSubtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  const discountAmount = Math.round(itemsSubtotal * (promoDiscount / 100));
  
  const selectedDistrictPrice = DISTRICT_PRICES[checkoutForm.district]?.price || 350;
  const deliveryStatus = itemsSubtotal === 0 ? 0 : selectedDistrictPrice;
  const totalPrice = Math.max(0, itemsSubtotal - discountAmount + (checkoutForm.deliveryType === 'delivery' ? deliveryStatus : 0));

  // Submit modern review
  const handleAddReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReview.author.trim() || !newReview.comment.trim()) {
      alert('Пожалуйста, заполните ваши имя и комментарий.');
      return;
    }

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author: newReview.author,
          rating: Number(newReview.rating),
          comment: newReview.comment
        })
      });

      if (res.ok) {
        await fetchReviews();
        setNewReview({ author: '', rating: 5, comment: '' });
        setReviewSuccessMessage('Спасибо! Ваш отзыв опубликован и согревает наши сердца🤍');
        setTimeout(() => setReviewSuccessMessage(''), 5000);
      } else {
        const err = await res.json();
        alert(err.error || 'Не удалось сохронить отзыв.');
      }
    } catch (err) {
      console.error('Failed to submit review via API:', err);
      alert('Произошла ошибка при отправке отзыва. Пожалуйста, попробуйте позже.');
    }
  };

  // Handle Checkout Order process
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutForm.name.trim() || !checkoutForm.phone.trim()) {
      alert('Пожалуйста, заполните Имя и Номер телефона.');
      return;
    }

    setOrderProcessing(true);
    setYooKassaSuccess(false);
    try {
      const orderDataPayload = {
        items: cart.map(item => ({
          productId: item.product.id,
          name: item.product.name,
          quantity: item.quantity,
          price: item.product.price
        })),
        customerName: checkoutForm.name,
        customerPhone: checkoutForm.phone,
        deliveryType: checkoutForm.deliveryType,
        address: checkoutForm.deliveryType === 'delivery' 
          ? `[${DISTRICT_PRICES[checkoutForm.district]?.name || 'Ленинский район'}] ${checkoutForm.address}` 
          : 'Самовывоз: ул. Масленникова, д. 6/1 (Салон)',
        date: checkoutForm.date,
        time: checkoutForm.time,
        cardMessage: checkoutForm.cardMessage || cardMessageInput || undefined,
        totalPrice: totalPrice,
        paymentMethod: checkoutForm.paymentMethod
      };

      const res = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderDataPayload)
      });

      const result = await res.json();
      if (result.success) {
        setOrderResult({ ...result, paymentMethod: checkoutForm.paymentMethod, totalPrice });
        setCart([]); // Clear cart upon successful layout order!
        
        // Save to my recent orders list in state & localStorage
        if (result.orderId) {
          const updatedRecent = [result.orderId, ...myRecentOrders.filter(id => id !== result.orderId)].slice(0, 8);
          setMyRecentOrders(updatedRecent);
          try {
            localStorage.setItem('my_recent_orders', JSON.stringify(updatedRecent));
          } catch (e) {
            console.error('Failed to save to localStorage:', e);
          }
          setTrackingIdInput(result.orderId);
        }
      } else {
        alert(result.error || 'Произошла непредвиденная ошибка на сервере.');
      }
    } catch (err) {
      console.error(err);
      alert('Не удалось связаться с сервером доставки. Пожалуйста, попробуйте снова!');
    } finally {
      setOrderProcessing(false);
    }
  };

  // Filter products by states
  const filteredProducts = products.filter(product => {
    let matchesCategory = false;
    if (selectedCategory === 'all') {
      matchesCategory = true;
    } else if (selectedCategory === 'favorites') {
      matchesCategory = favorites.includes(product.id);
    } else {
      matchesCategory = product.category === selectedCategory;
    }
    const matchesPrice = product.price <= maxPrice;
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          product.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          product.composition.some(c => c.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          product.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesPrice && matchesSearch;
  });

  const getCategoryLabel = (category: string) => {
    const found = categories.find(c => c.id === category);
    if (found) return found.label;
    switch (category) {
      case 'author': return 'Авторская флористика';
      case 'roses': return 'Пионовидные Розы';
      case 'spring': return 'Весенняя коллекция';
      case 'boxes': return 'Шляпные коробки';
      case 'flowers': return 'Цветы поштучно';
      case 'greens': return 'Декоративная зелень';
      case 'balloons': return 'Гелиевые шары';
      default: return 'Цветочный шедевр';
    }
  };

  const processStepsContent = [
    {
      title: '1. Селекционный отбор стеблей',
      description: 'Каждое утро наши флористы лично сортируют новые партии цветов. Мы принимаем поставки только первого класса свежести из Эквадора, Голландии и лучших уральских оранжерей. Стебли проходят строгий фито-контроль.',
      details: 'Все цветы сразу бережно распределяются и охлаждаются в специальной камере с идеальным климатом.'
    },
    {
      title: '2. Деликатная зачистка и гидратация',
      description: 'Мастера деликатно удаляют нижние шипы и листья, не повреждая тонкий ствол. Розы срезаются под углом 45 градусов исключительно под струей свежей холодной воды для предотвращения попадания воздушных пробок в капилляры.',
      details: 'Такая бережная очистка позволяет бутонам гармонично раскрываться в вазах у вас дома, обеспечивая стойкость до 2 недель.'
    },
    {
      title: '3. Экспертная спиральная сборка',
      description: 'Каждый букет собирается в проверенной корейской или французской объемной технике по спирали. Ни один цветок не пережимается слишком сильно, позволяя каждому бутону занять свое уникальное место в композиции.',
      details: 'Конечный вид подчеркивается мягкой матовой упаковочной дизайнерской бумагой, шелковой или атласной лентой.'
    },
    {
      title: '4. Заботливая курьерская доставка по Челябинску',
      description: 'Мы перевозим букеты с максимальной аккуратностью. Курьеры используют специальные защитные сумки и деликатные держатели, чтобы уберечь цветы от ветра, сквозняков и перепадов температуры.',
      details: 'Привезем букет свежим и сочным, как только что из холодильной камеры.'
    }
  ];

  return (
    <div className="min-h-screen flex flex-col font-sans transition-colors duration-300">
      
      {/* ─── HEADER ─── */}
      <header className="sticky top-0 z-40 bg-[#f5f5f0]/95 backdrop-blur-md border-b border-[#e1e1d5] px-4 md:px-12 py-3 flex justify-between items-center transition-all">
        <div className="flex flex-col cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <span className="serif text-2xl md:text-3xl font-semibold tracking-tight text-[#2d2d2d] flex items-center gap-2">
            Елизавета <span className="inline-block w-1.5 h-1.5 rounded-full olive-bg"></span>
          </span>
          <p className="text-[9px] uppercase tracking-[0.25em] text-[#8a8a7a] font-medium mt-0.5">
            Цветочный салон • Челябинск
          </p>
        </div>

        {/* Navigation - Tablet and Desktop */}
        <nav className="hidden md:flex gap-4 lg:gap-8 text-xs font-medium uppercase tracking-[0.15em] text-[#5A5A40]">
          <a href="#catalog" className="hover:opacity-100 transition-opacity pb-1 border-b border-transparent hover:border-[#5A5A40]">Каталог</a>
          <a href="#care" className="hover:opacity-100 transition-opacity pb-1 border-b border-transparent hover:border-[#5A5A40]">Секреты Ухода</a>
          <a href="#delivery-info" className="hover:opacity-100 transition-opacity pb-1 border-b border-transparent hover:border-[#5A5A40]">Доставка</a>
          <a href="#reviews" className="hover:opacity-100 transition-opacity pb-1 border-b border-transparent hover:border-[#5A5A40]">Отзывы</a>
        </nav>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* Tracking button */}
          <button
            onClick={() => {
              const latestOrder = myRecentOrders[0] || '';
              setTrackingIdInput(latestOrder);
              setTrackingError('');
              if (latestOrder) {
                handleTrackOrderById(latestOrder);
              } else {
                setTrackedOrder(null);
                setIsTrackingOpen(true);
              }
            }}
            className="flex items-center gap-1.5 text-stone-600 hover:text-[#5A5A40] text-[11px] px-2.5 py-1.5 md:px-3 md:py-2 rounded-full border border-stone-300/80 hover:bg-white transition-all font-medium cursor-pointer shrink-0"
          >
            <Clock className="w-3.5 h-3.5 text-[#5A5A40]" />
            <span className="hidden xs:inline">Статус заказа</span>
            <span className="xs:hidden">Статус</span>
          </button>

          {/* Phone call reference (Chelyabinsk localized) */}
          <a href="tel:+79512450565" className="hidden lg:flex items-center gap-1.5 text-stone-600 text-xs px-3 py-2 rounded-full hover:bg-stone-200/50 transition-colors">
            <Phone className="w-3.5 h-3.5 text-[#5A5A40]" />
            <span className="font-semibold text-stone-700 tracking-wider">+7 (951) 245-05-65</span>
          </a>

          {/* Favorites Header Button */}
          <button
            onClick={() => {
              setSelectedCategory('favorites');
              const el = document.getElementById('catalog');
              if (el) {
                el.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            className="flex items-center gap-1.5 text-stone-600 hover:text-[#5A5A40] text-[11px] px-2.5 py-1.5 md:px-3 md:py-2 rounded-full border border-stone-300/80 hover:bg-white transition-all font-medium cursor-pointer shrink-0"
            title="Перейти к избранным товарам"
          >
            <Heart className={`w-3.5 h-3.5 ${favorites.length > 0 ? 'fill-red-500 text-red-500' : 'text-[#5A5A40]'}`} />
            <span className="hidden xs:inline">Избранное</span>
            {favorites.length > 0 && (
              <span className="bg-[#5A5A40] text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold ml-0.5">
                {favorites.length}
              </span>
            )}
          </button>

          {/* Cart Icon Button */}
          <button 
            id="open-cart-button"
            onClick={() => setIsCartOpen(true)}
            className="relative bg-white hover:bg-stone-50 p-3 rounded-full border border-stone-200 flex items-center justify-center transition-all duration-150 hover:scale-110 active:scale-95 shadow-xs cursor-pointer"
            aria-label="Открыть корзину"
          >
            <ShoppingBag className="w-4 h-4 text-[#5A5A40]" />
            {cart.length > 0 && (
              <span 
                key={cart.reduce((sum, i) => sum + i.quantity, 0)}
                className="absolute -top-1 -right-1 olive-bg text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold border-2 border-[#f5f5f0] animated-pop"
              >
                {cart.reduce((sum, i) => sum + i.quantity, 0)}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ─── HERO SPLIT GRID ─── */}
      <main className="flex-grow">
        <section className="px-6 md:px-12 py-12 md:py-16 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
          
          {/* Hero Left Content */}
          <div className="lg:col-span-5 flex flex-col justify-center" id="hero-intro-text">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[#5A5A40] text-sm italic serif tracking-wide">Свежесть в каждом лепестке</span>
              <span className="h-px w-10 bg-[#5A5A40]/30"></span>
            </div>
            
            <h2 className="serif text-5xl md:text-6xl lg:text-7xl leading-[1.1] text-[#2d2d2d] mb-6">
              Цветы, которые<br />
              <span className="italic font-normal">расскажут</span> больше
            </h2>
            
            <p className="text-stone-600 text-sm leading-relaxed mb-8 max-w-md">
              С любовью создаем утонченные авторские композиции для ваших самых трепетных моментов в самом сердце Челябинска. Экспресс-доставка за 60-90 минут.
            </p>

            <div className="flex flex-wrap gap-4 items-center w-full max-w-md">
              <a 
                href="#catalog" 
                className="olive-bg text-white px-12 py-4 rounded-full text-xs uppercase tracking-widest hover:opacity-95 transition-all text-center font-medium shadow-md shadow-[#5a5a40]/10 w-full sm:w-auto sm:px-16"
              >
                Смотреть Каталог
              </a>
            </div>


          </div>

          {/* Hero Right Brand Story Panel */}
          <div className="lg:col-span-7 h-full">
            <div className="h-full bg-[#ecece2] rounded-[40px] p-8 md:p-12 flex flex-col justify-between card-shadow transition-all duration-300 hover:bg-[#eaeae0] group relative overflow-hidden min-h-[420px] md:min-h-[500px]">
              {/* Background elegant watermark and decor elements */}

              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                  <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#5A5A40] flex items-center gap-1.5 bg-[#5A5A40]/10 px-3.5 py-1.5 rounded-full w-fit whitespace-nowrap">
                    <Sparkles className="w-3.5 h-3.5 shrink-0" /> О салоне
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-stone-500 font-sans font-semibold sm:text-right">
                    Цветочный салон • Челябинск
                  </span>
                </div>

                <h3 className="serif text-3xl md:text-4xl text-stone-800 font-medium leading-tight mb-5">
                  Искусство чувствовать <span className="italic block text-[#5A5A40] mt-1">прекрасное в деталях</span>
                </h3>
                
                <div className="space-y-4 text-stone-700 text-xs md:text-sm leading-relaxed max-w-lg">
                  <p className="font-serif italic text-stone-600 border-l-2 border-[#5A5A40] pl-3">
                    «Мы создаем авторские букеты и композиции, которые передают искреннюю заботу и теплые эмоции прямо в руки ваших близких.»
                  </p>
                  <p className="font-sans">
                    Каждый день мы искренне стараемся радовать вас и ваших близких, собирая прекрасные букеты из свежих цветов. Мы бережно поставляем селекционные сорта самых роскошных роз, гортензий и диантусов напрямую с лучших плантаций мира. У нас вы всегда найдете идеальные букеты, изящные композиции и праздничный декор.
                  </p>
                  <p className="font-sans text-stone-600 hidden md:block">
                    Каждый букет бережно упаковывается и доставляется со специальной заботой о свежести, чтобы гарантировать безупречную стойкость композиции у вас дома.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── FLOWER CATALOG SECTION (Букеты) ─── */}
        <section id="catalog" className="max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-24">
          
          {/* Section Headers */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
            <div>
              <span className="text-[#5A5A40] text-xs font-semibold uppercase tracking-[0.25em] block mb-2">Наш обновленный ассортимент</span>
              <h2 className="serif text-4xl md:text-5xl text-[#2d2d2d] font-semibold">
                Свежие цветы и подарки в <span className="italic text-[#5A5A40]">Челябинске</span>
              </h2>
            </div>
            
            {/* Real Search Bar input */}
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-stone-400 absolute left-4 top-3.5" />
              <input 
                type="text"
                placeholder="Поиск цветка, зелени..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white text-stone-800 pl-11 pr-4 py-2.5 rounded-full text-xs font-medium border border-stone-300/80 focus:outline-none focus:border-[#5A5A40] transition-colors"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 p-1 rounded-full text-stone-400 hover:text-stone-700"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Filtering Widgets Container */}
          <div className="bg-[#ecece2] p-6 rounded-[28px] mb-10 card-shadow">
            <div className="flex flex-col gap-6">
              
              {/* Categories Navigation Row */}
              <div>
                {/* Mobile Selector */}
                <div className="relative block md:hidden">
                  <span className="text-[10px] text-stone-500 uppercase tracking-widest font-semibold block mb-2">Выберите категорию:</span>
                  <button 
                    type="button"
                    onClick={() => setIsMobileCategoryOpen(!isMobileCategoryOpen)}
                    className="w-full flex justify-between items-center bg-white border border-stone-200 text-stone-700 rounded-2xl px-5 py-3.5 hover:bg-stone-50 transition-colors active:scale-98 cursor-pointer shadow-sm"
                  >
                    <span className="text-xs font-bold uppercase tracking-wider text-[#5A5A40]">
                      {[
                        { id: 'all', label: 'Все товары' },
                        { id: 'favorites', label: `❤️ Избранное (${favorites.length})` },
                        ...categories
                      ].find(c => c.id === selectedCategory)?.label || 'Все товары'}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-stone-400 transition-transform duration-200 ${isMobileCategoryOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {isMobileCategoryOpen && (
                    <>
                      {/* Invisible backdrop to dismiss dropdown */}
                      <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsMobileCategoryOpen(false)} />
                      <div className="absolute left-0 right-0 mt-2 bg-[#fdfdfb] rounded-2xl border border-stone-200 shadow-xl z-50 overflow-hidden py-1 max-h-72 overflow-y-auto">
                        {[
                          { id: 'all', label: 'Все товары' },
                          { id: 'favorites', label: `❤️ Избранное (${favorites.length})` },
                          ...categories
                        ].map((categoryItem) => {
                          const isSelected = selectedCategory === categoryItem.id;
                          return (
                            <button
                              key={categoryItem.id}
                              type="button"
                              onClick={() => {
                                setSelectedCategory(categoryItem.id);
                                setIsMobileCategoryOpen(false);
                              }}
                              className={`w-full text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider border-b border-stone-100 last:border-b-0 transition-all flex items-center justify-between ${
                                isSelected 
                                  ? 'bg-[#5A5A40] text-white font-bold' 
                                  : 'text-stone-700 hover:bg-stone-50 hover:text-black'
                              }`}
                            >
                              <span>{categoryItem.label}</span>
                              {isSelected && <Check className="w-4 h-4" />}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                {/* Desktop Pills */}
                <div className="hidden md:block">
                  <span className="text-[10px] text-stone-500 uppercase tracking-widest font-semibold block mb-3">Выберите категорию:</span>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: 'all', label: 'Все товары' },
                      { id: 'favorites', label: `❤️ Избранное (${favorites.length})` },
                      ...categories
                    ].map((categoryItem) => (
                      <button 
                        key={categoryItem.id}
                        type="button"
                        onClick={() => setSelectedCategory(categoryItem.id)}
                        className={`px-5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all duration-300 whitespace-nowrap shrink-0 ${
                          selectedCategory === categoryItem.id 
                            ? 'bg-[#5A5A40] text-white shadow-xs font-bold' 
                            : 'bg-white text-stone-700 hover:bg-stone-50 hover:text-black border border-stone-200'
                        }`}
                      >
                        {categoryItem.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Price Filter Slider Row */}
              <div className="flex items-center gap-6 justify-between flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[10px] text-stone-500 uppercase tracking-widest font-semibold">Максимальный бюджет:</span>
                    <span className="text-xs font-bold text-stone-700">{maxPrice} ₽</span>
                  </div>
                  <input 
                    type="range" 
                    min="50" 
                    max="10000" 
                    step="50"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(Number(e.target.value))}
                    className="w-full accent-[#5A5A40]"
                  />
                  <div className="flex justify-between text-[10px] text-stone-400 font-medium font-sans mt-1">
                    <span>от 50 ₽</span>
                    <span>до 10 000 ₽</span>
                  </div>
                </div>

              </div>

            </div>
          </div>

          {/* Catalog Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6" id="products-grid-view">
            {filteredProducts.map((p) => (
              <div 
                key={p.id} 
                className="bg-white rounded-[32px] overflow-hidden card-shadow card-shadow-hover transition-all duration-300 group flex flex-col justify-between"
              >
                {/* Product Header / Visual Thumbnail */}
                <div className="relative aspect-[4/5] overflow-hidden bg-stone-100 cursor-pointer" onClick={() => setSelectedDetailProduct(p)}>
                  <img 
                    src={p.imageSrc} 
                    alt={p.name} 
                    style={parseImageClassNameToStyle(p.imageClassName)}
                    className="w-full h-full object-cover transition-transform duration-500 hover:scale-[1.03]" 
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-colors"></div>

                  {/* Favorite button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(p.id);
                    }}
                    className="absolute top-4 right-4 z-10 bg-[#f5f5f0]/80 hover:bg-white text-stone-700 p-2 rounded-full shadow-md backdrop-blur-sm transition-all duration-200 hover:scale-110 active:scale-90 focus:outline-none flex items-center justify-center cursor-pointer"
                    title={favorites.includes(p.id) ? "Удалить из избранного" : "Добавить в избранное"}
                  >
                    <Heart className={`w-4 h-4 transition-colors ${favorites.includes(p.id) ? 'fill-red-500 text-red-500' : 'text-stone-600'}`} />
                  </button>
                  
                  {/* Hot popularity badge */}
                  {p.popular && (
                    <div className="absolute top-4 left-4 olive-bg text-white text-[9px] uppercase tracking-wider font-semibold py-1 px-3 rounded-full">
                      Хит
                    </div>
                  )}
                </div>

                {/* Product Content Body */}
                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-rose-800 block mb-1">
                      {getCategoryLabel(p.category)}
                    </span>
                    <h3 
                      onClick={() => setSelectedDetailProduct(p)}
                      className="serif text-xl font-bold leading-snug text-stone-800 hover:text-[#5A5A40] cursor-pointer mb-2 line-clamp-1"
                    >
                      {p.name}
                    </h3>
                    <p className="text-xs text-stone-600 line-clamp-2 mb-4 leading-relaxed">
                      {p.description}
                    </p>
                  </div>

                  {/* Bottom pricing / actions block */}
                  <div className="border-t border-stone-100 pt-4 mt-auto">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex flex-col">
                        <span className="text-[9px] text-[#8a8a7a] tracking-wider uppercase font-semibold">Цена за 1 шт.</span>
                        <span className="text-lg font-bold text-stone-800 tracking-wide">{p.price} ₽</span>
                      </div>
                      
                      {/* Detailed info preview link */}
                      <button 
                        onClick={() => setSelectedDetailProduct(p)}
                        className="text-[10px] text-[#5A5A40] font-bold rounded-lg border border-[#5A5A40]/20 hover:bg-stone-50 px-2.5 py-1.5 transition-colors"
                      >
                        Состав
                      </button>
                    </div>

                    {/* Add to Cart button */}
                    <button 
                      onClick={() => addDirectToCart(p)}
                      className="w-full olive-bg hover:opacity-90 text-white py-3 rounded-2xl text-xs uppercase tracking-widest font-semibold transition-opacity flex items-center justify-center gap-2"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      Добавить в корзину
                    </button>
                  </div>
                </div>

              </div>
            ))}

            {filteredProducts.length === 0 && (
              <div className="col-span-full py-16 text-center bg-white rounded-[32px] border border-stone-200">
                <Leaf className="w-10 h-10 text-stone-300 mx-auto mb-3" />
                {selectedCategory === 'favorites' ? (
                  <>
                    <h4 className="serif text-xl text-stone-700">В вашем списке избранного пока пусто</h4>
                    <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">Нажимайте на ❤️ у букетов в каталоге, чтобы сохранить их здесь и вернуться к ним позже!</p>
                    <button 
                      onClick={() => setSelectedCategory('all')} 
                      className="text-xs text-[#5A5A40] underline mt-4 font-bold uppercase tracking-wider cursor-pointer"
                    >
                      Перейти в каталог
                    </button>
                  </>
                ) : (
                  <>
                    <h4 className="serif text-xl text-stone-700">Ничего не найдено в этой категории</h4>
                    <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">Попробуйте снизить планку поиска или поднять максимальный бюджет.</p>
                    <button 
                      onClick={() => { setSelectedCategory('all'); setSearchQuery(''); setMaxPrice(10000); }} 
                      className="text-xs text-[#5A5A40] underline mt-4 font-bold uppercase tracking-wider cursor-pointer"
                    >
                      Сбросить все фильтры
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

        </section>

        {/* ─── FLOWER CARE EDITORIAL BLOCK ─── */}
        <section id="care" className="bg-[#ecece2] py-20 border-t border-[#dfdfd2]">
          <div className="max-w-7xl mx-auto px-6 md:px-12 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Botanical guide text */}
            <div className="lg:col-span-7 flex flex-col justify-center">
              <span className="text-[#5A5A40] text-xs font-semibold uppercase tracking-[0.25em] mb-2 block">Продлите жизнь прекрасному</span>
              <h2 className="serif text-4xl md:text-5xl text-stone-800 leading-tight mb-6">
                Инструкция по уходу: <br />
                <span className="italic text-[#5A5A40]">секреты жизни цветов до 14+ дней</span>
              </h2>

              <p className="text-stone-600 text-sm leading-relaxed mb-8 max-w-xl">
                Мы бережно передаем вам каждый собранный букет в превосходном виде, но дома цветам необходим правильный микроклимат. Простые правила Цветочного салона Елизавета позволят бутонам стоять дольше и радовать вас своей сочной гармонией.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                
                {/* Step Item 1 */}
                <div className="bg-white p-5 rounded-3xl shadow-sm flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-[#f5f5f0] flex-shrink-0 flex items-center justify-center text-[#5A5A40] font-serif font-bold">1</div>
                  <div>
                    <h5 className="font-bold text-xs text-stone-800 uppercase tracking-wider mb-1">Срез под углом 45°</h5>
                    <p className="text-xs text-stone-500 leading-relaxed">Острым ножом или секатором подрежьте стебель перед погружением в воду на 1-2 см. Не используйте ножницы.</p>
                  </div>
                </div>

                {/* Step Item 2 */}
                <div className="bg-white p-5 rounded-3xl shadow-sm flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-[#f5f5f0] flex-shrink-0 flex items-center justify-center text-[#5A5A40] font-serif font-bold">2</div>
                  <div>
                    <h5 className="font-bold text-xs text-stone-800 uppercase tracking-wider mb-1">Кристально ледяная вода</h5>
                    <p className="text-xs text-stone-500 leading-relaxed">Используйте холодную отстоявшуюся воду. Тщательно мойте вазу с антисептиком при каждой смене воды раз в день.</p>
                  </div>
                </div>

                {/* Step Item 3 */}
                <div className="bg-white p-5 rounded-3xl shadow-sm flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-[#f5f5f0] flex-shrink-0 flex items-center justify-center text-[#5A5A40] font-serif font-bold">3</div>
                  <div>
                    <h5 className="font-bold text-xs text-stone-800 uppercase tracking-wider mb-1">Фруктовое табу</h5>
                    <p className="text-xs text-stone-500 leading-relaxed">Держите букет вдали от ваз со спелыми яблоками или бананами. Они выделяют смертельный для цветов этилен.</p>
                  </div>
                </div>

                {/* Step Item 4 */}
                <div className="bg-white p-5 rounded-3xl shadow-sm flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-[#f5f5f0] flex-shrink-0 flex items-center justify-center text-[#5A5A40] font-serif font-bold">4</div>
                  <div>
                    <h5 className="font-bold text-xs text-stone-800 uppercase tracking-wider mb-1">Хрустальный покой</h5>
                    <p className="text-xs text-stone-500 leading-relaxed">Избегайте прямого солнца, радиаторов отопления, кондиционеров и кухонных зон со сквозняком.</p>
                  </div>
                </div>

              </div>
            </div>

            {/* Showcase side layout card representing aesthetic floristry tips */}
            <div className="lg:col-span-5 h-[400px] bg-stone-100 rounded-[36px] overflow-hidden relative shadow-md">
              <img
                src={designShowcaseImg}
                alt="Как хранить цветы Елизавета Челябинск"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex flex-col justify-end p-8 text-white">
                <span className="serif text-2xl italic font-normal mb-1">Дизайнерское оформление</span>
                <p className="text-xs text-stone-200 max-w-sm leading-relaxed">
                  Каждый букет мы упаковываем с душой и заботой, бережно подчеркивая природную эстетику и свежесть цветов для ваших близких.
                </p>
              </div>
            </div>

          </div>
        </section>

        {/* ─── REVIEWS REDIRECT TO 2GIS & YANDEX MAPS ─── */}
        <section id="reviews" className="max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-24">
          
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-[#5A5A40] text-xs font-semibold uppercase tracking-[0.25em] block mb-2">Наши уважаемые гости</span>
            <h2 className="serif text-4xl md:text-5xl text-stone-800 font-semibold mb-4">
              Отзывы о Цветочном салоне <span className="italic text-[#5A5A40]">Елизавета</span>
            </h2>
            <p className="text-stone-600 text-sm">
              Мы искренне дорожим мнением каждого покупателя. Пожалуйста, ознакомьтесь с реальными отзывами о нашей работе или оставьте свое впечатление о качестве цветов и доставки на независимых городских сервисах карт.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            
            {/* Card 1: 2ГИС */}
            <div className="bg-white p-8 rounded-[36px] border border-stone-200/80 shadow-sm flex flex-col justify-between hover:shadow-md transition-all duration-300">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center">
                  <span className="w-5 h-5 rounded-full bg-[#24b455] flex items-center justify-center text-white text-[10px] font-bold">2</span>
                </div>
                <div>
                  <h4 className="font-bold text-stone-800 text-sm tracking-wide">Профиль в 2ГИС</h4>
                  <p className="text-[10px] text-stone-400 font-semibold uppercase tracking-wider">Челябинск</p>
                </div>
              </div>

              <div>
                <a 
                  href="https://2gis.ru/chelyabinsk/search/%D0%95%D0%BB%D0%B8%D0%B7%D0%B0%D0%B2%D0%B5%D1%82%D0%B0%2B%D0%9C%D0%B0%D1%81%D0%BB%D0%B5%D0%BD%D0%BD%D0%B8%D0%BA%D0%BE%D0%B2%D0%B0%2B6%2F1/firm/70000001103005190/61.46662%2C55.117669/tab/reviews?m=61.465559%2C55.141704%2F12" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-50 hover:bg-[#24b455] text-[#24b455] hover:text-white border border-emerald-200 hover:border-[#24b455] text-xs font-bold rounded-2xl transition-all duration-300 shadow-sm"
                >
                  <span>Посмотреть отзывы в 2ГИС</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Card 2: Яндекс Карты */}
            <div className="bg-white p-8 rounded-[36px] border border-stone-200/80 shadow-sm flex flex-col justify-between hover:shadow-md transition-all duration-300">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-orange-50 flex items-center justify-center">
                  <span className="w-5 h-5 rounded-full bg-[#ff3347] flex items-center justify-center text-white text-[10px] font-bold">Я</span>
                </div>
                <div>
                  <h4 className="font-bold text-stone-800 text-sm tracking-wide">Яндекс Карты</h4>
                  <p className="text-[10px] text-stone-400 font-semibold uppercase tracking-wider">Челябинск</p>
                </div>
              </div>

              <div>
                <a 
                  href="https://yandex.ru/maps/?text=Елизавета+Масленникова+6%2F1+Челябинск" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-orange-50 hover:bg-[#ff3347] text-[#ff3347] hover:text-white border border-orange-200 hover:border-[#ff3347] text-xs font-bold rounded-2xl transition-all duration-300 shadow-sm"
                >
                  <span>Посмотреть отзывы в Яндекс</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

          </div>

        </section>

        {/* ─── BOUTIQUE GEOLOCATION & SHOWN MAP INFO ─── */}
        <section id="delivery-info" className="bg-[#eaeae0] py-16 md:py-24 border-t border-[#dfdfd2]">
          <div className="max-w-7xl mx-auto px-6 md:px-12 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Operational details card */}
            <div className="lg:col-span-5">
              <span className="text-[#5A5A40] text-xs font-semibold uppercase tracking-[0.25em] mb-2 block">Цветочный салон Елизавета в Челябинске</span>
              <h2 className="serif text-4xl md:text-5xl text-stone-800 leading-tight mb-6">
                Где нас найти & <br className="hidden sm:block" />
                <span className="italic text-[#5A5A40]">условия доставки</span>
              </h2>

              <p className="text-stone-600 text-sm leading-relaxed mb-8">
                Наш салон находится в Челябинске по адресу ул. Масленникова, д. 6/1. Здесь вы можете забрать заказ самовывозом и лично проконсультироваться с нашими флористами.
              </p>

              <div className="space-y-6">
                {/* Info block 1 */}
                <div className="flex gap-4">
                  <MapPin className="w-5 h-5 text-[#5A5A40] flex-shrink-0" />
                  <div>
                    <h5 className="font-bold text-xs text-stone-800 uppercase tracking-wider">Адрес салона:</h5>
                    <p className="text-xs text-stone-600 mt-1">г. Челябинск, ул. Масленникова, д. 6/1</p>
                  </div>
                </div>

                {/* Info block 2 */}
                <div className="flex gap-4">
                  <Truck className="w-5 h-5 text-[#5A5A40] flex-shrink-0" />
                  <div>
                    <h5 className="font-bold text-xs text-stone-800 uppercase tracking-wider">Районы доставки цветов:</h5>
                    <p className="text-xs text-stone-600 mt-1">Вся городская территория Челябинска за 60-90 минут: Центральный, Курчатовский, Калининский, Советский, Тракторозаводский, Ленинский, Металлургический, а также в отдалённые районы.</p>
                  </div>
                </div>

                {/* Info block 3 */}
                <div className="flex gap-4">
                  <Clock className="w-5 h-5 text-[#5A5A40] flex-shrink-0" />
                  <div>
                    <h5 className="font-bold text-xs text-stone-800 uppercase tracking-wider">Режим работы:</h5>
                    <p className="text-xs text-stone-600 mt-1">Сборка букетов, прием заказов и экспресс-доставка: ежедневно с 08:00 до 21:00.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Simulated beautiful responsive map vector graphics with directions helper */}
            <div className="lg:col-span-7 bg-white p-8 rounded-[40px] card-shadow border border-stone-200">
              
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs font-semibold text-[#5A5A40] uppercase tracking-widest flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> Цветочный салон «Елизавета»
                </span>
                {isShopOpen ? (
                  <span className="bg-emerald-100 text-emerald-800 font-bold text-[10px] uppercase tracking-wider py-1 px-3 rounded-full flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Открыто • до 21:00
                  </span>
                ) : (
                  <span className="bg-stone-100 text-stone-500 font-semibold text-[10px] uppercase tracking-wider py-1.5 px-3 rounded-full flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-stone-400"></span>
                    Закрыто • с 08:00
                  </span>
                )}
              </div>

              {/* Real Interactive Map Widget */}
              <div className="w-full h-96 bg-stone-100 rounded-3xl relative overflow-hidden flex flex-col border border-stone-200 shadow-inner group">
                <iframe 
                  src="https://yandex.ru/map-widget/v1/?ll=61.466620%2C55.117669&z=17&pt=61.466620%2C55.117669%2Cpm2rdm" 
                  className="w-full h-full border-0 rounded-t-3xl"
                  title="Салон цветов Елизавета на карте"
                  allowFullScreen
                  style={{ border: 0 }}
                ></iframe>
                
                {/* Bottom map summary banner */}
                <div className="bg-white p-4 relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-t border-stone-100">
                  <div>
                    <span className="font-bold text-xs text-stone-800">Ленинский район, ориентир:</span>
                    <p className="text-[11px] text-stone-500">Улица Масленникова, д. 6/1 (салон «Елизавета»)</p>
                  </div>
                  <a 
                    href="https://2gis.ru/chelyabinsk/firm/70000001103005190" 
                    target="_blank" 
                    rel="noreferrer"
                    className="bg-[#5A5A40] hover:bg-[#454531] text-white text-[10px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-xl transition-colors shrink-0 text-center w-full sm:w-auto"
                  >
                    Построить маршрут
                  </a>
                </div>
              </div>

            </div>

          </div>
        </section>

      </main>

      {/* ─── FOOTER ─── */}
      <footer className="mt-auto bg-[#2d2d2d] text-white py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-6 md:px-12 flex flex-col gap-10">
          
          {/* Top segment */}
          <div className="flex flex-col md:flex-row justify-between items-start gap-8 border-b border-white/10 pb-10">
            <div className="flex flex-col">
              <span className="serif text-3xl font-semibold tracking-wide text-white">Елизавета</span>
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/50 mt-1">Авторская флористика • Доставка цветов Челябинск</p>
            </div>
          </div>

          {/* Contact segment */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-xs font-sans text-white/60">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2 font-bold font-sans">Адрес Салона</p>
              <p className="leading-relaxed">г. Челябинск, ул. Масленникова, д. 6/1</p>
              <p className="mt-1 font-serif italic text-white/80">Ежедневно с 08:00 до 21:00</p>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2 font-bold font-sans">Телефон салона</p>
              <a href="tel:+79512450565" className="text-white hover:underline block font-semibold text-sm tracking-wider">+7 (951) 245-05-65</a>
              <p className="mt-1">Режим работы поддержки: ежедневно с 08:00 до 21:00</p>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2 font-bold font-sans">Условия оплаты</p>
              <p className="leading-relaxed">Наличными при получении, банковскими картами (СБП, Visa, Master, МИР) в салоне или онлайн курьеру.</p>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/40 mb-3 font-bold font-sans">Социальные Сети</p>
              <div className="flex flex-col gap-2.5">
                
                {/* VK Group Link */}
                <a 
                  href="https://vk.com/elizaveta_flowers74" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="group flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/5 border border-white/10 text-white hover:bg-[#4C75A3]/15 hover:border-[#4C75A3]/40 transition-all duration-300 transform hover:-translate-y-0.5"
                >
                  <div className="w-7 h-7 rounded-lg bg-white/5 group-hover:bg-[#4C75A3]/20 border border-white/10 flex items-center justify-center overflow-hidden transition-all shrink-0 p-0.5">
                    <TransparentLogo 
                      src={vkIcon} 
                      alt="VK Logo" 
                      className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300" 
                      referrerPolicy="no-referrer" 
                    />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-white">ВКонтакте</span>
                    <span className="text-[9px] text-white/40 truncate group-hover:text-white/60 transition-colors">vk.com/elizaveta_flowers74</span>
                  </div>
                </a>

              </div>
            </div>
          </div>

          {/* Legal / IP Details */}
          <div className="border-t border-white/5 pt-4 flex flex-col sm:flex-row justify-between gap-2 text-[9.5px] text-white/35 font-mono tracking-wider">
            <div className="font-sans uppercase">ИНДИВИДУАЛЬНЫЙ ПРЕДПРИНИМАТЕЛЬ ИВАНОВА ЕЛЕНА ГЕННАДЬЕВНА</div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span>ОГРНИП: 325745600113952</span>
              <span>ИНН: 743203379680</span>
              <button 
                type="button" 
                onClick={() => {
                  setOfferModalTab('offer');
                  setIsOfferModalOpen(true);
                }} 
                className="underline hover:text-white/60 cursor-pointer uppercase text-[9px] font-bold"
              >
                Публичная Оферта
              </button>
              <button 
                type="button" 
                onClick={() => {
                  setOfferModalTab('agreement');
                  setIsOfferModalOpen(true);
                }} 
                className="underline hover:text-white/60 cursor-pointer uppercase text-[9px] font-bold"
              >
                Пользовательское Соглашение
              </button>
            </div>
          </div>

          {/* Fine print copy */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-[10px] text-white/40">
            <p 
              onClick={() => {
                setPinInput('');
                setPinError('');
                setIsPinModalOpen(true);
              }}
              className="cursor-pointer hover:text-white/70 transition-colors select-none"
              title="Служебный вход"
            >
              © {new Date().getFullYear()} Цветочный салон Елизавета. Все права защищены. Челябинск.
            </p>
          </div>

        </div>
      </footer>


      {/* ─── MODAL: DETAILED WORKFLOW Craft Process ─── */}
      {isCraftModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-[32px] max-w-2xl w-full p-6 md:p-10 card-shadow relative animate-fade-in my-8">
            <button 
              onClick={() => setIsCraftModalOpen(false)}
              className="absolute top-6 right-6 p-2 rounded-full hover:bg-stone-100 text-stone-500 hover:text-[#5A5A40] transition-colors"
              aria-label="Закрыть"
            >
              <X className="w-5 h-5" />
            </button>

            <span className="text-[#5A5A40] text-xs font-semibold uppercase tracking-[0.2em] mb-2 block">Кулуары Цветочного салона Елизавета</span>
            <h3 className="serif text-3xl font-semibold text-stone-800 mb-6">Как собирается ваше послание</h3>

            {/* Stepper block */}
            <div className="grid grid-cols-4 gap-2 mb-8">
              {processStepsContent.map((step, idx) => (
                <button 
                  key={idx}
                  onClick={() => setActiveProcessStep(idx)}
                  className={`py-3 px-1 rounded-xl text-xs font-bold transition-all border ${
                    activeProcessStep === idx 
                      ? 'bg-[#5A5A40] text-white border-[#5A5A40]' 
                      : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  Шаг {idx + 1}
                </button>
              ))}
            </div>

            {/* Showcase detail context */}
            <div className="bg-[#f5f5f0] p-6 rounded-2xl border border-stone-200/60 font-sans">
              <h4 className="font-bold text-sm tracking-wide text-stone-800 uppercase mb-2">
                {processStepsContent[activeProcessStep].title}
              </h4>
              <p className="text-xs text-stone-600 leading-relaxed mb-4">
                {processStepsContent[activeProcessStep].description}
              </p>
              <div className="bg-white/80 p-3 rounded-lg border border-dashed border-[#5A5A40]/30 flex gap-2 items-start">
                <Info className="w-3.5 h-3.5 text-[#5A5A40] mt-0.5 shrink-0" />
                <span className="text-[11px] italic text-[#5A5A40] leading-normal font-serif">
                  {processStepsContent[activeProcessStep].details}
                </span>
              </div>
            </div>

            <div className="mt-8 flex justify-between items-center">
              <button 
                onClick={() => setIsCraftModalOpen(false)}
                className="text-stone-500 hover:text-[#5A5A40] text-xs font-bold uppercase tracking-widest"
              >
                Закрыть
              </button>
              {activeProcessStep < 3 ? (
                <button 
                  onClick={() => setActiveProcessStep(activeProcessStep + 1)}
                  className="bg-[#5A5A40] text-white px-5 py-2.5 rounded-full text-xs font-semibold tracking-wider hover:opacity-90 transition-opacity"
                >
                  Далее →
                </button>
              ) : (
                <button 
                  onClick={() => setIsCraftModalOpen(false)}
                  className="bg-[#5A5A40] text-white px-6 py-2.5 rounded-full text-xs font-semibold tracking-wider hover:opacity-90 transition-opacity"
                >
                  Начать Покупки!
                </button>
              )}
            </div>

          </div>
        </div>
      )}


      {/* ─── CUSTOM DELETE CONFIRMATION MODAL ─── */}
      {productToDelete && (
        <div className="fixed inset-0 z-[100] bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#f5f5f0] text-stone-850 rounded-[30px] max-w-sm w-full p-6 text-center card-shadow border border-stone-200 animate-fade-in relative">
            <h4 className="serif text-lg font-bold text-stone-850 mb-3">Удаление товара</h4>
            <p className="text-xs text-stone-600 mb-6 leading-relaxed flex-col">
              Вы действительно хотите удалить товар <span className="font-semibold text-stone-800">«{productToDelete.name}»</span> из каталога? Покупатели больше его не увидят.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="text-xs font-semibold uppercase tracking-wider py-2.5 px-5 bg-stone-200 hover:bg-stone-300 text-stone-600 rounded-xl transition-colors cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = productToDelete.id;
                  setProductToDelete(null);
                  try {
                    const res = await adminFetch(`/api/products/${id}`, {
                      method: 'DELETE'
                    });
                    if (res.ok) {
                      await fetchProducts();
                    } else {
                      setInAppAlertMessage('Не удалось удалить товар. Возможно, его уже нет на сервере.');
                    }
                  } catch (err) {
                    setInAppAlertMessage('Ошибка при попытке удалить товар.');
                  }
                }}
                className="text-xs font-semibold uppercase tracking-wider py-2.5 px-5 bg-red-650 hover:bg-red-700 text-white rounded-xl transition-colors cursor-pointer"
              >
                Да, удалить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── CUSTOM ALERT BOX MODAL ─── */}
      {inAppAlertMessage && (
        <div className="fixed inset-0 z-[110] bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#f5f5f0] text-stone-850 rounded-[30px] max-w-sm w-full p-6 text-center card-shadow border border-stone-200 animate-fade-in relative">
            <h4 className="serif text-base font-bold text-stone-850 mb-2">Уведомление</h4>
            <p className="text-xs text-stone-600 mb-5 leading-relaxed">{inAppAlertMessage}</p>
            <button
              type="button"
              onClick={() => setInAppAlertMessage(null)}
              className="w-full text-xs font-semibold uppercase tracking-wider py-2.5 bg-stone-800 hover:bg-stone-900 text-white rounded-xl transition-colors cursor-pointer"
            >
              Хорошо
            </button>
          </div>
        </div>
      )}


      {/* ─── MODAL: PUBLIC OFFER AND USER AGREEMENT ─── */}
      {isOfferModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] max-w-2xl w-full h-[85vh] flex flex-col p-6 md:p-8 card-shadow relative animate-fade-in">
            <button 
              onClick={() => setIsOfferModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-stone-100 text-stone-500 hover:text-[#5A5A40] transition-colors cursor-pointer"
              aria-label="Закрыть"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-2 shrink-0">
              <span className="text-[10px] uppercase tracking-widest bg-stone-100 text-stone-600 px-2.5 py-1 rounded-md font-semibold">Юридический документ</span>
              <span className="text-[10px] text-stone-400 font-mono">Обновлено: Май 2026</span>
            </div>

            <h3 className="serif text-xl md:text-2xl font-semibold text-stone-850 mb-4 shrink-0">
              {offerModalTab === 'offer' ? 'Договор публичной оферты' : 'Пользовательское соглашение'}
            </h3>

            {/* Tab Selector */}
            <div className="flex border-b border-stone-200 mb-4 shrink-0 overflow-x-auto gap-4">
              <button
                type="button"
                onClick={() => setOfferModalTab('offer')}
                className={`pb-2 text-xs font-bold uppercase tracking-widest border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  offerModalTab === 'offer'
                    ? 'border-[#5A5A40] text-[#5A5A40]'
                    : 'border-transparent text-stone-400 hover:text-stone-600'
                }`}
              >
                📜 Публичная Оферта
              </button>
              <button
                type="button"
                onClick={() => setOfferModalTab('agreement')}
                className={`pb-2 text-xs font-bold uppercase tracking-widest border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  offerModalTab === 'agreement'
                    ? 'border-[#5A5A40] text-[#5A5A40]'
                    : 'border-transparent text-stone-400 hover:text-stone-600'
                }`}
              >
                🔒 Пользовательское Соглашение
              </button>
            </div>

            {/* Scrollable Document Body */}
            <div className="overflow-y-auto pr-2 flex-1 text-xs text-stone-600 leading-relaxed space-y-4 font-sans">
              {offerModalTab === 'offer' ? (
                <>
                  <div>
                    <strong className="text-stone-800 text-sm block mb-1">1. ОБЩИЕ ПОЛОЖЕНИЯ. ПРЕДМЕТ ДОГОВОРА</strong>
                    <p>
                      1.1. Настоящий документ в соответствии со ст. 437 Гражданского кодекса РФ является официальной публичной офертой Индивидуального Предпринимателя Ивановой Елены Геннадьевны (ОГРНИП: 325745600113952, ИНН: 743203379680) (далее — «Продавец») и содержит все существенные условия договора купли-продажи товаров дистанционным способом.
                    </p>
                    <p className="mt-2">
                      1.2. В случае принятия изложенных ниже условий и оплаты услуг, физическое или юридическое лицо, производящее акцепт этой оферты, становится Покупателем. Оплата заказа Покупателем является безусловным подтверждением (акцептом) заключения Договора на условиях настоящей оферты.
                    </p>
                  </div>

                  <div>
                    <strong className="text-stone-800 text-sm block mb-1">2. РЕКВИЗИТЫ ПРОДАВЦА</strong>
                    <p className="font-mono bg-stone-50 p-2.5 rounded-lg border border-stone-200/50 space-y-1">
                      • Получатель: Индивидуальный предприниматель Иванова Елена Геннадьевна<br />
                      • ОГРНИП: 325745600113952<br />
                      • ИНН: 743203379680<br />
                      • Фактический адрес: г. Челябинск, ул. Масленникова, д. 6/1<br />
                      • Телефон саппорта: +7 (951) 245-05-65
                    </p>
                  </div>

                  <div>
                    <strong className="text-stone-800 text-sm block mb-1">3. ОФОРМЛЕНИЕ ЗАКАЗА И ЦЕНЫ</strong>
                    <p>
                      3.1. Заказ Товара осуществляется Покупателем через интерактивный каталог, представленный на сайте. Цены на все позиции указаны в российских рублях (RUB) и актуальны на момент оформления.
                    </p>
                    <p className="mt-2">
                      3.2. Цветы являются живым товаром. Продавец гарантирует соответствие букета общей концепции, цветовой направленности и заявленной стоимости. Допускается замена отдельных второстепенных сортов цветов на аналогичные по стоимости и качеству при сохранении общего художественного стиля авторской композиции.
                    </p>
                  </div>

                  <div>
                    <strong className="text-stone-800 text-sm block mb-1">4. ДОСТАВКА И ПОЛУЧЕНИЕ</strong>
                    <p>
                      4.1. Доставка букетов осуществляется по городу Челябинску в выбранный при оформлении временной интервал. Стоимость доставки рассчитывается в соответствии с тарифами выбранного района при оформлении заказа.
                    </p>
                    <p className="mt-2 text-red-700/80">
                      4.2. Форс-мажор: в случае отсутствия Получателя по указанному адресу в назначенное время, курьер ожидает не более 15 минут. По истечении этого времени букет возвращается в салон. Повторная доставка оплачивается Покупателем отдельно в полном объеме.
                    </p>
                  </div>

                  <div>
                    <strong className="text-stone-800 text-sm block mb-1">5. ОПЛАТА И СЛУЖБА ЭКВАЙРИНГА</strong>
                    <p>
                      5.1. Покупатель оплачивает заказ безналичным расчетом в режиме онлайн через платежный шлюз ЮKassa, по СБП либо банковскими картами платёжных систем МИР, Visa, Mastercard, Maestro.
                    </p>
                    <p className="mt-2">
                      5.2. Безопасность платежей гарантируется применением современных сертифицированных криптоалгоритмов и протоколов 3D-Secure. Продавец не хранит и не обрабатывает банковские реквизиты карт Покупателей.
                    </p>
                  </div>

                  <div>
                    <strong className="text-stone-800 text-sm block mb-1">6. ВОЗВРАТ И ПРЕТЕНЗИИ</strong>
                    <p>
                      6.1. В соответствии с Постановлением Правительства РФ №2463, живые цветы, срезанные растения и флористические композиции надлежащего качества обмену и возврату не подлежат.
                    </p>
                    <p className="mt-2">
                      6.2. Если у Покупателя возникли претензии к качеству цветов, свежести или сборке букета, необходимо направить претензию с приложением четких фотографий в службу поддержки по телефону +7 (951) 245-05-65 или в чат в течение 24 часов с момента вручения заказа. Мы дорожим своей репутацией и оперативно предложим соразмерную компенсацию, замену букета или возврат денежных средств.
                    </p>
                  </div>

                  <div>
                    <strong className="text-stone-800 text-sm block mb-1">7. ПЕРСОНАЛЬНЫЕ ДАННЫЕ</strong>
                    <p>
                      7.1. Оформляя заказ, Покупатель выражает согласие на обработку своих персональных данных (имени, телефона, адреса доставки, адреса почты) в соответствии с ФЗ №152 «О персональных данных» исключительно для целей выполнения заказа и информирования о его статусе.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <strong className="text-stone-800 text-sm block mb-1">1. ПРЕДМЕТ СОГЛАШЕНИЯ</strong>
                    <p>
                      1.1. Настоящее Пользовательское соглашение (далее — «Соглашение») регулирует порядок доступа и использования материалов, интерфейса и сервисов интернет-сайта флористического салона «Елизавета» (далее — «Сайт»), индивидуального предпринимателя Ивановой Елены Геннадьевны (далее — «Администрация»).
                    </p>
                    <p className="mt-2">
                      1.2. Использование Сайта (включая просмотр каталога букетов, добавление товаров в корзину и оформление заказов) означает безоговорочное согласие Пользователя с условиями настоящего Соглашения и Политикой конфиденциальности.
                    </p>
                  </div>

                  <div>
                    <strong className="text-stone-800 text-sm block mb-1">2. ОБЯЗАТЕЛЬСТВА ПОЛЬЗОВАТЕЛЯ</strong>
                    <p>
                      2.1. Пользователь обязуется предоставлять достоверную информацию при оформлении заказа (Имя, актуальный телефон, адрес доставки, имя получателя). Использование вымышленных номеров телефонов или некорректных адресов делает исполнение обязательств со стороны салона невозможным.
                    </p>
                    <p className="mt-2">
                      2.2. Пользователь соглашается не предпринимать действий, которые могут быть рассмотрены как нарушающие российское законодательство или нормы международного права, в том числе в сфере интеллектуальной собственности, авторских прав, а также любых действий, которые ведут или могут привести к нарушению нормальной работы Сайта.
                    </p>
                  </div>

                  <div>
                    <strong className="text-stone-800 text-sm block mb-1">3. ИНТЕЛЛЕКТУАЛЬНАЯ СОБСТВЕННОСТЬ</strong>
                    <p>
                      3.1. Все объекты, размещенные на Сайте, включая товарный знак «Елизавета», элементы дизайна, тексты, иллюстрации, фотографии букетов и композиций, скрипты и их подборки, являются объектами исключительных прав Администрации. Любое копирование или распространение материалов допускается только с письменного согласия Администрации.
                    </p>
                  </div>

                  <div>
                    <strong className="text-stone-800 text-sm block mb-1">4. ПОЛИТИКА КОНФИДЕНЦИАЛЬНОСТИ И ФЗ №152</strong>
                    <p>
                      4.1. Администрация собирает и обрабатывает только те персональные данные, которые необходимы для организации доставки букета (Имя, мобильный телефон, адрес доставки) и информирования о статусе заказа.
                    </p>
                    <p className="mt-2">
                      4.2. Администрация обеспечивает конфиденциальность персональных данных. Данные передаются только службам доставки или платежным эквайерам (таким как ЮKassa) исключительно для обеспечения проведения платежей и транспортировки посылки. Регистрационные данные никогда не передаются и не продаются третьим лицам.
                    </p>
                  </div>

                  <div>
                    <strong className="text-stone-800 text-sm block mb-1">5. ОГРАНИЧЕНИЕ ОТВЕТСТВЕННОСТИ</strong>
                    <p>
                      5.1. Администрация прилагает все усилия для бесперебойной работы Сайта, но не гарантирует отсутствие временных технических сбоев или ошибок в интерактивных сервисах.
                    </p>
                    <p className="mt-2">
                      5.2. Сайт может содержать ссылки на сторонние ресурсы (например, безопасный шлюз ЮKassa, банковские приложения СБП). Администрация не несёт ответственности за работоспособность или содержимое внешних сайтов.
                    </p>
                  </div>

                  <div>
                    <strong className="text-stone-800 text-sm block mb-1">6. ИЗМЕНЕНИЕ СОГЛАШЕНИЯ</strong>
                    <p>
                      6.1. Администрация оставляет за собой право в одностороннем порядке изменять условия настоящего Соглашения без предварительного уведомления пользователей. Актуальная версия документа всегда опубликована на этой странице.
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Footer buttons block */}
            <div className="mt-6 pt-4 border-t border-stone-100 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setIsOfferModalOpen(false)}
                className="bg-[#5A5A40] text-white hover:bg-[#4C4C34] text-xs font-bold uppercase tracking-wider px-6 py-3 rounded-xl transition-colors cursor-pointer"
              >
                Ознакомлен и согласен
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ─── MODAL: DETAILED PRODUCT SPECIFICATIONS ─── */}
      {selectedDetailProduct && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start md:items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-[32px] max-w-2xl w-full card-shadow relative overflow-hidden flex flex-col md:flex-row my-4 md:my-8 animate-fade-in">
            
            {/* Visual Part */}
            <div className="md:w-1/2 aspect-[4/5] md:aspect-auto md:h-auto relative bg-stone-100 overflow-hidden">
              <img 
                src={selectedDetailProduct.imageSrc} 
                alt={selectedDetailProduct.name} 
                style={parseImageClassNameToStyle(selectedDetailProduct.imageClassName)}
                className="w-full h-full object-cover" 
              />
              {/* Product Info Block */}
            </div>

            {/* Context spec part */}
            <div className="p-8 md:w-1/2 flex flex-col justify-between">
              <div>
                <button
                  onClick={() => setSelectedDetailProduct(null)}
                  className="absolute top-4 right-4 z-10 p-2.5 rounded-full bg-white/90 backdrop-blur-sm shadow-md text-stone-700 hover:bg-white hover:text-stone-900 transition-colors"
                  aria-label="Закрыть подробности"
                >
                  <X className="w-5 h-5" strokeWidth={2.5} />
                </button>

                <span className="text-[#5A5A40] text-[9px] font-bold uppercase tracking-widest block mb-1">Флористическая карта</span>
                <h3 className="serif text-2xl font-bold text-stone-800 mb-2 leading-tight">{selectedDetailProduct.name}</h3>
                <p className="text-xs text-stone-600 leading-relaxed mb-4">{selectedDetailProduct.description}</p>
                
                <div className="border-t border-stone-200/80 pt-4 mb-4">
                  <span className="text-[10px] text-stone-400 uppercase tracking-widest font-bold block mb-2 font-sans">Характеристики / Состав:</span>
                  <ul className="space-y-1.5">
                    {selectedDetailProduct.composition.map((comp, idx) => (
                      <li key={idx} className="text-xs text-stone-700 flex gap-2 items-start font-sans leading-relaxed">
                        <Check className="w-3.5 h-3.5 text-[#5A5A40] mt-0.5 shrink-0" />
                        <span>{comp}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="border-t border-stone-100 pt-4">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-xs font-semibold text-stone-500 uppercase tracking-widest">Цена за 1 шт.:</span>
                  <span className="text-xl font-bold text-stone-800">{selectedDetailProduct.price} ₽</span>
                </div>
                
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      addDirectToCart(selectedDetailProduct);
                      setSelectedDetailProduct(null);
                    }}
                    className="flex-1 olive-bg hover:opacity-95 text-white py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-opacity text-center flex items-center justify-center gap-1.5"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" /> В корзину
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleFavorite(selectedDetailProduct.id)}
                    className="border border-stone-200 hover:bg-stone-50 text-stone-700 px-4 rounded-xl transition-all flex items-center justify-center cursor-pointer"
                    title={favorites.includes(selectedDetailProduct.id) ? "Удалить из избранного" : "Добавить в избранное"}
                  >
                    <Heart className={`w-4 h-4 ${favorites.includes(selectedDetailProduct.id) ? 'fill-red-500 text-red-500' : 'text-stone-600'}`} />
                  </button>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}





      {/* ─── SLIDE-OUT PANEL: CUSTOM SHOPPING CART sidebar ─── */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-md bg-[#f5f5f0] h-full flex flex-col justify-between shadow-2xl relative animate-slide-in">
            
            {/* Header of Drawer */}
            <div className="bg-[#5A5A40] text-white p-6 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5" />
                <span className="serif text-xl font-bold">Корзина Заказа</span>
              </div>
              <button 
                onClick={() => setIsCartOpen(false)}
                className="p-1 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                aria-label="Закрыть корзину"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List items block */}
            <div className="flex-grow p-6 overflow-y-auto space-y-4">
              {cart.map((item) => (
                <div key={item.product.id} className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200/60 font-sans flex gap-4">
                  
                  {/* Thumbnail */}
                  <div className="w-16 h-16 rounded-xl bg-stone-100 shrink-0 overflow-hidden relative">
                    <img 
                      src={item.product.imageSrc} 
                      alt={item.product.name} 
                      style={parseImageClassNameToStyle(item.product.imageClassName)} 
                      className="w-full h-full object-cover" 
                    />
                  </div>

                  {/* Detail contents */}
                  <div className="flex-grow min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <h5 className="font-bold text-xs text-stone-800 truncate">{item.product.name}</h5>
                      <button 
                        onClick={() => removeFromCart(item.product.id)}
                        className="text-stone-400 hover:text-red-600 transition-colors"
                        title="Удалить товар"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    
                    <p className="text-xs text-[#5A5A40] font-semibold mt-1">{item.product.price} ₽</p>

                    {item.cardMessage && (
                      <span className="text-[10px] bg-amber-50 border border-amber-200/60 block mt-2 p-1.5 rounded-lg text-amber-800 italic shrink-0 line-clamp-1">
                        ✍️ Открытка: "{item.cardMessage}"
                      </span>
                    )}

                    {item.comment && (
                      <span className="text-[10px] bg-stone-50 border border-stone-200/60 block mt-1 p-1 rounded-lg text-stone-500 truncate">
                        💬 Пожелание: "{item.comment}"
                      </span>
                    )}

                    {/* Quantity Adjustment triggers */}
                    <div className="flex justify-between items-center mt-3 pt-2 border-t border-stone-100">
                      <span className="text-[10px] text-stone-400 uppercase tracking-widest font-semibold">Поменять количество:</span>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => updateQuantity(item.product.id, -1)}
                          className="bg-stone-100 hover:bg-stone-200 text-stone-700 w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold transition-colors"
                        >
                          -
                        </button>
                        <span className="text-xs font-bold text-stone-800 px-1">{item.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(item.product.id, 1)}
                          className="bg-stone-100 hover:bg-stone-200 text-stone-700 w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </div>

                  </div>

                </div>
              ))}

              {cart.length === 0 && (
                <div className="py-20 text-center flex flex-col justify-center items-center">
                  <ShoppingBag className="w-12 h-12 text-stone-300 mb-2" />
                  <p className="serif text-lg text-stone-600">Ваша корзина пуста</p>
                  <p className="text-xs text-stone-400 mt-1 max-w-xs">Перейдите в наш каталог цветов, чтобы выбрать прекрасный букет!</p>
                  <button 
                    onClick={() => { setIsCartOpen(false); }}
                    className="olive-bg text-white px-5 py-2.5 rounded-full text-[10px] uppercase tracking-widest font-bold mt-6"
                  >
                    Вернуться к покупкам
                  </button>
                </div>
              )}
            </div>

            {/* Calculations & Checkout action buttons */}
            {cart.length > 0 && (
              <div className="p-6 bg-white border-t border-[#dfdfd2] space-y-4 font-sans">
                
                {/* Visual calculation bills and shipping logic states */}
                <div className="space-y-1.5 text-xs text-stone-600 border-b border-stone-100 pb-3">
                  <div className="flex justify-between">
                    <span>Стоимость товаров:</span>
                    <span className="font-bold text-stone-800">{itemsSubtotal} ₽</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Доставка{checkoutForm.deliveryType === 'delivery' ? ` (${DISTRICT_PRICES[checkoutForm.district]?.name || 'Ленинский'})` : ''}:</span>
                    <span>{checkoutForm.deliveryType === 'pickup' ? 'Самовывоз (0 ₽)' : `${deliveryStatus} ₽`}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center text-sm">
                  <span className="serif text-lg font-bold text-stone-800 uppercase tracking-widest">Итого к оплате:</span>
                  <span className="text-xl font-extrabold text-[#5A5A40] tracking-wide">{totalPrice} ₽</span>
                </div>

                <button 
                  onClick={() => {
                    setOrderResult(null);
                    setYooKassaSuccess(false);
                    setIsCheckoutDrawerOpen(true);
                  }}
                  className="w-full olive-bg text-white py-4 rounded-xl text-xs uppercase tracking-[0.2em] font-bold hover:opacity-95 text-center block transition-transform active:scale-98"
                >
                  Оформить заказ в Салоне
                </button>
              </div>
            )}

          </div>
        </div>
      )}


      {/* ─── checkout SIDEBAR / DRAWER PANEL ─── */}
      {isCheckoutDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-md bg-[#f5f5f0] h-full flex flex-col justify-between shadow-2xl relative animate-slide-in">
            
            {/* Header of Checkout Drawer */}
            <div className="bg-[#5A5A40] text-white p-6 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5" />
                <span className="serif text-xl font-bold">Оформление Доставки</span>
              </div>
              <button 
                onClick={() => {
                  setIsCheckoutDrawerOpen(false);
                  setOrderResult(null);
                  setYooKassaSuccess(false);
                }}
                className="p-1 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                aria-label="Назад к корзине"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* If Order processed successfully, show incredible bill summary */}
            {orderResult ? (
              <div className="flex-grow p-6 overflow-y-auto space-y-6 font-sans">
                <div className="bg-emerald-50 border border-emerald-300 p-6 rounded-3xl text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-800 mx-auto font-serif font-bold text-lg">
                    ✓
                  </div>
                  <h4 className="serif text-xl font-bold text-stone-800">Заказ успешно принят!</h4>
                  <p className="text-xs text-stone-600 leading-normal">{orderResult.message}</p>
                  
                  <div className="bg-white/60 p-3 rounded-xl border border-dashed border-emerald-300 inline-block">
                    <span className="text-[10px] text-stone-400 uppercase tracking-widest block font-bold">Номер вашего заказа</span>
                    <span className="text-sm font-extrabold text-[#5A5A40] tracking-wider font-mono select-all">{orderResult.orderId}</span>
                  </div>
                </div>

                {/* Simulated online checkout button if yookassa is used */}
                {orderResult.paymentMethod === 'yookassa' && (
                  <div className="bg-amber-50/80 border border-amber-200 p-5 rounded-[24px] flex flex-col items-center text-center space-y-3 mt-4">
                    {yooKassaSuccess ? (
                      <div className="space-y-1.5 py-1">
                        <div className="text-emerald-800 text-[13px] uppercase tracking-wider font-bold flex items-center justify-center gap-1.5 font-sans">
                          <span className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-800 text-xs font-bold">✓</span>
                          Заказ на 100% оплачен!
                        </div>
                        <p className="text-[11px] text-stone-600 font-sans leading-relaxed">
                          Оплата успешно зачислена по системе ЮKassa. Заказ мгновенно передан в Цветочный салон Елизавета для сборки флористами ✨
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="text-amber-800 text-[13px] uppercase tracking-wider font-bold flex items-center gap-1.5 font-sans">
                          <CreditCard className="w-4 h-4 text-amber-700 animate-pulse" /> Ожидает оплаты
                        </div>
                        
                        {yooKassaRealUrls[orderResult.orderId] ? (
                          <div className="space-y-3 w-full">
                            <p className="text-[11px] text-stone-600 leading-normal font-sans">
                              Создана официальная платежная форма ЮKassa. Попытались открыть её в новом окне.
                            </p>
                            <a
                              href={yooKassaRealUrls[orderResult.orderId]}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full bg-[#5A5A40] hover:bg-[#4C4C34] text-white py-3 rounded-xl text-xs uppercase tracking-widest font-bold transition-all text-center flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-95 duration-150 inline-block font-sans"
                            >
                              🔗 Открыть форму ЮKassa ({orderResult.totalPrice || totalPrice} ₽)
                            </a>
                            <p className="text-[9.5px] text-stone-500 italic leading-snug font-sans">
                              * Оплатите в новом окне. Каждые несколько секунд мы проверяем статус – после транзакции статус обновится автоматически!
                            </p>
                          </div>
                        ) : (
                          <>
                            <p className="text-[11px] text-stone-600 leading-normal font-sans">
                              Пожалуйста, завершите платеж через ЮKassa, чтобы флористы мгновенно получили заказ в Цветочный салон Елизавета.
                            </p>
                            <button
                              type="button"
                              onClick={() => handleStartPayment(orderResult.orderId, orderResult.totalPrice || totalPrice)}
                              disabled={initiatePaying}
                              className="w-full bg-[#5A5A40] hover:bg-[#5A5A40]/90 text-white py-3 rounded-xl text-xs uppercase tracking-widest font-bold transition-all text-center flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
                            >
                              {initiatePaying ? 'Секунду...' : `💳 Перейти к оплате ${orderResult.totalPrice || totalPrice} ₽`}
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}

                <div className="bg-white p-5 rounded-2xl border border-stone-200/60 space-y-3.5">
                  <h5 className="font-bold text-xs text-stone-800 uppercase tracking-wider border-b border-stone-100 pb-2 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" /> Конфиденциальность & Оплата
                  </h5>
                  <p className="text-xs text-stone-500 leading-relaxed">
                    Для защиты ваших данных и подтверждения заказа наш старший менеджер свяжется с вами по указанному номеру в течение 5-10 минут. Ваш заказ будет бережно передан во флористическую студию «Елизавета» для сборки.
                  </p>
                  <div className="bg-[#f5f5f0] p-3 rounded-lg text-[10px] text-stone-600 border border-stone-200/40">
                    📍 Цветочный салон Елизавета: Челябинск, ул. Масленникова, д. 6/1 <br />
                    📞 Горячая линия поддержки: +7 (951) 245-05-65
                  </div>
                </div>

                <button 
                  type="button"
                  onClick={() => {
                    handleTrackOrderById(orderResult.orderId);
                    setIsCheckoutDrawerOpen(false);
                    setOrderResult(null);
                    setYooKassaSuccess(false);
                  }}
                  className="w-full text-center py-3.5 rounded-xl text-xs font-bold text-[#5A5A40] border-2 border-[#5A5A40] hover:bg-[#5A5A40]/5 transition-colors uppercase tracking-widest block"
                >
                  Отследить процесс сборки 🌸
                </button>

                <button 
                  type="button"
                  onClick={() => {
                    setOrderResult(null);
                    setIsCheckoutDrawerOpen(false);
                    setIsCartOpen(false);
                  }}
                  className="w-full bg-[#8a8a7a]/20 hover:bg-[#8a8a7a]/30 text-stone-700 py-3.5 rounded-xl text-xs uppercase tracking-widest font-bold transition-colors"
                >
                  Вернуться на Главную
                </button>
              </div>
            ) : (
              // Order Form Block
              <div className="flex-grow p-6 overflow-y-auto font-sans">
                <form onSubmit={handlePlaceOrder} className="space-y-5">
                  
                  <div>
                    <h5 className="font-bold text-xs text-stone-800 uppercase tracking-widest border-b border-stone-200 pb-2 mb-3">1. Способ получения</h5>
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        type="button"
                        onClick={() => setCheckoutForm({ ...checkoutForm, deliveryType: 'delivery', paymentMethod: 'yookassa' })}
                        className={`py-3 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border ${
                          checkoutForm.deliveryType === 'delivery'
                            ? 'bg-[#5A5A40] text-white border-[#5A5A40]'
                            : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                        }`}
                      >
                        <Truck className="w-3.5 h-3.5" /> Доставка
                      </button>
                      <button 
                        type="button"
                        onClick={() => setCheckoutForm({ ...checkoutForm, deliveryType: 'pickup' })}
                        className={`py-3 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border ${
                          checkoutForm.deliveryType === 'pickup'
                            ? 'bg-[#5A5A40] text-white border-[#5A5A40]'
                            : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                        }`}
                      >
                        <MapPin className="w-3.5 h-3.5" /> Самовывоз
                      </button>
                    </div>
                  </div>

                  <div>
                    <h5 className="font-bold text-xs text-stone-800 uppercase tracking-widest border-b border-stone-200 pb-2 mb-3">2. Данные получателя</h5>
                    <div className="space-y-3.5">
                      <div>
                        <label className="text-[10px] text-stone-400 uppercase tracking-widest font-bold block mb-1">Ваше Имя:</label>
                        <input 
                          type="text" 
                          required
                          value={checkoutForm.name}
                          onChange={(e) => setCheckoutForm({ ...checkoutForm, name: e.target.value })}
                          placeholder="Ирина Викторовна"
                          className="w-full bg-white text-stone-800 border border-stone-300 px-4 py-2.5 text-xs rounded-xl focus:outline-none focus:border-[#5A5A40] transition-colors"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-stone-400 uppercase tracking-widest font-bold block mb-1">Телефон для подтверждения:</label>
                        <input 
                          type="tel" 
                          required
                          value={checkoutForm.phone}
                          onChange={(e) => setCheckoutForm({ ...checkoutForm, phone: e.target.value })}
                          placeholder="+7 (999) 123-45-67"
                          className="w-full bg-white text-stone-800 border border-stone-300 px-4 py-2.5 text-xs rounded-xl focus:outline-none focus:border-[#5A5A40] transition-colors"
                        />
                      </div>
                    </div>
                  </div>

                  {checkoutForm.deliveryType === 'delivery' && (
                    <div className="animate-fade-in space-y-4">
                      <h5 className="font-bold text-xs text-stone-800 uppercase tracking-widest border-b border-stone-200 pb-2 mb-1">3. Адрес доставки в Челябинске</h5>
                      
                      <div>
                        <label className="text-[10px] text-stone-400 uppercase tracking-widest font-bold block mb-1">Выберите Район:</label>
                        <select 
                          value={checkoutForm.district}
                          onChange={(e) => setCheckoutForm({ ...checkoutForm, district: e.target.value })}
                          className="w-full bg-white text-stone-800 border border-stone-300 px-4 py-2.5 text-xs rounded-xl focus:outline-none focus:border-[#5A5A40] transition-colors font-sans"
                        >
                          <option value="leninsky">Ленинский район (350 ₽)</option>
                          <option value="central">Центральный район (490 ₽)</option>
                          <option value="kurchatov">Курчатовский район (490 ₽)</option>
                          <option value="kalinin">Калининский район (490 ₽)</option>
                          <option value="soviet">Советский район (490 ₽)</option>
                          <option value="traktor">Тракторозаводский район (490 ₽)</option>
                          <option value="metal">Металлургический район (490 ₽)</option>
                          <option value="remote">В отдаленные районы Челябинска (от 650 ₽)</option>
                        </select>
                        <p className="text-[9.5px] text-stone-400 mt-1">
                          Стоимость доставки в выбранный район: {selectedDistrictPrice} ₽
                        </p>
                      </div>

                      <div>
                        <label className="text-[10px] text-stone-400 uppercase tracking-widest font-bold block mb-1">Улица, Дом, Квартира:</label>
                        <input 
                          type="text" 
                          required={checkoutForm.deliveryType === 'delivery'}
                          value={checkoutForm.address}
                          onChange={(e) => setCheckoutForm({ ...checkoutForm, address: e.target.value })}
                          placeholder="ул. Театральная, д. 18, кв. 42"
                          className="w-full bg-white text-stone-800 border border-stone-300 px-4 py-2.5 text-xs rounded-xl focus:outline-none focus:border-[#5A5A40] transition-colors"
                        />
                        <p className="text-[9px] text-stone-400 mt-1">Доставим аккуратно на авто с кондиционером.</p>
                      </div>
                    </div>
                  )}

                  <div>
                    <h5 className="font-bold text-xs text-stone-800 uppercase tracking-widest border-b border-stone-200 pb-2 mb-3">4. Дата и интервал времени</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-stone-400 uppercase tracking-widest font-bold block mb-1">Желаемая дата:</label>
                        <input 
                          type="date" 
                          value={checkoutForm.date}
                          onChange={(e) => setCheckoutForm({ ...checkoutForm, date: e.target.value })}
                          className="w-full bg-white text-stone-800 border border-stone-300 px-4 py-2 py-2.5 text-xs rounded-xl focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-stone-400 uppercase tracking-widest font-bold block mb-1">Интервал:</label>
                        <select 
                          value={checkoutForm.time}
                          onChange={(e) => setCheckoutForm({ ...checkoutForm, time: e.target.value })}
                          className="w-full bg-white text-stone-800 border border-stone-300 px-4 py-2.5 text-xs rounded-xl focus:outline-none"
                        >
                          <option value="08:00 - 10:00">08:00 - 10:00</option>
                          <option value="10:00 - 12:00">10:00 - 12:00</option>
                          <option value="12:00 - 14:00">12:00 - 14:00</option>
                          <option value="14:00 - 16:00">14:00 - 16:00</option>
                          <option value="16:00 - 18:00">16:00 - 18:00</option>
                          <option value="18:00 - 21:00">18:00 - 21:00</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h5 className="font-bold text-xs text-stone-800 uppercase tracking-widest border-b border-stone-200 pb-2 mb-3">5. Способ оплаты</h5>
                    <div className="space-y-2">
                      {checkoutForm.deliveryType === 'pickup' && (
                      <button
                        type="button"
                        onClick={() => setCheckoutForm({ ...checkoutForm, paymentMethod: 'cash' })}
                        className={`w-full py-3 px-4 rounded-xl text-xs font-medium transition-all flex flex-col items-start gap-1 border text-left ${
                          checkoutForm.paymentMethod === 'cash'
                            ? 'bg-[#5A5A40]/5 text-[#5A5A40] border-[#5A5A40] shadow-2xs'
                            : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold text-stone-800 text-[11.5px] uppercase tracking-wider">
                          <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center p-0.5 ${checkoutForm.paymentMethod === 'cash' ? 'border-[#5A5A40]' : 'border-stone-300'}`}>
                            {checkoutForm.paymentMethod === 'cash' && <span className="w-1.5 h-1.5 rounded-full bg-[#5A5A40]"></span>}
                          </span>
                          При получении
                        </div>
                        <span className="text-[10px] text-stone-450 pl-5 leading-normal">
                          СБП, СПБ-перевод или картой курьеру в салоне.
                        </span>
                      </button>
                      )}

                      <button 
                        type="button"
                        onClick={() => setCheckoutForm({ ...checkoutForm, paymentMethod: 'yookassa' })}
                        className={`w-full py-3 px-4 rounded-xl text-xs font-medium transition-all flex flex-col items-start gap-1 border text-left ${
                          checkoutForm.paymentMethod === 'yookassa'
                            ? 'bg-[#5A5A40]/5 text-[#5A5A40] border-[#5A5A40] shadow-2xs'
                            : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold text-stone-800 text-[11.5px] uppercase tracking-wider justify-between w-full">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center p-0.5 ${checkoutForm.paymentMethod === 'yookassa' ? 'border-[#5A5A40]' : 'border-stone-300'}`}>
                              {checkoutForm.paymentMethod === 'yookassa' && <span className="w-1.5 h-1.5 rounded-full bg-[#5A5A40]"></span>}
                            </span>
                            Оплатить онлайн (ЮKassa)
                          </div>
                          <span className="bg-[#5A5A40] text-white text-[8px] uppercase tracking-widest px-2 py-0.5 rounded-full font-bold">Выбор покупателей</span>
                        </div>
                        <span className="text-[10px] text-stone-450 pl-5 leading-normal">
                          СБП, Карты Мир / Visa / Mastercard. Автоматически переводит заказ на этап флористов.
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="bg-white/80 p-4 rounded-xl border border-stone-200/60 text-xs flex justify-between items-center text-stone-700">
                    <span>Итоговый Счёт с доставкой:</span>
                    <span className="font-extrabold text-stone-800 text-sm tracking-wide">{totalPrice} ₽</span>
                  </div>

                  {/* Merchant Compliance Agreement checkbox */}
                  <div className="flex items-start gap-2.5 pt-1.5 px-1">
                    <input 
                      type="checkbox"
                      id="checkout-agreement-checkbox"
                      required
                      checked={isTermsAccepted}
                      onChange={(e) => setIsTermsAccepted(e.target.checked)}
                      className="w-4 h-4 mt-0.5 rounded border-stone-300 text-[#5A5A40] focus:ring-[#5A5A40] focus:ring-offset-0 cursor-pointer accent-[#5A5A40]"
                    />
                    <label htmlFor="checkout-agreement-checkbox" className="text-[10px] text-stone-500 leading-normal select-none cursor-pointer">
                      Я согласен с условиями {' '}
                      <button 
                        type="button" 
                        onClick={() => {
                          setOfferModalTab('agreement');
                          setIsOfferModalOpen(true);
                        }} 
                        className="text-[#5A5A40] underline font-bold hover:text-[#4C4C34]"
                      >
                        Пользовательского соглашения
                      </button>{' '}
                      и {' '}
                      <button 
                        type="button" 
                        onClick={() => {
                          setOfferModalTab('offer');
                          setIsOfferModalOpen(true);
                        }} 
                        className="text-[#5A5A40] underline font-bold hover:text-[#4C4C34]"
                      >
                        Публичной оферты
                      </button>
                    </label>
                  </div>

                  <button 
                    type="submit"
                    disabled={orderProcessing || !isTermsAccepted}
                    className="w-full bg-[#5A5A40] text-white py-4 rounded-xl text-xs uppercase tracking-widest font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {orderProcessing ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        <span>Формируем ордер...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Подтвердить заказ ({totalPrice} ₽)</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* Bottom calculation warning */}
            {!orderResult && (
              <div className="p-4 bg-stone-200/60 border-t border-stone-300/40 text-center text-[10px] text-stone-500 font-sans">
                Оформляя заказ, вы подтверждаете согласие на обработку персональных данных в соответствии с ФЗ №152. Пожелания и текст записки можно свободно указать у каждого товара в корзине.
              </div>
            )}

          </div>
        </div>
      )}

      {/* ─── CUSTOMER ORDER TRACKING MODAL ─── */}
      {isTrackingOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#f5f5f0] rounded-[36px] max-w-lg w-full p-6 md:p-8 card-shadow border border-stone-200 relative animate-fade-in max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-center border-b border-stone-200/80 pb-4 mb-6">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#5A5A40]" />
                <h3 className="serif text-xl font-bold text-stone-850">Отслеживание заказа</h3>
              </div>
              <button 
                type="button"
                onClick={() => setIsTrackingOpen(false)}
                className="p-1 rounded-full bg-stone-200 hover:bg-stone-300 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4 text-stone-600" />
              </button>
            </div>

            {/* Code Search Input */}
            <div className="mb-6">
              <label className="text-[10px] text-stone-400 uppercase tracking-widest font-bold block mb-1.5">Введите номер заказа:</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Например, ELZ-872911"
                  value={trackingIdInput}
                  onChange={(e) => setTrackingIdInput(e.target.value)}
                  className="flex-grow bg-white text-stone-800 border border-stone-300 px-4 py-2.5 text-xs rounded-xl focus:outline-none focus:border-[#5A5A40] uppercase tracking-wider font-mono"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleTrackOrderById(trackingIdInput);
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleTrackOrderById(trackingIdInput)}
                  disabled={trackingLoading}
                  className="bg-[#5A5A40] hover:bg-stone-850 text-white text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 shrink-0"
                >
                  {trackingLoading ? 'Поиск...' : <Search className="w-3.5 h-3.5" />}
                </button>
              </div>
              {trackingError && <p className="text-red-600 text-[11px] mt-2 font-medium">{trackingError}</p>}
            </div>

            {/* Recent Orders helper badges */}
            {myRecentOrders.length > 0 && (
              <div className="mb-6 bg-white p-4 rounded-3xl border border-stone-200/60 shadow-xs">
                <span className="text-[10px] text-stone-400 font-bold uppercase tracking-widest block mb-2">Ваши последние заказы:</span>
                <div className="flex flex-wrap gap-2">
                  {myRecentOrders.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setTrackingIdInput(id);
                        handleTrackOrderById(id);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-mono font-extrabold tracking-wider transition-all duration-150 cursor-pointer border ${
                        trackingIdInput === id
                          ? 'bg-[#5A5A40] text-white border-[#5A5A40] shadow-sm scale-[1.02]'
                          : 'bg-stone-50 hover:bg-stone-100/80 text-stone-700 border-stone-200 shadow-xs'
                      }`}
                    >
                      {id}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {trackedOrder ? (
              <div className="space-y-6">
                {/* Order Snapshot Header */}
                <div className="bg-white p-4 rounded-3xl border border-stone-200/60 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <span className="text-[10px] text-stone-400 font-bold tracking-widest block uppercase">Заказ</span>
                    <span className="text-base font-extrabold text-[#5A5A40] font-mono tracking-wide">{trackedOrder.orderId}</span>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] text-stone-400 font-bold tracking-widest block uppercase">Текущий статус</span>
                    <span className={`inline-block px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider mt-0.5 ${
                      trackedOrder.status === 'delivered' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                      trackedOrder.status === 'delivering' ? 'bg-sky-100 text-sky-800 border border-sky-200' :
                      trackedOrder.status === 'assembled' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                      trackedOrder.status === 'cancelled' ? 'bg-red-100 text-red-800 border border-red-200' :
                      'bg-stone-100 text-stone-600 border border-stone-200'
                    }`}>
                      {trackedOrder.status === 'pending' && 'Оформлен'}
                      {trackedOrder.status === 'assembling' && 'Собирается'}
                      {trackedOrder.status === 'assembled' && 'Собран'}
                      {trackedOrder.status === 'delivering' && 'Доставляется'}
                      {trackedOrder.status === 'delivered' && 'Вручен! 🎉'}
                      {trackedOrder.status === 'cancelled' && 'Отменен'}
                    </span>
                  </div>
                </div>

                {/* Online checkout button if yookassa is used */}
                {trackedOrder.paymentMethod === 'yookassa' && (
                  <div className="bg-amber-50/80 border border-amber-200 p-4 rounded-3xl flex flex-col items-center text-center space-y-2.5">
                    {trackedOrder.paymentStatus === 'paid' ? (
                      <div className="flex items-center gap-1.5 font-bold text-emerald-800 text-[11px] uppercase tracking-wider font-sans py-1">
                        <span className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-800 text-xs font-bold">✓</span>
                        Заказ на 100% оплачен!
                      </div>
                    ) : (
                      <>
                        <div className="text-amber-800 text-[11px] uppercase tracking-wider font-bold flex items-center gap-1.5 font-sans">
                          <CreditCard className="w-3.5 h-3.5 text-amber-700 animate-pulse" /> Ожидает онлайн-оплаты {trackedOrder.totalPrice} ₽
                        </div>
                        
                        {yooKassaRealUrls[trackedOrder.orderId] ? (
                          <div className="space-y-2.5 w-full">
                            <p className="text-[10.5px] text-stone-600 leading-normal font-sans">
                              Создана официальная платежная форма ЮKassa. Оплатите в новом окне:
                            </p>
                            <a
                              href={yooKassaRealUrls[trackedOrder.orderId]}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full bg-[#5A5A40] hover:bg-[#4C4C34] text-white py-2.5 rounded-xl text-xs uppercase tracking-widest font-bold transition-all text-center flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-95 duration-150 inline-block font-sans"
                            >
                              🔗 Открыть форму ЮKassa ({trackedOrder.totalPrice} ₽)
                            </a>
                            <p className="text-[9px] text-stone-500 italic leading-snug font-sans">
                              * Каждые несколько секунд мы автоматически опрашиваем шлюз на предмет статуса оплаты!
                            </p>
                          </div>
                        ) : (
                          <>
                            <p className="text-[10.5px] text-stone-600 leading-normal font-sans">
                              Для передачи заказа флористам на сборку, пожалуйста, завершите платеж через систему ЮKassa.
                            </p>
                            <button
                              type="button"
                              onClick={() => handleStartPayment(trackedOrder.orderId, trackedOrder.totalPrice)}
                              disabled={initiatePaying}
                              className="w-full bg-[#5A5A40] hover:bg-[#5A5A40]/90 text-white py-2.5 rounded-xl text-xs uppercase tracking-widest font-bold transition-all text-center flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
                            >
                              {initiatePaying ? 'Секунду...' : `💳 Перейти к оплате ${trackedOrder.totalPrice} ₽`}
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Stepper progress timeline */}
                {trackedOrder.status !== 'cancelled' && (
                  <div className="bg-white p-5 rounded-3xl border border-stone-200/60 space-y-4">
                    <span className="text-[10px] text-stone-400 font-bold tracking-widest block uppercase">Путь вашего букета</span>
                    <div className="relative pl-5 border-l border-stone-200 space-y-6 py-2 ml-1.5 font-sans">
                      {[
                        { statusKey: 'pending', title: 'Оформлен', text: 'Заказ успешно принят и внесен в ведомость' },
                        { statusKey: 'assembling', title: 'Сборка', text: 'Флорист подбирает самые красивые стебли и элитную зелень' },
                        { statusKey: 'assembled', title: 'Букет готов', text: 'Композиция собрана на воде, сфотографирована и бережно упакована' },
                        { statusKey: 'delivering', title: 'Доставка', text: 'Заказ передан курьеру и бережно доставляется вам' },
                        { statusKey: 'delivered', title: 'Вручен получателю', text: 'Букет бережно передан в руки и дарит радость!' }
                      ].map((step, idx) => {
                        const statesArr = ['pending', 'assembling', 'assembled', 'delivering', 'delivered'];
                        const currentIdx = statesArr.indexOf(trackedOrder.status);
                        const isCompleted = idx <= currentIdx;
                        return (
                          <div key={idx} className="relative">
                            {/* Active / completed green bubble marker */}
                            <span className={`absolute -left-[27px] top-[2px] w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 ${
                              isCompleted 
                                ? 'bg-[#5A5A40] border-[#5A5A40] text-white' 
                                : 'bg-white border-stone-300 text-stone-300'
                            }`}>
                              {isCompleted && <span className="text-[9px]">✓</span>}
                            </span>
                            <div>
                              <h5 className={`text-xs font-bold leading-none ${isCompleted ? 'text-[#5A5A40]' : 'text-stone-400'}`}>{step.title}</h5>
                              <p className="text-[11px] text-stone-500 leading-normal mt-1">{step.text}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}



                {/* Ordered elements detail summary */}
                <div className="bg-white p-5 rounded-3xl border border-stone-200/60 space-y-3.5">
                  <span className="text-[10px] text-stone-400 font-bold tracking-widest block uppercase">Детали заказа</span>
                  <div className="space-y-2 text-xs text-stone-700">
                    <div className="border-b border-stone-100 pb-2">
                      <span className="text-stone-400">Получатель:</span> <strong className="text-stone-800">{trackedOrder.customerName}</strong>
                    </div>
                    <div className="border-b border-stone-100 pb-2 border-stone-200/40">
                      <span className="text-stone-400">Указанный Телефон:</span> <strong className="text-stone-800 font-mono">{trackedOrder.customerPhone}</strong>
                    </div>
                    <div className="border-b border-stone-100 pb-2 border-stone-200/40">
                      <span className="text-stone-400">Адрес доставки:</span> <strong className="text-stone-800">{trackedOrder.address}</strong>
                    </div>
                    <div className="border-b border-stone-100 pb-2 border-stone-200/40">
                      <span className="text-stone-400">Интервал:</span> <strong className="text-stone-800">{trackedOrder.date}, {trackedOrder.time}</strong>
                    </div>
                    {trackedOrder.cardMessage && (
                      <div className="border-b border-stone-100 pb-2 border-stone-200/40 bg-amber-50/50 p-2.5 rounded-xl border border-dashed border-amber-200 mt-2">
                        <span className="text-stone-500 block text-[9px] uppercase font-bold tracking-wider mb-1">✍️ Каллиграфу на открытку:</span>
                        <p className="font-serif italic text-stone-700 text-xs">«{trackedOrder.cardMessage}»</p>
                      </div>
                    )}
                    <div className="pt-2">
                      <span className="text-stone-400 block mb-1">Флористический состав:</span>
                      <ul className="space-y-1 list-disc pl-4 text-stone-600 text-[11px]">
                        {trackedOrder.items?.map((it: any, j: number) => (
                          <li key={j}>
                            {it.name} — <strong className="text-stone-800 font-mono">{it.quantity} шт</strong> ({it.price} ₽/шт)
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="pt-3 border-t border-stone-100 flex justify-between items-center text-sm font-sans">
                      <span className="font-bold text-[#5A5A40]">Итоговая стоимость:</span>
                      <strong className="text-[#5A5A40] text-base font-extrabold font-mono">{trackedOrder.totalPrice} ₽</strong>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-stone-400">
                <p className="text-xs leading-relaxed font-sans">Введите ваш номер заказа (например: <strong className="font-mono text-[#5A5A40]">ELZ-872911</strong>), чтобы увидеть статус сборки, бережной упаковки и курьерской доставки вашего престижного букета.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── YOOKASSA PAYMENT OVERLAY ─── */}
      {yooKassaOrderId && (
        <div className="fixed inset-0 z-[70] bg-[#1a1128]/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] max-w-sm w-full overflow-hidden shadow-2xl border border-purple-900/10 font-sans text-stone-800">
            {/* Header of YooKassa */}
            <div className="bg-[#1b083c] p-6 text-white relative">
              <button 
                type="button"
                onClick={() => setYooKassaOrderId(null)}
                className="absolute top-5 right-5 text-stone-400 hover:text-white p-1 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                disabled={isYooKassaPaying}
              >
                <X className="w-4 h-4" />
              </button>
              
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-white font-extrabold text-xs tracking-tighter">Ю</span>
                <span className="font-extrabold text-base tracking-tight font-sans">ЮKassa <span className="text-[10px] bg-indigo-600 py-0.5 px-1.5 rounded-full font-bold ml-1.5 uppercase tracking-widest text-[#00ffcc]">Тест</span></span>
              </div>
              
              <h3 className="text-xl font-extrabold text-stone-100 flex justify-between items-baseline mt-4">
                <span className="text-xs font-medium text-stone-300">Сумма к оплате:</span>
                <span className="text-xl font-black font-mono tracking-wide text-indigo-300">{yooKassaAmount} ₽</span>
              </h3>
              
              <div className="mt-3 pt-3 border-t border-white/10 flex justify-between text-[11px] text-stone-300">
                <span>Магазин: <strong>Салон «Елизавета»</strong></span>
                <span>Заказ: <strong className="font-mono">{yooKassaOrderId}</strong></span>
              </div>
            </div>

            {/* Content body */}
            <div className="p-6 space-y-5 bg-[#faf9fc]">
              {yooKassaSuccess ? (
                <div className="text-center py-6 space-y-4 animate-fade-in">
                  <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 flex items-center justify-center mx-auto text-xl font-bold">
                    ✓
                  </div>
                  <h4 className="text-base font-bold text-stone-850">Оплата успешно проведена!</h4>
                  <p className="text-[11px] text-stone-500 leading-relaxed max-w-sm mx-auto">
                    Онлайн-платеж ЮKassa прошел успешную авторизацию. Мы мгновенно предупредили старшего флориста в Челябинске. Уже начинаем сборку вашего букета из свежайших цветов!
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setYooKassaOrderId(null);
                      setYooKassaSuccess(false);
                    }}
                    className="bg-[#1b083c] hover:bg-[#2b105a] text-white py-3 px-6 rounded-xl text-xs uppercase tracking-widest font-bold transition-all inline-block shadow-md cursor-pointer"
                  >
                    Вернуться к заказу
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Select payment type simulation segment */}
                  <div className="bg-white p-3.5 rounded-2xl border border-purple-100 flex items-center justify-between gap-2 shadow-2xs">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4.5 h-4.5 text-indigo-600" />
                      <div className="text-left font-sans">
                        <span className="text-xs font-bold text-stone-800 block">Банковская карта</span>
                        <span className="text-[10px] text-stone-400 block font-normal">Мир, Visa, Mastercard, СБП</span>
                      </div>
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full bg-[#1b083c] ring-4 ring-indigo-50"></span>
                  </div>

                  {/* Card values fields form mock */}
                  <div className="bg-white p-4 rounded-2xl border border-purple-100 space-y-3 shadow-2xs">
                    <div>
                      <label className="text-[9px] text-[#8133cc] font-extrabold uppercase tracking-wider block mb-1">Номер карты:</label>
                      <input 
                        type="text"
                        value={yooCardNumber}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 16);
                          const formatted = val.replace(/(\d{4})/g, '$1 ').trim();
                          setYooCardNumber(formatted);
                        }}
                        placeholder="2202 2011 3491 5821"
                        className="w-full bg-stone-50 text-stone-800 border border-stone-200 px-3 py-2 text-xs rounded-xl focus:outline-none focus:border-indigo-500 transition-colors font-mono font-bold tracking-wider"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[9px] text-[#8133cc] font-extrabold uppercase tracking-wider block mb-1">Срок действия:</label>
                        <input 
                          type="text"
                          value={yooCardExpiry}
                          onChange={(e) => {
                            let val = e.target.value.replace(/\D/g, '').slice(0, 4);
                            if (val.length > 2) {
                              val = val.slice(0, 2) + '/' + val.slice(2);
                            }
                            setYooCardExpiry(val);
                          }}
                          placeholder="12/29"
                          className="w-full bg-stone-50 text-stone-800 border border-stone-200 px-3 py-2 text-xs rounded-xl focus:outline-none focus:border-indigo-500 transition-colors font-mono font-bold text-center tracking-widest"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-[#8133cc] font-extrabold uppercase tracking-wider block mb-1">CVC / CVC2:</label>
                        <input 
                          type="password"
                          maxLength={3}
                          value={yooCardCvc}
                          onChange={(e) => setYooCardCvc(e.target.value.replace(/\D/g, ''))}
                          placeholder="•••"
                          className="w-full bg-stone-50 text-stone-800 border border-stone-200 px-3 py-2 text-xs rounded-xl focus:outline-none focus:border-indigo-500 transition-colors font-mono font-bold text-center tracking-widest"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="button"
                    disabled={isYooKassaPaying}
                    onClick={() => {
                      if (!yooCardNumber.replace(/\s+/g, '').trim()) {
                        alert('Пожалуйста, укажите любой номер карты для тестирования ЮKassa.');
                        return;
                      }
                      handleConfirmYooKassaPayment(yooKassaOrderId);
                    }}
                    className="w-full bg-[#1b083c] hover:bg-[#2b105a] disabled:opacity-80 text-white font-bold py-3.5 rounded-xl text-xs uppercase tracking-widest transition-all mt-4 text-center flex items-center justify-center gap-2 shadow-md cursor-pointer hover:scale-[1.01] active:scale-95 duration-150"
                  >
                    {isYooKassaPaying ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                        <span>Авторизация транзакции...</span>
                      </>
                    ) : (
                      <span>Оплатить {yooKassaAmount} ₽</span>
                    )}
                  </button>

                  <div className="flex items-center justify-center gap-1.5 text-stone-400 text-[10px] mt-2 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" /> Тестовый шлюз YooKassa 3D-Secure
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── SECRET PIN AUTHENTICATION MODAL ─── */}
      {isPinModalOpen && (
        <div className="fixed inset-0 z-[60] bg-stone-900/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#f5f5f0] rounded-[36px] max-w-sm w-full p-6 md:p-8 card-shadow border border-stone-200 text-center animate-fade-in text-stone-800">
            {/* Header */}
            <div className="flex flex-col items-center mb-6">
              <div className="w-12 h-12 rounded-full bg-[#5A5A40]/10 flex items-center justify-center mb-3 text-[#5A5A40]">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="serif text-lg font-bold text-stone-850">Вход для персонала</h3>
              <p className="text-stone-500 text-[11px] mt-1 font-sans">Требуется индентификационный код салона</p>
            </div>

            {/* Simulated PIN Display */}
            <div className="flex justify-center gap-3.5 mb-6">
              {[0, 1, 2, 3].map((idx) => (
                <div 
                  key={idx} 
                  className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                    pinInput.length > idx 
                      ? 'bg-[#5A5A40] border-[#5A5A40] scale-110 shadow-xs' 
                      : 'border-stone-300 bg-white'
                  }`}
                />
              ))}
            </div>

            {/* PIN Code digits grid */}
            <div className="grid grid-cols-3 gap-3 max-w-[240px] mx-auto mb-6">
              {[
                { label: '1', value: '1' }, { label: '2', value: '2' }, { label: '3', value: '3' },
                { label: '4', value: '4' }, { label: '5', value: '5' }, { label: '6', value: '6' },
                { label: '7', value: '7' }, { label: '8', value: '8' }, { label: '9', value: '9' },
                { label: '⌫', value: 'backspace' }, { label: '0', value: '0' }, { label: 'C', value: 'clear' }
              ].map((btn) => (
                <button
                  key={btn.label}
                  type="button"
                  onClick={() => {
                    if (btn.value === 'clear') {
                      setPinInput('');
                      setPinError('');
                    } else if (btn.value === 'backspace') {
                      setPinInput((prev) => prev.slice(0, -1));
                      setPinError('');
                    } else {
                      if (pinInput.length < 4) {
                        const updated = pinInput + btn.value;
                        setPinInput(updated);
                        setPinError('');
                        if (updated.length === 4) {
                          (async () => {
                            try {
                              const res = await fetch('/api/admin/login', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ pin: updated }),
                              });
                              if (res.ok) {
                                const { token } = await res.json();
                                localStorage.setItem('adminToken', token);
                                setIsAdminOpen(true);
                                setIsPinModalOpen(false);
                                setPinInput('');
                              } else {
                                setTimeout(() => {
                                  setPinError('Неверный служебный код салона');
                                  setPinInput('');
                                }, 600);
                              }
                            } catch {
                              setPinError('Сервер недоступен, попробуйте ещё раз.');
                              setPinInput('');
                            }
                          })();
                        }
                      }
                    }
                  }}
                  className={`w-14 h-14 rounded-full text-[#5A5A40] text-lg font-black tracking-widest transition-all shadow-xs border flex items-center justify-center cursor-pointer active:scale-90 ${
                    btn.value === 'clear' || btn.value === 'backspace'
                      ? 'bg-stone-200/60 border-stone-300 text-stone-600 hover:bg-stone-300/60'
                      : 'bg-white border-stone-200/50 hover:bg-stone-100'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            {pinError && (
              <p className="text-red-650 text-[11px] font-sans font-semibold animate-pulse mb-4">{pinError}</p>
            )}

            {/* Back to site */}
            <button
              type="button"
              onClick={() => setIsPinModalOpen(false)}
              className="text-stone-400 hover:text-stone-600 font-sans text-xs underline cursor-pointer"
            >
              ← Вернуться в каталог салона
            </button>
          </div>
        </div>
      )}

      {/* ─── ADMIN DASHBOARD CABINET ─── */}
      {isAdminOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#fafaf9] text-stone-850 font-sans">
          {/* Header Bar */}
          <div className="bg-stone-900 text-stone-100 px-6 py-4 flex flex-col md:flex-row justify-between items-center border-b border-stone-800 sticky top-0 z-50 shadow-md">
            <div className="flex items-center gap-3 mb-3 md:mb-0">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h3 className="serif text-lg font-extrabold tracking-tight">Служебный Кабинет Салона «Елизавета»</h3>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAdminTab('orders')}
                className={`text-xs font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                  adminTab === 'orders' 
                    ? 'bg-[#5A5A40] text-white shadow-xs' 
                    : 'bg-stone-800 text-stone-300 hover:bg-stone-750 hover:text-white'
                }`}
              >
                📦 Управление заказами
              </button>
              <button
                type="button"
                onClick={() => setAdminTab('catalog')}
                className={`text-xs font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                  adminTab === 'catalog' 
                    ? 'bg-[#5A5A40] text-white shadow-xs' 
                    : 'bg-stone-800 text-stone-300 hover:bg-stone-750 hover:text-white'
                }`}
              >
                ✂️ Витрина Букетов
              </button>
              <button
                type="button"
                onClick={() => setIsAdminOpen(false)}
                className="text-xs bg-red-600 hover:bg-red-700 text-white font-extrabold px-3.5 py-1.5 rounded-xl uppercase tracking-wider transition-all cursor-pointer hover:scale-[1.01]"
              >
                Выйти ↩
              </button>
            </div>
          </div>

          <div className="max-w-7xl mx-auto p-4 md:p-8 animate-fade-in">
            {adminTab === 'orders' ? (
              <>
                {/* Advanced Date Filters Section */}
                {(() => {
                  // Available years in orders list for dynamic dropdown
                  const availableYears = (() => {
                    const YSet = new Set<string>();
                    adminOrders.forEach(o => {
                      const cInfo = getOrderDateInfo(o, 'createdAt');
                      const dInfo = getOrderDateInfo(o, 'delivery');
                      if (cInfo.year) YSet.add(cInfo.year);
                      if (dInfo.year) YSet.add(dInfo.year);
                    });
                    if (YSet.size === 0) {
                      YSet.add(new Date().getFullYear().toString());
                    }
                    return Array.from(YSet).sort((a, b) => b.localeCompare(a));
                  })();

                  const filteredOrders = adminOrders.filter(o => {
                    // search logic
                    const txt = adminSearch.toLowerCase().trim();
                    const matchesSearch = !txt || 
                      o.orderId.toLowerCase().includes(txt) ||
                      o.customerName.toLowerCase().includes(txt) ||
                      o.customerPhone.includes(txt);

                    if (!matchesSearch) return false;

                    // date logic
                    const dateInfo = getOrderDateInfo(o, adminDateFilterType);
                    
                    if (adminDayFilter) {
                      // exact match YYYY-MM-DD
                      if (dateInfo.fullDate !== adminDayFilter) return false;
                    } else {
                      // month and/or year
                      if (adminYearFilter !== 'any' && dateInfo.year !== adminYearFilter) return false;
                      if (adminMonthFilter !== 'any' && dateInfo.month !== adminMonthFilter) return false;
                    }

                    return true;
                  });

                  const totalStats = filteredOrders.length;
                  const totalRevenue = filteredOrders.reduce((acc, o) => acc + (o.totalPrice || 0), 0);
                  const paidCount = filteredOrders.filter(o => o.paymentStatus === 'paid').length;
                  const paidRevenue = filteredOrders.filter(o => o.paymentStatus === 'paid').reduce((acc, o) => acc + (o.totalPrice || 0), 0);

                  return (
                    <>
                      <div className="mb-6 bg-stone-50/70 p-4 md:p-5 rounded-[26px] border border-stone-200/60 shadow-xs space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#5A5A40] flex items-center gap-1.5 font-sans">
                            <Clock className="w-3.5 h-3.5" />
                            Фильтрация по дате заказа
                          </span>
                          {(adminYearFilter !== 'any' || adminMonthFilter !== 'any' || adminDayFilter !== '') && (
                            <button
                              type="button"
                              onClick={() => {
                                setAdminYearFilter('any');
                                setAdminMonthFilter('any');
                                setAdminDayFilter('');
                              }}
                              className="text-[10px] text-red-650 hover:text-red-750 font-bold uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              ✕ Сбросить фильтры дат
                            </button>
                          )}
                        </div>

                        {/* Date Field Toggle */}
                        <div className="flex flex-wrap gap-2.5 items-center font-sans">
                          <span className="text-xs text-stone-500 font-medium">Какую дату фильтровать?</span>
                          <div className="bg-stone-200/60 p-0.5 rounded-xl flex gap-1 select-none">
                            <button
                              type="button"
                              onClick={() => setAdminDateFilterType('createdAt')}
                              className={`px-3 py-1 text-[11px] font-bold transition-all rounded-lg cursor-pointer ${
                                adminDateFilterType === 'createdAt'
                                  ? 'bg-[#5A5A40] text-white shadow-xs'
                                  : 'text-stone-600 hover:text-stone-800'
                              }`}
                            >
                              Дата оформления
                            </button>
                            <button
                              type="button"
                              onClick={() => setAdminDateFilterType('delivery')}
                              className={`px-3 py-1 text-[11px] font-bold transition-all rounded-lg cursor-pointer ${
                                adminDateFilterType === 'delivery'
                                  ? 'bg-[#5A5A40] text-white shadow-xs'
                                  : 'text-stone-600 hover:text-stone-800'
                              }`}
                            >
                              Дата доставки / самовывоза
                            </button>
                          </div>
                        </div>

                        {/* Dropdowns and Exact Day Select */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-sans">
                          {/* Year Dynamic Dropdown */}
                          <div className="space-y-1">
                            <label className="text-[10px] text-stone-500 uppercase tracking-wider font-bold block">Год</label>
                            <select
                              value={adminYearFilter}
                              onChange={(e) => {
                                setAdminYearFilter(e.target.value);
                                setAdminDayFilter(''); // Clear exact day when changing dropdowns
                              }}
                              disabled={adminDayFilter !== ''}
                              className="w-full bg-white text-stone-800 border border-stone-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-[#5A5A40] disabled:bg-stone-100 disabled:text-stone-400 cursor-pointer"
                            >
                              <option value="any">Все годы</option>
                              {availableYears.map(yr => (
                                <option key={yr} value={yr}>{yr} год</option>
                              ))}
                            </select>
                          </div>

                          {/* Month Dropdown */}
                          <div className="space-y-1">
                            <label className="text-[10px] text-stone-500 uppercase tracking-wider font-bold block">Месяц</label>
                            <select
                              value={adminMonthFilter}
                              onChange={(e) => {
                                setAdminMonthFilter(e.target.value);
                                setAdminDayFilter('');
                              }}
                              disabled={adminDayFilter !== ''}
                              className="w-full bg-white text-stone-805 border border-stone-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-[#5A5A40] disabled:bg-stone-100 disabled:text-stone-400 cursor-pointer"
                            >
                              {MONTHS_RU.map(m => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                              ))}
                            </select>
                          </div>

                          {/* Specific Day Picker */}
                          <div className="space-y-1">
                            <label className="text-[10px] text-stone-500 uppercase tracking-wider font-bold block">Конкретный день</label>
                            <div className="relative">
                              <input
                                type="date"
                                value={adminDayFilter}
                                onChange={(e) => setAdminDayFilter(e.target.value)}
                                className="w-full bg-white text-stone-850 border border-stone-200 rounded-xl px-2.5 py-1 text-xs focus:outline-none focus:border-[#5A5A40] cursor-pointer"
                              />
                              {adminDayFilter && (
                                <button
                                  type="button"
                                  onClick={() => setAdminDayFilter('')}
                                  className="absolute right-2.5 top-1.5 text-stone-400 hover:text-stone-650 text-xs font-bold font-sans"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Summary and Stats of filtered Orders */}
                        <div className="pt-3 border-t border-stone-200/50 grid grid-cols-2 lg:grid-cols-4 gap-3 text-center font-sans">
                          <div className="bg-white p-2 md:p-2.5 rounded-2xl border border-stone-150">
                            <span className="text-[9px] text-stone-400 uppercase tracking-widest block font-bold mb-0.5">Заказов</span>
                            <strong className="text-sm md:text-base text-stone-850 font-mono">{totalStats} шт.</strong>
                          </div>
                          <div className="bg-white p-2 md:p-2.5 rounded-2xl border border-stone-150">
                            <span className="text-[9px] text-stone-400 uppercase tracking-widest block font-bold mb-0.5">На сумму</span>
                            <strong className="text-sm md:text-base text-[#5A5A40] font-mono">{totalRevenue.toLocaleString('ru-RU')} ₽</strong>
                          </div>
                          <div className="bg-white p-2 md:p-2.5 rounded-2xl border border-stone-150">
                            <span className="text-[9px] text-stone-400 uppercase tracking-widest block font-bold mb-0.5">Оплачено</span>
                            <strong className="text-sm md:text-base text-emerald-700 font-mono">{paidCount} шт.</strong>
                          </div>
                          <div className="bg-white p-2 md:p-2.5 rounded-2xl border border-stone-150">
                            <span className="text-[9px] text-stone-400 uppercase tracking-widest block font-bold mb-0.5">В кассе</span>
                            <strong className="text-sm md:text-base text-emerald-800 font-mono">{paidRevenue.toLocaleString('ru-RU')} ₽</strong>
                          </div>
                        </div>
                      </div>

                      {/* Admin orders table / cards scroll list */}
                      {adminLoading ? (
                        <div className="text-center py-16 text-stone-400 text-xs">Загрузка актуального списка заказов...</div>
                      ) : (
                        <div className="space-y-4">
                          {filteredOrders.map((order) => (
                            <div key={order.orderId} className="bg-white p-5 rounded-3xl border border-stone-200/60 shadow-sm hover:border-stone-300 transition-all font-sans text-stone-850">
                              {/* ID and state block */}
                              <div className="flex flex-col sm:flex-row justify-between sm:items-center pb-3 border-b border-stone-100 gap-2 mb-4">
                                <div className="flex items-center gap-2.5">
                                  <span className="text-sm font-black text-stone-800 font-mono tracking-wide bg-stone-100 px-2.5 py-1 rounded-lg border border-stone-200">{order.orderId}</span>
                                  <span className="text-stone-400 text-xs font-mono">{new Date(order.createdAt || '').toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'})}</span>
                                  <span className={`text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${
                                    order.status === 'delivered' ? 'bg-emerald-100 text-emerald-850' :
                                    order.status === 'delivering' ? 'bg-sky-100 text-sky-850' :
                                    order.status === 'assembled' ? 'bg-amber-100 text-amber-850' :
                                    order.status === 'cancelled' ? 'bg-red-100 text-red-850' :
                                    'bg-stone-100 text-stone-600'
                                  }`}>
                                    {order.status === 'pending' && 'Ожидает'}
                                    {order.status === 'assembling' && 'Сборка'}
                                    {order.status === 'assembled' && 'Готов'}
                                    {order.status === 'delivering' && 'Доставляется'}
                                    {order.status === 'delivered' && 'Доставлен! 🎉'}
                                    {order.status === 'cancelled' && 'Отменен'}
                                  </span>
                                </div>
                                <strong className="text-sm text-[#5A5A40] font-sans">{order.totalPrice} ₽</strong>
                              </div>

                              {/* Payment status and method badges */}
                              <div className="flex flex-wrap gap-1.5 mb-4 font-sans select-none">
                                {order.paymentMethod === 'yookassa' ? (
                                  <span className="bg-purple-50 text-purple-700 px-2.5 py-1 rounded-lg border border-purple-200 text-[9.5px] font-extrabold uppercase tracking-widest flex items-center gap-1">
                                    <CreditCard className="w-3.5 h-3.5 text-purple-600" />
                                    Онлайн (ЮKassa)
                                  </span>
                                ) : (
                                  <span className="bg-stone-50 text-stone-700 px-2.5 py-1 rounded-lg border border-stone-200 text-[9.5px] font-extrabold uppercase tracking-widest flex items-center gap-1">
                                    💵 При получении
                                  </span>
                                )}

                                {order.paymentMethod === 'yookassa' ? (
                                  order.paymentStatus === 'paid' ? (
                                    <span className="bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-lg border border-emerald-200 text-[9.5px] font-extrabold uppercase tracking-widest flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                      ✓ Оплачено онлайн
                                    </span>
                                  ) : (
                                    <span className="bg-rose-50 text-rose-800 px-2.5 py-1 rounded-lg border border-rose-200 text-[9.5px] font-extrabold uppercase tracking-widest flex items-center gap-1 animate-pulse">
                                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                      🕓 Ждёт онлайн-оплату
                                    </span>
                                  )
                                ) : (
                                  order.paymentStatus === 'paid' ? (
                                    <span className="bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-lg border border-emerald-200 text-[9.5px] font-extrabold uppercase tracking-widest flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                      ✓ Получено при выдаче
                                    </span>
                                  ) : (
                                    <span className="bg-sky-50 text-sky-800 px-2.5 py-1 rounded-lg border border-sky-200 text-[9.5px] font-extrabold uppercase tracking-widest flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
                                      💵 Оплата при получении
                                    </span>
                                  )
                                )}
                              </div>

                              {/* Main grid of info */}
                              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 mb-4">
                                {/* Left segment (receiver details) */}
                                <div className="md:col-span-6 space-y-1.5 text-xs text-stone-700 font-sans border-r border-stone-100/60 pr-2">
                                  <p>👦 Получатель: <strong className="text-stone-800">{order.customerName}</strong> (<a href={`tel:${order.customerPhone}`} className="text-[#5A5A40] hover:underline font-bold">{order.customerPhone}</a>)</p>
                                  <p>📍 {order.deliveryType === 'delivery' ? '🚗 Доставка на авто:' : '🏪 Самовывоз:'} <span className="font-semibold text-stone-600">{order.address}</span></p>
                                  <p>⏰ Интервал: <span className="font-semibold text-stone-600">{order.date}, {order.time}</span></p>
                                  {order.cardMessage && (
                                    <p className="bg-amber-50 border border-dashed border-amber-200 text-[10.5px] p-2 rounded-xl mt-2 font-serif italic text-stone-600">
                                      💌 Каллиграфу открытка: «{order.cardMessage}»
                                    </p>
                                  )}
                                </div>

                                {/* Right segment (flower specs) */}
                                <div className="md:col-span-6 space-y-2 text-xs font-sans">
                                  <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">Состав флористической заказа:</span>
                                  <ul className="space-y-1 text-stone-600 text-[11px]">
                                    {order.items?.map((it: any, k: number) => (
                                      <li key={k} className="flex justify-between border-b border-stone-50 pb-1">
                                        <span>🌸 {it.name}</span>
                                        <span className="font-semibold text-stone-800">x{it.quantity} шт ({it.price} ₽)</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>

                              {/* Workflow Status controls for the florists */}
                              <div className="bg-[#f5f5f0] p-4 rounded-3xl border border-stone-200/50">
                                <span className="text-[10px] text-stone-400 font-bold tracking-widest block uppercase mb-2">Обновить статус сборки и добавить комментарий:</span>
                                
                                {/* Input for custom comment */}
                                <div className="mb-3">
                                  <input
                                    type="text"
                                    placeholder="Добавить флористическое примечание (например: букет собран на воде, курьер Александр выехал)"
                                    value={customStatusNote}
                                    onChange={(e) => setCustomStatusNote(e.target.value)}
                                    className="w-full bg-white text-stone-800 border border-stone-200 px-3 py-2 text-[11px] rounded-lg focus:outline-none focus:border-[#5A5A40]"
                                  />
                                </div>

                                {/* State transition buttons */}
                                <div className="flex flex-wrap gap-1.5">
                                  {[
                                    { statusKey: 'pending', label: 'В очередь ⏱️' },
                                    { statusKey: 'assembling', label: 'На сборку ✂️' },
                                    { statusKey: 'assembled', label: 'Готов & Снят 📸' },
                                    { statusKey: 'delivering', label: 'В Путь 🚗' },
                                    { statusKey: 'delivered', label: 'Доставлен 🎉' },
                                    { statusKey: 'cancelled', label: 'Отменить ❌' }
                                  ].map((st) => (
                                    <button
                                      key={st.statusKey}
                                      type="button"
                                      onClick={() => handleUpdateOrderStatus(order.orderId, st.statusKey)}
                                      disabled={adminUpdatingId === order.orderId}
                                      className={`text-[10px] font-bold uppercase tracking-wider py-1.5 px-3 rounded-full transition-all border shrink-0 cursor-pointer ${
                                        order.status === st.statusKey
                                          ? 'bg-[#5A5A40] text-white border-[#5A5A40] scale-102 shadow-xs'
                                          : 'bg-white hover:bg-stone-100 text-stone-600 border-stone-200'
                                      }`}
                                    >
                                      {st.label}
                                    </button>
                                  ))}
                                </div>

                                {/* Payment State Manual Confirms */}
                                <div className="mt-3 pt-3 border-t border-stone-200/50 flex flex-wrap items-center gap-2">
                                  <span className="text-[9px] text-stone-400 font-extrabold uppercase tracking-widest mr-1">Контроль кассы:</span>
                                  
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateOrderPaymentStatus(order.orderId, 'paid')}
                                    disabled={adminUpdatingId === order.orderId || order.paymentStatus === 'paid'}
                                    className={`text-[9.5px] font-bold uppercase tracking-wider py-1 px-3 rounded-lg transition-all border shrink-0 cursor-pointer ${
                                      order.paymentStatus === 'paid'
                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200 opacity-70 cursor-default'
                                        : 'bg-white hover:bg-emerald-50 text-emerald-700 border-emerald-200 shadow-2xs hover:scale-[1.01]'
                                    }`}
                                  >
                                    {order.paymentStatus === 'paid' ? '✓ Оплата подтверждена' : '💳 Отметить как оплачен'}
                                  </button>

                                  {order.paymentStatus === 'paid' && (
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateOrderPaymentStatus(order.orderId, order.paymentMethod === 'yookassa' ? 'unpaid' : 'pending_confirmation')}
                                      disabled={adminUpdatingId === order.orderId}
                                      className="text-[9.5px] font-bold uppercase tracking-wider py-1 px-2.5 rounded-lg bg-white hover:bg-red-50 text-red-650 border border-red-200 transition-all cursor-pointer hover:scale-[1.01]"
                                    >
                                      Отменить оплату ↩
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => handleDeleteOrder(order.orderId)}
                                    disabled={adminUpdatingId === order.orderId}
                                    className="ml-auto text-[9.5px] font-bold uppercase tracking-wider py-1 px-2.5 rounded-lg bg-white hover:bg-red-100 text-red-650 border border-red-200 transition-all cursor-pointer hover:scale-[1.01] flex items-center gap-1 shrink-0"
                                    title="Удалить заказ из базы"
                                  >
                                    <X className="w-3 h-3" /> Удалить заказ
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}

                          {adminOrders.length === 0 ? (
                            <div className="text-center py-12 text-stone-400 text-xs">Нет оформленных заказов. Нажмите «+ Тест-заказ», чтобы сгенерировать первый!</div>
                          ) : filteredOrders.length === 0 ? (
                            <div className="text-center py-12 text-stone-400 text-sm bg-white border border-stone-200 border-dashed rounded-[32px] p-8 max-w-md mx-auto my-4 shadow-sm font-sans flex flex-col items-center justify-center space-y-2">
                              <span className="text-3xl">🔎</span>
                              <p className="font-bold text-stone-700">Ничего не найдено</p>
                              <p className="text-stone-400 text-xs text-center">Заказы с выбранными параметрами дат или поисковым запросом отсутствуют.</p>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </>
                  );
                })()}
              </>
            ) : (
              /* TAB CONTENT: PRODUCT CATALOG VITRINE */
              <div className="space-y-6 animate-fade-in text-stone-850">
                {/* Product Catalog Action Bar */}
                <div className="bg-white p-5 rounded-3xl border border-stone-200/60 shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-center text-stone-850">
                  <div>
                    <h4 className="serif text-lg font-bold text-stone-850">Управление витриной салона</h4>
                    <p className="text-[10px] text-stone-400 mt-0.5 font-sans">Добавляйте новинки, корректируйте розничные цены и редактируйте букеты в реальном времени</p>
                  </div>
                  <button
                    type="button"
                    onClick={openAddProductForm}
                    className="bg-[#5A5A40] hover:bg-[#4a4a34] text-white text-[11px] font-bold px-4 py-2.5 rounded-xl uppercase tracking-wider transition-all cursor-pointer shadow-sm shrink-0 flex items-center gap-1.5"
                  >
                    <span>✨ Добавить новый букет</span>
                  </button>
                </div>

                {/* Dynamic Category Creation Card */}
                <div className="bg-white p-5 rounded-3xl border border-stone-200/60 shadow-sm">
                  <span className="text-[10px] uppercase tracking-widest text-[#5A5A40] font-extrabold bg-[#5A5A40]/10 px-2.5 py-1 rounded-md">Новая Категория</span>
                  <h4 className="serif text-sm font-bold text-stone-850 mt-2 mb-1">Создать новую категорию цветов</h4>
                  <p className="text-[10px] text-stone-400 mb-4 font-sans">Добавьте новую категорию, чтобы группировать букеты в каталоге и на главной странице</p>
                  
                  {categoryFormError && (
                    <div className="bg-red-50 text-red-700 text-xs p-3 rounded-xl border border-red-200 mb-4 font-sans">
                      ⚠️ {categoryFormError}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3 items-end">
                    <div className="flex-1 w-full">
                      <label className="text-[9px] text-stone-400 uppercase tracking-widest font-bold block mb-1">ID категории (на латинице):</label>
                      <input 
                        type="text"
                        placeholder="Например: mono-roses"
                        value={newCategoryId}
                        onChange={(e) => {
                          const val = e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '');
                          setNewCategoryId(val);
                        }}
                        className="w-full bg-stone-50 text-stone-850 border border-stone-300 px-4 py-2.5 text-xs rounded-xl focus:outline-none focus:border-[#5A5A40] font-sans"
                      />
                    </div>

                    <div className="flex-1 w-full">
                      <label className="text-[9px] text-stone-400 uppercase tracking-widest font-bold block mb-1">Название на русском:</label>
                      <input 
                        type="text"
                        placeholder="Например: Моно-розы"
                        value={newCategoryLabel}
                        onChange={(e) => setNewCategoryLabel(e.target.value)}
                        className="w-full bg-stone-50 text-stone-850 border border-stone-300 px-4 py-2.5 text-xs rounded-xl focus:outline-none focus:border-[#5A5A40] font-sans"
                      />
                    </div>

                    <button
                      type="button"
                      disabled={isCategorySaving}
                      onClick={handleCreateCategory}
                      className="bg-[#5A5A40] hover:bg-[#4a4a34] disabled:opacity-50 text-white text-[11px] font-bold px-6 py-3 rounded-xl uppercase tracking-wider transition-all cursor-pointer shadow-sm shrink-0 flex items-center justify-center gap-1.5 h-[38px] w-full sm:w-auto"
                    >
                      {isCategorySaving ? 'Создание...' : '➕ Создать категорию'}
                    </button>
                  </div>

                  {/* Existing Categories List with delete support */}
                  <div className="mt-6 pt-5 border-t border-stone-100">
                    <span className="text-[9px] text-stone-400 uppercase tracking-widest font-bold block mb-3">Существующие категории на сайте:</span>
                    <div className="flex flex-wrap gap-2">
                      {categories.map((c) => (
                        <div 
                          key={c.id} 
                          className="flex items-center gap-2 bg-stone-50 border border-stone-200 px-3 py-1.5 rounded-xl text-xs text-stone-700"
                        >
                          <span className="font-semibold">{c.label}</span>
                          <span className="text-[10px] text-stone-400 font-mono">({c.id})</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(c.id)}
                            className="text-stone-400 hover:text-red-600 transition-colors p-0.5 ml-1 cursor-pointer"
                            title="Удалить категорию"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Products Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 select-none">
                  {products.map((p, idx) => {
                    const categoryLabels: Record<string, string> = {
                      flowers: 'Цветы поштучно',
                      greens: 'Декоративная зелень',
                      balloons: 'Гелиевые шары',
                      author: 'Авторские букеты',
                      roses: 'Пионовидные розы',
                      spring: 'Весенняя коллекция',
                      boxes: 'Шляпные коробки'
                    };
                    const categoryLabel = categoryLabels[p.category] || p.category;

                    const isCurrentlyDragged = draggedProductId === p.id;
                    const isCurrentlyOver = draggedOverProductId === p.id;

                    return (
                      <div 
                        key={p.id}
                        draggable="true"
                        onDragStart={(e) => handleProductDragStart(e, p.id)}
                        onDragOver={(e) => handleProductDragOver(e, p.id)}
                        onDragEnd={handleProductDragEnd}
                        onDrop={(e) => handleProductDrop(e, p.id)}
                        className={`bg-white p-3.5 rounded-3xl border flex gap-3 shadow-xs hover:border-[#5A5A40]/45 transition-all text-stone-800 ${
                          isCurrentlyDragged 
                            ? 'opacity-40 border-dashed border-2 border-stone-300 scale-[0.97]' 
                            : isCurrentlyOver
                            ? 'border-[#5A5A40] bg-[#5A5A40]/5 border-2 scale-[1.01]'
                            : 'border-stone-200/60'
                        }`}
                      >
                        {/* Drag and Reorder Controls Panel */}
                        <div className="flex flex-col items-center justify-center gap-1.5 shrink-0 bg-stone-100/70 border border-stone-200/45 rounded-2xl px-1 py-1 px-1.5 self-center">
                          <button
                            type="button"
                            title="Переместить выше в каталоге"
                            disabled={idx === 0}
                            onClick={() => moveProductUp(p.id)}
                            className="p-1 rounded-lg hover:bg-stone-200 text-stone-500 hover:text-stone-800 transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          
                          <div 
                            title="Зажмите и тащите для сортировки" 
                            className="p-1 cursor-grab active:cursor-grabbing text-stone-400 hover:text-stone-600 transition-colors"
                          >
                            <GripVertical className="w-4 h-4" />
                          </div>

                          <button
                            type="button"
                            title="Переместить ниже в каталоге"
                            disabled={idx === products.length - 1}
                            onClick={() => moveProductDown(p.id)}
                            className="p-1 rounded-lg hover:bg-stone-200 text-stone-500 hover:text-stone-800 transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Image preview */}
                        <div className="w-16 h-16 rounded-2xl bg-stone-100 overflow-hidden shrink-0 border border-stone-200 self-center">
                          <img
                            src={p.imageSrc || 'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?q=80&w=600&auto=format&fit=crop'}
                            alt={p.name}
                            referrerPolicy="no-referrer"
                            style={parseImageClassNameToStyle(p.imageClassName)}
                            className="w-full h-full object-cover pointer-events-none select-none"
                          />
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                              <span className="text-[8.5px] font-extrabold uppercase tracking-widest px-2 py-0.5 bg-stone-150 text-stone-500 rounded-md">
                                {categoryLabel}
                              </span>
                              {p.popular && (
                                <span className="text-[8.5px] font-extrabold uppercase tracking-widest px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded-md">
                                  🔥 Хит
                                </span>
                              )}
                            </div>
                            <h5 className="font-bold text-xs text-stone-850 truncate">{p.name}</h5>
                            <p className="text-[9.5px] text-stone-400 mt-0.5 line-clamp-1">{p.description || 'Нет описания.'}</p>
                            <span className="text-xs font-black text-rose-800 mt-1 block font-mono">
                              {p.price} ₽
                            </span>
                          </div>

                          {/* Control buttons */}
                          <div className="flex gap-2 justify-end mt-2">
                            <button
                              type="button"
                              onClick={() => openEditProductForm(p)}
                              className="text-[10px] font-bold uppercase tracking-wider py-1 px-3 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-lg border border-stone-200/80 transition-colors cursor-pointer"
                            >
                              ⚙️ Изменить
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteProduct(p.id)}
                              className="text-[10px] font-bold uppercase tracking-wider py-1 px-3 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg border border-red-100 transition-colors cursor-pointer"
                            >
                              🗑️ Удалить
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ─── IN-ADMIN PRODUCT ADD/EDIT MODAL OVERLAY ─── */}
            {isProductFormOpen && (
              <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-[#f5f5f0] text-stone-850 rounded-[36px] max-w-lg w-full p-6 md:p-8 card-shadow border border-stone-200 relative animate-fade-in max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center border-b border-stone-200 pb-4 mb-4">
                    <h4 className="serif text-lg font-bold text-stone-850 animate-fade-in">
                      {editingProduct ? 'Редактировать товар' : 'Добавить букет на витрину'}
                    </h4>
                    <button
                      type="button"
                      onClick={() => setIsProductFormOpen(false)}
                      className="p-1 rounded-full bg-stone-200 hover:bg-stone-300 transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4 text-stone-600" />
                    </button>
                  </div>

                  <form onSubmit={handleSaveProduct} className="space-y-4">
                    {productFormError && (
                      <div className="bg-red-50 text-red-700 text-xs p-3 rounded-xl border border-red-200">
                        ⚠️ {productFormError}
                      </div>
                    )}

                    <div>
                      <label className="text-[10px] text-stone-400 uppercase tracking-widest font-bold block mb-1">Название товара/букета:</label>
                      <input
                        type="text"
                        required
                        value={productForm.name}
                        onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                        placeholder="Например: Пышное Розовое Облако"
                        className="w-full bg-white text-stone-800 border border-stone-300 px-4 py-2.5 text-xs rounded-xl focus:outline-none focus:border-[#5A5A40] transition-colors font-sans"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] text-stone-400 uppercase tracking-widest font-bold block mb-1">Категория:</label>
                        <select
                          value={productForm.category}
                          onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                          className="w-full bg-white text-stone-800 border border-stone-300 px-3 py-2.5 text-xs rounded-xl focus:outline-none focus:border-[#5A5A40] transition-colors font-sans"
                        >
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>{cat.label}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] text-stone-400 uppercase tracking-widest font-bold block mb-1">Цена (в ₽):</label>
                        <input
                          type="number"
                          required
                          min="1"
                          value={productForm.price || ''}
                          onChange={(e) => setProductForm({ ...productForm, price: Number(e.target.value) })}
                          placeholder="2500"
                          className="w-full bg-white text-stone-800 border border-stone-300 px-4 py-2.5 text-xs rounded-xl focus:outline-none focus:border-[#5A5A40] transition-colors font-sans"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-stone-400 uppercase tracking-widest font-bold block mb-1">Краткое описание:</label>
                      <textarea
                        value={productForm.description}
                        onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                        placeholder="Роскошное сочетание нежных пионовидных роз..."
                        rows={2}
                        className="w-full bg-white text-stone-800 border border-stone-300 px-4 py-2.5 text-xs rounded-xl focus:outline-none focus:border-[#5A5A40] transition-colors font-sans resize-none"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-stone-400 uppercase tracking-widest font-bold block mb-1">Состав букета (через запятую):</label>
                      <input
                        type="text"
                        value={productForm.composition}
                        onChange={(e) => setProductForm({ ...productForm, composition: e.target.value })}
                        placeholder="Роза Kahala — 9 шт, Эвкалипт — 4 шт"
                        className="w-full bg-white text-stone-800 border border-stone-300 px-4 py-2.5 text-xs rounded-xl focus:outline-none focus:border-[#5A5A40] transition-colors font-sans font-medium"
                      />
                    </div>

                    <div>
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            handleImageFile(e.target.files[0]);
                          }
                        }}
                        className="hidden"
                      />

                      <label className="text-[10px] text-stone-400 uppercase tracking-widest font-bold block mb-1">Изображение букета:</label>
                      
                      {productForm.imageSrc ? (
                        <div className="bg-white border border-stone-200 rounded-3xl p-4 space-y-4">
                          {/* Rich Interactive Drag Area */}
                          <div className="text-center font-sans">
                            <span className="text-[10.5px] font-bold text-stone-500">Регулировка положения и обрезки букета:</span>
                            <p className="text-[9.5px] text-stone-400 mt-0.5">Управляйте сдвигом прямо мышкой на картинке или ползунками ниже</p>
                          </div>

                          <div
                            onMouseDown={handleDragStart}
                            onMouseMove={handleDragMove}
                            onMouseUp={handleDragEnd}
                            onMouseLeave={handleDragEnd}
                            onTouchStart={handleTouchStartOffset}
                            onTouchMove={handleTouchMoveOffset}
                            onTouchEnd={handleDragEnd}
                            className="w-full max-w-[250px] aspect-square mx-auto rounded-2xl relative overflow-hidden bg-stone-100 shadow-inner group border border-stone-200 select-none touch-none cursor-move"
                          >
                            <img 
                              src={productForm.imageSrc} 
                              alt="Preview adjusting" 
                              referrerPolicy="no-referrer"
                              style={{
                                transform: `scale(${imgZoom / 100})`,
                                objectPosition: `${imgOffsetX}% ${imgOffsetY}%`,
                                transformOrigin: 'center'
                              }}
                              className="w-full h-full object-cover transition-none pointer-events-none select-none" 
                            />
                            
                            {/* Visual Crop Guidelines Helper Grid */}
                            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-40 group-hover:opacity-75 transition-opacity duration-300">
                              <div className="border-r border-b border-dashed border-stone-300/40"></div>
                              <div className="border-r border-b border-dashed border-stone-300/40"></div>
                              <div className="border-b border-dashed border-stone-300/40"></div>
                              <div className="border-r border-b border-dashed border-stone-300/40"></div>
                              <div className="border-r border-b border-dashed border-stone-300/40"></div>
                              <div className="border-b border-dashed border-stone-300/40"></div>
                              <div className="border-r border-dashed border-stone-300/40"></div>
                              <div className="border-r border-dashed border-stone-300/40"></div>
                              <div></div>
                            </div>

                            {/* Center Target Indicator overlay */}
                            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center pointer-events-none">
                              <div className="w-1.5 h-1.5 bg-stone-800/20 rounded-full border border-white/40"></div>
                            </div>
                          </div>

                          {/* Adjustment Sliders */}
                          <div className="space-y-3 pt-1">
                            {/* Zoom control */}
                            <div>
                              <div className="flex justify-between text-[10px] text-stone-500 font-bold mb-1">
                                <span>🔍 Размер (Масштаб):</span>
                                <span className="text-[#5A5A40] font-mono">{imgZoom}%</span>
                              </div>
                              <input 
                                type="range"
                                min="100" 
                                max="250" 
                                step="1"
                                value={imgZoom}
                                onChange={(e) => setImgZoom(Number(e.target.value))}
                                className="w-full accent-[#5A5A40] h-1.5 bg-stone-100 rounded-lg appearance-none cursor-pointer"
                              />
                            </div>

                            {/* Y axis control */}
                            <div>
                              <div className="flex justify-between text-[10px] text-stone-500 font-bold mb-1">
                                <span>↕️ Положение по высоте (Y):</span>
                                <span className="text-[#5A5A40] font-mono">{imgOffsetY}%</span>
                              </div>
                              <input 
                                type="range"
                                min="0" 
                                max="100" 
                                step="1"
                                value={imgOffsetY}
                                onChange={(e) => setImgOffsetY(Number(e.target.value))}
                                className="w-full accent-[#5A5A40] h-1.5 bg-stone-100 rounded-lg appearance-none cursor-pointer"
                              />
                              <div className="flex justify-between text-[8px] text-stone-400 font-semibold px-0.5 mt-0.5">
                                <span>Вверх</span>
                                <span>Вниз</span>
                              </div>
                            </div>

                            {/* X axis control */}
                            <div>
                              <div className="flex justify-between text-[10px] text-stone-500 font-bold mb-1">
                                <span>↔️ Положение по ширине (X):</span>
                                <span className="text-[#5A5A40] font-mono">{imgOffsetX}%</span>
                              </div>
                              <input 
                                type="range"
                                min="0" 
                                max="100" 
                                step="1"
                                value={imgOffsetX}
                                onChange={(e) => setImgOffsetX(Number(e.target.value))}
                                className="w-full accent-[#5A5A40] h-1.5 bg-stone-100 rounded-lg appearance-none cursor-pointer"
                              />
                              <div className="flex justify-between text-[8px] text-stone-400 font-semibold px-0.5 mt-0.5">
                                <span>Влево</span>
                                <span>Вправо</span>
                              </div>
                            </div>
                          </div>

                          {/* Quick Photo Actions */}
                          <div className="flex gap-2 pt-2 border-t border-stone-100 text-xs">
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="flex-1 bg-white border border-stone-300 hover:border-stone-400 text-stone-700 font-bold py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 text-[11px]"
                            >
                              📂 Заменить файл
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setProductForm(prev => ({ ...prev, imageSrc: '' }));
                              }}
                              className="bg-red-50 hover:bg-red-100 text-red-650 font-bold py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 text-[11px]"
                              title="Удалить фото"
                            >
                              <X className="w-3.5 h-3.5" /> Удалить
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          onDragOver={(e) => {
                            e.preventDefault();
                            setIsDraggingImage(true);
                          }}
                          onDragLeave={() => setIsDraggingImage(false)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setIsDraggingImage(false);
                            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                              handleImageFile(e.dataTransfer.files[0]);
                            }
                          }}
                          onClick={() => fileInputRef.current?.click()}
                          className={`border-2 border-dashed rounded-3xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[140px] relative overflow-hidden ${
                            isDraggingImage 
                              ? 'border-[#5A5A40] bg-[#5A5A40]/5' 
                              : 'border-stone-300 hover:border-[#5A5A40]/60 bg-white'
                          }`}
                        >
                          <div className="flex flex-col items-center gap-2 py-2">
                            <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-400">
                              <UploadCloud className="w-5 h-5" />
                            </div>
                            <div className="text-xs text-stone-700">
                              <span className="font-bold text-[#5A5A40] hover:underline">Загрузить файл</span> или перетащить сюда
                            </div>
                            <p className="text-[9px] text-stone-400">PNG, JPG, JPEG, WEBP весом до 10 МБ</p>
                          </div>
                        </div>
                      )}

                      <div className="mt-2 bg-stone-100 rounded-xl p-2 border border-stone-200/50">
                        <details className="group">
                          <summary className="text-[9px] font-bold text-stone-500 uppercase tracking-wider cursor-pointer select-none flex items-center gap-1.5 list-none">
                            <span className="transition-transform group-open:rotate-90">▶</span>
                            Или вставить ссылку в текстовом формате (URL)
                          </summary>
                          <div className="mt-2 pt-1.5 border-t border-stone-250/20">
                            <input
                              type="text"
                              value={productForm.imageSrc.startsWith('data:') ? '' : productForm.imageSrc}
                              onChange={(e) => setProductForm({ ...productForm, imageSrc: e.target.value })}
                              placeholder="https://images.unsplash.com/..."
                              className="w-full bg-white text-stone-800 border border-stone-300 px-3 py-2 text-[10.5px] rounded-lg focus:outline-none focus:border-[#5A5A40] transition-colors font-sans"
                            />
                            {productForm.imageSrc.startsWith('data:') && (
                              <p className="text-[9px] text-[#5A5A40] mt-1 font-semibold">
                                📁 Используется ваш загруженный локальный файл
                              </p>
                            )}
                          </div>
                        </details>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1 font-sans">
                      <input
                        type="checkbox"
                        id="formPopular"
                        checked={productForm.popular}
                        onChange={(e) => setProductForm({ ...productForm, popular: e.target.checked })}
                        className="w-4 h-4 rounded-sm border-stone-300 text-[#5A5A40] focus:ring-[#5A5A40] cursor-pointer"
                      />
                      <label htmlFor="formPopular" className="text-xs text-stone-600 font-bold select-none cursor-pointer">
                        🔥 Отметить как ХИТ (Популярный букет)
                      </label>
                    </div>

                    <div className="flex gap-3 pt-3">
                      <button
                        type="button"
                        onClick={() => setIsProductFormOpen(false)}
                        className="flex-1 bg-stone-200 hover:bg-stone-300 text-stone-700 text-xs font-bold py-3 rounded-xl uppercase tracking-wider transition-colors cursor-pointer"
                      >
                        Отмена
                      </button>
                      <button
                        type="submit"
                        disabled={productFormSaving}
                        className="flex-1 bg-[#5A5A40] hover:bg-[#4a4a34] text-white text-xs font-bold py-3 px-6 rounded-xl uppercase tracking-wider transition-colors cursor-pointer"
                      >
                        {productFormSaving ? 'Сохранение...' : 'Сохранить'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
