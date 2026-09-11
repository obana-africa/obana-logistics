import axios, { AxiosInstance, AxiosError } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3006';

interface ApiResponse<T = any> {
  data?: T;
  message?: string;
  status?: string;
  error?: string;
  success?: boolean;
}

interface AuthTokens {
  access_token: string;
  refresh_token: string;
  user?: any;
}

// Public quote (POST /routes/quote) — no account needed.
interface QuotePlace {
  country: string;
  country_code: string;
  state: string;
  state_code: string;
  city: string;
}

interface PublicQuoteRequest {
  origin: QuotePlace;
  destination: QuotePlace;
  weight_kg: number;
  declared_value?: number;
  display_currency?: string;
}

interface PublicQuoteOption {
  id: string;
  provider: 'obana' | 'partner';
  carrier_name: string;
  logo_url: string | null;
  transport_mode: 'road' | 'air' | 'sea' | null;
  service_level: string | null;
  eta: string | null;
  price: number;
  display_price: number | null;
}

interface PublicQuote {
  currency: string;
  display_currency: string;
  fx: { rate: number; as_of: string; source: string } | null;
  options: PublicQuoteOption[];
  cheapest_id: string;
  fastest_id: string | null;
  expires_at: string;
}

// Stores & API: a business account connects stores (website, Shopify, app), each with its own API key.
type StoreStatus = 'active' | 'paused';

interface Store {
  id: number | string;
  name: string;
  website_url: string | null;
  status: StoreStatus;
  /** e.g. "obk_live_…Ab3x" — the full key is only returned by createStore and rotateStoreKey. */
  api_key_hint: string;
  api_key_created_at: string;
  last_used_at: string | null;
  webhook_url: string | null;
  /** Owner calls only; not included in the admin list. */
  webhook_secret?: string;
  created_at: string;
  shipments_count?: number;
  /** Admin list (GET /stores?all=1) only. */
  owner?: { id: number | string; email: string | null; phone: string | null } | null;
}

interface StoreDetail extends Store {
  stats: { total: number; by_status: Partial<Record<string, number>> };
}

interface StoreWithKey {
  store: Store;
  api_key: string;
}

interface StoreInput {
  name?: string;
  website_url?: string | null;
  webhook_url?: string | null;
  status?: StoreStatus;
}

interface StoreWebhookTest {
  ok: boolean;
  code: number | null;
  delivery_id: number | string | null;
}

interface StoreWebhookDelivery {
  id: number | string;
  event: string;
  shipment_id: number | string | null;
  status: 'pending' | 'delivered' | 'failed';
  attempts: number;
  response_code: number | null;
  next_attempt_at: string | null;
  delivered_at: string | null;
  created_at: string;
}

interface StoreShipment {
  id: number | string;
  reference: string;
  order_id: string | null;
  status: string;
  customer: { id: number | string | null; name: string | null; email: string | null; phone: string | null } | null;
  carrier: { type: 'obana' | 'partner'; name: string | null; tracking_number?: string | null } | null;
  shipping_fee: number | string | null;
  currency: string | null;
  tracking_url: string | null;
  destination: { name: string | null; city: string | null; state: string | null; country: string | null } | null;
  created_at: string;
  updated_at: string;
}

interface StoreShipmentPage {
  shipments: StoreShipment[];
  pagination: { total: number; page: number; pages: number; limit: number };
}

interface StoreShipmentQuery {
  status?: string;
  order_id?: string;
  customer_id?: string;
  q?: string;
  page?: number;
  limit?: number;
}

interface StoreCustomer {
  customer_id: number | string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  shipments: number;
  delivered: number;
  in_progress: number;
  total_fees: number | string;
  last_shipment_at: string | null;
}

