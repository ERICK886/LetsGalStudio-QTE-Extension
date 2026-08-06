# QTE 扩展 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 LetsGal 运行时 QTE：单键/连打、中央双环 UI、perfect/normal/defeat 三种结果与可选片段跳转。

**Architecture:** 单一 `QteExtension` 模块暴露 `start-qte` 方法；纯逻辑在 `qte-logic.ts` 判定结果；`qte-session.ts` 负责计时/键位/与 UI 通信；`qte-overlay.tsx` 渲染外环半径收缩 + 内环 Perfect 提示；结算时按片段配置调用 `unsafe_goToFragment` 或继续剧情。

**Tech Stack:** TypeScript、React 18、Vite 5、`@avg-studio/sdk`（本地 `sdk/`）、Node 内置 `node:test`（仅测纯逻辑，用 `npx tsx` 运行）。

## Global Constraints

- 扩展稳定 id：`ink.zenly.qte-f9e583`（版本 `1.0.0`）
- 禁止手改 `sdk/` 与 `dist/`；行为变更只改 `src/` 后 `npm run build`
- 不引入第二份 React；保持 Vite `external` 配置
- 新文件 kebab-case；禁止用 `any` 掩盖 SDK 契约
- 源码顶部文件头注释：文件名、作者、日期、版本；函数需详细中文注释
- Git commit 仅在用户明确要求时执行（本计划中的 Commit 步骤默认跳过，改为确认 `git status` 干净改动集）
- 规格来源：`docs/superpowers/specs/2026-08-06-qte-design.md`

---

## File Structure

| 文件 | 职责 |
|------|------|
| `src/key-utils.ts` | 键名规范化与显示名 |
| `src/qte-logic.ts` | 参数规范化、结果判定（纯函数） |
| `src/qte-logic.test.ts` | 纯逻辑单测 |
| `src/qte-session.ts` | 会话生命周期、计时、快捷键、结算 |
| `src/qte-overlay.tsx` | 双环 UI、按钮、连打计数、Perfect 闪光 |
| `src/index.tsx` | `QteExtension` + `startQte` method |
| 删除 `src/welcome-ui.tsx` | 移除模板 UI |
| `README.md` | 更新为 QTE 用法说明 |
| `package.json` | 增加 `test:logic` 脚本（tsx + node:test） |

---

### Task 1: 键名工具 `key-utils`

**Files:**
- Create: `src/key-utils.ts`
- Create: `src/key-utils.test.ts`

**Interfaces:**
- Produces:
  - `normalizeShortcut(raw: string): string`
  - `displayKeyLabel(code: string): string`

- [ ] **Step 1: 写失败测试**

创建 `src/key-utils.test.ts`：

```ts
/**
 * 文件名：key-utils.test.ts
 * 作者：池水三两升
 * 日期：2026-08-06
 * 版本：1.0.0
 * 描述：key-utils 单元测试
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { displayKeyLabel, normalizeShortcut } from "./key-utils";

describe("normalizeShortcut", () => {
  it("trims and maps aliases", () => {
    assert.equal(normalizeShortcut(" f "), "KeyF");
    assert.equal(normalizeShortcut("space"), "Space");
    assert.equal(normalizeShortcut("KeyA"), "KeyA");
  });
});

describe("displayKeyLabel", () => {
  it("shows friendly labels", () => {
    assert.equal(displayKeyLabel("KeyF"), "F");
    assert.equal(displayKeyLabel("Space"), "空格");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx --yes tsx --test src/key-utils.test.ts
```

Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 `key-utils.ts`**

