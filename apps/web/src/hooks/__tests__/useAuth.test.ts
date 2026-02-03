import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAuth, useRequireAuth } from '../useAuth';
import { useAuthStore } from '../../stores/auth';

describe('useAuth', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  });

  describe('useAuth', () => {
    it('未認証状態を返す', () => {
      const { result } = renderHook(() => useAuth());
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('認証済み状態を返す', () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'テストユーザー',
      };
      useAuthStore.setState({
        user: mockUser as any,
        isAuthenticated: true,
        isLoading: false,
      });

      const { result } = renderHook(() => useAuth());
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('ローディング状態を返す', () => {
      useAuthStore.setState({ isLoading: true });
      const { result } = renderHook(() => useAuth());
      expect(result.current.isLoading).toBe(true);
    });

    it('エラー状態を返す', () => {
      useAuthStore.setState({ error: '認証エラー' });
      const { result } = renderHook(() => useAuth());
      expect(result.current.error).toBe('認証エラー');
    });

    it('logoutとclearError関数が含まれる', () => {
      const { result } = renderHook(() => useAuth());
      expect(typeof result.current.logout).toBe('function');
      expect(typeof result.current.clearError).toBe('function');
    });
  });

  describe('useRequireAuth', () => {
    it('ローディング中の場合はuser: null, isLoading: trueを返す', () => {
      useAuthStore.setState({ isLoading: true });
      const { result } = renderHook(() => useRequireAuth());
      expect(result.current.user).toBeNull();
      expect(result.current.isLoading).toBe(true);
    });

    it('未認証の場合はuser: null, isLoading: falseを返す', () => {
      useAuthStore.setState({
        isAuthenticated: false,
        isLoading: false,
      });
      const { result } = renderHook(() => useRequireAuth());
      expect(result.current.user).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it('認証済みの場合はユーザー情報を返す', () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'テストユーザー',
      };
      useAuthStore.setState({
        user: mockUser as any,
        isAuthenticated: true,
        isLoading: false,
      });
      const { result } = renderHook(() => useRequireAuth());
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isLoading).toBe(false);
    });
  });
});
