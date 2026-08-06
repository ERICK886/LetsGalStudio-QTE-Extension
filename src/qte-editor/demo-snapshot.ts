/**
 * 文件名：demo-snapshot.ts
 * 作者：池水三两升
 * 日期：2026-08-06
 * 版本：1.0.0
 * 描述：QTE 编辑器演示快照纯逻辑 —— 默认 model、倒计时 tick、图层→样式字段映射
 *
 * 本模块不含 React / DOM，供编辑器预览面板与后续 UI 复用。
 * `QteEditorLayerId` 与 `QteVisualHighlightLayer` 语义一致，在此 re-export 别名供 editor 使用。
 */

import type { QteVisualModel } from "../qte-visual";
import type { QteStyleFieldKey } from "../qte-style";

/**
 * 编辑器可选中的视觉层标识（不含 null）。
 *
 * 与 `QteVisualHighlightLayer` 的非 null 分支一一对应。
 */
export type QteEditorLayerId = "outer" | "perfect" | "button" | "prompt" | "flash";

/**
 * 编辑器图层面板展示顺序与中文标签。
 *
 * 顺序：外环 → Perfect 环 → 中心按钮 → 提示文案 → 闪光
 */
export const QTE_EDITOR_LAYERS: { id: QteEditorLayerId; label: string }[] = [
  { id: "outer", label: "外环" },
  { id: "perfect", label: "Perfect环" },
  { id: "button", label: "中心按钮" },
  { id: "prompt", label: "提示文案" },
  { id: "flash", label: "闪光" },
];

/** 演示用 QTE 总时限（秒） */
export const DEMO_TIMEOUT_SEC = 5;

/** 演示用 Perfect 窗口起始时间（秒，相对 QTE 开始） */
export const DEMO_PERFECT_START = 1.5;

/** 演示用 Perfect 窗口结束时间（秒，相对 QTE 开始） */
export const DEMO_PERFECT_END = 2.5;

/**
 * 构造编辑器演示用的 `QteVisualModel` 默认值，并可选择性覆盖字段。
 *
 * @param patch - 可选的部分字段覆盖；未传入的字段使用演示默认值
 * @returns 完整的展示数据模型，可直接传给 `QteVisual`
 *
 * @example
 * const model = createDemoVisualModel({ showPerfectFlash: true });
 * // model.posX === 50, model.timeoutSec === 5, ...
 */
export function createDemoVisualModel(
  patch?: Partial<QteVisualModel>,
): QteVisualModel {
  const defaults: QteVisualModel = {
    keyLabel: "F",
    prompt: "按 F 键",
    mode: "single",
    mashCount: 1,
    hitCount: 0,
    timeoutSec: DEMO_TIMEOUT_SEC,
    remainingSec: DEMO_TIMEOUT_SEC,
    perfectStartSec: DEMO_PERFECT_START,
    perfectEndSec: DEMO_PERFECT_END,
    perfectEnabled: true,
    showPerfectFlash: false,
    posX: 50,
    posY: 50,
  };

  return { ...defaults, ...patch };
}

/**
 * 演示倒计时：按帧间隔递减剩余时间；减至 ≤0 时循环重置为总时限。
 *
 * @param remainingSec - 当前剩余秒数
 * @param dtSec - 本帧经过的秒数（正数）
 * @param timeoutSec - 总时限；循环重置目标
 * @returns 下一帧剩余秒数；若 `remainingSec - dtSec <= 0` 则返回 `timeoutSec`
 *
 * @example
 * tickDemoRemaining(5, 0.1, 5);   // 4.9
 * tickDemoRemaining(0.05, 0.1, 5); // 5（循环）
 */
export function tickDemoRemaining(
  remainingSec: number,
  dtSec: number,
  timeoutSec: number,
): number {
  const next = remainingSec - dtSec;

  if (next <= 0) {
    return timeoutSec;
  }

  return next;
}

/**
 * 根据编辑器当前选中层，返回应暴露的样式 settings 字段列表。
 *
 * - `null`（未选中具体层 / 全局）→ 尺寸类：`ringDiameter`, `ringStroke`, `buttonSize`
 * - `outer` → 外环色 + 尺寸
 * - `perfect` → `perfectColor`
 * - `button` → 按钮色与尺寸
 * - `prompt` → `[]`（仅本地假文案，不写 settings）
 * - `flash` → `flashColor`
 *
 * @param layer - 当前选中层；`null` 表示全局/默认尺寸编辑
 * @returns 该层关联的 `QteStyleFieldKey` 列表（顺序稳定，供面板渲染）
 */
export function fieldsForLayer(
  layer: QteEditorLayerId | null,
): QteStyleFieldKey[] {
  switch (layer) {
    case null:
      return ["ringDiameter", "ringStroke", "buttonSize"];
    case "outer":
      return ["outerRingColor", "ringDiameter", "ringStroke"];
    case "perfect":
      return ["perfectColor"];
    case "button":
      return ["buttonBgColor", "buttonTextColor", "buttonSize"];
    case "prompt":
      return [];
    case "flash":
      return ["flashColor"];
  }
}
