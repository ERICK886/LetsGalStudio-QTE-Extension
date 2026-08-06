/**
 * 文件名：property-panel.tsx
 * 作者：池水三两升
 * 日期：2026-08-06
 * 版本：1.0.0
 * 描述：QTE 编辑器 —— 属性面板（右侧子面板）
 *
 * 根据当前选中层暴露的 `fields`（`QteStyleFieldKey[]`）渲染对应控件：
 * - 颜色字段：`<input type="color">` 取 #RRGGBB；若原值带 alpha
 *   （#RRGGBBAA 或 rgba()），另起 text input 编辑完整 CSS 颜色
 * - 数值字段：`<input type="range">` + number，min/max 来自 `QTE_STYLE_LIMITS`
 * - `fields` 为空且提供 `onLocalPromptChange`：渲染本地预览提示文案输入
 *   （仅本地，不写入 settings）
 * - `showFlashButton`：渲染「播放闪光预览」按钮，调用 `onFlashPreview`
 *
 * 视觉基调：深炭黑底 + 品红强调，对标 Studio 气质。
 */

import React from "react";
import {
  QTE_STYLE_LIMITS,
  type QteResolvedStyle,
  type QteStyleFieldKey,
} from "../qte-style";

/**
 * PropertyPanel 的 props 类型。
 *
 * @property fields              - 当前层应暴露的样式字段列表（由 `fieldsForLayer` 得到）
 * @property style               - 当前已解析的样式（用于回填控件值）
 * @property readOnly            - 是否只读（预览页时使用）
 * @property onChange            - 字段值变更回调
 * @property onFlashPreview      - 「播放闪光预览」回调
 * @property showFlashButton     - 是否显示「播放闪光预览」按钮
 * @property localPrompt         - 本地预览提示文案当前值
 * @property onLocalPromptChange - 本地预览提示文案变更回调
 */
export interface PropertyPanelProps {
  fields: QteStyleFieldKey[];
  style: QteResolvedStyle;
  readOnly?: boolean;
  onChange: (field: QteStyleFieldKey, value: string | number) => void;
  onFlashPreview?: () => void;
  showFlashButton?: boolean;
  localPrompt?: string;
  onLocalPromptChange?: (v: string) => void;
}

/** 颜色类样式字段集合，用于区分颜色控件与数值控件 */
const COLOR_FIELDS: ReadonlySet<QteStyleFieldKey> = new Set<QteStyleFieldKey>([
  "outerRingColor",
  "perfectColor",
  "buttonBgColor",
  "buttonTextColor",
  "flashColor",
]);

/**
 * 将任意 CSS 颜色字符串规范化为 `<input type="color">` 可用的 `#RRGGBB`。
 *
 * 只取 `#RRGGBB` 前缀；其他格式（rgba / #RGB / 命名色）回退 `#ffffff`，
 * 保证 color 控件不报错。alpha 信息由旁边的 text input 单独维护。
 *
 * @param css - 原始 CSS 颜色字符串
 * @returns 6 位 hex 颜色（`#rrggbb`）
 *
 * @example
 * toColorInputValue("#FFD66BB3"); // "#FFD66B"
 * toColorInputValue("rgba(1,2,3,0.5)"); // "#ffffff"
 */
function toColorInputValue(css: string): string {
  const m = /^#([0-9a-fA-F]{6})/.exec(css.trim());
  return m ? `#${m[1]}` : "#ffffff";
}

/**
 * 判断颜色字符串是否带 alpha 通道。
 *
 * 命中以下任一情况即视为带 alpha：
 * - 8 位 hex（`#RRGGBBAA`）
 * - `rgba(...)` 显式 alpha
 *
 * @param css - 原始 CSS 颜色字符串
 * @returns 是否带 alpha
 */
function hasAlpha(css: string): boolean {
  const trimmed = css.trim();
  if (/^#[0-9a-fA-F]{8}$/.test(trimmed)) {
    return true;
  }
  return /^rgba?\(/i.test(trimmed) && /,\s*0?\.\d+/.test(trimmed);
}

/**
 * 提取颜色字符串末尾的 alpha 后缀（hex 两位或 rgba 末段）。
 *
 * @param css - 原始 CSS 颜色字符串
 * @returns alpha 后缀字符串；无 alpha 时返回空串
 */
function extractAlphaSuffix(css: string): string {
  const trimmed = css.trim();
  const hex8 = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})$/.exec(trimmed);
  if (hex8) {
    return hex8[1]!;
  }
  const rgba = /^rgba?\(\s*([^)]+)\s*\)$/i.exec(trimmed);
  if (rgba) {
    const parts = rgba[1]!.split(",").map((p) => p.trim());
    if (parts.length === 4) {
      return parts[3]!;
    }
  }
  return "";
}

