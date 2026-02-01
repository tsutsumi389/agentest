import { useState } from 'react';

/** 折れ線グラフのデータポイント */
export interface LineChartDataPoint {
  /** X軸ラベル（日付等） */
  label: string;
  /** 値 */
  value: number;
}

interface LineChartProps {
  /** データポイント配列 */
  data: LineChartDataPoint[];
  /** チャートの幅（px） */
  width?: number;
  /** チャートの高さ（px） */
  height?: number;
  /** 線の色 */
  strokeColor?: string;
  /** 塗りつぶしの色（グラデーション用） */
  fillColor?: string;
  /** 空状態のメッセージ */
  emptyMessage?: string;
  /** アクセシビリティ用ラベル */
  ariaLabel?: string;
  /** X軸ラベルの表示間隔（0で非表示） */
  xLabelInterval?: number;
  /** Y軸の目盛り数 */
  yTickCount?: number;
  /** ツールチップを表示するか */
  showTooltip?: boolean;
}

/**
 * SVGの折れ線パスを構築
 */
function buildLinePath(
  data: LineChartDataPoint[],
  chartWidth: number,
  chartHeight: number,
  padding: { top: number; right: number; bottom: number; left: number }
): string {
  if (data.length === 0) return '';

  const values = data.map((d) => d.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue || 1;

  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;

  const points = data.map((d, i) => {
    const x = padding.left + (i / (data.length - 1 || 1)) * plotWidth;
    const y = padding.top + plotHeight - ((d.value - minValue) / range) * plotHeight;
    return { x, y };
  });

  // パスを構築
  const pathParts = points.map((p, i) => {
    return i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`;
  });

  return pathParts.join(' ');
}

/**
 * 塗りつぶし用のパスを構築
 */
function buildAreaPath(
  data: LineChartDataPoint[],
  chartWidth: number,
  chartHeight: number,
  padding: { top: number; right: number; bottom: number; left: number }
): string {
  if (data.length === 0) return '';

  const linePath = buildLinePath(data, chartWidth, chartHeight, padding);
  if (!linePath) return '';

  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;
  const bottomY = padding.top + plotHeight;
  const startX = padding.left;
  const endX = padding.left + plotWidth;

  // 線のパス + 下端を閉じる
  return `${linePath} L ${endX} ${bottomY} L ${startX} ${bottomY} Z`;
}

/**
 * Y軸の目盛り値を計算
 */
function calculateYTicks(data: LineChartDataPoint[], tickCount: number): number[] {
  if (data.length === 0) return [];

  const values = data.map((d) => d.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);

  // 最小値と最大値が同じ場合
  if (minValue === maxValue) {
    return [minValue];
  }

  const ticks: number[] = [];
  const step = (maxValue - minValue) / (tickCount - 1);

  for (let i = 0; i < tickCount; i++) {
    ticks.push(Math.round(minValue + step * i));
  }

  return ticks;
}

/**
 * 汎用折れ線グラフコンポーネント
 * SVGベースの軽量実装
 */
export function LineChart({
  data,
  width = 600,
  height = 300,
  strokeColor = '#58a6ff',
  fillColor = 'rgba(88, 166, 255, 0.1)',
  emptyMessage = 'データがありません',
  ariaLabel,
  xLabelInterval = 5,
  yTickCount = 5,
  showTooltip = true,
}: LineChartProps) {
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const isEmpty = data.length === 0;

  // Y軸の目盛り
  const yTicks = calculateYTicks(data, yTickCount);
  const minValue = data.length > 0 ? Math.min(...data.map((d) => d.value)) : 0;
  const maxValue = data.length > 0 ? Math.max(...data.map((d) => d.value)) : 0;
  const range = maxValue - minValue || 1;

  const plotHeight = height - padding.top - padding.bottom;
  const plotWidth = width - padding.left - padding.right;

  // データポイントの座標を計算
  const dataPoints = data.map((d, i) => {
    const x = padding.left + (i / (data.length - 1 || 1)) * plotWidth;
    const y = padding.top + plotHeight - ((d.value - minValue) / range) * plotHeight;
    return { x, y, ...d };
  });

  // アクセシビリティ用の説明文を構築
  const defaultAriaLabel = isEmpty
    ? emptyMessage
    : `折れ線グラフ: ${data.length}データポイント、最小${minValue}、最大${maxValue}`;

  // ツールチップ状態
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <div className="relative">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel || defaultAriaLabel}
        className="select-none"
      >
        {/* グラデーション定義 */}
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fillColor} stopOpacity="0.8" />
            <stop offset="100%" stopColor={fillColor} stopOpacity="0" />
          </linearGradient>
        </defs>

        {isEmpty ? (
          <text
            x={width / 2}
            y={height / 2}
            textAnchor="middle"
            className="fill-foreground-muted text-sm"
          >
            {emptyMessage}
          </text>
        ) : (
          <>
            {/* Y軸グリッド線と目盛り */}
            {yTicks.map((tick) => {
              const y = padding.top + plotHeight - ((tick - minValue) / range) * plotHeight;
              return (
                <g key={tick}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={width - padding.right}
                    y2={y}
                    stroke="var(--border)"
                    strokeDasharray="4,4"
                    strokeOpacity="0.5"
                  />
                  <text
                    x={padding.left - 8}
                    y={y + 4}
                    textAnchor="end"
                    className="fill-foreground-muted text-xs"
                  >
                    {tick.toLocaleString()}
                  </text>
                </g>
              );
            })}

            {/* X軸ライン */}
            <line
              x1={padding.left}
              y1={height - padding.bottom}
              x2={width - padding.right}
              y2={height - padding.bottom}
              stroke="var(--border)"
            />

            {/* X軸ラベル */}
            {xLabelInterval > 0 &&
              data.map((d, i) => {
                if (i % xLabelInterval !== 0 && i !== data.length - 1) return null;
                const x = padding.left + (i / (data.length - 1 || 1)) * plotWidth;
                return (
                  <text
                    key={d.label}
                    x={x}
                    y={height - padding.bottom + 20}
                    textAnchor="middle"
                    className="fill-foreground-muted text-xs"
                  >
                    {d.label}
                  </text>
                );
              })}

            {/* 塗りつぶしエリア */}
            <path
              d={buildAreaPath(data, width, height, padding)}
              fill="url(#areaGradient)"
            />

            {/* 折れ線 */}
            <path
              d={buildLinePath(data, width, height, padding)}
              fill="none"
              stroke={strokeColor}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* データポイント（インタラクティブ） */}
            {showTooltip &&
              dataPoints.map((point, i) => (
                <g key={point.label}>
                  {/* 透明な大きめの領域でホバー検出 */}
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r="12"
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIndex(i)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  />
                  {/* 可視のドット */}
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={hoveredIndex === i ? 6 : 4}
                    fill={strokeColor}
                    className="transition-all duration-150"
                  />
                </g>
              ))}
          </>
        )}
      </svg>

      {/* ツールチップ */}
      {showTooltip && hoveredIndex !== null && dataPoints[hoveredIndex] && (
        <div
          className="absolute pointer-events-none bg-background-secondary border border-border rounded px-2 py-1 text-sm shadow-lg z-tooltip"
          style={{
            left: dataPoints[hoveredIndex].x,
            top: dataPoints[hoveredIndex].y - 40,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="text-foreground-muted text-xs">{dataPoints[hoveredIndex].label}</div>
          <div className="text-foreground font-medium">
            {dataPoints[hoveredIndex].value.toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}
