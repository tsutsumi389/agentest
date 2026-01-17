import type React from 'react';

/** ドーナツチャートのセグメント */
export interface DonutSegment {
  /** 一意のID */
  id: string;
  /** 表示ラベル */
  label: string;
  /** 値 */
  value: number;
  /** 色（HEXコード） */
  color: string;
}

interface DonutChartProps {
  /** セグメント配列 */
  segments: DonutSegment[];
  /** チャートサイズ（px） */
  size?: number;
  /** ドーナツの太さ（0-1の比率） */
  thickness?: number;
  /** 中央に表示するコンテンツ */
  centerContent?: React.ReactNode;
  /** 空状態のメッセージ */
  emptyMessage?: string;
  /** アクセシビリティ用ラベル */
  ariaLabel?: string;
}

/**
 * conic-gradient用のグラデーション文字列を構築
 */
function buildConicGradient(segments: DonutSegment[], total: number): string {
  if (total === 0) {
    return '#6e7681'; // 空状態の色
  }

  const gradientParts: string[] = [];
  let currentAngle = 0;

  for (const segment of segments) {
    if (segment.value <= 0) continue;

    const segmentAngle = (segment.value / total) * 360;
    const endAngle = currentAngle + segmentAngle;

    gradientParts.push(
      `${segment.color} ${currentAngle}deg ${endAngle}deg`
    );
    currentAngle = endAngle;
  }

  // total > 0 が保証されているので、gradientParts は必ず1つ以上ある
  return `conic-gradient(${gradientParts.join(', ')})`;
}

/**
 * 汎用ドーナツチャートコンポーネント
 * CSS conic-gradient を使用した軽量実装
 */
export function DonutChart({
  segments,
  size = 160,
  thickness = 0.25,
  centerContent,
  emptyMessage = 'データがありません',
  ariaLabel,
}: DonutChartProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const isEmpty = total === 0;
  const innerSize = size * (1 - thickness * 2);

  // アクセシビリティ用の説明文を構築
  const defaultAriaLabel = isEmpty
    ? emptyMessage
    : segments
        .filter((s) => s.value > 0)
        .map((s) => `${s.label}: ${s.value}`)
        .join(', ');

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={ariaLabel || defaultAriaLabel}
    >
      {/* 外側のドーナツ */}
      <div
        className="absolute rounded-full"
        style={{
          width: size,
          height: size,
          background: buildConicGradient(segments, total),
        }}
      />

      {/* 内側の穴（中央） */}
      <div
        className="absolute rounded-full bg-background-secondary flex items-center justify-center"
        style={{
          width: innerSize,
          height: innerSize,
        }}
      >
        {isEmpty ? (
          <span className="text-foreground-muted text-xs text-center px-2">
            {emptyMessage}
          </span>
        ) : (
          centerContent
        )}
      </div>
    </div>
  );
}