interface RegisterTenantResponse {
  id: number;
  name: string;
  slug: string;
  base_url: string;
  description?: string;
  api_key: string;
  message?: string;
}
class ApiClient {
  private client: AxiosInstance;
  private accessToken: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.loadTokens();
    this.setupInterceptors();
  }

  private loadTokens() {
    if (typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('access_token');
      const token = localStorage.getItem('refresh_token');
      if (token) {
        this.client.defaults.headers.common['Authorization'] = `Bearer ${this.accessToken}`;
      }
    }
  }

  private setupInterceptors() {
    this.client.interceptors.request.use((config) => {
      if (this.accessToken) {
        config.headers.Authorization = `Bearer ${this.accessToken}`;
      }
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as any;

        
        if (originalRequest.url?.includes('/users/token') || originalRequest.url?.includes('/users/logout')) {
          return Promise.reject(error);
        }

        if ((error.response?.status === 401 || error.response?.status === 403) && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const refreshToken = localStorage.getItem('refresh_token');
            if (refreshToken) {
              const response = await this.client.post('/users/token', {
                refresh_token: refreshToken,
              });

              const { access_token } = response.data.data;
              this.accessToken = access_token;
              localStorage.setItem('access_token', access_token);
              this.client.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
              originalRequest.headers['Authorization'] = `Bearer ${access_token}`;
              return this.client(originalRequest);
            }
          } catch (refreshError) {
            this.logout();
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  
  async signup(first_name: string, last_name: string, email: string, phone: string, password: string, role: string, additionalData?: any) {
    const response = await this.client.post<ApiResponse>('/users/signup', {
      first_name,
      last_name,
      email,
      phone,
      password,
      role,
      ...additionalData
    });
    return response;
  }

  async login(userIdentification: string, password: string, rememberMe: boolean = false) {
    const response = await this.client.post<ApiResponse>('/users/login', {
      user_identification: userIdentification,
      password,
      remember_me: rememberMe,
    });

    if (response.data?.data) {
      const tokens = response.data.data;
      const { access_token, refresh_token } = tokens;
      this.accessToken = access_token;
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      this.client.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
    }
    
    return response;
  }


  async getProfile() {
    const response = await this.client.get<ApiResponse>('/users/profile');
    return response.data;
  }

  async updateProfile(data: any) {
    const response = await this.client.put<ApiResponse>('/users/profile', data);
    return response.data;
  }

  async changePassword(oldPassword: string, newPassword: string) {
    const response = await this.client.post<ApiResponse>('/users/change-password', {
      old_password: oldPassword,
      password: newPassword,
    });
    return response.data;
  }

  async logout(refresh_token?: string | null) {
    try {
      await this.client.delete('/users/logout', {
        data: { refresh_token }
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      this.accessToken = null;
      delete this.client.defaults.headers.common['Authorization'];

      if (typeof window !== 'undefined' && !window.location.pathname.includes('/auth/login')) {
        window.location.href = '/auth/login';
      }
    }
  }

  // Routes endpoints
  async listRoutes() {
    const response = await this.client.get<ApiResponse>('/routes');
    return response.data;
  }

  async getRoute(id: string) {
    const response = await this.client.get<ApiResponse>(`/routes/${id}`);
    return response.data;
  }

  async createRoute(data: any) {
    const response = await this.client.post<ApiResponse>('/routes', data);
    return response.data;
  }

  async updateRoute(id: string, data: any) {
    const response = await this.client.put<ApiResponse>(`/routes/${id}`, data);
    return response.data;
  }

  async deleteRoute(id: string) {
    const response = await this.client.delete<ApiResponse>(`/routes/${id}`);
    return response.data;
  }

  async matchRoute(arg1: any, arg2?: string, arg3?: string, arg4?: string, arg5?: string) {
    let payload;
    if (typeof arg1 !== 'object') {
      payload = {
        weight: arg1,
        origin_city: arg2,
        destination_city: arg3,
        transport_mode: arg4,
        service_level: arg5,
      };
    } else {
      payload = arg1;
    }
    const response = await this.client.post<ApiResponse>('/routes/match', payload);
    return response.data;
  }

  // Public, rate-limited price check for anyone (signed in or not). Sent with plain axios rather than
  // this.client, so it carries no Authorization header and a 401 can never trigger the refresh/logout flow.
  async getPublicQuote(body: PublicQuoteRequest) {
    const response = await axios.post<ApiResponse<PublicQuote>>(`${API_BASE_URL}/routes/quote`, body, {
      headers: { 'Content-Type': 'application/json' },
    });
    return response.data;
  }

  // Tenant/Business endpoints
  async registerTenant(name: string, slug: string, base_url: string, description: string) {
    const response = await this.client.post<ApiResponse<RegisterTenantResponse>>('/tenants/register', {
      name,
      slug,
      base_url,
      description,
    });
    return response.data;
  }

  // Stores & API (signed-in owner; admins can list every store with all=true).
  async listStores(all = false) {
    const response = await this.client.get<ApiResponse<Store[]>>('/stores', { params: all ? { all: 1 } : undefined });
    return response.data;
  }

  async createStore(data: { name: string; website_url?: string; webhook_url?: string }) {
    const response = await this.client.post<ApiResponse<StoreWithKey>>('/stores', data);
    return response.data;
  }

  async getStore(id: string | number) {
    const response = await this.client.get<ApiResponse<StoreDetail>>(`/stores/${encodeURIComponent(String(id))}`);
    return response.data;
  }

  async updateStore(id: string | number, data: StoreInput) {
    const response = await this.client.put<ApiResponse<Store>>(`/stores/${encodeURIComponent(String(id))}`, data);
    return response.data;
  }

  async rotateStoreKey(id: string | number) {
    const response = await this.client.post<ApiResponse<StoreWithKey>>(`/stores/${encodeURIComponent(String(id))}/rotate-key`);
    return response.data;
  }

  async rotateWebhookSecret(id: string | number) {
    const response = await this.client.post<ApiResponse<Store>>(`/stores/${encodeURIComponent(String(id))}/webhook-secret`);
    return response.data;
  }

  async testStoreWebhook(id: string | number) {
    const response = await this.client.post<ApiResponse<StoreWebhookTest>>(`/stores/${encodeURIComponent(String(id))}/test-webhook`);
    return response.data;
  }

  async listStoreWebhooks(id: string | number) {
    const response = await this.client.get<ApiResponse<StoreWebhookDelivery[]>>(`/stores/${encodeURIComponent(String(id))}/webhooks`);
    return response.data;
  }

  async listStoreShipments(id: string | number, params: StoreShipmentQuery = {}) {
    // Leave out empty filters so the backend only sees the ones in use.
    const query = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
    const response = await this.client.get<ApiResponse<StoreShipmentPage>>(`/stores/${encodeURIComponent(String(id))}/shipments`, { params: query });
    return response.data;
  }

  async listStoreCustomers(id: string | number) {
    const response = await this.client.get<ApiResponse<StoreCustomer[]>>(`/stores/${encodeURIComponent(String(id))}/customers`);
    return response.data;
  }


  async createShipment(data: any) {
    const response = await this.client.post<ApiResponse>('/shipments', data);
    return response.data;
  }

  async getAllShipments(filters?: any) {
    const response = await this.client.get<ApiResponse>('/shipments', { params: filters });
    return response.data;
  }
 
  async listShipments(userId: number, filters?: any) {
    const response = await this.client.get<ApiResponse>(`/shipments/users/${userId}`, {params: filters });
    return response.data;
  }

  async getAllUsers() {
    const response = await this.client.get<ApiResponse>('/users');
    return response.data;
  }

  async getAdminStats() {
    const response = await this.client.get<ApiResponse>('/shipments/admin/stats');
    return response.data;
  }

  async getAgentStats() {
    const response = await this.client.get<ApiResponse>('/shipments/agent/stats');
    return response.data;
  }

  async getCustomerStats() {
    const response = await this.client.get<ApiResponse>('/shipments/customer/stats');
    return response.data;
  }

  async getShipment(id: string) {
    const response = await this.client.get<ApiResponse>(`/shipments/track/${id}`);
    return response.data;
  }

  
  async getPublicShipment(id: string) {
    const response = await this.client.get<ApiResponse>(`/shipments/public/track/${id}`);
    return response.data;
  }

  async updateShipmentStatus(id: string, status: string, notes?: string, location?: string) {
    const response = await this.client.put<ApiResponse>(`/shipments/status/${id}`, {
      status,
      notes,
      location,
    });
    return response.data;
  }

  async confirmExternalShipment(shipmentId: string) {
    const response = await this.client.post<ApiResponse>(`/shipments/confirm-external/${shipmentId}`);
    return response.data;
  }

  async assignDriver(shipmentId: string, driverId: string) {
    const response = await this.client.put<ApiResponse>(`/shipments/${shipmentId}/assign-driver`, { driver_id: driverId });
    return response.data;
  }

  async deleteShipment(id: string) {
    const response = await this.client.delete<ApiResponse>(`/shipments/${id}`);
    return response.data;
  }

  // Agents endpoints (for Admin)
  async listAgents() {
    const response = await this.client.get<ApiResponse>('/agents');
    return response.data;
  }

  async getAgent(id: string) {
    const response = await this.client.get<ApiResponse>(`/agents/${id}`);
    return response.data;
  }

  async updateAgent(id: string, data: any) {
    const response = await this.client.put<ApiResponse>(`/agents/${id}`, data);
    return response.data;
  }

  async deleteAgent(id: string) {
    const response = await this.client.delete<ApiResponse>(`/agents/${id}`);
    return response.data;
  }

  // Drivers endpoints
  async listDrivers() {
    const response = await this.client.get<ApiResponse>('/users?role=driver');
    return response.data;
  }

  async getDriver(id: string) {
    const response = await this.client.get<ApiResponse>(`/users/${id}`);
    return response.data;
  }

  async createDriver(data: any) {
    const response = await this.client.post<ApiResponse>('/users', {
      ...data,
      account_type: 'driver',
    });
    return response.data;
  }

  async updateDriver(id: string, data: any) {
    const response = await this.client.put<ApiResponse>(`/users/${id}`, data);
    return response.data;
  }

  async deleteDriver(id: string) {
    const response = await this.client.delete<ApiResponse>(`/users/${id}`);
    return response.data;
  }

  // Partner carriers & markup (admin). Partners are added automatically when a quote returns their rates.
  async listPartners() {
    const response = await this.client.get<ApiResponse>('/partners');
    return response.data;
  }

  async updatePartnerDefaults(data: { markup_percent: number }) {
    const response = await this.client.put<ApiResponse>('/partners/default', data);
    return response.data;
  }

  async updatePartner(slug: string, data: { enabled?: boolean; markup_percent?: number | null }) {
    const response = await this.client.put<ApiResponse>(`/partners/${encodeURIComponent(slug)}`, data);
    return response.data;
  }

  // Send an Obana-fleet shipment to a partner carrier (admin): live priced options, then book the chosen one.
  async getPartnerQuotes(shipmentId: string) {
    const response = await this.client.post<ApiResponse>(`/routes/partner-quotes/${shipmentId}`);
    return response.data;
  }

  async pushToPartner(shipmentId: string, data: { rate_id: string; terminal_shipment_id: string; carrier_name?: string }) {
    const response = await this.client.post<ApiResponse>(`/shipments/push-to-partner/${shipmentId}`, data);
    return response.data;
  }

  // Requests endpoints
  async listRequests() {
    const response = await this.client.get<ApiResponse>('/requests');
    return response.data;
  }

  async getRequest(id: string) {
    const response = await this.client.get<ApiResponse>(`/requests/${id}`);
    return response.data;
  }

  // Location endpoints (Terminal Africa)
  async getCountries() {
    const response = await this.client.get<ApiResponse>('/locations/countries');
    return response.data;
  }

  async getStates(countryCode: string) {
    const response = await this.client.get<ApiResponse>(`/locations/states?country_code=${countryCode}`);
    return response.data;
  }

  async getCities(countryCode: string, stateCode: string) {
    const response = await this.client.get<ApiResponse>(`/locations/cities?country_code=${countryCode}&state_code=${stateCode}`);
    return response.data;
  }
}

export const apiClient = new ApiClient();
export type {
  ApiResponse,
  AuthTokens,
  PublicQuote,
  PublicQuoteOption,
  PublicQuoteRequest,
  Store,
  StoreCustomer,
  StoreDetail,
  StoreInput,
  StoreShipment,
  StoreShipmentPage,
  StoreShipmentQuery,
  StoreStatus,
  StoreWebhookDelivery,
  StoreWebhookTest,
  StoreWithKey,
};
