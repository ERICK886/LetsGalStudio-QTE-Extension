/**
 * 文件名：editor-panel.tsx
 * 作者：池水三两升
 * 日期：2026-08-06
 * 版本：1.0.0
 * 描述：QTE 编辑器 —— 编辑面板根组件
 *
 * 本组件是 `QteEditorExtension` 的 UI 入口，负责：
 * - 通过 `useExtensionContext()` 拿到 SDK 上下文
 * - 读取「qte」模块的项目样式（`ctx.settings.cross.get("qte", field)`）
 *   并合并默认值，得到 `QteResolvedStyle`
 * - 在本地 state 中维护当前页签、选中层、播放态、演示 model、本地预览提示
 * - 播放倒计时时按 50ms 间隔调用 `tickDemoRemaining` 更新 `model.remainingSec`
 * - 闪光预览：开 `showPerfectFlash`，400ms 后自动关闭
 * - 字段变更：`normalizeQteStyleField` → `ctx.settings.cross.set("qte", field, next)`
 *   → 本地 state 乐观更新
 *
 * 设计页：左 `LayerList` + 中 `PreviewStage` + 右 `PropertyPanel`
 * 预览页：`PreviewStage fullBleed` + 底部简单工具条（播放、闪光）
 *
 * 注意：本组件从不调用 `runQteSession`，仅做样式编辑与静态预览。
 */

import React, { useEffect, useRef, useState } from "react";
import { useExtensionContext } from "@avg-studio/sdk";
import {
  QTE_STYLE_DEFAULTS,
  normalizeQteStyleField,
  resolveQteStyle,
  type QteResolvedStyle,
  type QteStyleFieldKey,
} from "../qte-style";
import {
  QTE_EDITOR_LAYERS,
  createDemoVisualModel,
  fieldsForLayer,
  tickDemoRemaining,
  type QteEditorLayerId,
} from "./demo-snapshot";
import type { QteVisualModel } from "../qte-visual";
import { EditorShell } from "./editor-shell";
import { LayerList } from "./layer-list";
import { PreviewStage } from "./preview-stage";
import { PropertyPanel } from "./property-panel";

/**
 * 从扩展上下文读取并解析「qte」模块的项目样式。
 *
 * 对每个 `keyof QteResolvedStyle`，先尝试 `ctx.settings.cross.get("qte", k)`；
 * 若返回 undefined，则回退到 `QTE_STYLE_DEFAULTS[k]`。把合并后的对象交给
 * `resolveQteStyle` 做最终归一化（颜色解析、数值裁剪）。
 *
 * 这样做的好处：
 * - 即便宿主把设置存成裸键 / `qte.xxx` 形态，cross.get 也能拿到值
 * - 缺字段时回落默认值，保证编辑器首次打开就能展示完整皮肤
 *
 * @param ctx - 扩展上下文
 * @returns 合并默认值后的运行时样式
 */
function readStyle(ctx: {
  settings: {
    cross: {
      get<T = unknown>(uiId: string, key: string): T | undefined;
    };
  };
}): QteResolvedStyle {
  const fields = Object.keys(QTE_STYLE_DEFAULTS) as QteStyleFieldKey[];

  const merged: Record<string, unknown> = {};
  for (const field of fields) {
    let value: unknown;
    try {
      value = ctx.settings.cross.get("qte", field);
    } catch {
      // 部分宿主可能未实现 cross.get，吞错后回落默认值
      value = undefined;
    }
    merged[field] = value ?? QTE_STYLE_DEFAULTS[field];
  }

  return resolveQteStyle(merged);
}

/**
 * EditorPanel 的 props 类型。
 *
 * 必须继承自 SDK 的 `ExtensionProps`，与 `QteEditorExtension.render()`
 * 返回的 `props` 形状对齐。当前无额外字段。
 */
export interface EditorPanelProps {
  /** 透传自 Extension.data，预留扩展位 */
  readonly id?: string;
}

/** 倒计时 tick 间隔（毫秒） */
const TICK_INTERVAL_MS = 50;

/** 每次 tick 推进的秒数（与 50ms 间隔匹配） */
const TICK_DT_SEC = TICK_INTERVAL_MS / 1000;

/** Perfect 闪光持续时间（毫秒），与运行时 `qte-session` 保持一致 */
const FLASH_DURATION_MS = 400;

/**
 * QTE 编辑面板根组件。
 *
 * @returns 编辑器外壳 + 设计/预览页
 *
 * @example
 * // 由 QteEditorExtension.render() 挂载：
 * // { component: EditorPanel, props: this.data ?? {} }
 */
