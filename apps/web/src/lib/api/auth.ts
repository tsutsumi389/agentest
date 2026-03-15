import { api } from './client.js';
import type { User, LoginResponse, TwoFactorSetupResponse } from './types.js';

// ============================================
// 認証API
// ============================================

export const authApi = {
  me: () => api.get<{ user: User }>('/api/auth/me'),
  refresh: () => api.post<{ accessToken: string; refreshToken: string }>('/api/auth/refresh'),
  logout: () => api.post<{ message: string }>('/api/auth/logout'),
  login: (data: { email: string; password: string }) =>
    api.post<LoginResponse>('/api/auth/login', data),
  register: (data: { email: string; password: string; name: string }) =>
    api.post<{
      message: string;
      user: { id: string; email: string; name: string };
      emailVerificationSkipped?: boolean;
    }>('/api/auth/register', data),
  verifyEmail: (token: string) =>
    api.get<{ message: string }>(`/api/auth/verify-email?token=${encodeURIComponent(token)}`),
  resendVerification: (data: { email: string }) =>
    api.post<{ message: string }>('/api/auth/resend-verification', data),
  forgotPassword: (data: { email: string }) =>
    api.post<{ message: string }>('/api/auth/forgot-password', data),
  resetPassword: (data: { token: string; password: string }) =>
    api.post<{ message: string }>('/api/auth/reset-password', data),

  // 2FA関連
  get2FAStatus: () => api.get<{ totpEnabled: boolean }>('/api/auth/2fa/status'),
  setup2FA: () => api.post<TwoFactorSetupResponse>('/api/auth/2fa/setup'),
  enable2FA: (code: string) => api.post<{ message: string }>('/api/auth/2fa/enable', { code }),
  verify2FA: (twoFactorToken: string, code: string) =>
    api.post<{ user: User }>('/api/auth/2fa/verify', { twoFactorToken, code }),
  disable2FA: (password: string) =>
    api.post<{ message: string }>('/api/auth/2fa/disable', { password }),
};