```ts
/**
 * 文件名：key-utils.ts
 * 作者：池水三两升
 * 日期：2026-08-06
 * 版本：1.0.0
 * 描述：QTE 按键字符串规范化与 UI 显示名
 */

const ALIASES: Record<string, string> = {
  space: "Space",
  " ": "Space",
  enter: "Enter",
  return: "Enter",
  esc: "Escape",
  escape: "Escape",
};

/**
 * 将作者填写的按键文本规范为 `bindShortcut` 可用的 code。
 *
 * @param raw - 作者输入，如 `"f"`、`"KeyF"`、`"space"`
 * @returns 规范化后的快捷键字符串；空输入回退 `"KeyF"`
 *
 * @example
 * normalizeShortcut("f") // "KeyF"
 */
export function normalizeShortcut(raw: string): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "KeyF";

  const lower = trimmed.toLowerCase();
  if (ALIASES[lower]) return ALIASES[lower];

  if (/^[a-z]$/i.test(trimmed)) {
    return `Key${trimmed.toUpperCase()}`;
  }

  if (/^Key[A-Z]$/i.test(trimmed)) {
    return `Key${trimmed.slice(3).toUpperCase()}`;
  }

  return trimmed;
}

/**
 * 将 KeyboardEvent.code 风格键名转为 UI 短标签。
 *
 * @param code - 规范化键名
 * @returns 显示用短文本
 */
export function displayKeyLabel(code: string): string {
  const normalized = normalizeShortcut(code);
  if (normalized === "Space") return "空格";
  if (normalized === "Enter") return "回车";
  if (normalized === "Escape") return "Esc";
  if (/^Key[A-Z]$/.test(normalized)) return normalized.slice(3);
  if (/^Digit\d$/.test(normalized)) return normalized.slice(5);
  return normalized;
}
```

- [ ] **Step 4: 再跑测试确认通过**

```bash
npx --yes tsx --test src/key-utils.test.ts
```

Expected: PASS

- [ ] **Step 5: 记录改动（默认不 commit）**

```bash
git status
```

---

### Task 2: 纯判定逻辑 `qte-logic`

**Files:**
- Create: `src/qte-logic.ts`
- Create: `src/qte-logic.test.ts`

**Interfaces:**
- Consumes: 无
- Produces:
  - `export type QteMode = "single" | "mash"`
  - `export type QteOutcome = "perfect" | "normal" | "defeat"`
  - `export interface QteNormalizedConfig { ... }`
  - `normalizeQteConfig(input: QteConfigInput): QteNormalizedConfig`
  - `judgeSingle(elapsedSec: number, cfg: QteNormalizedConfig): QteOutcome`
  - `judgeMash(elapsedSec: number, hitCount: number, cfg: QteNormalizedConfig): QteOutcome | null`
  - `outcomeFromSkip(skipCountsAsPass: boolean): QteOutcome`
  - `pickFragment(outcome, cfg): string | undefined`

- [ ] **Step 1: 写失败测试**

`src/qte-logic.test.ts` 覆盖：

```ts
/**
 * 文件名：qte-logic.test.ts
 * 作者：池水三两升
 * 日期：2026-08-06
 * 版本：1.0.0
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  judgeMash,
  judgeSingle,
  normalizeQteConfig,
  outcomeFromSkip,
} from "./qte-logic";

describe("normalizeQteConfig", () => {
  it("clamps perfect window and disables when start>=end", () => {
    const cfg = normalizeQteConfig({
      mode: "single",
      key: "KeyF",
      timeoutSec: 5,
      perfectStartSec: -1,
      perfectEndSec: 9,
      mashCount: 0,
      failOnWrongKey: false,
      skipCountsAsPass: true,
    });
    assert.equal(cfg.timeoutSec, 5);
    assert.equal(cfg.perfectStartSec, 0);
    assert.equal(cfg.perfectEndSec, 5);
    assert.equal(cfg.perfectEnabled, true);
    assert.equal(cfg.mashCount, 1);

    const bad = normalizeQteConfig({
      mode: "single",
      key: "KeyF",
      timeoutSec: 5,
      perfectStartSec: 3,
      perfectEndSec: 3,
      mashCount: 10,
      failOnWrongKey: false,
      skipCountsAsPass: true,
    });
    assert.equal(bad.perfectEnabled, false);
  });
});

describe("judgeSingle", () => {
  it("returns perfect / normal by window", () => {
    const cfg = normalizeQteConfig({
      mode: "single",
      key: "KeyF",
      timeoutSec: 5,
      perfectStartSec: 1,
      perfectEndSec: 2,
      mashCount: 1,
      failOnWrongKey: false,
      skipCountsAsPass: true,
    });
    assert.equal(judgeSingle(1.5, cfg), "perfect");
    assert.equal(judgeSingle(3, cfg), "normal");
  });
});

describe("judgeMash", () => {
  it("perfect when filled before perfectEnd", () => {
    const cfg = normalizeQteConfig({
      mode: "mash",
      key: "KeyF",
      timeoutSec: 5,
      perfectStartSec: 0,
      perfectEndSec: 2,
      mashCount: 3,
      failOnWrongKey: false,
      skipCountsAsPass: true,
    });
    assert.equal(judgeMash(1.5, 2, cfg), null);
    assert.equal(judgeMash(1.5, 3, cfg), "perfect");
    assert.equal(judgeMash(3, 3, cfg), "normal");
  });
});

describe("outcomeFromSkip", () => {
  it("defaults to normal when pass", () => {
    assert.equal(outcomeFromSkip(true), "normal");
    assert.equal(outcomeFromSkip(false), "defeat");
  });
});
```