export const EditorPanel: React.FC<EditorPanelProps> = () => {
  const ctx = useExtensionContext();

  // 当前页签：设计 / 预览
  const [tab, setTab] = useState<"design" | "preview">("design");

  // 当前选中的图层；null 表示「全局尺寸」
  const [selectedLayer, setSelectedLayer] = useState<QteEditorLayerId | null>(
    null,
  );

  // 倒计时是否正在播放
  const [playing, setPlaying] = useState(false);

  // 演示用 QteVisualModel，初始为默认值
  const [model, setModel] = useState<QteVisualModel>(() =>
    createDemoVisualModel(),
  );

  // 本地预览提示文案（仅本地，不写入 settings）
  const [localPrompt, setLocalPrompt] = useState<string>("按 F 键");

  // 当前已解析样式：首次渲染时从 ctx 读取，之后本地乐观更新
  const [style, setStyle] = useState<QteResolvedStyle>(() =>
    readStyle(ctx),
  );

  // 倒计时定时器引用，便于在停止 / 卸载时清理
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * 倒计时播放 / 暂停副作用。
   *
   * 当 `playing` 为 true 时启动 50ms 间隔定时器，调用 `tickDemoRemaining`
   * 推进 `model.remainingSec`；为 false 或组件卸载时清理定时器。
   */
  useEffect(() => {
    if (!playing) {
      return;
    }

    tickTimerRef.current = setInterval(() => {
      setModel((prev) => ({
        ...prev,
        remainingSec: tickDemoRemaining(
          prev.remainingSec,
          TICK_DT_SEC,
          prev.timeoutSec,
        ),
      }));
    }, TICK_INTERVAL_MS);

    return () => {
      if (tickTimerRef.current !== null) {
        clearInterval(tickTimerRef.current);
        tickTimerRef.current = null;
      }
    };
  }, [playing]);

  /**
   * 字段变更处理：规范化 → 写入 qte 模块 settings → 本地乐观更新。
   *
   * 即便 `cross.set` 抛错（宿主未实现 / Player 端只读），也吞错继续，
   * 保证本地编辑体验不中断；下次重读时若宿主真没写入，会回落默认值。
   *
   * @param field - 样式字段键
   * @param value - 原始输入值（颜色字符串或数值）
   */
  const handleFieldChange = (
    field: QteStyleFieldKey,
    value: string | number,
  ): void => {
    const next = normalizeQteStyleField(field, value);
    try {
      ctx.settings.cross.set("qte", field, next);
    } catch {
      // 宿主可能未实现 cross.set 或处于只读环境；吞错以保证本地编辑不中断
    }
    setStyle((prev) => ({ ...prev, [field]: next }));
  };

  /**
   * 触发 Perfect 闪光预览：开 `showPerfectFlash`，400ms 后自动关闭。
   *
   * 闪光时长与运行时 `qte-session` 的停留时间一致，便于编辑者预览真实效果。
   */
  const handleFlashPreview = (): void => {
    setModel((prev) => ({ ...prev, showPerfectFlash: true }));
    setTimeout(() => {
      setModel((prev) => ({ ...prev, showPerfectFlash: false }));
    }, FLASH_DURATION_MS);
  };

  /**
   * 切换倒计时播放 / 暂停。
   *
   * 暂停时同步关掉闪光，避免静止画面残留闪光元素。
   */
  const togglePlaying = (): void => {
    setPlaying((prev) => {
      const next = !prev;
      if (!next) {
        setModel((m) => ({ ...m, showPerfectFlash: false }));
      }
      return next;
    });
  };

  // 顶部工具条：播放 / 暂停按钮
  const toolbar = (
    <button
      type="button"
      onClick={togglePlaying}
      style={{
        padding: "6px 14px",
        fontSize: 13,
        fontWeight: 600,
        color: "#ff6b9f",
        background: "rgba(255, 77, 143, 0.14)",
        border: "1px solid rgba(255, 77, 143, 0.5)",
        borderRadius: 6,
        cursor: "pointer",
        transition: "background 120ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(255, 77, 143, 0.22)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(255, 77, 143, 0.14)";
      }}
    >
      {playing ? "暂停倒计时" : "播放倒计时"}
    </button>
  );

  // 设计页左栏：图层列表
  const left = (
    <LayerList
      layers={QTE_EDITOR_LAYERS}
      selected={selectedLayer}
      onSelect={setSelectedLayer}
    />
  );

  // 设计页中栏：预览舞台（默认带框带网格）
  const center = (
    <PreviewStage
      style={style}
      model={model}
      highlightLayer={selectedLayer}
    />
  );

  // 设计页右栏：属性面板
  // - fields 来自当前选中层；flash 层额外显示「播放闪光预览」按钮
  // - prompt 层无样式字段，渲染本地预览提示输入
  const right = (
    <PropertyPanel
      fields={fieldsForLayer(selectedLayer)}
      style={style}
      onChange={handleFieldChange}
      showFlashButton={selectedLayer === "flash"}
      onFlashPreview={handleFlashPreview}
      localPrompt={localPrompt}
      onLocalPromptChange={setLocalPrompt}
    />
  );

  // 预览页：全宽预览舞台 + 底部简单工具条（播放、闪光）
  const previewCenter = (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ flex: 1, minHeight: 0 }}>
        <PreviewStage
          style={style}
          model={model}
          highlightLayer={selectedLayer}
          fullBleed
        />
      </div>
      <div
        style={{
          flex: "0 0 auto",
          display: "flex",
          gap: 8,
          padding: "10px 14px",
          borderTop: "1px solid rgba(255, 255, 255, 0.06)",
          background: "#1a1a20",
        }}
      >
        <button
          type="button"
          onClick={togglePlaying}
          style={{
            padding: "6px 14px",
            fontSize: 13,
            fontWeight: 600,
            color: "#ff6b9f",
            background: "rgba(255, 77, 143, 0.14)",
            border: "1px solid rgba(255, 77, 143, 0.5)",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          {playing ? "暂停倒计时" : "播放倒计时"}
        </button>
        <button
          type="button"
          onClick={handleFlashPreview}
          style={{
            padding: "6px 14px",
            fontSize: 13,
            fontWeight: 600,
            color: "#ffd66b",
            background: "rgba(255, 214, 107, 0.12)",
            border: "1px solid rgba(255, 214, 107, 0.5)",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          播放闪光预览
        </button>
      </div>
    </div>
  );

  return (
    <EditorShell
      tab={tab}
      onTabChange={setTab}
      title="QTE 样式编辑器"
      toolbar={toolbar}
      left={left}
      center={tab === "design" ? center : previewCenter}
      right={right}
    />
  );
};
