export interface EmailCampaign {
  id: string;
  brand: string;
  subject: string;
  date: string;
  screenshot: string;
  campaign_theme: string;
  design_level: string;
  discount_percent: number | null;
  emotional_tone: string;
  event_or_seasonality: string | null;
  flow_type: string | null;
  flow_vs_campaign: string;
  image_vs_text_ratio: number;
  num_products_featured: number;
  personalization_used: boolean;
  social_proof_used: boolean;
  unsubscribe_visible: boolean;
  visual_content: EmailBlock[];
  estimated_revenue?: number;
  sender_domain?: string;
  store_id?: string;
  gpt_analysis?: any;
  merchant_name?: string;
  platform_domain?: string;
  platform?: string;
  country_code?: string;
  region?: string;
  subregion?: string;
  location?: string;
  state?: string;
  description?: string;
  avg_price?: number;
  product_count?: number;
  employee_count?: number;
  estimated_sales_yearly?: number;
  categories?: string;
}

export interface EmailBlock {
  block_index: number;
  columns: number | null;
  copy: string;
  cta: string | null;
  desc: string;
  has_button: boolean;
  has_image: boolean;
  role: string;
  style: string;
}

export interface FilterOptions {
  brand: string;
  dateRange: string;
  theme: string;
  designLevel: string;
}