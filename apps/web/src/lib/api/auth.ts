import { apiClient } from './client';

export interface LoginRequest {
  email: string;
  password: string;
  totpCode?: string;
}

export const authApi = {
  login: async (data: LoginRequest) => {
    const response = await apiClient.post('/auth/login', data);
    return response.data.data ?? response.data;
  },

  refresh: async (refreshToken: string) => {
    const response = await apiClient.post('/auth/refresh', { refreshToken });
    return response.data.data ?? response.data;
  },

  logout: async (refreshToken?: string) => {
    await apiClient.post('/auth/logout', { refreshToken });
  },

  me: async () => {
    const response = await apiClient.get('/auth/me');
    return response.data.data ?? response.data;
  },
};
