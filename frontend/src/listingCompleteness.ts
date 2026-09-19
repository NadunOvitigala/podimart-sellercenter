import type { Product } from "./types";

export type CompletenessResult = {
  score: number;
  tips: string[];
};

export function listingCompleteness(product: Product): CompletenessResult {
  const tips: string[] = [];
  let score = 0;
  const hasPhoto = Boolean(
    (product.image_url && product.image_url.trim()) ||
      (product.image_urls && product.image_urls.some((url: string) => url.trim())),
  );
  const hasPrice =
    product.price > 0 || (product.variants ?? []).some((item) => item.price > 0);
  const hasDescription = Boolean(product.description?.trim());
  const hasLead = Boolean(product.lead_time?.trim());
  const hasDeliveryNote = Boolean(product.delivery_note?.trim());
  const hasPayment = (product.payment_methods ?? []).length > 0;
  const offersPickup = product.offers_pickup !== false;
  const offersDelivery = product.offers_delivery !== false;

  if (hasPhoto) score += 25;
  else tips.push("Add a photo");

  if (hasPrice) score += 25;
  else tips.push("Add a price");

  if (hasDescription) score += 15;
  else tips.push("Add a short description");

  if (hasLead) score += 15;
  else tips.push("Add lead / ready time");

  if (hasDeliveryNote || product.delivery_charge !== undefined) score += 10;
  else tips.push("Add delivery info");

  if (offersPickup || offersDelivery) score += 5;
  else tips.push("Mark pickup or delivery");

  if (hasPayment) score += 5;
  else tips.push("Choose payment methods");

  if (tips.length === 0) tips.push("Looking good — share your listing");

  return { score: Math.min(100, score), tips };
}
