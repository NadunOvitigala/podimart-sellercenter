export type Subcategory = {
  id: string;
  name: string;
};

export type Category = {
  id: string;
  name: string;
  blurb: string;
  image: string;
  subcategories?: Subcategory[];
};

export type Seller = {
  id: string;
  name: string;
  slug: string;
  city: string;
  bio: string;
  avatar_url: string;
  whatsapp: string;
  phone: string;
  email_public: string;
  pickup_notes: string;
  delivery_notes: string;
  product_count?: number;
};

export type ProductVariant = {
  id: string;
  label: string;
  price: number;
};

export type Product = {
  id: string;
  seller_id: string;
  seller_slug: string;
  seller_name: string;
  city: string;
  category: string;
  subcategory?: string;
  name: string;
  description: string;
  price: number;
  lead_time: string;
  delivery_charge?: number;
  delivery_note?: string;
  offers_pickup?: boolean;
  offers_delivery?: boolean;
  image_url: string;
  image_urls?: string[];
  video_urls?: string[];
  code?: string;
  payment_methods?: string[];
  variation_type?: string;
  variation_type_label?: string;
  variants?: ProductVariant[];
  status?: "active" | "disabled";
  created_at: string;
};

export type AuthResponse = {
  token: string;
  seller: Seller | null;
};

export type ShopDraft = {
  name: string;
  city: string;
  whatsapp: string;
  phone: string;
};

export type Order = {
  id: string;
  reference: string;
  status: string;
  product_id: string;
  product_name: string;
  product_code: string;
  seller_id: string;
  seller_name: string;
  quantity: number;
  unit_price: number;
  items_total: number;
  delivery_charge: number;
  total: number;
  total_label: string;
  variant_label: string;
  payment_method: string;
  payment_method_label: string;
  buyer_name: string;
  buyer_phone: string;
  buyer_email: string;
  note: string;
  timeline?: OrderTimelineEntry[];
  created_at: string;
  confirmed_at?: string;
  completed_at?: string;
};

export type OrderTimelineEntry = {
  id: string;
  message: string;
  created_at: string;
  author?: string;
  buyer_notified?: boolean;
};
