export type PaymentMethod = "cash" | "card" | "other";

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: "Espèces",
  card: "Carte",
  other: "Autre",
};

export type Barber = {
  id: string;
  shop_id: string;
  display_name: string;
  color: string;
  pin_hash: string | null;
  active: boolean;
};

// owner-only, jamais synchronisé à la tablette
export type BarberPrivate = {
  barber_id: string;
  shop_id: string;
  commission_pct: number;
};

export type Service = {
  id: string;
  shop_id: string;
  name: string;
  price: number;
  category: string;
  sort_order: number;
  active: boolean;
};

export type Sale = {
  id: string;
  shop_id: string;
  barber_id: string;
  payment_method: PaymentMethod;
  total: number;
  status: "completed" | "refunded";
  created_at: string;
  device_id: string | null;
};

export type SaleItem = {
  id: string;
  sale_id: string;
  service_id: string | null;
  name_snapshot: string;
  price_snapshot: number;
  qty: number;
};

export function formatEUR(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}
