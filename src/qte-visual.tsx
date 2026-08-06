/**
 * 文件名：qte-visual.tsx
 * 作者：池水三两升
 * 日期：2026-08-06
 * 版本：1.0.0
 * 描述：QTE 共享视觉组件 —— 圆环 / 按钮 / 提示 / Perfect 闪光
 *
 * 本组件从 `qte-overlay` 抽出，承担所有与「展示」相关的 DOM：
 * - 外环（随剩余时间收缩）
 * - Perfect 内环（窗口内高亮）
 * - 中心按钮（可点击 / 可禁用点击）
 * - 提示文案、连打计数、Perfect 命中闪光
 *
 * 设计目标：
 * 1. 运行时由 `QteOverlay` 渲染，传入 session 快照转出的 model 与项目样式
 * 2. 编辑器（Task 3）可直接复用本组件做静态预览，传入 `interactive={false}` 与
 *    `highlightLayer` 高亮选中层，无需依赖会话订阅
 *
 * 不依赖会话状态，纯展示组件。
 */

import React from "react";
import {
  colorToRgba,
  dimColor,
  glowShadow,
  type QteResolvedStyle,
} from "./qte-style";

/**
 * 编辑器可高亮的视觉层标识。
 *
 * - `outer`   外环
 * - `perfect` Perfect 内环
 * - `button`  中心按钮
 * - `prompt`  顶部提示文案
 * - `flash`   Perfect 命中闪光
 * - `null`    运行时默认，不高亮
 *
 * 之所以在此处（而非 editor 包）定义，是为了避免 editor ↔ visual 之间的循环依赖；
 * Task 3 会在 `demo-snapshot.ts` 中 re-export 本类型。
 */
export type QteVisualHighlightLayer =
  | "outer"
  | "perfect"
  | "button"
  | "prompt"
  | "flash"
  | null;

/**
 * QteVisual 的展示数据模型。
 *
 * 字段含义与 `QteUiSnapshot` 中对应字段一致，但仅保留渲染所需字段，
 * 使编辑器可在没有会话的情况下手工构造一份预览数据。
 */
export interface QteVisualModel {
  /** 展示给玩家的按键标签（如 "F" / "空格"） */
  keyLabel: string;
  /** 顶部提示文案 */
  prompt: string;
  /** QTE 模式：单键判定或连打 */
  mode: "single" | "mash";
  /** 连打模式需要按下的总次数 */
  mashCount: number;
  /** 当前已有效按下的次数 */
  hitCount: number;
  /** 总时限（秒） */
  timeoutSec: number;
  /** 剩余时间（秒） */
  remainingSec: number;
  /** Perfect 窗口起始时间 */
  perfectStartSec: number;
  /** Perfect 窗口结束时间 */
  perfectEndSec: number;
  /** 是否启用 Perfect 判定 */
  perfectEnabled: boolean;
  /** 是否应显示 Perfect 命中闪光 */
  showPerfectFlash: boolean;
  /** QTE 中心水平位置（舞台宽度百分比 0–100） */
  posX: number;
  /** QTE 中心垂直位置（舞台高度百分比 0–100） */
  posY: number;
}

/**
 * QteVisual 的 props 类型。
 *
 * @property style         - 已合并默认值的项目样式
 * @property model         - 展示数据（来自 session 快照或编辑器构造）
 * @property interactive   - 是否允许点击按钮触发结算；编辑器预览传 false
 * @property onButtonClick - 按钮点击回调；通常为 `reportQteCorrectInput`
 * @property highlightLayer - 编辑器选中层高亮；运行时传 null
 */
export interface QteVisualProps {
  style: QteResolvedStyle;
  model: QteVisualModel;
  interactive?: boolean;
  onButtonClick?: () => void;
  highlightLayer?: QteVisualHighlightLayer;
}

/**
 * 字体栈：优先系统字体，避免加载外部资源。
 */
const FONT_BODY =
  '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';

/**
 * 编辑器选中层高亮时使用的描边样式。
 *
 * 使用 2px 亮色描边 + 微透明填充，便于在编辑器中辨识当前选中层。
 */
const HIGHLIGHT_OUTLINE = "2px solid #4DA6FF";

/**
 * 将数值限制在 [0, 1] 区间。
 *
 * @param value - 输入值
 * @returns 限制后的值
 */