- [ ] **Step 2: 跑测确认失败**

```bash
npx --yes tsx --test src/qte-logic.test.ts
```

Expected: FAIL

- [ ] **Step 3: 实现 `qte-logic.ts`**

完整实现需包含以下导出（实现时按测试补全，保持无 DOM / 无 SDK 依赖）：

```ts
/**
 * 文件名：qte-logic.ts
 * 作者：池水三两升
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

/** 规范化配置：裁剪时限与 Perfect 窗，mashCount 至少为 1。 */
export function normalizeQteConfig(input: QteConfigInput): QteNormalizedConfig {
  const timeoutSec = Math.max(0.1, Number(input.timeoutSec) || 5);
  let perfectStartSec = Math.min(timeoutSec, Math.max(0, Number(input.perfectStartSec) || 0));
  let perfectEndSec = Math.min(timeoutSec, Math.max(0, Number(input.perfectEndSec) || 0));
  if (perfectEndSec < perfectStartSec) {
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

function emptyToUndef(v?: string): string | undefined {
  const s = (v ?? "").trim();
  return s ? s : undefined;
}

/** 单键：根据 elapsed 判定 perfect 或 normal（调用方保证未超时）。 */
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

export function outcomeFromSkip(skipCountsAsPass: boolean): QteOutcome {
  return skipCountsAsPass ? "normal" : "defeat";
}

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
```

注意：若 `perfectStartSec === perfectEndSec`（测试用例 3 与 3），`perfectEnabled` 必须为 `false`。上面交换逻辑在相等时不会启用——`perfectEndSec > perfectStartSec` 已覆盖。但测试里 `perfectEndSec: 9` 会 clamp 到 5 且 start 0，enabled true。相等 case：不要交换成问题；直接 `perfectEnabled = end > start`。

修正规范化中「start>end 才交换」，相等则 `perfectEnabled=false`：

```ts
  let perfectStartSec = ...
  let perfectEndSec = ...
  if (perfectStartSec > perfectEndSec) {
    const t = perfectStartSec;
    perfectStartSec = perfectEndSec;
    perfectEndSec = t;
  }
  const perfectEnabled = perfectEndSec > perfectStartSec;
```

- [ ] **Step 4: 跑测通过**

```bash
npx --yes tsx --test src/qte-logic.test.ts
```

Expected: PASS

- [ ] **Step 5: `git status`（不 commit）**

---

### Task 3: 会话控制器 `qte-session`

**Files:**
- Create: `src/qte-session.ts`

**Interfaces:**
- Consumes: `normalizeQteConfig`、`judgeSingle`、`judgeMash`、`pickFragment`、`normalizeShortcut`、`outcomeFromSkip`
- Produces:
  - `export type QteUiSnapshot = { ... }`
  - `export function runQteSession(ctx: ExtensionContext, input: QteConfigInput): Promise<QteOutcome>`
  - 模块级 `getActiveQteSnapshot(): QteUiSnapshot | null` + `subscribeQteUi(listener): () => void`（供 overlay 订阅）
  - `export function reportQteCorrectInput(): void`（屏幕按钮调用）

- [ ] **Step 1: 实现会话（无独立单测；逻辑已在 Task 2 覆盖）**

`runQteSession` 要点：

