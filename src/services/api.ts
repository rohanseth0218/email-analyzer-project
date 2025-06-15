import { EmailCampaign, FilterOptions } from '../types/email';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

console.log('🔍 API_BASE_URL:', API_BASE_URL);
console.log('🔍 Environment variables:', import.meta.env);

export interface CampaignsResponse {
  campaigns: EmailCampaign[];
  total: number;
  hasMore: boolean;
}

export interface FiltersResponse {
  brands: string[];
  themes: string[];
  designLevels: string[];
}

export interface StatsResponse {
  total_campaigns: number;
  unique_brands: number;
  unique_themes: number;
  avg_products: number;
  personalized_campaigns: number;
}

class ApiService {
  private async fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }
    return response.json();
  }

  async getCampaigns(filters: FilterOptions, searchQuery: string, limit?: number, offset?: number): Promise<CampaignsResponse> {
    const params = new URLSearchParams();

    // Add pagination only if provided
    if (limit !== undefined) {
      params.append('limit', limit.toString());
    }
    if (offset !== undefined) {
      params.append('offset', offset.toString());
    }

    // Add filters
    if (filters.brand !== 'All Brands') {
      params.append('brand', filters.brand);
    }
    if (filters.dateRange !== 'All Time') {
      params.append('dateRange', filters.dateRange);
    }
    if (filters.theme !== 'All Themes') {
      params.append('theme', filters.theme);
    }
    if (filters.designLevel !== 'All Levels') {
      params.append('designLevel', filters.designLevel);
    }
    if (searchQuery) {
      params.append('search', searchQuery);
    }

    return this.fetchJson<CampaignsResponse>(`${API_BASE_URL}/api/campaigns?${params}`);
  }

  async getFilters(): Promise<FiltersResponse> {
    return this.fetchJson<FiltersResponse>(`${API_BASE_URL}/api/filters`);
  }

  async getStats(): Promise<StatsResponse> {
    return this.fetchJson<StatsResponse>(`${API_BASE_URL}/api/stats`);
  }

  async getCampaignDetails(campaignId: string): Promise<{ campaign: EmailCampaign; queryTime: number }> {
    return this.fetchJson<{ campaign: EmailCampaign; queryTime: number }>(`${API_BASE_URL}/api/campaigns/${campaignId}`);
  }

  async getStoreDetails(domain: string): Promise<{ store: any; queryTime: number }> {
    return this.fetchJson<{ store: any; queryTime: number }>(`${API_BASE_URL}/api/stores/${domain}`);
  }

  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return this.fetchJson(`${API_BASE_URL}/health`);
  }
}

export const apiService = new ApiService(); 