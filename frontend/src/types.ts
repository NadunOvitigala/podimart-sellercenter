export type Category = {
  id: string;
  name: string;
  blurb: string;
  image: string;
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

export type Product = {
  id: string;
  seller_id: string;
  seller_slug: string;
  seller_name: string;
  city: string;
  category: string;
  name: string;
  description: string;
  price: number;
  lead_time: string;
  image_url: string;
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