```ts
/**
 * 文件名：qte-session.ts
 * 作者：池水三两升
 * 日期：2026-08-06
 * 版本：1.0.0
 * 描述：QTE 会话生命周期：UI、计时、键位、结算与清理
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

const UI_ID = "qte"; // 与 @extension id 一致，供 ctx.ui.show

export interface QteUiSnapshot {
  running: boolean;
  keyLabel: string;
  prompt: string;
  mode: "single" | "mash";
  mashCount: number;
  hitCount: number;
  timeoutSec: number;
  remainingSec: number;
  perfectStartSec: number;
  perfectEndSec: number;
  perfectEnabled: boolean;
  showPerfectFlash: boolean;
}

type Listener = () => void;

let listeners = new Set<Listener>();
let snapshot: QteUiSnapshot | null = null;
let active: {
  cfg: QteNormalizedConfig;
  startedAt: number;
  hitCount: number;
  unbindKey: (() => void) | null;
  timer: ReturnType<typeof setInterval> | null;
  resolve: (o: QteOutcome) => void;
  settled: boolean;
  rafAbort: AbortController;
} | null = null;

export function getActiveQteSnapshot(): QteUiSnapshot | null {
  return snapshot;
}

export function subscribeQteUi(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(): void {
  for (const l of listeners) l();
}

function setSnapshot(next: QteUiSnapshot | null): void {
  snapshot = next;
  emit();
}

/** 屏幕按钮：与正确键等价。 */
export function reportQteCorrectInput(): void {
  if (!active || active.settled) return;
  handleCorrect(active);
}

async function cancelActive(ctx: ExtensionContext): Promise<void> {
  if (!active) return;
  const prev = active;
  prev.settled = true;
  prev.rafAbort.abort();
  if (prev.timer) clearInterval(prev.timer);
  prev.unbindKey?.();
  try {
    await ctx.ui.hide(UI_ID);
  } catch {
    /* ignore */
  }
  setSnapshot(null);
  // 取消旧场：以 defeat 结束 Promise，但不跳片段
  prev.resolve("defeat");
  active = null;
}

/**
 * 启动一场 QTE，阻塞至结算。
 *
 * @param ctx - 扩展上下文
 * @param input - 方法参数
 * @returns 最终结果
 */
export async function runQteSession(
  ctx: ExtensionContext,
  input: QteConfigInput,
): Promise<QteOutcome> {
  if (active) {
    await cancelActive(ctx);
  }

  const key = normalizeShortcut(input.key);
  const cfg = normalizeQteConfig({ ...input, key });

  return new Promise<QteOutcome>((resolve) => {
    const startedAt = performance.now();
    const rafAbort = new AbortController();

    const finish = async (outcome: QteOutcome, jump: boolean) => {
      if (!active || active.settled) return;
      active.settled = true;
      rafAbort.abort();
      if (active.timer) clearInterval(active.timer);
      active.unbindKey?.();

      if (outcome === "perfect") {
        setSnapshot({
          ...(snapshot as QteUiSnapshot),
          showPerfectFlash: true,
          remainingSec: Math.max(0, cfg.timeoutSec - (performance.now() - startedAt) / 1000),
          hitCount: active.hitCount,
        });
        await sleep(220);
      }

      try {
        await ctx.ui.hide(UI_ID);
      } catch {
        /* ignore */
      }
      setSnapshot(null);

      const session = active;
      active = null;

      if (jump) {
        const { fragmentId, chapterId } = pickFragment(outcome, cfg);
        if (fragmentId) {
          ctx.flow.unsafe_goToFragment(
            fragmentId,
            chapterId ? { chapterId } : undefined,
          );
        }
      }

      session?.resolve(outcome);
      resolve(outcome);
    };

    active = {
      cfg,
      startedAt,
      hitCount: 0,
      unbindKey: null,
      timer: null,
      resolve: () => {},
      settled: false,
      rafAbort,
    };
    // 保存 resolve 到 active（上面占位后覆写）
    active.resolve = (o) => resolve(o);

    const tick = () => {
      if (!active || active.settled) return;
      const elapsed = (performance.now() - startedAt) / 1000;
      const remaining = Math.max(0, cfg.timeoutSec - elapsed);
      setSnapshot({
        running: true,
        keyLabel: displayKeyLabel(cfg.key),
        prompt: cfg.prompt,
        mode: cfg.mode,
        mashCount: cfg.mashCount,
        hitCount: active.hitCount,
        timeoutSec: cfg.timeoutSec,
        remainingSec: remaining,
        perfectStartSec: cfg.perfectStartSec,
        perfectEndSec: cfg.perfectEndSec,
        perfectEnabled: cfg.perfectEnabled,
        showPerfectFlash: false,
      });
      if (remaining <= 0) {
        void finish("defeat", true);
      }
    };

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

    void ctx.ui.show(UI_ID, {}, { size: "(100%, 100%)", position: "(0, 0)", interactable: true });

    active.unbindKey = ctx.input.bindShortcut(cfg.key, () => {
      if (!active || active.settled) return;
      handleCorrect(active);
    });

    // 可选：若 SDK 支持全局 keydown 且 failOnWrongKey，可另绑监听；
    // 第一版若 bindShortcut 无法区分错键，则仅在 overlay 内忽略错键文档说明，
    // failOnWrongKey 通过 window keydown（仅 QTE 期间）实现：

    const onKeyDown = (ev: KeyboardEvent) => {
      if (!active || active.settled) return;
      if (ev.repeat) return;
      if (ev.code === cfg.key) return; // 正确键由 bindShortcut 处理，避免双计
      if (cfg.failOnWrongKey) {
        void finish("defeat", true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    const prevUnbind = active.unbindKey;
    active.unbindKey = () => {
      prevUnbind?.();
      window.removeEventListener("keydown", onKeyDown);
    };

    active.timer = setInterval(tick, 50);
    tick();

    const onAbort = () => {
      void (async () => {
        if (!active || active.settled) return;
        active.settled = true;
        rafAbort.abort();
        if (active.timer) clearInterval(active.timer);
        active.unbindKey?.();
        try {
          await ctx.ui.hide(UI_ID);
        } catch {
          /* ignore */
        }
        setSnapshot(null);
        const s = active;
        active = null;
        s?.resolve("defeat");
        resolve("defeat");
      })();
    };
    if (ctx.flow.signal.aborted) onAbort();
    else ctx.flow.signal.addEventListener("abort", onAbort, { once: true });
  });
}

function handleCorrect(session: NonNullable<typeof active>): void {
  const elapsed = (performance.now() - session.startedAt) / 1000;
  if (elapsed > session.cfg.timeoutSec) return;

  if (session.cfg.mode === "single") {
    const outcome = judgeSingle(elapsed, session.cfg);
    void settleFromHandle(outcome);
    return;
  }

  session.hitCount += 1;
  const judged = judgeMash(elapsed, session.hitCount, session.cfg);
  // 刷新 snapshot hitCount
  if (snapshot) {
    setSnapshot({ ...snapshot, hitCount: session.hitCount });
  }
  if (judged) {
    void settleFromHandle(judged);
  }
}

async function settleFromHandle(outcome: QteOutcome): Promise<void> {
  // 通过 active 闭包 finish —— 实现时把 finish 提到模块级或存在 active 上
  // 计划要求：实现者将 finish 挂到 active.finish = finish，此处调用 active.finish(outcome, true)
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** 供 method.skip 调用 */
export async function skipQteSession(
  ctx: ExtensionContext,
  input: QteConfigInput,
): Promise<QteOutcome> {
  const cfg = normalizeQteConfig({
    ...input,
    key: normalizeShortcut(input.key),
  });
  const outcome = outcomeFromSkip(cfg.skipCountsAsPass);
  if (active) {
    // 走统一结算（含跳转）
    // active.finish(outcome, true)
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
```

