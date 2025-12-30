import { Circle, CheckCircle2, XCircle, MinusCircle, Ban, type LucideIcon } from 'lucide-react';
import type {
  PreconditionResultStatus,
  StepResultStatus,
  ExpectedResultStatus,
} from './api';

/**
 * ステータス設定の型
 */
export interface StatusConfig {
  /** アイコンコンポーネント */
  icon: LucideIcon;
  /** Tailwindの色クラス（text-...形式） */
  colorClass: string;
  /** 背景色クラス（bg-...形式、ボタン等で使用） */
  bgClass: string;
  /** ラベル（日本語） */
  label: string;
}

/**
 * ステータス選択肢の型
 */
export interface StatusOption<T extends string> {
  value: T;
  config: StatusConfig;
}

// ============================================
// 前提条件結果ステータス設定
// ============================================

export const preconditionResultStatusConfig: Record<PreconditionResultStatus, StatusConfig> = {
  UNCHECKED: {
    icon: Circle,
    colorClass: 'text-foreground-muted',
    bgClass: 'bg-background-tertiary',
    label: '未確認',
  },
  MET: {
    icon: CheckCircle2,
    colorClass: 'text-success',
    bgClass: 'bg-success-subtle',
    label: '満たす',
  },
  NOT_MET: {
    icon: XCircle,
    colorClass: 'text-danger',
    bgClass: 'bg-danger-subtle',
    label: '満たさない',
  },
};

/** 前提条件ステータスの選択肢一覧 */
export const preconditionResultStatusOptions: StatusOption<PreconditionResultStatus>[] = [
  { value: 'UNCHECKED', config: preconditionResultStatusConfig.UNCHECKED },
  { value: 'MET', config: preconditionResultStatusConfig.MET },
  { value: 'NOT_MET', config: preconditionResultStatusConfig.NOT_MET },
];

// ============================================
// ステップ結果ステータス設定
// ============================================

export const stepResultStatusConfig: Record<StepResultStatus, StatusConfig> = {
  PENDING: {
    icon: Circle,
    colorClass: 'text-foreground-muted',
    bgClass: 'bg-background-tertiary',
    label: '未実行',
  },
  DONE: {
    icon: CheckCircle2,
    colorClass: 'text-success',
    bgClass: 'bg-success-subtle',
    label: '完了',
  },
  SKIPPED: {
    icon: MinusCircle,
    colorClass: 'text-warning',
    bgClass: 'bg-warning-subtle',
    label: 'スキップ',
  },
};

/** ステップステータスの選択肢一覧 */
export const stepResultStatusOptions: StatusOption<StepResultStatus>[] = [
  { value: 'PENDING', config: stepResultStatusConfig.PENDING },
  { value: 'DONE', config: stepResultStatusConfig.DONE },
  { value: 'SKIPPED', config: stepResultStatusConfig.SKIPPED },
];

// ============================================
// 期待結果ステータス設定
// ============================================

export const expectedResultStatusConfig: Record<ExpectedResultStatus, StatusConfig> = {
  PENDING: {
    icon: Circle,
    colorClass: 'text-foreground-muted',
    bgClass: 'bg-background-tertiary',
    label: '未判定',
  },
  PASS: {
    icon: CheckCircle2,
    colorClass: 'text-success',
    bgClass: 'bg-success-subtle',
    label: 'PASS',
  },
  FAIL: {
    icon: XCircle,
    colorClass: 'text-danger',
    bgClass: 'bg-danger-subtle',
    label: 'FAIL',
  },
  SKIPPED: {
    icon: MinusCircle,
    colorClass: 'text-warning',
    bgClass: 'bg-warning-subtle',
    label: 'スキップ',
  },
  NOT_EXECUTABLE: {
    icon: Ban,
    colorClass: 'text-accent',
    bgClass: 'bg-accent-subtle',
    label: '実行不可',
  },
};

/** 期待結果ステータスの選択肢一覧 */
export const expectedResultStatusOptions: StatusOption<ExpectedResultStatus>[] = [
  { value: 'PENDING', config: expectedResultStatusConfig.PENDING },
  { value: 'PASS', config: expectedResultStatusConfig.PASS },
  { value: 'FAIL', config: expectedResultStatusConfig.FAIL },
  { value: 'SKIPPED', config: expectedResultStatusConfig.SKIPPED },
  { value: 'NOT_EXECUTABLE', config: expectedResultStatusConfig.NOT_EXECUTABLE },
];

// ============================================
// ヘルパー関数
// ============================================

/**
 * 前提条件結果ステータスの設定を取得
 */
export function getPreconditionStatusConfig(status: PreconditionResultStatus): StatusConfig {
  return preconditionResultStatusConfig[status];
}

/**
 * ステップ結果ステータスの設定を取得
 */
export function getStepStatusConfig(status: StepResultStatus): StatusConfig {
  return stepResultStatusConfig[status];
}

/**
 * 期待結果ステータスの設定を取得
 */
export function getExpectedStatusConfig(status: ExpectedResultStatus): StatusConfig {
  return expectedResultStatusConfig[status];
}
