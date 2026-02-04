import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAdminAuth } from '../useAdminAuth';
import { useAdminAuthStore } from '../../stores/admin-auth.store';
import { createMockAdminUser } from '../../__tests__/factories';

describe('useAdminAuth', () => {
  beforeEach(() => {
    useAdminAuthStore.setState({
      admin: null,
      isAuthenticated: false,
      isLoading: false,
      requires2FA: false,
      error: null,
    });
  });

  it('未認証状態を返す', () => {
    const { result } = renderHook(() => useAdminAuth());
    expect(result.current.admin).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.requires2FA).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('認証済み状態を返す', () => {
    const mockAdmin = createMockAdminUser();
    useAdminAuthStore.setState({
      admin: mockAdmin,
      isAuthenticated: true,
    });

    const { result } = renderHook(() => useAdminAuth());
    expect(result.current.admin).toEqual(mockAdmin);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('ローディング状態を返す', () => {
    useAdminAuthStore.setState({ isLoading: true });
    const { result } = renderHook(() => useAdminAuth());
    expect(result.current.isLoading).toBe(true);
  });

  it('2FA必須状態を返す', () => {
    useAdminAuthStore.setState({
      requires2FA: true,
      admin: createMockAdminUser({ totpEnabled: true }),
    });
    const { result } = renderHook(() => useAdminAuth());
    expect(result.current.requires2FA).toBe(true);
  });

  it('アクション関数が含まれる', () => {
    const { result } = renderHook(() => useAdminAuth());
    expect(typeof result.current.initialize).toBe('function');
    expect(typeof result.current.login).toBe('function');
    expect(typeof result.current.verify2FA).toBe('function');
    expect(typeof result.current.logout).toBe('function');
    expect(typeof result.current.clearError).toBe('function');
  });
});