function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * 计算外环缩放系数。
 *
 * 公式：scale = 0.52 + 0.48 * (remainingSec / timeoutSec)
 *
 * @param model - 当前展示数据
 * @returns 外环相对 ringDiameter 的缩放系数
 */
function computeOuterScale(model: QteVisualModel): number {
  if (model.timeoutSec <= 0) {
    return 0.52;
  }
  return 0.52 + 0.48 * clamp01(model.remainingSec / model.timeoutSec);
}

/**
 * 计算 Perfect 内环缩放系数（窗口中点对应的半径）。
 *
 * @param model - 当前展示数据
 * @returns 内环相对 ringDiameter 的缩放系数
 */
function computeInnerScale(model: QteVisualModel): number {
  if (!model.perfectEnabled || model.timeoutSec <= 0) {
    return 0.52;
  }
  const centerElapsed = (model.perfectStartSec + model.perfectEndSec) / 2;
  const centerRemaining = model.timeoutSec - centerElapsed;
  return 0.52 + 0.48 * clamp01(centerRemaining / model.timeoutSec);
}

/**
 * 判断当前已流逝时间是否落在 Perfect 窗口内。
 *
 * @param model - 当前展示数据
 * @returns 在窗口内返回 true
 */
function isInPerfectWindow(model: QteVisualModel): boolean {
  if (!model.perfectEnabled || model.timeoutSec <= 0) {
    return false;
  }
  const elapsed = model.timeoutSec - model.remainingSec;
  return elapsed >= model.perfectStartSec && elapsed <= model.perfectEndSec;
}

/**
 * 由主色推导按钮 hover 背景（略提亮）。
 *
 * @param bg - 按钮底色
 * @returns hover 用颜色
 */
function buttonHoverColor(bg: string): string {
  return colorToRgba(bg, 0.92);
}

/**
 * QTE 视觉组件。
 *
 * 根节点为 `position:absolute; inset:0` 的透明层，
 * 内部锚点使用 `model.posX/posY` 百分比定位 QTE 中心。
 *
 * @returns 透明覆盖层 + 圆环 + 按钮 + 提示 + 闪光
 */
