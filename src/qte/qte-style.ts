/**
 * QTE visual style contract shared by the runtime and the Studio style lab.
 *
 * All fields are deliberately flat. LetsGal stores extension settings by key,
 * so a flat document remains compatible with old projects and can be updated
 * atomically by the custom editor without a second persistence format.
 */

export type QteRingShape = "circle" | "rounded-square" | "diamond";
export type QteRingPattern = "solid" | "dashed" | "segmented";
export type QteButtonShape = "circle" | "rounded" | "diamond";
export type QtePromptWeight = "regular" | "semibold" | "bold";
export type QteProgressMode = "none" | "time" | "percent";

export interface QteResolvedStyle {
  overlayColor: string;
  overlayBlur: number;
  outerRingColor: string;
  outerTrackColor: string;
  perfectColor: string;
  tickColor: string;
  buttonBgColor: string;
  buttonTextColor: string;
  buttonBorderColor: string;
  buttonAccentColor: string;
  promptColor: string;
  promptBgColor: string;
  progressColor: string;
  flashColor: string;
  ringShape: QteRingShape;
  ringPattern: QteRingPattern;
  buttonShape: QteButtonShape;
  promptWeight: QtePromptWeight;
  progressMode: QteProgressMode;
  ringDiameter: number;
  ringStroke: number;
  ringGlow: number;
  ringRotationSpeed: number;
  tickCount: number;
  tickLength: number;
  buttonSize: number;
  buttonBorderWidth: number;
  buttonFontSize: number;
  buttonShadow: number;
  buttonPulse: number;
  promptFontSize: number;
  promptOffset: number;
  promptLetterSpacing: number;
  promptPadding: number;
  promptRadius: number;
  progressFontSize: number;
  progressOffset: number;
  flashSize: number;
  flashIntensity: number;
  flashDuration: number;
  ambientGlow: number;
  sparkCount: number;
  motionSpeed: number;
}

/** New fields extend the old eight-field skin without invalidating it. */
export const QTE_STYLE_DEFAULTS: QteResolvedStyle = {
  overlayColor: "#05070B5C",
  overlayBlur: 0,
  outerRingColor: "#FFFFFFCC",
  outerTrackColor: "#FFFFFF24",
  perfectColor: "#FFD66B",
  tickColor: "#FFFFFF80",
  buttonBgColor: "#111827E8",
  buttonTextColor: "#FFFFFF",
  buttonBorderColor: "#FFFFFF5C",
  buttonAccentColor: "#FFD66B",
  promptColor: "#FFFFFF",
  promptBgColor: "#090B12B8",
  progressColor: "#FFFFFFB8",
  flashColor: "#FFD66BB3",
  ringShape: "circle",
  ringPattern: "solid",
  buttonShape: "circle",
  promptWeight: "semibold",
  progressMode: "time",
  ringDiameter: 320,
  ringStroke: 6,
  ringGlow: 28,
  ringRotationSpeed: 0,
  tickCount: 12,
  tickLength: 10,
  buttonSize: 88,
  buttonBorderWidth: 2,
  buttonFontSize: 32,
  buttonShadow: 24,
  buttonPulse: 4,
  promptFontSize: 18,
  promptOffset: 58,
  promptLetterSpacing: 0,
  promptPadding: 12,
  promptRadius: 8,
  progressFontSize: 12,
  progressOffset: 54,
  flashSize: 170,
  flashIntensity: 72,
  flashDuration: 400,
  ambientGlow: 46,
  sparkCount: 8,
  motionSpeed: 1,
};