/**
 * 将 color 控件选出的 `#RRGGBB` 与原值的 alpha 后缀合成回完整 CSS 颜色。
 *
 * - 原值为 8 位 hex：拼接为 `#RRGGBBAA`
 * - 原值为 rgba()：解析出 a，重组为 `rgba(r, g, b, a)`
 * - 否则直接写 `#rrggbb`
 *
 * @param originalCss - 原始颜色值（可能带 alpha）
 * @param newRgbHex   - color 控件返回的 6 位 hex（`#RRGGBB`）
 * @returns 合成后的 CSS 颜色字符串
 */
function applyRgbKeepingAlpha(
  originalCss: string,
  newRgbHex: string,
): string {
  const trimmed = originalCss.trim();
  const hex8 = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})$/.exec(trimmed);
  if (hex8) {
    return `${newRgbHex}${hex8[1]}`.toUpperCase();
  }

  const rgba = /^rgba?\(\s*([^)]+)\s*\)$/i.exec(trimmed);
  if (rgba) {
    const parts = rgba[1]!.split(",").map((p) => p.trim());
    const a = parts.length === 4 ? parts[3]! : "1";
    const r = parseInt(newRgbHex.slice(1, 3), 16);
    const g = parseInt(newRgbHex.slice(3, 5), 16);
    const b = parseInt(newRgbHex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  return newRgbHex.toUpperCase();
}

/**
 * 字段中文标签映射，用于控件标题展示。
 */
const FIELD_LABELS: Record<QteStyleFieldKey, string> = {
  outerRingColor: "外环颜色",
  perfectColor: "Perfect 颜色",
  buttonBgColor: "按钮背景色",
  buttonTextColor: "按钮文字色",
  flashColor: "闪光颜色",
  ringDiameter: "外环直径",
  ringStroke: "环描边粗细",
  buttonSize: "按钮直径",
};

/**
 * 属性面板。
 *
 * 渲染顺序：
 * 1. 若 `fields` 非空：按顺序渲染每个字段对应控件
 * 2. 若 `fields` 为空且提供 `onLocalPromptChange`：渲染本地预览提示输入
 * 3. 若 `showFlashButton`：渲染「播放闪光预览」按钮
 *
 * @returns 属性面板 React 节点
 *
 * @example
 * <PropertyPanel
 *   fields={fieldsForLayer(selected)}
 *   style={style}
 *   onChange={handleChange}
 *   showFlashButton
 *   onFlashPreview={handleFlash}
 *   localPrompt={prompt}
 *   onLocalPromptChange={setPrompt}
 * />
 */
export const PropertyPanel: React.FC<PropertyPanelProps> = ({
  fields,
  style,
  readOnly = false,
  onChange,
  onFlashPreview,
  showFlashButton = false,
  localPrompt,
  onLocalPromptChange,
}) => {
  const showLocalPrompt =
    fields.length === 0 && typeof onLocalPromptChange === "function";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        padding: "12px 12px 16px 12px",
      }}
    >
      {fields.map((field) => {
        const value = style[field];

        if (COLOR_FIELDS.has(field)) {
          return (
            <ColorField
              key={field}
              label={FIELD_LABELS[field]}
              value={String(value)}
              readOnly={readOnly}
              onChange={(next) => onChange(field, next)}
            />
          );
        }

        return (
          <NumberField
            key={field}
            label={FIELD_LABELS[field]}
            value={Number(value)}
            readOnly={readOnly}
            min={QTE_STYLE_LIMITS[field as keyof typeof QTE_STYLE_LIMITS].min}
            max={QTE_STYLE_LIMITS[field as keyof typeof QTE_STYLE_LIMITS].max}
            onChange={(next) => onChange(field, next)}
          />
        );
      })}

      {showLocalPrompt && (
        <LocalPromptField
          value={localPrompt ?? ""}
          readOnly={readOnly}
          onChange={onLocalPromptChange!}
        />
      )}

      {showFlashButton && (
        <button
          type="button"
          onClick={onFlashPreview}
          disabled={readOnly}
          style={{
            marginTop: 4,
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid rgba(255, 77, 143, 0.5)",
            background: "rgba(255, 77, 143, 0.12)",
            color: "#ff6b9f",
            fontSize: 13,
            fontWeight: 600,
            cursor: readOnly ? "not-allowed" : "pointer",
            opacity: readOnly ? 0.5 : 1,
            transition: "background 120ms ease",
          }}
          onMouseEnter={(e) => {
            if (!readOnly) {
              e.currentTarget.style.background = "rgba(255, 77, 143, 0.22)";
            }
          }}
          onMouseLeave={(e) => {
            if (!readOnly) {
              e.currentTarget.style.background = "rgba(255, 77, 143, 0.12)";
            }
          }}
        >
          播放闪光预览
        </button>
      )}
    </div>
  );
};

