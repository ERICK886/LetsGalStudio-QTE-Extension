/**
 * 文件名：qte-logic.ts
 * 作者：池水三两七
 * 日期：2026-08-06
 * 版本：1.0.0
 * 描述：QTE 参数规范化与 perfect/normal/defeat 判定（纯函数）
 */

export type QteMode = "single" | "mash";
export type QteOutcome = "perfect" | "normal" | "defeat";

export interface QteConfigInput {
  mode: QteMode;
  key: string;
  timeoutSec: number;
  perfectStartSec: number;
  perfectEndSec: number;
  mashCount: number;
  failOnWrongKey: boolean;
  skipCountsAsPass: boolean;
  perfectFragment?: string;
  normalFragment?: string;
  defeatFragment?: string;
  perfectChapterId?: string;
  normalChapterId?: string;
  defeatChapterId?: string;
  prompt?: string;
}

export interface QteNormalizedConfig {
  mode: QteMode;
  key: string;
  timeoutSec: number;
  perfectStartSec: number;
  perfectEndSec: number;
  perfectEnabled: boolean;
  mashCount: number;
  failOnWrongKey: boolean;
  skipCountsAsPass: boolean;
  perfectFragment?: string;
  normalFragment?: string;
  defeatFragment?: string;
  perfectChapterId?: string;
  normalChapterId?: string;
  defeatChapterId?: string;
  prompt: string;
}

/**
 * 将空字符串或纯空白转为 undefined，便于可选字段归一化。
 *
 * @param v - 原始字符串
 * @returns 非空 trimmed 字符串，或 undefined
 */
function emptyToUndef(v?: string): string | undefined {
  const s = (v ?? "").trim();
  return s ? s : undefined;
}

/**
 * 规范化配置：裁剪时限与 Perfect 窗，mashCount 至少为 1。
 *
 * @param input - 作者/运行时原始 QTE 配置
 * @returns 裁剪与默认值处理后的配置；`perfectStartSec === perfectEndSec` 时 `perfectEnabled` 为 false
 *
 * @example
 * normalizeQteConfig({ mode: "single", key: "KeyF", timeoutSec: 5, ... })
 */
export function normalizeQteConfig(input: QteConfigInput): QteNormalizedConfig {
  const timeoutSec = Math.max(0.1, Number(input.timeoutSec) || 5);
  let perfectStartSec = Math.min(timeoutSec, Math.max(0, Number(input.perfectStartSec) || 0));
  let perfectEndSec = Math.min(timeoutSec, Math.max(0, Number(input.perfectEndSec) || 0));

  if (perfectStartSec > perfectEndSec) {
    const t = perfectStartSec;
    perfectStartSec = perfectEndSec;
    perfectEndSec = t;
  }

  const perfectEnabled = perfectEndSec > perfectStartSec;
  const mashCount = Math.max(1, Math.floor(Number(input.mashCount) || 1));

  return {
    mode: input.mode === "mash" ? "mash" : "single",
    key: input.key,
    timeoutSec,
    perfectStartSec,
    perfectEndSec,
    perfectEnabled,
    mashCount,
    failOnWrongKey: !!input.failOnWrongKey,
    skipCountsAsPass: input.skipCountsAsPass !== false,
    perfectFragment: emptyToUndef(input.perfectFragment),
    normalFragment: emptyToUndef(input.normalFragment),
    defeatFragment: emptyToUndef(input.defeatFragment),
    perfectChapterId: emptyToUndef(input.perfectChapterId),
    normalChapterId: emptyToUndef(input.normalChapterId),
    defeatChapterId: emptyToUndef(input.defeatChapterId),
    prompt: (input.prompt ?? "").trim(),
  };
}

/**
 * 单键：根据 elapsed 判定 perfect 或 normal（调用方保证未超时）。
 *
 * @param elapsedSec - 自 QTE 开始经过的秒数
 * @param cfg - 规范化后的配置
 * @returns `"perfect"` 或 `"normal"`
 */
export function judgeSingle(elapsedSec: number, cfg: QteNormalizedConfig): QteOutcome {
  if (
    cfg.perfectEnabled &&
    elapsedSec >= cfg.perfectStartSec &&
    elapsedSec <= cfg.perfectEndSec
  ) {
    return "perfect";
  }
  return "normal";
}

/**
 * 连打：未凑满返回 null；凑满则按 t≤perfectEnd 判 perfect，否则 normal。
 *
 * @param elapsedSec - 自 QTE 开始经过的秒数
 * @param hitCount - 当前有效按键次数
 * @param cfg - 规范化后的配置
 * @returns 判定结果；未达 mashCount 时为 null
 */
export function judgeMash(
  elapsedSec: number,
  hitCount: number,
  cfg: QteNormalizedConfig,
): QteOutcome | null {
  if (hitCount < cfg.mashCount) return null;
  if (cfg.perfectEnabled && elapsedSec <= cfg.perfectEndSec) return "perfect";
  return "normal";
}

/**
 * 跳过 QTE 时的结果映射。
 *
 * @param skipCountsAsPass - 跳过是否计为通过
 * @returns `"normal"` 或 `"defeat"`
 */
export function outcomeFromSkip(skipCountsAsPass: boolean): QteOutcome {
  return skipCountsAsPass ? "normal" : "defeat";
}

/**
 * 按 outcome 选取 fragment 与 chapter 跳转目标。
 *
 * @param outcome - 判定结果
 * @param cfg - 规范化后的配置
 * @returns fragmentId 与 chapterId（可能为 undefined）
 */
export function pickFragment(
  outcome: QteOutcome,
  cfg: QteNormalizedConfig,
): { fragmentId?: string; chapterId?: string } {
  if (outcome === "perfect") {
    return { fragmentId: cfg.perfectFragment, chapterId: cfg.perfectChapterId };
  }
  if (outcome === "normal") {
    return { fragmentId: cfg.normalFragment, chapterId: cfg.normalChapterId };
  }
  return { fragmentId: cfg.defeatFragment, chapterId: cfg.defeatChapterId };
}
