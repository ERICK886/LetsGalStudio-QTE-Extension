/**
 * 文件名：layer-list.tsx
 * 作者：池水三两升
 * 日期：2026-08-06
 * 版本：1.0.0
 * 描述：QTE 编辑器 —— 图层面板（左侧子面板）
 *
 * 本组件列出 `QTE_EDITOR_LAYERS` 中定义的所有可选视觉层，
 * 供编辑者切换当前正在编辑的层。点击已选中项可取消选中
 * （向 `onSelect` 传 `null`），此时属性面板会回落到「全局尺寸」字段集。
 *
 * 视觉基调：深炭黑底 + 品红强调选中，对标 Studio 气质，
 * 刻意避免紫白渐变模板风。
 */

import React from "react";
import {
  QTE_EDITOR_LAYERS,
  type QteEditorLayerId,
} from "./demo-snapshot";
import { FONT_SIZE_UI, FONT_UI } from "../ui-fonts";

/**
 * LayerList 的 props 类型。
 *
 * @property layers   - 可选图层列表，默认直接传 `QTE_EDITOR_LAYERS`
 * @property selected - 当前选中层；`null` 表示未选中具体层（全局尺寸）
 * @property onSelect - 选中/取消选中回调；取消时传 `null`
 */
export interface LayerListProps {
  layers: typeof QTE_EDITOR_LAYERS;
  selected: QteEditorLayerId | null;
  onSelect: (id: QteEditorLayerId | null) => void;
}

/**
 * 图层面板。
 *
 * 渲染一个垂直列表，每项显示 `layer.label`；选中项使用品红高亮 + 左侧色条。
 * 点击已选中项会触发 `onSelect(null)` 取消选中，从而切回全局尺寸编辑。
 *
 * @returns 图层面板 React 节点
 *
 * @example
 * <LayerList
 *   layers={QTE_EDITOR_LAYERS}
 *   selected={selected}
 *   onSelect={setSelected}
 * />
 */
export const LayerList: React.FC<LayerListProps> = ({
  layers,
  selected,
  onSelect,
}) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: "8px 8px 12px 8px",
      }}
    >
      {/* 「全局」项：selected === null 时高亮 */}
      <LayerItem
        label="全局尺寸"
        active={selected === null}
        onClick={() => onSelect(null)}
      />

      <div
        style={{
          height: 1,
          background: "rgba(255, 255, 255, 0.06)",
          margin: "4px 0",
        }}
      />

      {layers.map((layer) => (
        <LayerItem
          key={layer.id}
          label={layer.label}
          active={selected === layer.id}
          onClick={() =>
            onSelect(selected === layer.id ? null : layer.id)
          }
        />
      ))}
    </div>
  );
};

/**
 * 单个图层项的 props 类型。
 *
 * @property label   - 显示文案
 * @property active  - 是否处于选中态
 * @property onClick - 点击回调
 */
interface LayerItemProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

/**
 * 图层项：选中时品红高亮 + 左侧色条，hover 时微提亮背景。
 *
 * @returns 单个图层行 React 节点
 */
const LayerItem: React.FC<LayerItemProps> = ({ label, active, onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        padding: "8px 10px",
        borderRadius: 6,
        border: "1px solid transparent",
        background: active
          ? "rgba(255, 77, 143, 0.14)"
          : "transparent",
        color: active ? "#ff6b9f" : "#c8c8d0",
        fontFamily: FONT_UI,
        fontSize: FONT_SIZE_UI,
        fontWeight: active ? 600 : 400,
        textAlign: "left",
        cursor: "pointer",
        transition:
          "background 120ms ease, color 120ms ease, border-color 120ms ease",
        borderLeft: active
          ? "3px solid #ff4d8f"
          : "3px solid transparent",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = "transparent";
        }
      }}
    >
      <span>{label}</span>
    </button>
  );
};