/**
 * 颜色字段控件的 props 类型。
 *
 * @property label    - 字段中文标签
 * @property value    - 当前 CSS 颜色字符串
 * @property readOnly - 是否只读
 * @property onChange - 变更回调，参数为合成后的完整 CSS 颜色
 */
interface ColorFieldProps {
  label: string;
  value: string;
  readOnly: boolean;
  onChange: (next: string) => void;
}

/**
 * 颜色字段控件：color picker + 可选 alpha text input。
 *
 * - color picker 只改 RGB；若原值带 alpha，保留原 alpha 后缀
 * - 当原值带 alpha 时，额外渲染 text input 供编辑完整 CSS 颜色
 *
 * @returns 颜色字段 React 节点
 */
const ColorField: React.FC<ColorFieldProps> = ({
  label,
  value,
  readOnly,
  onChange,
}) => {
  const withAlpha = hasAlpha(value);
  const colorInputValue = toColorInputValue(value);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label
        style={{
          fontSize: 12,
          color: "#9a9aa3",
          fontWeight: 500,
        }}
      >
        {label}
      </label>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="color"
          value={colorInputValue}
          readOnly={readOnly}
          onChange={(e) => {
            const next = applyRgbKeepingAlpha(value, e.target.value);
            onChange(next);
          }}
          style={{
            width: 36,
            height: 28,
            padding: 0,
            border: "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: 6,
            background: "transparent",
            cursor: readOnly ? "default" : "pointer",
          }}
        />

        {withAlpha && (
          <input
            type="text"
            value={value}
            readOnly={readOnly}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
            style={{
              flex: 1,
              minWidth: 0,
              padding: "4px 8px",
              fontSize: 12,
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              color: "#d8d8e0",
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: 6,
              outline: "none",
            }}
          />
        )}

        {!withAlpha && (
          <span
            style={{
              fontSize: 12,
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              color: "#9a9aa3",
            }}
          >
            {value}
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * 数值字段控件的 props 类型。
 *
 * @property label    - 字段中文标签
 * @property value    - 当前数值
 * @property readOnly - 是否只读
 * @property min      - 最小值（来自 QTE_STYLE_LIMITS）
 * @property max      - 最大值（来自 QTE_STYLE_LIMITS）
 * @property onChange - 变更回调
 */
interface NumberFieldProps {
  label: string;
  value: number;
  readOnly: boolean;
  min: number;
  max: number;
  onChange: (next: number) => void;
}

/**
 * 数值字段控件：range slider + number input 并排。
 *
 * 两个控件都写回同一 `onChange`，值经裁剪后由父组件统一规范化。
 *
 * @returns 数值字段 React 节点
 */
const NumberField: React.FC<NumberFieldProps> = ({
  label,
  value,
  readOnly,
  min,
  max,
  onChange,
}) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label
        style={{
          fontSize: 12,
          color: "#9a9aa3",
          fontWeight: 500,
        }}
      >
        {label}
      </label>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          readOnly={readOnly}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{
            flex: 1,
            minWidth: 0,
            accentColor: "#ff4d8f",
            cursor: readOnly ? "default" : "pointer",
          }}
        />

        <input
          type="number"
          min={min}
          max={max}
          value={value}
          readOnly={readOnly}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) {
              onChange(n);
            }
          }}
          style={{
            width: 64,
            padding: "4px 6px",
            fontSize: 12,
            color: "#d8d8e0",
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: 6,
            outline: "none",
          }}
        />
      </div>
    </div>
  );
};

/**
 * 本地预览提示文案输入的 props 类型。
 *
 * @property value    - 当前提示文案
 * @property readOnly - 是否只读
 * @property onChange - 变更回调（仅本地，不写入 settings）
 */
interface LocalPromptFieldProps {
  value: string;
  readOnly: boolean;
  onChange: (v: string) => void;
}

/**
 * 本地预览提示文案输入：多行 textarea。
 *
 * 仅用于编辑器预览，不写入项目 settings；适合在「提示文案」层
 * 被选中但无样式字段可调时让编辑者临时调整预览文案。
 *
 * @returns 本地提示输入 React 节点
 */
const LocalPromptField: React.FC<LocalPromptFieldProps> = ({
  value,
  readOnly,
  onChange,
}) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label
        style={{
          fontSize: 12,
          color: "#9a9aa3",
          fontWeight: 500,
        }}
      >
        预览提示文案（仅本地）
      </label>

      <textarea
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        spellCheck={false}
        placeholder="输入预览用提示文案…"
        style={{
          width: "100%",
          padding: "6px 8px",
          fontSize: 13,
          color: "#d8d8e0",
          background: "rgba(255, 255, 255, 0.04)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: 6,
          resize: "vertical",
          outline: "none",
          fontFamily: "inherit",
        }}
      />
    </div>
  );
};
