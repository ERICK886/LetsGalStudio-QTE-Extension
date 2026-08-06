/**
 * 文件名：qte-session.ts
 * 作者：池水三两升
 * 日期：2026-08-06
 * 版本：1.0.0
 * 描述：QTE 会话生命周期：UI 显隐、计时刷新、键位绑定、命中结算与清理
 *
 * 本模块不实现 overlay 视觉组件（Task 4/5 负责），只管理会话状态并导出
 * 供 overlay 订阅的 UI 快照（QteUiSnapshot）。
 */

import type { ExtensionContext } from "@avg-studio/sdk";
import { displayKeyLabel, normalizeShortcut } from "./key-utils";
import {
  judgeMash,
  judgeSingle,
  normalizeQteConfig,
  outcomeFromSkip,
  pickFragment,
  type QteConfigInput,
  type QteNormalizedConfig,
  type QteOutcome,
} from "./qte-logic";

/**
 * UI 模块标识，必须与 @extension({ id: "qte" }) 模块 id 一致，
 * 供 ctx.ui.show / ctx.ui.hide 使用。
 *
 * 注意：不是 extension.json 中的 id（extension.json.id 为 "qte-f9e583"）。
 */
const UI_ID = "qte";

/**
 * 供 overlay 订阅的 UI 状态快照。
 *
 * 所有字段均为只读展示数据，overlay 仅负责渲染，不修改会话逻辑。
 */
export interface QteUiSnapshot {
  /** 当前是否有会话正在进行 */
  running: boolean;
  /** 展示给玩家的按键标签（如 "F" / "空格"） */
  keyLabel: string;
  /** 提示文本 */
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
}

/** 订阅 UI 快照变化的监听器类型 */
type Listener = () => void;

/** 当前所有 overlay 订阅者 */
const listeners = new Set<Listener>();

/** 当前对外暴露的 UI 快照 */
let snapshot: QteUiSnapshot | null = null;

/**
 * 一个正在运行的 QTE 会话的内部状态。
 *
 * finish 挂在会话对象自身上，避免跨会话闭包导致误操作其它会话。
 */
interface ActiveSession {
  /** 规范化后的配置 */
  cfg: QteNormalizedConfig;
  /** 会话启动时刻（performance.now()） */
  startedAt: number;
  /** 当前有效命中次数 */
  hitCount: number;
  /** 解绑按键监听的函数（包含 bindShortcut + window keydown） */
  unbindKey: (() => void) | null;
  /** 计时器句柄（setInterval） */
  timer: ReturnType<typeof setInterval> | null;
  /** 用于 resolve runQteSession 返回的 Promise */
  resolve: (o: QteOutcome) => void;
  /** 是否已结算（防止重复 finish） */
  settled: boolean;
  /** 是否仍允许在 finish 中跳转片段；abort/cancel 会将其置 false */
  allowJump: boolean;
  /** Promise 是否已 resolve，防止 finish/cancel/abort 重复 resolve */
  promiseSettled: boolean;
  /** 移除 abort 信号监听器的函数 */
  removeAbortListener: (() => void) | null;
  /** 结算并清理：outcome 为结果，jump 为是否跳转片段 */
  finish: (outcome: QteOutcome, jump: boolean) => Promise<void>;
}

/** 当前正在运行的会话；null 表示没有活跃会话 */
let active: ActiveSession | null = null;

/**
 * 获取当前 UI 快照。
 *
 * @returns 当前快照；无会话时返回 null
 */
export function getActiveQteSnapshot(): QteUiSnapshot | null {
  return snapshot;
}

/**
 * 订阅 UI 快照变化。
 *
 * @param listener - 快照变化时调用的无参回调
 * @returns 退订函数，调用后停止接收变化
 */
