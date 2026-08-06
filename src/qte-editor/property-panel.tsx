/**
 * 文件名：property-panel.tsx
 * 作者：池水三两升
 * 日期：2026-08-06
 * 版本：1.1.0
 * 描述：QTE 编辑器 —— 属性面板（右侧子面板；颜色走独立 ColorPicker）
 *
 * 根据当前选中层暴露的 `fields`（`QteStyleFieldKey[]`）渲染对应控件：
 * - 颜色字段：独立 `ColorPicker`（SV / 色相 / Alpha / HEX·RGB·HSL）
 * - 数值字段：`<input type="range">` + number，min/max 来自 `QTE_STYLE_LIMITS`
 * - `fields` 为空且提供 `onLocalPromptChange`：渲染本地预览提示文案输入
 * - `showFlashButton`：渲染「播放闪光预览」按钮
 */

import React from "react";
import {
  QTE_STYLE_LIMITS,
  type QteResolvedStyle,
  type QteStyleFieldKey,
} from "../qte/qte-style";
import { FONT_MONO, FONT_SIZE_UI, FONT_UI } from "../ui-fonts";
import { ColorPicker } from "./color-picker";

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

/** 数值类样式字段键（与 `QTE_STYLE_LIMITS` 键一致） */
type QteNumericStyleFieldKey = keyof typeof QTE_STYLE_LIMITS;

/**
 * 判断样式字段是否为数值字段（在 `QTE_STYLE_LIMITS` 中有 min/max）。
 *
 * @param field - 样式字段键
 * @returns 若为数值字段则 TypeScript 窄化为 `QteNumericStyleFieldKey`
 */
function isNumericStyleField(
  field: QteStyleFieldKey,
): field is QteNumericStyleFieldKey {
  return field in QTE_STYLE_LIMITS;
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
        // 允许 ColorPicker 弹出层溢出面板
        overflow: "visible",
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

        if (isNumericStyleField(field)) {
          const limits = QTE_STYLE_LIMITS[field];
          return (
            <NumberField
              key={field}
              label={FIELD_LABELS[field]}
              value={Number(value)}
              readOnly={readOnly}
              min={limits.min}
              max={limits.max}
              onChange={(next) => onChange(field, next)}
            />
          );
        }

        return null;
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
          onClick={() => onFlashPreview?.()}
          disabled={readOnly}
          style={{
            marginTop: 4,
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid rgba(255, 77, 143, 0.5)",
            background: "rgba(255, 77, 143, 0.12)",
            color: "#ff6b9f",
            fontFamily: FONT_UI,
            fontSize: FONT_SIZE_UI,
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
 * 颜色字段：委托独立 `ColorPicker` 组件。
 *
 * @returns 颜色字段 React 节点
 */
const ColorField: React.FC<ColorFieldProps> = ({
  label,
  value,
  readOnly,
  onChange,
}) => {
  return (
    <ColorPicker
      label={label}
      value={value}
      readOnly={readOnly}
      allowAlpha
      onChange={onChange}
    />
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
          fontFamily: FONT_UI,
          fontSize: FONT_SIZE_UI,
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
            fontFamily: FONT_MONO,
            fontSize: FONT_SIZE_UI,
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
          fontFamily: FONT_UI,
          fontSize: FONT_SIZE_UI,
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
          fontFamily: FONT_UI,
          fontSize: FONT_SIZE_UI,
          color: "#d8d8e0",
          background: "rgba(255, 255, 255, 0.04)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: 6,
          resize: "vertical",
          outline: "none",
        }}
      />
    </div>
  );
};
