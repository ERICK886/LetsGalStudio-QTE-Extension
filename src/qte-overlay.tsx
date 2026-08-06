/**
 * 文件名：qte-overlay.tsx
 * 作者：池水三两升
 * 日期：2026-08-06
 * 版本：1.0.0
 * 描述：QTE 覆盖层 UI：透明全屏、双环进度、Perfect 区域、连打计数、闪光反馈
 *
 * 本组件只负责渲染，不修改会话状态。数据来自 `src/qte-session.ts` 暴露的
 * `getActiveQteSnapshot()` 与 `subscribeQteUi()`，点击按钮通过
 * `reportQteCorrectInput()` 通知会话逻辑。
 */

import React, { useEffect, useState } from "react";
import type { ExtensionProps } from "@avg-studio/sdk";
import {
  getActiveQteSnapshot,
  subscribeQteUi,
  reportQteCorrectInput,
  type QteUiSnapshot,
} from "./qte-session";

/**
 * QteOverlay 的 props 类型。
 *
 * 必须继承自 SDK 的 `ExtensionProps`，这样宿主加载器才能把组件放进
 * `ExtensionRenderData<P>` 的泛型约束里。当前 overlay 不需要额外 props，
 * 所有展示字段均从 qte-session 的快照读取。
 */
export interface QteOverlayProps extends ExtensionProps {}

// ─── 视觉 token（零外部依赖，全部系统样式）────────────────────────────────────
const tokens = {
  // 主环：冷白半透明，跟随时间收缩
  ring: {
    border: "rgba(255, 255, 255, 0.72)",
    shadow: "0 0 0 4px rgba(255, 255, 255, 0.06), 0 0 28px rgba(255, 255, 255, 0.18)",
  },
  // Perfect 内环：金色虚线，命中窗口内更亮
  perfect: {
    border: "#FFD66B",
    borderDim: "rgba(255, 214, 107, 0.45)",
    glow: "0 0 16px rgba(255, 214, 107, 0.55)",
    glowDim: "0 0 8px rgba(255, 214, 107, 0.22)",
  },
  // 中心按钮：深蓝半透明，hover / active 微亮
  button: {
    bg: "rgba(30, 40, 60, 0.82)",
    bgHover: "rgba(45, 58, 85, 0.88)",
    border: "rgba(255, 255, 255, 0.24)",
    text: "#FFFFFF",
  },
  // 文字颜色
  text: {
    primary: "rgba(255, 255, 255, 0.92)",
    secondary: "rgba(255, 255, 255, 0.64)",
  },
  // 字体栈：优先使用系统字体，避免加载外部资源
  fontBody:
    '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
};

/**
 * 外环基础直径（px）。
 *
 * 最终渲染大小会乘以 `computeOuterScale()` 返回的系数，让环随着时间收缩。
 */
const RING_BASE_PX = 320;

/**
 * 外环描边粗细（px）。
 */
const RING_STROKE_PX = 6;

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
 * 规则：剩余时间越短，环越小；剩余时间等于总时限时达到最大（1.0）；
 * 剩余时间为 0 时贴近按键（0.52）。
 *
 * 公式：scale = 0.52 + 0.48 * (remainingSec / timeoutSec)
 *
 * @param snapshot - 当前 UI 快照
 * @returns 外环相对 RING_BASE_PX 的缩放系数
 */
function computeOuterScale(snapshot: QteUiSnapshot): number {
  if (snapshot.timeoutSec <= 0) {
    return 0.52;
  }

  return 0.52 + 0.48 * clamp01(snapshot.remainingSec / snapshot.timeoutSec);
}

/**
 * 计算 Perfect 内环缩放系数。
 *
 * 内环代表 Perfect 窗口的视觉半径。将窗口中点对应到剩余时间，
 * 再用与外环相同的归一化公式得出大小。如果未启用 Perfect 判定或总时限为 0，
 * 返回最小系数 0.52。
 *
 * @param snapshot - 当前 UI 快照
 * @returns 内环相对 RING_BASE_PX 的缩放系数
 */
function computeInnerScale(snapshot: QteUiSnapshot): number {
  if (!snapshot.perfectEnabled || snapshot.timeoutSec <= 0) {
    return 0.52;
  }

  // 取 Perfect 窗口 [start, end] 的中点作为内环代表位置
  const centerElapsed = (snapshot.perfectStartSec + snapshot.perfectEndSec) / 2;
  const centerRemaining = snapshot.timeoutSec - centerElapsed;

  return 0.52 + 0.48 * clamp01(centerRemaining / snapshot.timeoutSec);
}

/**
 * 判断当前已流逝时间是否落在 Perfect 窗口内。
 *
 * @param snapshot - 当前 UI 快照
 * @returns 在窗口内返回 true，否则返回 false
 */
function isInPerfectWindow(snapshot: QteUiSnapshot): boolean {
  if (!snapshot.perfectEnabled || snapshot.timeoutSec <= 0) {
    return false;
  }

  const elapsed = snapshot.timeoutSec - snapshot.remainingSec;

  return elapsed >= snapshot.perfectStartSec && elapsed <= snapshot.perfectEndSec;
}

