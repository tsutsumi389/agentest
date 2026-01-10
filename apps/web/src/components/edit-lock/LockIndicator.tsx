import { Lock, Pencil } from 'lucide-react';
import type { LockHolder } from '@agentest/shared';

interface LockIndicatorProps {
  /** ロック状態 */
  isLocked: boolean;
  /** 自分がロック所有者か */
  isOwnLock: boolean;
  /** ロック所有者情報 */
  lockHolder: LockHolder | null;
  /** カスタムクラス */
  className?: string;
}

/**
 * ロック状態インジケーター
 * 編集中のユーザーをリアルタイム表示
 */
export function LockIndicator({
  isLocked,
  isOwnLock,
  lockHolder,
  className = '',
}: LockIndicatorProps) {
  if (!isLocked) {
    return null;
  }

  if (isOwnLock) {
    // 自分がロック中（緑色）
    return (
      <span
        className={`badge bg-success-subtle text-success ${className}`}
        role="status"
        aria-label="編集中"
      >
        <Pencil className="w-3 h-3" />
        <span>編集中</span>
      </span>
    );
  }

  // 他者がロック中（黄色）
  return (
    <span
      className={`badge bg-warning-subtle text-warning ${className}`}
      role="status"
      aria-label={`${lockHolder?.name ?? '他のユーザー'}が編集中`}
    >
      <Lock className="w-3 h-3" />
      <span>{lockHolder?.name ?? '他のユーザー'}が編集中</span>
    </span>
  );
}

interface LockStatusIconProps {
  /** ロック状態 */
  isLocked: boolean;
  /** 自分がロック所有者か */
  isOwnLock: boolean;
  /** アイコンサイズ */
  size?: 'sm' | 'md';
  /** カスタムクラス */
  className?: string;
}

/**
 * ロック状態アイコン
 * リスト表示などで使用するコンパクトバージョン
 */
export function LockStatusIcon({
  isLocked,
  isOwnLock,
  size = 'sm',
  className = '',
}: LockStatusIconProps) {
  const sizeClass = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';

  if (!isLocked) {
    return null;
  }

  if (isOwnLock) {
    return (
      <Pencil
        className={`${sizeClass} text-success ${className}`}
        aria-label="編集中"
      />
    );
  }

  return (
    <Lock
      className={`${sizeClass} text-warning ${className}`}
      aria-label="他者が編集中"
    />
  );
}
