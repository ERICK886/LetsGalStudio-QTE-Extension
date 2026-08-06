/**
 * 文件名：qte-style.ts
 * 作者：池水三两升
 * 日期：2026-08-06
 * 版本：1.0.1
 * 描述：QTE 视觉样式默认值与从项目设置解析运行时样式
 *
 * 注意：Extension 模块 id 为 `qte` 时，宿主常把设置键存成 `qte.fieldName`。
 * 解析时必须同时兼容「无前缀」与「uiId.前缀」两种快照形态。
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

/** 模块内 settings 声明所在的 uiId（与 @extension({ id: "qte" }) 一致） */
export const QTE_SETTINGS_UI_ID = "qte";

/**
 * 从 settings 快照中按字段名取值，兼容多种键形态。
 *
 * 查找顺序：
 * 1. 裸键 `field`
 * 2. `qte.field`（模块 scope 前缀）
 * 3. 任意以 `.field` 结尾的键
 * 4. 嵌套对象 `snapshot.qte.field`
 *
 * @param snapshot - useSnapshot / snapshot() 结果
 * @param field - schema 字段名，如 `"buttonBgColor"`
 * @returns 找到的原始值；未找到则为 undefined
 */
export function pickSettingValue(
  snapshot: Record<string, unknown> | null | undefined,
  field: string,
): unknown {
  if (!snapshot) {
    return undefined;
  }

  if (Object.prototype.hasOwnProperty.call(snapshot, field)) {
    return snapshot[field];
  }

  const prefixed = `${QTE_SETTINGS_UI_ID}.${field}`;
  if (Object.prototype.hasOwnProperty.call(snapshot, prefixed)) {
    return snapshot[prefixed];
  }

  for (const [key, value] of Object.entries(snapshot)) {
    if (key.endsWith(`.${field}`)) {
      return value;
    }
  }

  const nested = snapshot[QTE_SETTINGS_UI_ID];
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const bag = nested as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(bag, field)) {
      return bag[field];
    }
  }

  return undefined;
}

/**
 * 将未知值解析为可用的 CSS 颜色字符串。
 *
 * 兼容普通字符串，以及 Studio 偶发对象 `{ hex }` / `{ r,g,b,a }`。
 *
 * @param value - 设置或快照中的原始值
 * @param fallback - 回退色
 * @returns 可用的 CSS 颜色字符串
 */
function asColor(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.value === "string" && obj.value.trim().length > 0) {
      return obj.value.trim();
    }
    if (typeof obj.hex === "string" && obj.hex.trim().length > 0) {
      return obj.hex.trim();
    }
    if (typeof obj.color === "string" && obj.color.trim().length > 0) {
      return obj.color.trim();
    }
    if (
      typeof obj.r === "number" &&
      typeof obj.g === "number" &&
      typeof obj.b === "number"
    ) {
      const a = typeof obj.a === "number" ? obj.a : 1;
      return `rgba(${Math.round(obj.r)}, ${Math.round(obj.g)}, ${Math.round(obj.b)}, ${a})`;
    }
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
  let raw: unknown = value;
  if (raw && typeof raw === "object" && "value" in (raw as object)) {
    raw = (raw as { value: unknown }).value;
  }
  const n = typeof raw === "number" ? raw : Number(raw);
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
 */
export function resolveQteStyle(
  snapshot: Record<string, unknown> | null | undefined,
): QteResolvedStyle {
  return {
    outerRingColor: asColor(
      pickSettingValue(snapshot, "outerRingColor"),
      QTE_STYLE_DEFAULTS.outerRingColor,
    ),
    perfectColor: asColor(
      pickSettingValue(snapshot, "perfectColor"),
      QTE_STYLE_DEFAULTS.perfectColor,
    ),
    buttonBgColor: asColor(
      pickSettingValue(snapshot, "buttonBgColor"),
      QTE_STYLE_DEFAULTS.buttonBgColor,
    ),
    buttonTextColor: asColor(
      pickSettingValue(snapshot, "buttonTextColor"),
      QTE_STYLE_DEFAULTS.buttonTextColor,
    ),
    flashColor: asColor(
      pickSettingValue(snapshot, "flashColor"),
      QTE_STYLE_DEFAULTS.flashColor,
    ),
    ringDiameter: asClampedNumber(
      pickSettingValue(snapshot, "ringDiameter"),
      QTE_STYLE_DEFAULTS.ringDiameter,
      64,
      600,
    ),
    ringStroke: asClampedNumber(
      pickSettingValue(snapshot, "ringStroke"),
      QTE_STYLE_DEFAULTS.ringStroke,
      2,
      20,
    ),
    buttonSize: asClampedNumber(
      pickSettingValue(snapshot, "buttonSize"),
      QTE_STYLE_DEFAULTS.buttonSize,
      48,
      200,
    ),
  };
}

/**
 * 从 ExtensionContext 读取并解析 QTE 样式。
 *
 * 同时尝试多种键形态与 API，避免宿主把设置存成裸键 / `qte.xxx` 时读不到：
 * - snapshot + pickSettingValue
 * - settings.get("field")（scoped 时会自动加 uiId 前缀）
 * - settings.get("qte.field")（显式完整路径，跳过再补前缀）
 * - settings.cross.get("qte", "field")
 *
 * @param ctx - 扩展上下文
 * @returns 合并默认值后的运行时样式
 */
export function readQteStyleFromContext(ctx: {
  settings: {
    snapshot(): Record<string, unknown>;
    get<T = unknown>(key: string): T | undefined;
    cross: {
      get<T = unknown>(uiId: string, key: string): T | undefined;
    };
  };
}): QteResolvedStyle {
  const snap = ctx.settings.snapshot() ?? {};
  const merged: Record<string, unknown> = { ...snap };

  const fields = [
    "outerRingColor",
    "perfectColor",
    "buttonBgColor",
    "buttonTextColor",
    "flashColor",
    "ringDiameter",
    "ringStroke",
    "buttonSize",
  ] as const;

  for (const field of fields) {
    if (pickSettingValue(merged, field) !== undefined) {
      continue;
    }

    const fromGet = ctx.settings.get(field);
    if (fromGet !== undefined) {
      merged[field] = fromGet;
      continue;
    }

    const fromPrefixed = ctx.settings.get(`${QTE_SETTINGS_UI_ID}.${field}`);
    if (fromPrefixed !== undefined) {
      merged[field] = fromPrefixed;
      continue;
    }

    try {
      const fromCross = ctx.settings.cross.get(QTE_SETTINGS_UI_ID, field);
      if (fromCross !== undefined) {
        merged[field] = fromCross;
      }
    } catch {
      // cross 在部分宿主上可能不可用，忽略
    }
  }

  return resolveQteStyle(merged);
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
 * @param color - 主色
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
 * 将 #RGB / #RRGGBB / #RRGGBBAA 转为 rgba()。
 *
 * @param color - 十六进制颜色
 * @param alpha - 覆盖透明度 0–1
 * @returns rgba 字符串；无法解析时返回原色
 */
export function colorToRgba(color: string, alpha: number): string {
  const hex = color.trim();
  const short = /^#([0-9a-fA-F]{3})([0-9a-fA-F])?$/.exec(hex);
  if (short) {
    const [r, g, b] = short[1]!.split("").map((c) => parseInt(c + c, 16));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  const m = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})?$/.exec(hex);
  if (!m) {
    return color;
  }
  const r = parseInt(m[1]!, 16);
  const g = parseInt(m[2]!, 16);
  const b = parseInt(m[3]!, 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
