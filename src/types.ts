export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  imageSrc: string;
  category: 'all' | 'author' | 'roses' | 'spring' | 'boxes' | 'flowers' | 'greens' | 'balloons' | string;
  composition: string[];
  tags: string[];
  rating: number;
  popular?: boolean;
  imageClassName?: string;
  order?: number;
}

export interface Review {
  id: string;
  author: string;
  rating: number;
  comment: string;
  date: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  cardMessage?: string;
  comment?: string;
}

export interface OrderData {
  items: {
    productId: string;
    name: string;
    quantity: number;
    price: number;
  }[];
  customerName: string;
  customerPhone: string;
  deliveryType: 'delivery' | 'pickup';
  address?: string;
  date?: string;
  time?: string;
  cardMessage?: string;
  totalPrice: number;
  paymentMethod?: 'cash' | 'yookassa' | string;
  paymentStatus?: 'unpaid' | 'paid' | 'pending_confirmation' | string;
}

export interface ConsultantMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  suggestedProducts?: Product[];
}

export interface FilterState {
  category: 'all' | 'author' | 'roses' | 'spring' | 'boxes' | 'flowers' | 'greens' | 'balloons' | string;
  maxPrice: number;
  search: string;
}