实现时必须把草稿中的 `settleFromHandle` / `finish` 挂接完整，避免悬空引用；以「一场会话一个 `finish` 闭包存在 `active`」为准。

- [ ] **Step 2: TypeScript 能被后续入口引用（先不 build 全量）**

确认导出名称与上表一致。

- [ ] **Step 3: `git status`**

---

### Task 4: 覆盖层 UI `qte-overlay`

**Files:**
- Create: `src/qte-overlay.tsx`
- Delete: `src/welcome-ui.tsx`（在 Task 5 切换入口后删除亦可）

**Interfaces:**
- Consumes: `getActiveQteSnapshot`、`subscribeQteUi`、`reportQteCorrectInput`、`ExtensionProps`
- Produces: `QteOverlay` React 组件

- [ ] **Step 1: 实现双环 UI**

视觉规则：

- 外环 `scale = 0.52 + 0.48 * (remainingSec / timeoutSec)`（剩余 100% 时最大，归零时贴近按键）
- 内环固定在 Perfect 区视觉半径；`perfectEnabled` 时显示；当前 elapsed 落在窗内时提高亮度
- 中央按钮显示 `keyLabel`；`onClick` → `reportQteCorrectInput()`
- `mode === "mash"` 显示 `hitCount / mashCount`
- `showPerfectFlash` 时叠加金色光晕动画