export const QTE_STYLE_LIMITS = {
  overlayBlur: { min: 0, max: 20, step: 1, unit: "px" },
  ringDiameter: { min: 96, max: 640, step: 1, unit: "px" },
  ringStroke: { min: 1, max: 24, step: 1, unit: "px" },
  ringGlow: { min: 0, max: 80, step: 1, unit: "px" },
  ringRotationSpeed: { min: -180, max: 180, step: 5, unit: "°/s" },
  tickCount: { min: 0, max: 36, step: 1, unit: "" },
  tickLength: { min: 2, max: 28, step: 1, unit: "px" },
  buttonSize: { min: 40, max: 220, step: 1, unit: "px" },
  buttonBorderWidth: { min: 0, max: 12, step: 1, unit: "px" },
  buttonFontSize: { min: 12, max: 72, step: 1, unit: "px" },
  buttonShadow: { min: 0, max: 64, step: 1, unit: "px" },
  buttonPulse: { min: 0, max: 16, step: 1, unit: "%" },
  promptFontSize: { min: 10, max: 42, step: 1, unit: "px" },
  promptOffset: { min: 24, max: 160, step: 1, unit: "px" },
  promptLetterSpacing: { min: -1, max: 12, step: 0.1, unit: "px" },
  promptPadding: { min: 0, max: 32, step: 1, unit: "px" },
  promptRadius: { min: 0, max: 32, step: 1, unit: "px" },
  progressFontSize: { min: 9, max: 30, step: 1, unit: "px" },
  progressOffset: { min: 24, max: 160, step: 1, unit: "px" },
  flashSize: { min: 80, max: 480, step: 1, unit: "px" },
  flashIntensity: { min: 0, max: 100, step: 1, unit: "%" },
  flashDuration: { min: 120, max: 1200, step: 20, unit: "ms" },
  ambientGlow: { min: 0, max: 140, step: 1, unit: "px" },
  sparkCount: { min: 0, max: 24, step: 1, unit: "" },
  motionSpeed: { min: 0.25, max: 3, step: 0.05, unit: "×" },
} as const;

export const QTE_STYLE_ENUMS = {
  ringShape: ["circle", "rounded-square", "diamond"],
  ringPattern: ["solid", "dashed", "segmented"],
  buttonShape: ["circle", "rounded", "diamond"],
  promptWeight: ["regular", "semibold", "bold"],
  progressMode: ["none", "time", "percent"],
} as const;

export type QteStyleFieldKey = keyof QteResolvedStyle;
export type QteNumericStyleFieldKey = keyof typeof QTE_STYLE_LIMITS;
export type QteEnumStyleFieldKey = keyof typeof QTE_STYLE_ENUMS;
export type QteStyleValue = QteResolvedStyle[QteStyleFieldKey];

export const QTE_SETTINGS_UI_ID = "qte";
export const QTE_STYLE_FIELDS = Object.keys(QTE_STYLE_DEFAULTS) as QteStyleFieldKey[];

const COLOR_FIELDS = new Set<QteStyleFieldKey>([
  "overlayColor",
  "outerRingColor",
  "outerTrackColor",
  "perfectColor",
  "tickColor",
  "buttonBgColor",
  "buttonTextColor",
  "buttonBorderColor",
  "buttonAccentColor",
  "promptColor",
  "promptBgColor",
  "progressColor",
  "flashColor",
]);

export function isQteColorField(field: QteStyleFieldKey): boolean {
  return COLOR_FIELDS.has(field);
}

export function isQteNumericField(field: QteStyleFieldKey): field is QteNumericStyleFieldKey {
  return field in QTE_STYLE_LIMITS;
}

export function isQteEnumField(field: QteStyleFieldKey): field is QteEnumStyleFieldKey {
  return field in QTE_STYLE_ENUMS;
}

export function pickSettingValue(
  snapshot: Record<string, unknown> | null | undefined,
  field: string,
): unknown {
  if (!snapshot) return undefined;
  if (Object.prototype.hasOwnProperty.call(snapshot, field)) return snapshot[field];

  const prefixed = `${QTE_SETTINGS_UI_ID}.${field}`;
  if (Object.prototype.hasOwnProperty.call(snapshot, prefixed)) return snapshot[prefixed];

  for (const [key, value] of Object.entries(snapshot)) {
    if (key.endsWith(`.${field}`)) return value;
  }

  const nested = snapshot[QTE_SETTINGS_UI_ID];
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const bag = nested as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(bag, field)) return bag[field];
  }
  return undefined;
}

function asColor(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const key of ["value", "hex", "color"] as const) {
      if (typeof obj[key] === "string" && obj[key].trim()) return obj[key].trim();
    }
    if (typeof obj.r === "number" && typeof obj.g === "number" && typeof obj.b === "number") {
      const alpha = typeof obj.a === "number" ? obj.a : 1;
      return `rgba(${Math.round(obj.r)}, ${Math.round(obj.g)}, ${Math.round(obj.b)}, ${alpha})`;
    }
  }
  return fallback;
}