export function subscribeQteUi(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * 通知所有订阅者快照已变化。
 */
function emit(): void {
  for (const l of listeners) {
    l();
  }
}

/**
 * 更新快照并通知订阅者。
 *
 * @param next - 新的快照或 null（会话结束）
 */
function setSnapshot(next: QteUiSnapshot | null): void {
  snapshot = next;
  emit();
}

/**
 * 屏幕按钮：玩家点击 overlay 中的正确按钮时调用。
 *
 * 与按下正确物理键等效，均走 handleCorrect 结算。
 */
export function reportQteCorrectInput(): void {
  if (!active || active.settled) {
    return;
  }
  handleCorrect(active);
}

/**
 * 取消当前活跃会话，用于被新会话替换时。
 *
 * 行为：清理 UI 与键位，以 defeat 结束旧 Promise，**不跳转片段**。
 *
 * @param ctx - 扩展上下文，用于隐藏 UI
 */
async function cancelActive(ctx: ExtensionContext): Promise<void> {
  if (!active) {
    return;
  }

  const prev = active;
  prev.settled = true;
  prev.allowJump = false; // 阻止任何进行中的 finish 后续跳转

  prev.removeAbortListener?.();
  prev.removeAbortListener = null;

  if (prev.timer) {
    clearInterval(prev.timer);
    prev.timer = null;
  }

  prev.unbindKey?.();
  prev.unbindKey = null;

  setSnapshot(null);

  try {
    await ctx.ui.hide(UI_ID);
  } catch {
    // 宿主隐藏 UI 失败不应阻断后续清理
  }

  // 替换旧会话：以 defeat 结束，不触发任何片段跳转，且只 resolve 一次
  if (!prev.promiseSettled) {
    prev.promiseSettled = true;
    prev.resolve("defeat");
  }
  active = null;
}

/**
 * 根据会话和配置构建一份基础快照。
 *
 * 用于在 finish 结算前需要补齐 snapshot 的极端场景。
 *
 * @param session - 当前会话
 * @param cfg - 规范化配置
 * @returns 完整的 UI 快照
 */
function buildSnapshot(session: ActiveSession, cfg: QteNormalizedConfig): QteUiSnapshot {
  const elapsed = (performance.now() - session.startedAt) / 1000;
  return {
    running: true,
    keyLabel: displayKeyLabel(cfg.key),
    prompt: cfg.prompt,
    mode: cfg.mode,
    mashCount: cfg.mashCount,
    hitCount: session.hitCount,
    timeoutSec: cfg.timeoutSec,
    remainingSec: Math.max(0, cfg.timeoutSec - elapsed),
    perfectStartSec: cfg.perfectStartSec,
    perfectEndSec: cfg.perfectEndSec,
    perfectEnabled: cfg.perfectEnabled,
    showPerfectFlash: false,
  };
}

/**
 * 启动一场 QTE，阻塞至会话结束并返回判定结果。
 *
 * 如果已有活跃会话，会先取消旧会话（不跳转），再启动新会话。
 *
 * @param ctx - 扩展上下文
 * @param input - 作者/运行时传入的 QTE 配置
 * @returns 最终判定结果：perfect / normal / defeat
 */
export async function runQteSession(
  ctx: ExtensionContext,
  input: QteConfigInput,
): Promise<QteOutcome> {
  // 若已存在会话，先取消其键位与 UI，避免叠加
  if (active) {
    await cancelActive(ctx);
  }

  const key = normalizeShortcut(input.key);
  const cfg = normalizeQteConfig({ ...input, key });

  return new Promise<QteOutcome>((resolve) => {
    const startedAt = performance.now();

    // 先创建会话对象，再把 finish 绑定到对象自身，避免闭包指向全局 active 导致误伤其它会话
    const session: ActiveSession = {
      cfg,
      startedAt,
      hitCount: 0,
      unbindKey: null,
      timer: null,
      resolve,
      settled: false,
      allowJump: true,
      promiseSettled: false,
      removeAbortListener: null,
      finish: async () => {}, // 占位，下面立即覆盖
    };

    /**
     * 结算会话：停止计时、隐藏 UI、按需跳转片段、resolve Promise。
     *
     * @param outcome - 判定结果
     * @param jump - 是否按 outcome 跳转对应片段
     */
    session.finish = async (outcome: QteOutcome, jump: boolean) => {
      if (session.settled) {
        return;
      }
      session.settled = true;

      session.removeAbortListener?.();
      session.removeAbortListener = null;

      if (session.timer) {
        clearInterval(session.timer);
        session.timer = null;
      }
      session.unbindKey?.();
      session.unbindKey = null;

      // Perfect 命中时先显示闪光，短暂停留后再隐藏 UI，给玩家明确反馈
      if (outcome === "perfect") {
        const elapsed = (performance.now() - startedAt) / 1000;
        setSnapshot({
          ...(snapshot ?? buildSnapshot(session, cfg)),
          showPerfectFlash: true,
          remainingSec: Math.max(0, cfg.timeoutSec - elapsed),
          hitCount: session.hitCount,
        });
        await sleep(220);

        // 闪光期间若会话被 abort/cancel/替换，必须禁止后续跳转
        if (!session.allowJump) {
          jump = false;
        }
      }

      try {
        await ctx.ui.hide(UI_ID);
      } catch {
        // 宿主隐藏 UI 失败不应阻断后续流程
      }
      setSnapshot(null);

      // 只有 finish 才将 active 置空；abort/cancel 已在各自路径中处理
      if (active === session) {
        active = null;
      }

      // 隐藏 UI 期间仍可能被取消，再次检查是否允许跳转
      if (!session.allowJump) {
        jump = false;
      }

      // 需要跳转时按 outcome 选择目标片段
      if (jump) {
        const { fragmentId, chapterId } = pickFragment(outcome, cfg);
        if (fragmentId) {
          ctx.flow.unsafe_goToFragment(
            fragmentId,
            chapterId ? { chapterId } : undefined,
          );
        }
      }

      // 确保 Promise 只 resolve 一次
      if (!session.promiseSettled) {
        session.promiseSettled = true;
        session.resolve(outcome);
      }
    };

    // 将当前会话注册为全局活跃会话
    active = session;

    /**
     * 每 50ms 刷新一次 UI 快照，并在超时后自动结算为 defeat。
     */
    const tick = () => {
      if (active !== session || session.settled) {
        return;
      }

      const elapsed = (performance.now() - startedAt) / 1000;
      const remaining = Math.max(0, cfg.timeoutSec - elapsed);

      setSnapshot({
        running: true,
        keyLabel: displayKeyLabel(cfg.key),
        prompt: cfg.prompt,
        mode: cfg.mode,
        mashCount: cfg.mashCount,
        hitCount: session.hitCount,
        timeoutSec: cfg.timeoutSec,
        remainingSec: remaining,
        perfectStartSec: cfg.perfectStartSec,
        perfectEndSec: cfg.perfectEndSec,
        perfectEnabled: cfg.perfectEnabled,
        showPerfectFlash: false,
      });

      if (remaining <= 0) {
        // 超时：按 defeat 结算并跳转 defeat 片段
        void session.finish("defeat", true);
      }
    };

    /**
     * 全局 window keydown 监听，用于 failOnWrongKey。
     *
     * 正确键由 bindShortcut 单独处理，这里忽略；
     * 重复按键也忽略，避免连发导致误判。
     */
    const onKeyDown = (ev: KeyboardEvent) => {
      if (active !== session || session.settled) {
        return;
      }
      if (ev.repeat) {
        return;
      }
      if (normalizeShortcut(ev.code) === cfg.key) {
        // 正确键由 bindShortcut 处理，避免重复判定
        return;
      }
      if (cfg.failOnWrongKey) {
        // 按错键：按 defeat 结算并跳转 defeat 片段
        void session.finish("defeat", true);
      }
    };

    /**
     * 启动会话：显示 UI、绑定正确键、绑定错误键监听、启动计时器。
     */
    const start = async () => {
      // 初始快照：在 UI 显示前设置，避免 overlay 第一次渲染时拿到 null
      setSnapshot({
        running: true,
        keyLabel: displayKeyLabel(cfg.key),
        prompt: cfg.prompt,
        mode: cfg.mode,
        mashCount: cfg.mashCount,
        hitCount: 0,
        timeoutSec: cfg.timeoutSec,
        remainingSec: cfg.timeoutSec,
        perfectStartSec: cfg.perfectStartSec,
        perfectEndSec: cfg.perfectEndSec,
        perfectEnabled: cfg.perfectEnabled,
        showPerfectFlash: false,
      });

      try {
        await ctx.ui.show(UI_ID, {}, { size: "(100%, 100%)", position: "(0, 0)", interactable: true });
      } catch {
        // 宿主显示 UI 失败不应阻断 QTE 继续运行
      }

      const unbindShortcut = ctx.input.bindShortcut(cfg.key, () => {
        if (active !== session || session.settled) {
          return;
        }
        handleCorrect(session);
      });

      window.addEventListener("keydown", onKeyDown);

      // 合并解绑函数：确保取消时同时移除 bindShortcut 与 window 监听
      session.unbindKey = () => {
        unbindShortcut();
        window.removeEventListener("keydown", onKeyDown);
      };

      session.timer = setInterval(tick, 50);
      tick();
    };

    void start();

    /**
     * 宿主发送 abort 信号时：清理 UI 与键位，以 defeat 结束 Promise，**不跳转片段**。
     */
    const onAbort = () => {
      void (async () => {
        // 即使 finish 已 settled，也要阻止它后续再跳转片段
        session.allowJump = false;

        if (active !== session || session.promiseSettled) {
          return;
        }
        session.settled = true;

        session.removeAbortListener?.();
        session.removeAbortListener = null;

        if (session.timer) {
          clearInterval(session.timer);
          session.timer = null;
        }
        session.unbindKey?.();
        session.unbindKey = null;

        try {
          await ctx.ui.hide(UI_ID);
        } catch {
          // 忽略宿主隐藏失败
        }
        setSnapshot(null);

        if (active === session) {
          active = null;
        }

        session.promiseSettled = true;
        session.resolve("defeat");
      })();
    };

    session.removeAbortListener = () =>
      ctx.flow.signal.removeEventListener("abort", onAbort);

    if (ctx.flow.signal.aborted) {
      onAbort();
    } else {
      ctx.flow.signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

/**
 * 处理一次正确按键输入。
 *
 * - single 模式：按 elapsed 判定 perfect / normal，立即结算并跳转
 * - mash 模式：增加命中次数，未凑满时仅刷新快照；凑满后按规则结算并跳转
 *
 * @param session - 当前会话
 */
function handleCorrect(session: ActiveSession): void {
  const elapsed = (performance.now() - session.startedAt) / 1000;

  // 超时后不应再接受输入（超时由 tick 自动处理）
  if (elapsed > session.cfg.timeoutSec) {
    return;
  }

  if (session.cfg.mode === "single") {
    const outcome = judgeSingle(elapsed, session.cfg);
    void session.finish(outcome, true);
    return;
  }

  session.hitCount += 1;
  const judged = judgeMash(elapsed, session.hitCount, session.cfg);

  // 连打过程中刷新命中次数，让 overlay 实时显示进度
  if (snapshot) {
    setSnapshot({ ...snapshot, hitCount: session.hitCount });
  }

  if (judged) {
    void session.finish(judged, true);
  }
}

/**
 * 毫秒级睡眠工具。
 *
 * @param ms - 毫秒数
 * @returns 延迟后 resolve 的 Promise
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 跳过 QTE 时调用。
 *
 * 行为：
 * - 若当前有活跃会话，按 skip 结果统一结算并跳转（调用 active.finish）
 * - 若没有活跃会话，直接根据 skipCountsAsPass 计算 outcome 并跳转对应片段
 *
 * @param ctx - 扩展上下文
 * @param input - 原始 QTE 配置
 * @returns 跳过后的判定结果
 */
export async function skipQteSession(
  ctx: ExtensionContext,
  input: QteConfigInput,
): Promise<QteOutcome> {
  const key = normalizeShortcut(input.key);
  const cfg = normalizeQteConfig({ ...input, key });
  const outcome = outcomeFromSkip(cfg.skipCountsAsPass);

  if (active) {
    // 走统一结算路径，包含 UI 隐藏与片段跳转
    await active.finish(outcome, true);
  } else {
    const { fragmentId, chapterId } = pickFragment(outcome, cfg);
    if (fragmentId) {
      ctx.flow.unsafe_goToFragment(
        fragmentId,
        chapterId ? { chapterId } : undefined,
      );
    }
  }

  return outcome;
}
