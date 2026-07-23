export type PaymentMethod = "cash" | "card" | "other";

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: "Espèces",
  card: "Carte",
  other: "Autre",
};

// 'mixed' n'est pas un mode sélectionnable : c'est le marqueur d'une vente
// réglée en plusieurs fois — le détail vit dans Sale.payments.
export type SaleMethod = PaymentMethod | "mixed";

export type SalePayment = { method: PaymentMethod; amount: number };

// Jours de semaine dans l'ordre d'affichage français.
export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: "Lundi",
  tue: "Mardi",
  wed: "Mercredi",
  thu: "Jeudi",
  fri: "Vendredi",
  sat: "Samedi",
  sun: "Dimanche",
};

// Horaires d'ouverture d'un jour ("10:00"–"19:30") ; null = fermé.
export type DayHours = { open: string; close: string } | null;

export type BookingSettings = {
  // réservation en ligne (page publique /reserver/<slug>) activée
  enabled: boolean;
  hours: Record<Weekday, DayHours>;
};

export type ShopSettings = {
  payment_methods: Record<PaymentMethod, { enabled: boolean; label: string }>;
  security: {
    require_pin: boolean;
    admin_session_minutes: number;
  };
  booking: BookingSettings;
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
  booking: {
    enabled: false,
    hours: {
      mon: { open: "09:00", close: "19:00" },
      tue: { open: "09:00", close: "19:00" },
      wed: { open: "09:00", close: "19:00" },
      thu: { open: "09:00", close: "19:00" },
      fri: { open: "09:00", close: "19:00" },
      sat: { open: "09:00", close: "19:00" },
      sun: null,
    },
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
    booking: {
      enabled: stored?.booking?.enabled ?? DEFAULT_SHOP_SETTINGS.booking.enabled,
      hours: { ...DEFAULT_SHOP_SETTINGS.booking.hours, ...stored?.booking?.hours },
    },
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
  // base du calcul des créneaux de réservation
  duration_min: number;
};

export type Product = {
  id: string;
  shop_id: string;
  name: string;
  price: number;
  stock: number;
  low_stock_threshold: number;
  sort_order: number;
  active: boolean;
};

export type StockReason = "sale" | "refund" | "restock" | "correction";

// owner-only : écrit par les triggers de vente et la RPC adjust_stock
export type StockMovement = {
  id: number;
  shop_id: string;
  product_id: string;
  delta: number;
  reason: StockReason;
  sale_id: string | null;
  note: string | null;
  created_at: string;
};

export const STOCK_REASON_LABELS: Record<StockReason, string> = {
  sale: "Vente",
  refund: "Remboursement",
  restock: "Réappro",
  correction: "Correction",
};

export type Sale = {
  id: string;
  shop_id: string;
  barber_id: string;
  payment_method: SaleMethod;
  // détail des encaissements : [{method:"cash",amount:20},{method:"card",amount:5}]
  payments: SalePayment[];
  total: number;
  // part prestations du total : base de calcul des commissions, les produits revendus n'y entrent pas
  services_total: number;
  status: "completed" | "refunded";
  created_at: string;
  device_id: string | null;
};

export type SaleItem = {
  id: string;
  sale_id: string;
  shop_id: string;
  item_type: "service" | "product";
  service_id: string | null;
  product_id: string | null;
  name_snapshot: string;
  price_snapshot: number;
  qty: number;
};

export type AppointmentStatus = "booked" | "done" | "cancelled" | "no_show";

export type Appointment = {
  id: string;
  shop_id: string;
  // null : résa web "sans préférence", à assigner depuis l'agenda
  barber_id: string | null;
  service_id: string | null;
  // libellé libre quand la prestation ne vient pas du catalogue
  title: string | null;
  client_name: string;
  client_phone: string | null;
  client_email: string | null;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  source: "manual" | "web";
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  booked: "Réservé",
  done: "Honoré",
  cancelled: "Annulé",
  no_show: "Absent",
};

export function formatEUR(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

// Détail des encaissements d'une vente. Les ventes enregistrées avant la
// migration 0008 (encore dans Dexie) n'ont pas de champ payments : l'ancien
// mode unique fait foi.
export function salePayments(
  sale: Pick<Sale, "payments" | "payment_method" | "total">,
): SalePayment[] {
  if (sale.payments && sale.payments.length > 0) return sale.payments;
  return [{ method: sale.payment_method as PaymentMethod, amount: Number(sale.total) }];
}

// Libellé d'affichage : "Carte" pour un paiement simple,
// "Espèces 20,00 € + Carte 5,00 €" pour un paiement mixte.
export function paymentSummary(
  sale: Pick<Sale, "payments" | "payment_method" | "total">,
): string {
  const parts = salePayments(sale);
  if (parts.length === 1) return PAYMENT_LABELS[parts[0].method];
  return parts
    .map((p) => `${PAYMENT_LABELS[p.method]} ${formatEUR(Number(p.amount))}`)
    .join(" + ");
}