export const QteVisual: React.FC<QteVisualProps> = ({
  style,
  model,
  interactive = true,
  onButtonClick,
  highlightLayer = null,
}) => {
  const ringBase = style.ringDiameter;
  const stroke = style.ringStroke;
  const btnSize = style.buttonSize;

  const outerScale = computeOuterScale(model);
  const innerScale = computeInnerScale(model);
  const perfectActive = isInPerfectWindow(model);
  const showMash = model.mode === "mash";
  const perfectDim = dimColor(style.perfectColor);

  /** 是否给指定层加编辑器高亮描边 */
  const isHighlighted = (layer: QteVisualHighlightLayer): boolean =>
    highlightLayer === layer;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        background: "transparent",
        fontFamily: FONT_BODY,
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      {model.showPerfectFlash && (
        <style>
          {`
            @keyframes qte-perfect-flash {
              0% {
                transform: translate(-50%, -50%) scale(0.8);
                opacity: 0.7;
              }
              100% {
                transform: translate(-50%, -50%) scale(1.6);
                opacity: 0;
              }
            }
          `}
        </style>
      )}

      {/*
        定位锚点：相对舞台百分比放置 QTE 中心。
        left/top 为 0–100%；translate(-50%,-50%) 使控件中心对准该点。
      */}
      <div
        style={{
          position: "absolute",
          left: `${model.posX}%`,
          top: `${model.posY}%`,
          transform: "translate(-50%, -50%)",
          width: ringBase,
          height: ringBase,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {model.prompt && (
          <div
            style={{
              position: "absolute",
              top: -48,
              left: 0,
              right: 0,
              textAlign: "center",
              fontSize: 18,
              fontWeight: 500,
              color: "rgba(255, 255, 255, 0.92)",
              textShadow: "0 1px 4px rgba(0, 0, 0, 0.35)",
              pointerEvents: "none",
              outline: isHighlighted("prompt") ? HIGHLIGHT_OUTLINE : "none",
              outlineOffset: 2,
              borderRadius: 4,
            }}
          >
            {model.prompt}
          </div>
        )}

        {/* 外环：随剩余时间从大收缩到小 */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: ringBase * outerScale,
            height: ringBase * outerScale,
            transform: "translate(-50%, -50%)",
            borderRadius: "50%",
            border: `${stroke}px solid ${style.outerRingColor}`,
            boxShadow: `0 0 0 4px ${colorToRgba(style.outerRingColor, 0.12)}, 0 0 28px ${colorToRgba(style.outerRingColor, 0.28)}`,
            pointerEvents: "none",
            transition: "width 80ms linear, height 80ms linear",
            outline: isHighlighted("outer") ? HIGHLIGHT_OUTLINE : "none",
            outlineOffset: 4,
          }}
        />

        {/* Perfect 内环：仅在 perfectEnabled 时显示 */}
        {model.perfectEnabled && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: ringBase * innerScale,
              height: ringBase * innerScale,
              transform: "translate(-50%, -50%)",
              borderRadius: "50%",
              border: `${stroke}px dashed ${
                perfectActive ? style.perfectColor : perfectDim
              }`,
              boxShadow: glowShadow(style.perfectColor, perfectActive),
              pointerEvents: "none",
              transition: "box-shadow 120ms ease, border-color 120ms ease",
              outline: isHighlighted("perfect") ? HIGHLIGHT_OUTLINE : "none",
              outlineOffset: 4,
            }}
          />
        )}

        {/* 中心按钮：interactive=false 时不响应点击 */}
        <button
          type="button"
          aria-label={`QTE 按键 ${model.keyLabel}`}
          onClick={interactive ? onButtonClick : undefined}
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: btnSize,
            height: btnSize,
            transform: "translate(-50%, -50%)",
            borderRadius: "50%",
            border: "2px solid rgba(255, 255, 255, 0.24)",
            background: style.buttonBgColor,
            color: style.buttonTextColor,
            fontSize: Math.max(18, Math.round(btnSize * 0.36)),
            fontWeight: 700,
            letterSpacing: "0.02em",
            cursor: interactive ? "pointer" : "default",
            pointerEvents: interactive ? "auto" : "none",
            outline: isHighlighted("button") ? HIGHLIGHT_OUTLINE : "none",
            outlineOffset: 2,
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.35)",
            transition: "background 120ms ease, transform 60ms ease",
          }}
          onMouseEnter={(e) => {
            if (!interactive) return;
            e.currentTarget.style.background = buttonHoverColor(style.buttonBgColor);
            e.currentTarget.style.transform = "translate(-50%, -50%) scale(1.05)";
          }}
          onMouseLeave={(e) => {
            if (!interactive) return;
            e.currentTarget.style.background = style.buttonBgColor;
            e.currentTarget.style.transform = "translate(-50%, -50%) scale(1)";
          }}
          onMouseDown={(e) => {
            if (!interactive) return;
            e.currentTarget.style.transform = "translate(-50%, -50%) scale(0.95)";
          }}
          onMouseUp={(e) => {
            if (!interactive) return;
            e.currentTarget.style.transform = "translate(-50%, -50%) scale(1.05)";
          }}
        >
          {model.keyLabel}
        </button>

        {/* 连打模式进度计数 */}
        {showMash && (
          <div
            style={{
              position: "absolute",
              bottom: -48,
              left: 0,
              right: 0,
              textAlign: "center",
              fontSize: 22,
              fontWeight: 700,
              color: "rgba(255, 255, 255, 0.92)",
              textShadow: "0 1px 4px rgba(0, 0, 0, 0.35)",
              pointerEvents: "none",
            }}
          >
            {model.hitCount} / {model.mashCount}
          </div>
        )}

        {/* Perfect 命中闪光：仅 showPerfectFlash 时挂载，动画结束自动消失 */}
        {model.showPerfectFlash && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: Math.round(btnSize * 1.35),
              height: Math.round(btnSize * 1.35),
              borderRadius: "50%",
              background: `radial-gradient(circle, ${colorToRgba(style.flashColor, 0.7)} 0%, ${colorToRgba(style.flashColor, 0)} 70%)`,
              animation: "qte-perfect-flash 400ms ease-out forwards",
              pointerEvents: "none",
              outline: isHighlighted("flash") ? HIGHLIGHT_OUTLINE : "none",
              outlineOffset: 4,
            }}
          />
        )}
      </div>
    </div>
  );
};
