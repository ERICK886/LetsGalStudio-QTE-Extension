/**
 * 文件名：qte-overlay.tsx
 * 作者：池水三两升
 * 日期：2026-08-06
 * 版本：2.0.0
 * 描述：QTE 覆盖层 —— 仅订阅会话快照并渲染 QteVisual
 *
 * 自 Task 2 起，所有视觉绘制（圆环 / 按钮 / 提示 / 闪光）已迁出至
 * `src/qte-visual.tsx`，本文件仅保留：
 * - 订阅 `subscribeQteUi` 触发重渲染
 * - 通过 `getActiveQteSnapshot` 取当前快照
 * - 无快照时渲染透明占位
 * - 有快照时将快照映射为 `QteVisualModel` 并交给 `QteVisual`
 *
 * 本组件不修改会话状态，仅负责数据桥接。
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
  readQteStyleFromContext,
  type QteResolvedStyle,
} from "./qte-style";
import { QteVisual, type QteVisualModel } from "./qte-visual";

/**
 * QteOverlay 的 props 类型。
 *
 * 必须继承自 SDK 的 `ExtensionProps`。展示字段来自 session 快照与项目设置。
 */
export interface QteOverlayProps extends ExtensionProps {}

/**
 * QTE 全屏透明覆盖层。
 *
 * @returns 无会话时透明占位；有会话时按百分比定位并应用项目样式
 */
export const QteOverlay: React.FC<QteOverlayProps> = () => {
  const ctx = useExtensionContext();

  /**
   * 运行时再读一遍设置作为兜底；主路径使用会话启动时写入 snapshot.style 的值，
   * 避免 Preview 里 settings 键前缀不一致时回落到默认皮肤。
   */
  const liveStyle: QteResolvedStyle = readQteStyleFromContext(ctx);

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

  // 无活跃会话：渲染透明占位，不响应任何输入
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

  /**
   * 将 session 快照映射为 QteVisual 所需的纯展示模型。
   *
   * @param snap - 当前 UI 快照
   * @returns QteVisualModel
   */
  const toModel = (snap: QteUiSnapshot): QteVisualModel => ({
    keyLabel: snap.keyLabel,
    prompt: snap.prompt,
    mode: snap.mode,
    mashCount: snap.mashCount,
    hitCount: snap.hitCount,
    timeoutSec: snap.timeoutSec,
    remainingSec: snap.remainingSec,
    perfectStartSec: snap.perfectStartSec,
    perfectEndSec: snap.perfectEndSec,
    perfectEnabled: snap.perfectEnabled,
    showPerfectFlash: snap.showPerfectFlash,
    posX: snap.posX,
    posY: snap.posY,
  });

  // 优先使用快照中启动会话时冻结的样式；缺失时回落到运行时读取的 liveStyle
  const resolvedStyle: QteResolvedStyle = snapshot.style ?? liveStyle;

  return (
    <QteVisual
      style={resolvedStyle}
      model={toModel(snapshot)}
      interactive
      onButtonClick={reportQteCorrectInput}
    />
  );
};