组件订阅：

```tsx
const [, force] = useState(0);
useEffect(() => subscribeQteUi(() => force((x) => x + 1)), []);
const snap = getActiveQteSnapshot();
```

若 `snap` 为空，渲染透明全屏占位（避免闪断）。

- [ ] **Step 2: 文件头与详细注释按用户规范添加**

- [ ] **Step 3: `git status`**

---

### Task 5: 扩展入口 `index.tsx` + README + 构建

**Files:**
- Modify: `src/index.tsx`（整体替换）
- Delete: `src/welcome-ui.tsx`
- Modify: `README.md`
- Modify: `package.json`（增加 `"test:logic": "tsx --test src/key-utils.test.ts src/qte-logic.test.ts"`，tsx 用 npx 亦可写 `"test:logic": "npx --yes tsx --test src/*.test.ts"`）

**Interfaces:**
- Consumes: `runQteSession`、`skipQteSession`、`QteOverlay`
- Produces: default export `QteExtension`

- [ ] **Step 1: 重写 `src/index.tsx`**

```tsx
/**
 * 文件名：index.tsx
 * 作者：池水三两升
 * 日期：2026-08-06
 * 版本：1.0.0
 * 描述：QTE 扩展入口 —— UI 覆盖层 + start-qte 剧本方法
 */
import {
  Extension,
  extension,
  method,
  type ExtensionRenderData,
} from "@avg-studio/sdk";
import { QteOverlay, type QteOverlayProps } from "./qte-overlay";
import { runQteSession, skipQteSession } from "./qte-session";
import type { QteMode } from "./qte-logic";

@extension({ id: "qte", label: "QTE" })
class QteExtension extends Extension<QteOverlayProps> {
  render(): ExtensionRenderData<QteOverlayProps> {
    return {
      component: QteOverlay,
      props: this.data ?? {},
    };
  }

  static startQte = method({
    id: "start-qte",
    title: "开始 QTE",
    description: "单键或连打限时 QTE，结果可为 perfect / normal / defeat",
    schema: {
      mode: {
        type: "enum",
        label: "模式",
        default: "single",
        options: [
          { label: "单键限时", value: "single" },
          { label: "连打", value: "mash" },
        ],
      },
      key: { type: "string", label: "按键", default: "KeyF", required: true },
      timeoutSec: {
        type: "number",
        label: "总时限(秒)",
        default: 5,
        min: 0.1,
        step: 0.1,
        required: true,
      },
      perfectStartSec: {
        type: "number",
        label: "Perfect起点(秒)",
        default: 0,
        min: 0,
        step: 0.1,
      },
      perfectEndSec: {
        type: "number",
        label: "Perfect终点(秒)",
        default: 1,
        min: 0,
        step: 0.1,
      },
      mashCount: {
        type: "number",
        label: "连打次数",
        default: 10,
        min: 1,
        step: 1,
      },
      failOnWrongKey: {
        type: "boolean",
        label: "按错即失败",
        default: false,
      },
      skipCountsAsPass: {
        type: "boolean",
        label: "跳过算过",
        default: true,
      },
      perfectFragment: {
        type: "fragment",
        label: "Perfect片段",
        chapterField: "perfectChapterId",
      },
      normalFragment: {
        type: "fragment",
        label: "Normal片段",
        chapterField: "normalChapterId",
      },
      defeatFragment: {
        type: "fragment",
        label: "Defeat片段",
        chapterField: "defeatChapterId",
      },
      prompt: { type: "string", label: "提示文案" },
    },
    async run(ctx, params) {
      await runQteSession(ctx, {
        mode: params.mode as QteMode,
        key: params.key,
        timeoutSec: params.timeoutSec,
        perfectStartSec: params.perfectStartSec,
        perfectEndSec: params.perfectEndSec,
        mashCount: params.mashCount,
        failOnWrongKey: params.failOnWrongKey,
        skipCountsAsPass: params.skipCountsAsPass,
        perfectFragment: params.perfectFragment,
        normalFragment: params.normalFragment,
        defeatFragment: params.defeatFragment,
        perfectChapterId: (params as Record<string, string>).perfectChapterId,
        normalChapterId: (params as Record<string, string>).normalChapterId,
        defeatChapterId: (params as Record<string, string>).defeatChapterId,
        prompt: params.prompt,
      });
    },
    async skip(ctx, params) {
      await skipQteSession(ctx, {
        mode: params.mode as QteMode,
        key: params.key,
        timeoutSec: params.timeoutSec,
        perfectStartSec: params.perfectStartSec,
        perfectEndSec: params.perfectEndSec,
        mashCount: params.mashCount,
        failOnWrongKey: params.failOnWrongKey,
        skipCountsAsPass: params.skipCountsAsPass,
        perfectFragment: params.perfectFragment,
        normalFragment: params.normalFragment,
        defeatFragment: params.defeatFragment,
        perfectChapterId: (params as Record<string, string>).perfectChapterId,
        normalChapterId: (params as Record<string, string>).normalChapterId,
        defeatChapterId: (params as Record<string, string>).defeatChapterId,
        prompt: params.prompt,
      });
    },
  });
}

export default QteExtension;
```

