export type PaymentMethod = "cash" | "card" | "other";

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: "Espèces",
  card: "Carte",
  other: "Autre",
};

export type ShopSettings = {
  payment_methods: Record<PaymentMethod, { enabled: boolean; label: string }>;
  security: {
    require_pin: boolean;
    admin_session_minutes: number;
  };
};

export const DEFAULT_SHOP_SETTINGS: ShopSettings = {
  payment_methods: {
    cash: { enabled: true, label: "Espèces" },
    card: { enabled: true, label: "Carte" },
    other: { enabled: true, label: "Autre" },
  },
  security: {
    require_pin: false,
    admin_session_minutes: 15,
  },
};

// Fusionne les settings stockés (partiels) avec les défauts, colonne par colonne.
export function withShopSettingsDefaults(stored: Partial<ShopSettings> | null | undefined): ShopSettings {
  return {
    payment_methods: {
      cash: { ...DEFAULT_SHOP_SETTINGS.payment_methods.cash, ...stored?.payment_methods?.cash },
      card: { ...DEFAULT_SHOP_SETTINGS.payment_methods.card, ...stored?.payment_methods?.card },
      other: { ...DEFAULT_SHOP_SETTINGS.payment_methods.other, ...stored?.payment_methods?.other },
    },
    security: { ...DEFAULT_SHOP_SETTINGS.security, ...stored?.security },
  };
}

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
