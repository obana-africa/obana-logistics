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

  async matchRoute(weight: number, origin: string, destination: string, transport_mode: string, service_level: string) {
    const response = await this.client.post<ApiResponse>('/routes/match', {
      weight,
      origin_city: origin,
      destination_city: destination,
      transport_mode,
      service_level,
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

  async updateShipmentStatus(id: string, status: string, notes?: string, location?: string) {
    const response = await this.client.put<ApiResponse>(`/shipments/status/${id}`, {
      status,
      notes,
      location,
    });
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
export type { ApiResponse, AuthTokens };
