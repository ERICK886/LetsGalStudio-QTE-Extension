/**
 * 文件名：qte-style.ts
 * 作者：池水三两升
 * 日期：2026-08-06
 * 版本：1.0.0
 * 描述：QTE 视觉样式默认值与从项目设置解析运行时样式
 */

/**
 * QTE 运行时样式（已合并默认值）。
 */
export interface QteResolvedStyle {
  /** 外环描边颜色 */
  outerRingColor: string;
  /** Perfect 内环 / 高亮颜色 */
  perfectColor: string;
  /** 中心按钮背景色 */
  buttonBgColor: string;
  /** 中心按钮文字色 */
  buttonTextColor: string;
  /** Perfect 命中闪光色 */
  flashColor: string;
  /** 外环基准直径（px） */
  ringDiameter: number;
  /** 环描边粗细（px） */
  ringStroke: number;
  /** 中心按钮直径（px） */
  buttonSize: number;
}

/**
 * 样式字段默认值（与扩展 settings schema 的 default 保持一致）。
 */
export const QTE_STYLE_DEFAULTS: QteResolvedStyle = {
  outerRingColor: "#FFFFFFB8",
  perfectColor: "#FFD66B",
  buttonBgColor: "#1E2838D1",
  buttonTextColor: "#FFFFFF",
  flashColor: "#FFD66BB3",
  ringDiameter: 320,
  ringStroke: 6,
  buttonSize: 88,
};

/**
 * 将未知值解析为非空颜色字符串。
 *
 * @param value - 设置或快照中的原始值
 * @param fallback - 回退色
 * @returns 可用的 CSS 颜色字符串
 */
function asColor(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return fallback;
}

/**
 * 将未知值解析为落在 [min, max] 内的有限数字。
 *
 * @param value - 原始值
 * @param fallback - 回退值
 * @param min - 最小值
 * @param max - 最大值
 * @returns 裁剪后的数字
 */
function asClampedNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, n));
}

/**
 * 从扩展 settings 快照解析完整样式。
 *
 * @param snapshot - `ctx.settings.snapshot()` 或 `useSnapshot()` 的结果
 * @returns 合并默认值后的运行时样式
 *
 * @example
 * const style = resolveQteStyle(ctx.settings.snapshot());
 */
export function resolveQteStyle(
  snapshot: Record<string, unknown> | null | undefined,
): QteResolvedStyle {
  const s = snapshot ?? {};

  return {
    outerRingColor: asColor(s.outerRingColor, QTE_STYLE_DEFAULTS.outerRingColor),
    perfectColor: asColor(s.perfectColor, QTE_STYLE_DEFAULTS.perfectColor),
    buttonBgColor: asColor(s.buttonBgColor, QTE_STYLE_DEFAULTS.buttonBgColor),
    buttonTextColor: asColor(s.buttonTextColor, QTE_STYLE_DEFAULTS.buttonTextColor),
    flashColor: asColor(s.flashColor, QTE_STYLE_DEFAULTS.flashColor),
    ringDiameter: asClampedNumber(s.ringDiameter, QTE_STYLE_DEFAULTS.ringDiameter, 120, 600),
    ringStroke: asClampedNumber(s.ringStroke, QTE_STYLE_DEFAULTS.ringStroke, 2, 20),
    buttonSize: asClampedNumber(s.buttonSize, QTE_STYLE_DEFAULTS.buttonSize, 48, 200),
  };
}

/**
 * 将 0–100 的百分比坐标裁剪到合法区间。
 *
 * @param value - 原始百分比
 * @param fallback - 非法时的回退（默认 50）
 * @returns [0, 100] 内的数字
 */
export function clampPercent(value: unknown, fallback = 50): number {
  return asClampedNumber(value, fallback, 0, 100);
}

/**
 * 根据主色生成略透明的「暗淡」边框色（Perfect 窗外态）。
 *
 * 若无法解析 hex，则原样返回。
 *
 * @param color - 主色（支持 #RGB / #RRGGBB / #RRGGBBAA）
 * @returns 带透明度的颜色或原色
 */
export function dimColor(color: string): string {
  const hex = color.trim();
  const m = /^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/.exec(hex);
  if (!m) {
    return color;
  }
  return `#${m[1]}73`;
}

/**
 * 根据主色生成外发光 box-shadow。
 *
 * @param color - 主色
 * @param strong - 是否高亮（Perfect 窗内）
 * @returns CSS box-shadow 字符串
 */
export function glowShadow(color: string, strong: boolean): string {
  const alpha = strong ? 0.55 : 0.22;
  const blur = strong ? 16 : 8;
  return `0 0 ${blur}px rgba(0, 0, 0, 0), 0 0 ${blur}px ${colorToRgba(color, alpha)}`;
}

/**
 * 将 #RRGGBB / #RRGGBBAA 转为 rgba()。
 *
 * @param color - 十六进制颜色
 * @param alpha - 覆盖透明度 0–1
 * @returns rgba 字符串；无法解析时返回原色
 */
export function colorToRgba(color: string, alpha: number): string {
  const hex = color.trim();
  const m = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})?$/.exec(hex);
  if (!m) {
    return color;
  }
  const r = parseInt(m[1]!, 16);
  const g = parseInt(m[2]!, 16);
  const b = parseInt(m[3]!, 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
