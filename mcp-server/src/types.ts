export interface Trend {
  id: number;
  topic: string;
  type: "horse" | "cuadra" | "phrase" | "event";
  score: number;
  mentions: number;
  growth_pct: number;
  sentiment: "positive" | "neutral" | "hype";
  first_seen: string;
  last_seen: string;
}

export interface Design {
  id: number;
  name: string;
  trend_id: number | null;
  style: string;
  brief: string;
  image_path: string | null;
  is_personal: 0 | 1;
  personal_context: string | null;
  status: "brief" | "generated" | "published";
  created_at: string;
}

export interface MerchProduct {
  id: number;
  design_id: number;
  printify_product_id: string | null;
  product_type: "shirt" | "hoodie" | "hat" | "sticker" | "mug";
  mockup_url: string | null;
  status: "draft" | "published";
  created_at: string;
}

export interface MerchListing {
  id: number;
  product_id: number;
  etsy_listing_id: string | null;
  title: string;
  description: string;
  tags: string;
  price: number;
  status: "draft" | "active" | "sold_out";
  created_at: string;
}

export interface Sale {
  id: number;
  listing_id: number;
  revenue: number;
  units: number;
  platform: string;
  sold_at: string;
}

export type DesignStyle =
  | "vintage_western"
  | "distressed_racing"
  | "bold_emblem"
  | "ranch_luxury"
  | "champion_stallion"
  | "carril_culture";
