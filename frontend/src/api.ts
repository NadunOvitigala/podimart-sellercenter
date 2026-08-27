import type { AuthResponse, Category, Order, Product, Seller, ShopDraft } from "./types";

const API = import.meta.env.VITE_API_URL || "/api";
const TOKEN_KEY = "podimart_seller_token";
const SHOP_DRAFT_KEY = "podimart_shop_draft";

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getShopDraft(): ShopDraft | null {
  const raw = sessionStorage.getItem(SHOP_DRAFT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ShopDraft;
  } catch {
    return null;
  }
}

export function setShopDraft(draft: ShopDraft | null): void {
  if (draft) sessionStorage.setItem(SHOP_DRAFT_KEY, JSON.stringify(draft));
  else sessionStorage.removeItem(SHOP_DRAFT_KEY);
}

export function mediaUrl(url: string | undefined): string {
  if (!url) return "";
  if (url.startsWith("http") || url.startsWith("/images") || url.startsWith("/uploads")) {
    return url;
  }
  return url;
}

let authToken: string | null = getStoredToken();

export function setAuthToken(token: string | null): void {
  authToken = token;
  setStoredToken(token);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (authToken) headers.set("Authorization", `Bearer ${authToken}`);
  const res = await fetch(`${API}${path}`, { ...init, headers });
  if (!res.ok) {
    let detail = "Something went wrong.";
    try {
      const body = (await res.json()) as { detail?: string };
      detail = body.detail || detail;
    } catch {
      /* keep default */
    }
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

let pendingCoverFile: File | null = null;

export function setPendingCover(file: File | null): void {
  pendingCoverFile = file;
}

export function getPendingCover(): File | null {
  return pendingCoverFile;
}

export async function savePendingCover(): Promise<void> {
  const file = pendingCoverFile;
  pendingCoverFile = null;
  if (!file) return;
  const { url } = await api.upload(file);
  await api.updateMe({ avatar_url: url });
}

export const api = {
  categories: () => request<Category[]>("/categories"),
  cities: () => request<string[]>("/cities"),
  contact: (body: { name: string; email: string; message: string; source?: string }) =>
    request<{ ok: boolean }>("/contact", { method: "POST", body: JSON.stringify(body) }),
  product: (id: string) =>
    request<{ product: Product; seller: Seller | null }>(`/products/${id}`),
  signup: (body: Record<string, string>) =>
    request<AuthResponse>("/auth/signup", { method: "POST", body: JSON.stringify(body) }),
  login: (email: string, password: string) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<{ seller: Seller; products: Product[] }>("/me"),
  myOrders: () => request<Order[]>("/me/orders"),
  confirmOrder: (orderId: string) =>
    request<{ order: Order; buyer_notified: boolean; already_confirmed: boolean }>(
      `/me/orders/${encodeURIComponent(orderId)}/confirm`,
      { method: "POST" },
    ),
  bootstrap: (body: ShopDraft) =>
    request<{ seller: Seller; products: Product[] }>("/me/bootstrap", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateMe: (body: Record<string, string>) =>
    request<Seller>("/me", { method: "PUT", body: JSON.stringify(body) }),
  createProduct: (body: Record<string, unknown>) =>
    request<Product>("/products", { method: "POST", body: JSON.stringify(body) }),
  updateProduct: (id: string, body: Record<string, unknown>) =>
    request<Product>(`/products/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  setProductStatus: (id: string, status: "active" | "disabled") =>
    request<Product>(`/products/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  deleteProduct: (id: string) => request<{ ok: boolean }>(`/products/${id}`, { method: "DELETE" }),
  deleteShop: () => request<{ ok: boolean }>("/me", { method: "DELETE" }),
  upload: async (file: File) => {
    const data = new FormData();
    data.append("file", file);
    return request<{ url: string }>("/media/upload", { method: "POST", body: data });
  },
};

export function formatPrice(value: number): string {
  return `Rs ${value.toLocaleString("en-LK")}`;
}

export function displayPrice(value: number): string {
  if (!value || value <= 0) return "Contact for price";
  return formatPrice(value);
}

export function productCode(product: { id: string; code?: string }): string {
  if (product.code?.trim()) return product.code.trim().toUpperCase();
  return product.id ? `PM-${product.id.slice(0, 6).toUpperCase()}` : "";
}
