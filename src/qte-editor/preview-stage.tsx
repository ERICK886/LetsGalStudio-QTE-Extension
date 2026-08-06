/**
 * 文件名：preview-stage.tsx
 * 作者：池水三两升
 * 日期：2026-08-06
 * 版本：1.0.1
 * 描述：QTE 编辑器 —— 预览舞台（中央子面板）
 *
 * 在编辑器中央渲染一个 QTE 预览舞台：
 * - 默认模式：深色网格背景 + 居中 16:9 舞台框（带边距、可见边界）
 * - `fullBleed` 模式：无框无网格边距，铺满整个区域（预览页使用）
 *
 * 舞台内部直接复用 `QteVisual`，传入 `interactive={false}` 让其仅作展示，
 * `pos` 来自 `model.posX/posY`（演示 model 固定 50/50，不支持拖拽）。
 * `highlightLayer` 透传给 `QteVisual`，用于在舞台上高亮当前选中层。
 *
 * 注意：`QteVisual` 根节点为 `position:absolute; inset:0`，**不会撑开父级**。
 * 舞台框必须给出明确宽高（不能仅靠 aspect-ratio + width/height:auto），
 * 否则设计页会出现「只有网格、看不到 QTE」的空画布。
 */

import React from "react";
import {
  QteVisual,
  type QteVisualModel,
} from "../qte/qte-visual";
import type { QteResolvedStyle } from "../qte/qte-style";
import type { QteEditorLayerId } from "./demo-snapshot";

/**
 * PreviewStage 的 props 类型。
 *
 * @property style          - 当前已解析的样式，透传给 QteVisual
 * @property model          - 展示数据模型，提供 posX/posY 等渲染字段
 * @property highlightLayer - 编辑器当前选中层；高亮对应视觉元素
 * @property fullBleed      - 是否铺满（无框无网格），预览页使用
 */
export interface PreviewStageProps {
  style: QteResolvedStyle;
  model: QteVisualModel;
  highlightLayer: QteEditorLayerId | null;
  fullBleed?: boolean;
}

/**
 * 网格背景的 CSS（仅默认模式使用）。
 *
 * 使用两层线性渐变拼出 24px 见方的细网格，颜色低对比以保持深色基调。
 */
const GRID_BACKGROUND =
  "linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px), " +
  "linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px)";

/** 网格单元尺寸 */
const GRID_SIZE_PX = 24;

/**
 * 预览舞台。
 *
 * - 默认模式：外层网格背景，内层 16:9 居中舞台框（占可用区域约 90%）
 * - `fullBleed`：外层无网格、无 padding；舞台框无边框，铺满整个区域
 *
 * 舞台框内部挂载 `QteVisual`，`interactive={false}`，`pos` 取自 model。
 *
 * @returns 预览舞台 React 节点
 *
 * @example
 * <PreviewStage
 *   style={style}
 *   model={createDemoVisualModel()}
 *   highlightLayer={selected}
 * />
 */
export const PreviewStage: React.FC<PreviewStageProps> = ({
  style,
  model,
  highlightLayer,
  fullBleed = false,
}) => {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 0,
        background: fullBleed ? "#0e0e12" : "#101014",
        backgroundImage: fullBleed ? undefined : GRID_BACKGROUND,
        backgroundSize: fullBleed
          ? undefined
          : `${GRID_SIZE_PX}px ${GRID_SIZE_PX}px`,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: fullBleed ? 0 : 16,
        boxSizing: "border-box",
      }}
    >
      {/*
        舞台框必须有确定尺寸：QteVisual 绝对定位不贡献布局高度。
        设计页用 width:90% + aspect-ratio 撑开；预览页 100% 铺满。
      */}
      <div
        style={{
          position: "relative",
          boxSizing: "border-box",
          ...(fullBleed
            ? {
                width: "100%",
                height: "100%",
              }
            : {
                width: "90%",
                maxWidth: "100%",
                aspectRatio: "16 / 9",
                maxHeight: "90%",
                height: "auto",
                minWidth: 240,
                minHeight: 135,
              }),
          background: "#0a0a0e",
          borderRadius: fullBleed ? 0 : 8,
          border: fullBleed
            ? "none"
            : "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow: fullBleed
            ? "none"
            : "0 8px 32px rgba(0, 0, 0, 0.45)",
          overflow: "hidden",
        }}
      >
        <QteVisual
          style={style}
          model={model}
          interactive={false}
          highlightLayer={highlightLayer}
        />
      </div>
    </div>
  );
};