注意：`ParamsOf` 对未在 schema 声明的 `chapterField` 辅助字段可能推不出类型——用最小范围收窄读取即可，勿滥用 `any`。

- [ ] **Step 2: 删除 `welcome-ui.tsx`，更新 README 为 QTE 用法（参数表 + Studio 验收步骤）**

- [ ] **Step 3: 安装依赖并构建**

```bash
npm install
npm run build
```

Expected: 成功生成 `dist/index.js`，无 TS 错误

- [ ] **Step 4: 跑纯逻辑测试**

```bash
npx --yes tsx --test src/key-utils.test.ts src/qte-logic.test.ts
```

Expected: 全部 PASS

- [ ] **Step 5: `git status` 确认改动文件集合合理**

---

### Task 6: Studio 人工验收清单（执行者勾选）

在 LetsGal Studio 中：

- [ ] 单键窗内 → perfect；窗外未超时 → normal；超时 → defeat
- [ ] 连打在 perfectEnd 前凑满 → perfect；之后凑满 → normal
- [ ] 屏幕按钮与键盘等价
- [ ] `failOnWrongKey` 开/关
- [ ] 三片段全空 → 继续剧情
- [ ] 只填 defeat → 失败跳转、成功继续
- [ ] 快进默认 normal；关闭「跳过算过」→ defeat
- [ ] 外环半径随时间收缩；Perfect 金色反馈

---

## Self-Review（对照 spec）

| Spec 项 | 对应 Task |
|---------|-----------|
| 单键 + 连打 + 屏幕按钮 | Task 3–5 |
| perfect/normal/defeat + 可选片段 | Task 2–3 |
| 外环半径收缩 + 内环 | Task 4 |
| 作者指定按键 | Task 1, 5 |
| failOnWrongKey | Task 3 |
| skipCountsAsPass 默认 true | Task 2, 5 |
| 不改 extension id / sdk / 手改 dist | Global Constraints |
| 删除 welcome 模板 | Task 5 |
| Studio 验收 | Task 6 |

已消除草稿中 `finish` 悬空风险说明：实现 Task 3 时必须把 `finish` 挂到 `active`。  
类型名全程统一：`QteOutcome` / `QteNormalizedConfig` / `runQteSession`。
