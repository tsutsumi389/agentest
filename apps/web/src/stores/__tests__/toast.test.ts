import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useToastStore, toast } from '../toast';

describe('toast store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // ストアをリセット
    useToastStore.setState({ toasts: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('addToast', () => {
    it('トーストを追加する', () => {
      useToastStore.getState().addToast('success', 'テスト成功');
      const { toasts } = useToastStore.getState();
      expect(toasts).toHaveLength(1);
      expect(toasts[0].type).toBe('success');
      expect(toasts[0].message).toBe('テスト成功');
      expect(toasts[0].id).toBeDefined();
    });

    it('複数のトーストを追加できる', () => {
      useToastStore.getState().addToast('success', '成功');
      useToastStore.getState().addToast('error', 'エラー');
      const { toasts } = useToastStore.getState();
      expect(toasts).toHaveLength(2);
    });

    it('5秒後に自動削除される', () => {
      useToastStore.getState().addToast('info', '情報');
      expect(useToastStore.getState().toasts).toHaveLength(1);

      vi.advanceTimersByTime(5000);
      expect(useToastStore.getState().toasts).toHaveLength(0);
    });
  });

  describe('removeToast', () => {
    it('指定IDのトーストを削除する', () => {
      useToastStore.getState().addToast('success', '成功');
      const { toasts } = useToastStore.getState();
      const id = toasts[0].id;

      useToastStore.getState().removeToast(id);
      expect(useToastStore.getState().toasts).toHaveLength(0);
    });

    it('存在しないIDを指定しても安全', () => {
      useToastStore.getState().addToast('success', '成功');
      useToastStore.getState().removeToast('nonexistent');
      expect(useToastStore.getState().toasts).toHaveLength(1);
    });
  });

  describe('toastヘルパー', () => {
    it('toast.successがsuccessタイプのトーストを追加する', () => {
      toast.success('成功メッセージ');
      const { toasts } = useToastStore.getState();
      expect(toasts[0].type).toBe('success');
      expect(toasts[0].message).toBe('成功メッセージ');
    });

    it('toast.errorがerrorタイプのトーストを追加する', () => {
      toast.error('エラーメッセージ');
      const { toasts } = useToastStore.getState();
      expect(toasts[0].type).toBe('error');
    });

    it('toast.infoがinfoタイプのトーストを追加する', () => {
      toast.info('情報メッセージ');
      const { toasts } = useToastStore.getState();
      expect(toasts[0].type).toBe('info');
    });

    it('toast.warningがwarningタイプのトーストを追加する', () => {
      toast.warning('警告メッセージ');
      const { toasts } = useToastStore.getState();
      expect(toasts[0].type).toBe('warning');
    });
  });
});