function asClampedNumber(value: unknown, fallback: number, min: number, max: number): number {
  let raw = value;
  if (raw && typeof raw === "object" && "value" in raw) raw = (raw as { value: unknown }).value;
  const parsed = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function asEnum<K extends QteEnumStyleFieldKey>(field: K, value: unknown): QteResolvedStyle[K] {
  const choices = QTE_STYLE_ENUMS[field] as readonly string[];
  const raw = typeof value === "string" ? value : "";
  return (choices.includes(raw) ? raw : QTE_STYLE_DEFAULTS[field]) as QteResolvedStyle[K];
}

export function normalizeQteStyleField<K extends QteStyleFieldKey>(
  field: K,
  value: unknown,
): QteResolvedStyle[K] {
  if (isQteColorField(field)) {
    return asColor(value, QTE_STYLE_DEFAULTS[field] as string) as QteResolvedStyle[K];
  }
  if (isQteNumericField(field)) {
    const limits = QTE_STYLE_LIMITS[field];
    return asClampedNumber(
      value,
      QTE_STYLE_DEFAULTS[field] as number,
      limits.min,
      limits.max,
    ) as QteResolvedStyle[K];
  }
  if (isQteEnumField(field)) return asEnum(field, value) as QteResolvedStyle[K];
  return QTE_STYLE_DEFAULTS[field];
}

export function resolveQteStyle(
  snapshot: Record<string, unknown> | null | undefined,
): QteResolvedStyle {
  const resolved = {} as QteResolvedStyle;
  for (const field of QTE_STYLE_FIELDS) {
    (resolved as Record<QteStyleFieldKey, QteStyleValue>)[field] = normalizeQteStyleField(
      field,
      pickSettingValue(snapshot, field),
    );
  }
  return resolved;
}

export function readQteStyleFromContext(ctx: {
  settings: {
    snapshot(): Record<string, unknown>;
    get<T = unknown>(key: string): T | undefined;
    cross: { get<T = unknown>(uiId: string, key: string): T | undefined };
  };
}): QteResolvedStyle {
  const snapshot = ctx.settings.snapshot() ?? {};
  const merged: Record<string, unknown> = { ...snapshot };

  for (const field of QTE_STYLE_FIELDS) {
    if (pickSettingValue(merged, field) !== undefined) continue;
    const scoped = ctx.settings.get(field);
    if (scoped !== undefined) {
      merged[field] = scoped;
      continue;
    }
    const prefixed = ctx.settings.get(`${QTE_SETTINGS_UI_ID}.${field}`);
    if (prefixed !== undefined) {
      merged[field] = prefixed;
      continue;
    }
    try {
      const cross = ctx.settings.cross.get(QTE_SETTINGS_UI_ID, field);
      if (cross !== undefined) merged[field] = cross;
    } catch {
      // Older hosts can omit cross-setting access. Defaults keep the UI usable.
    }
  }
  return resolveQteStyle(merged);
}

export function clampPercent(value: unknown, fallback = 50): number {
  return asClampedNumber(value, fallback, 0, 100);
}

export function dimColor(color: string): string {
  const match = /^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/.exec(color.trim());
  return match ? `#${match[1]}73` : color;
}

export function glowShadow(color: string, strong: boolean, blur = strong ? 16 : 8): string {
  return `0 0 ${blur}px ${colorToRgba(color, strong ? 0.58 : 0.24)}`;
}

export function colorToRgba(color: string, alpha: number): string {
  const value = color.trim();
  const short = /^#([0-9a-fA-F]{3})([0-9a-fA-F])?$/.exec(value);
  if (short) {
    const [r, g, b] = short[1]!.split("").map((part) => parseInt(part + part, 16));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const hex = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})?$/.exec(value);
  if (!hex) return color;
  return `rgba(${parseInt(hex[1]!, 16)}, ${parseInt(hex[2]!, 16)}, ${parseInt(hex[3]!, 16)}, ${alpha})`;
}