/**
 * QTE 全屏透明覆盖层。
 *
 * 使用示例：
 * ```tsx
 * import { QteOverlay, type QteOverlayProps } from "./qte-overlay";
 *
 * class QteExtension extends Extension<QteOverlayProps> {
 *   render(): ExtensionRenderData<QteOverlayProps> {
 *     return { component: QteOverlay, props: {} };
 *   }
 * }
 * ```
 *
 * @returns 当无活跃会话时渲染一个透明占位，避免全屏闪烁；有会话时渲染双环 UI。
 */
export const QteOverlay: React.FC<QteOverlayProps> = () => {
  /**
   * 用一个递增计数器触发重渲染。
   *
   * 不保存快照本身，因为 qte-session 是单一事实源，组件每次 render 都重新
   * 读取 `getActiveQteSnapshot()`，保证所有会话状态同步。
   */
  const [, forceUpdate] = useState(0);

  /**
   * 订阅 UI 快照变化。
   *
   * 挂载时注册监听器，卸载时退订，避免内存泄漏。
   */
  useEffect(() => {
    const unsubscribe = subscribeQteUi(() => {
      forceUpdate((prev) => prev + 1);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const snapshot = getActiveQteSnapshot();

  // 无会话时：全屏透明占位，pointerEvents 关闭，不遮挡下方舞台。
  if (!snapshot) {
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          background: "transparent",
        }}
      />
    );
  }

  const outerScale = computeOuterScale(snapshot);
  const innerScale = computeInnerScale(snapshot);
  const perfectActive = isInPerfectWindow(snapshot);
  const showMash = snapshot.mode === "mash";

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        background: "transparent",
        fontFamily: tokens.fontBody,
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      {/* Perfect 命中时的金色扩散闪光动画 */}
      {snapshot.showPerfectFlash && (
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

      <div
        style={{
          position: "relative",
          width: RING_BASE_PX,
          height: RING_BASE_PX,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* 提示文本 */}
        {snapshot.prompt && (
          <div
            style={{
              position: "absolute",
              top: -48,
              left: 0,
              right: 0,
              textAlign: "center",
              fontSize: 18,
              fontWeight: 500,
              color: tokens.text.primary,
              textShadow: "0 1px 4px rgba(0, 0, 0, 0.35)",
              pointerEvents: "none",
            }}
          >
            {snapshot.prompt}
          </div>
        )}

        {/* 外环：随剩余时间收缩 */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: RING_BASE_PX * outerScale,
            height: RING_BASE_PX * outerScale,
            transform: "translate(-50%, -50%)",
            borderRadius: "50%",
            border: `${RING_STROKE_PX}px solid ${tokens.ring.border}`,
            boxShadow: tokens.ring.shadow,
            pointerEvents: "none",
            transition: "width 80ms linear, height 80ms linear",
          }}
        />

        {/* 内环：Perfect 区域，虚线金色，命中窗口时高亮 */}
        {snapshot.perfectEnabled && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: RING_BASE_PX * innerScale,
              height: RING_BASE_PX * innerScale,
              transform: "translate(-50%, -50%)",
              borderRadius: "50%",
              border: `${RING_STROKE_PX}px dashed ${
                perfectActive ? tokens.perfect.border : tokens.perfect.borderDim
              }`,
              boxShadow: perfectActive ? tokens.perfect.glow : tokens.perfect.glowDim,
              pointerEvents: "none",
              transition: "box-shadow 120ms ease, border-color 120ms ease",
            }}
          />
        )}

        {/* 中心按钮：显示 keyLabel，点击视为正确输入 */}
        <button
          type="button"
          aria-label={`QTE 按键 ${snapshot.keyLabel}`}
          onClick={reportQteCorrectInput}
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: 88,
            height: 88,
            transform: "translate(-50%, -50%)",
            borderRadius: "50%",
            border: `2px solid ${tokens.button.border}`,
            background: tokens.button.bg,
            color: tokens.button.text,
            fontSize: 32,
            fontWeight: 700,
            letterSpacing: "0.02em",
            cursor: "pointer",
            pointerEvents: "auto",
            outline: "none",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.35)",
            transition: "background 120ms ease, transform 60ms ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = tokens.button.bgHover;
            e.currentTarget.style.transform = "translate(-50%, -50%) scale(1.05)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = tokens.button.bg;
            e.currentTarget.style.transform = "translate(-50%, -50%) scale(1)";
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = "translate(-50%, -50%) scale(0.95)";
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = "translate(-50%, -50%) scale(1.05)";
          }}
        >
          {snapshot.keyLabel}
        </button>

        {/* 连打模式：显示已命中 / 总次数 */}
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
              color: tokens.text.primary,
              textShadow: "0 1px 4px rgba(0, 0, 0, 0.35)",
              pointerEvents: "none",
            }}
          >
            {snapshot.hitCount} / {snapshot.mashCount}
          </div>
        )}

        {/* Perfect 命中闪光层 */}
        {snapshot.showPerfectFlash && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: 120,
              height: 120,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(255, 214, 107, 0.7) 0%, rgba(255, 214, 107, 0) 70%)",
              animation: "qte-perfect-flash 420ms ease-out forwards",
              pointerEvents: "none",
            }}
          />
        )}
      </div>
    </div>
  );
};
