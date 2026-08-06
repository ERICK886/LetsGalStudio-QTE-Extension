/**
 * 文件名：qte-overlay.tsx
 * 作者：池水三两升
 * 日期：2026-08-06
 * 版本：1.0.0
 * 描述：QTE 覆盖层 UI：百分比定位、可配置颜色/尺寸、双环进度、Perfect 闪光
 *
 * 本组件只负责渲染，不修改会话状态。数据来自：
 * - `qte-session` 快照（玩法进度、posX/posY）
 * - `ctx.settings.useSnapshot()`（项目级样式）
 */

import React, { useEffect, useState } from "react";
import { useExtensionContext, type ExtensionProps } from "@avg-studio/sdk";
import {
  getActiveQteSnapshot,
  subscribeQteUi,
  reportQteCorrectInput,
  type QteUiSnapshot,
} from "./qte-session";
import {
  colorToRgba,
  dimColor,
  glowShadow,
  resolveQteStyle,
  type QteResolvedStyle,
} from "./qte-style";

/**
 * QteOverlay 的 props 类型。
 *
 * 必须继承自 SDK 的 `ExtensionProps`。展示字段来自 session 快照与项目设置。
 */
export interface QteOverlayProps extends ExtensionProps {}

/**
 * 字体栈：优先系统字体，避免加载外部资源。
 */
const FONT_BODY =
  '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';

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
 * @param snapshot - 当前 UI 快照
 * @returns 外环相对 ringDiameter 的缩放系数
 */
function computeOuterScale(snapshot: QteUiSnapshot): number {
  if (snapshot.timeoutSec <= 0) {
    return 0.52;
  }
  return 0.52 + 0.48 * clamp01(snapshot.remainingSec / snapshot.timeoutSec);
}

/**
 * 计算 Perfect 内环缩放系数（窗口中点对应的半径）。
 *
 * @param snapshot - 当前 UI 快照
 * @returns 内环相对 ringDiameter 的缩放系数
 */
function computeInnerScale(snapshot: QteUiSnapshot): number {
  if (!snapshot.perfectEnabled || snapshot.timeoutSec <= 0) {
    return 0.52;
  }
  const centerElapsed = (snapshot.perfectStartSec + snapshot.perfectEndSec) / 2;
  const centerRemaining = snapshot.timeoutSec - centerElapsed;
  return 0.52 + 0.48 * clamp01(centerRemaining / snapshot.timeoutSec);
}

/**
 * 判断当前已流逝时间是否落在 Perfect 窗口内。
 *
 * @param snapshot - 当前 UI 快照
 * @returns 在窗口内返回 true
 */
function isInPerfectWindow(snapshot: QteUiSnapshot): boolean {
  if (!snapshot.perfectEnabled || snapshot.timeoutSec <= 0) {
    return false;
  }
  const elapsed = snapshot.timeoutSec - snapshot.remainingSec;
  return elapsed >= snapshot.perfectStartSec && elapsed <= snapshot.perfectEndSec;
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
 * QTE 全屏透明覆盖层。
 *
 * @returns 无会话时透明占位；有会话时按百分比定位并应用项目样式
 */
export const QteOverlay: React.FC<QteOverlayProps> = () => {
  const ctx = useExtensionContext();

  /**
   * 逐字段 useValue：宿主会按模块 uiId 自动补前缀（如 qte.buttonBgColor），
   * 比只读 useSnapshot 裸键更可靠。
   */
  const [outerRingColor] = ctx.settings.useValue<string>("outerRingColor");
  const [perfectColor] = ctx.settings.useValue<string>("perfectColor");
  const [buttonBgColor] = ctx.settings.useValue<string>("buttonBgColor");
  const [buttonTextColor] = ctx.settings.useValue<string>("buttonTextColor");
  const [flashColor] = ctx.settings.useValue<string>("flashColor");
  const [ringDiameter] = ctx.settings.useValue<number>("ringDiameter");
  const [ringStroke] = ctx.settings.useValue<number>("ringStroke");
  const [buttonSize] = ctx.settings.useValue<number>("buttonSize");

  /** 再合并 snapshot，兜底兼容其它键形态 */
  const settingsSnap = ctx.settings.useSnapshot();
  const style: QteResolvedStyle = resolveQteStyle({
    ...settingsSnap,
    // useValue 已按 uiId 解好前缀；写入裸键供 resolve 优先读取
    ...(outerRingColor !== undefined ? { outerRingColor } : {}),
    ...(perfectColor !== undefined ? { perfectColor } : {}),
    ...(buttonBgColor !== undefined ? { buttonBgColor } : {}),
    ...(buttonTextColor !== undefined ? { buttonTextColor } : {}),
    ...(flashColor !== undefined ? { flashColor } : {}),
    ...(ringDiameter !== undefined ? { ringDiameter } : {}),
    ...(ringStroke !== undefined ? { ringStroke } : {}),
    ...(buttonSize !== undefined ? { buttonSize } : {}),
  });


  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribeQteUi(() => {
      forceUpdate((prev) => prev + 1);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const snapshot = getActiveQteSnapshot();

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

  const ringBase = style.ringDiameter;
  const stroke = style.ringStroke;
  const btnSize = style.buttonSize;
  const outerScale = computeOuterScale(snapshot);
  const innerScale = computeInnerScale(snapshot);
  const perfectActive = isInPerfectWindow(snapshot);
  const showMash = snapshot.mode === "mash";
  const perfectDim = dimColor(style.perfectColor);

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

      {/*
        定位锚点：相对舞台百分比放置 QTE 中心。
        left/top 为 0–100%；translate(-50%,-50%) 使控件中心对准该点。
      */}
      <div
        style={{
          position: "absolute",
          left: `${snapshot.posX}%`,
          top: `${snapshot.posY}%`,
          transform: "translate(-50%, -50%)",
          width: ringBase,
          height: ringBase,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
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
              color: "rgba(255, 255, 255, 0.92)",
              textShadow: "0 1px 4px rgba(0, 0, 0, 0.35)",
              pointerEvents: "none",
            }}
          >
            {snapshot.prompt}
          </div>
        )}

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
          }}
        />

        {snapshot.perfectEnabled && (
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
            }}
          />
        )}

        <button
          type="button"
          aria-label={`QTE 按键 ${snapshot.keyLabel}`}
          onClick={reportQteCorrectInput}
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
            cursor: "pointer",
            pointerEvents: "auto",
            outline: "none",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.35)",
            transition: "background 120ms ease, transform 60ms ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = buttonHoverColor(style.buttonBgColor);
            e.currentTarget.style.transform = "translate(-50%, -50%) scale(1.05)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = style.buttonBgColor;
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
            {snapshot.hitCount} / {snapshot.mashCount}
          </div>
        )}

        {snapshot.showPerfectFlash && (
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
            }}
          />
        )}
      </div>
    </div>
  );
};
