/**
 * 文件名：qte-inline-cards.ts
 * 作者：池水三两升
 * 日期：2026-08-06
 * 版本：1.0.0
 * 描述：Studio 编辑器内联卡片 hack（非 SDK 正式接口）
 *
 * 参考手机扩展 `phone-inline-cards.ts`：通过受限 DOM/Fiber 探测，
 * 把本扩展的 `start-qte` 方法块显示为深绿色摘要卡片；不写入编辑器数据，
 * Inspector 仍是参数编辑的唯一入口。宿主 DOM 变更或探测失败时静默保留原生块。
 *
 * 片段显示名：paramsJson 仅存 id，通过 Fiber 扫描 `project.chapters[].fragments[].name`
 * 解析为「章节 / 片段」（与 Inspector 下拉一致）。
 *
 * @example
 * ```ts
 * // 在扩展入口侧效导入即可安装
 * import "./studio/qte-inline-cards";
 * ```
 */

import { displayKeyLabel, resolveQteKeyParam } from "../qte/key-utils";

/** 本扩展包 ID（与 extension.json 一致） */
const HOST_EXTENSION_ID = "ink.zenly.qte-f9e583";

const CARD_ATTRIBUTE = "data-qte-inline-card";
const HOST_ATTRIBUTE = "data-qte-inline-card-host";
const ORIGINAL_DISPLAY_ATTRIBUTE = "data-qte-inline-original-display";
const STYLE_ATTRIBUTE = "data-qte-inline-card-style";
const BLOCK_SELECTOR = '.bn-block-content[data-content-type="callExtensionFunction"]';
const RUNTIME_KEY = "__inkZenlyQteInlineCards";

/** 深绿色强调色（卡片左边条 / 标题徽章） */
const ACCENT_GREEN = "#166534";
/** 深绿底上的浅色文字，保证对比度 */
const ACCENT_TEXT = "#ecfdf5";

/** 本扩展目前对外暴露的方法 id */
type QteMethodId = "start-qte";

interface ExtensionBlock {
  id?: unknown;
  type?: unknown;
  props?: { target?: unknown; paramsJson?: unknown };
}

interface ReactFiber {
  memoizedProps?: Record<string, unknown> & { block?: ExtensionBlock };
  pendingProps?: Record<string, unknown> & { block?: ExtensionBlock };
  memoizedState?: unknown;
  stateNode?: unknown;
  type?: unknown;
  dependencies?: unknown;
  alternate?: ReactFiber | null;
  return?: ReactFiber | null;
  child?: ReactFiber | null;
  sibling?: ReactFiber | null;
}

/** fragmentId → 「章节名 / 片段名」或仅片段名 */
type FragmentNameMap = Map<string, string>;

interface InlineCardRuntime {
  observer?: MutationObserver;
  themeObserver?: MutationObserver;
  inspectorRefresh?: (event: Event) => void;
  frame?: number;
  dispose(): void;
}

/** 片段目录缓存（避免每帧全树扫描） */
let fragmentCatalogCache: { map: FragmentNameMap; at: number } | null = null;
const FRAGMENT_CATALOG_TTL_MS = 1500;

const METHOD_META: Record<QteMethodId, { label: string; icon: string }> = {
  "start-qte": { label: "开始 QTE", icon: "◎" },
};

/**
 * 判断值是否为普通对象记录。
 *
 * @param value - 任意值
 * @returns 是否为非数组对象
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 将字符串收窄为已知方法 id。
 *
 * @param value - 路径末段
 * @returns 方法 id 或 undefined
 */
function asQteMethodId(value: string): QteMethodId | undefined {
  return Object.prototype.hasOwnProperty.call(METHOD_META, value)
    ? (value as QteMethodId)
    : undefined;
}

/**
 * 从块的 target 路径解析本扩展方法 id。
 *
 * @param block - Fiber 上的扩展块
 * @returns 方法 id 或 undefined
 */
function qteMethodId(block: ExtensionBlock | undefined): QteMethodId | undefined {
  if (block?.type !== "callExtensionFunction") return undefined;
  const target = block.props?.target;
  if (typeof target !== "string" || !target.includes(HOST_EXTENSION_ID)) {
    return undefined;
  }
  // 兼容 `extension-id/method-id` 与 `extension-id/ui-id/method-id`
  const segments = target.split("/");
  return asQteMethodId(segments[segments.length - 1] ?? "");
}

/**
 * 优先用 Fiber 块解析方法；失败时仅在当前块文本内兜底（不向上读编辑器根）。
 *
 * @param content - BlockNote 内容节点
 * @param block - 已解析的块（可空）
 * @returns 方法 id 或 undefined
 */
function qteMethodIdFromContent(
  content: HTMLElement,
  block: ExtensionBlock | undefined,
): QteMethodId | undefined {
  const fromBlock = qteMethodId(block);
  if (fromBlock) return fromBlock;

  const blockRoot = content.closest<HTMLElement>("[data-id]") ?? content;
  const text = blockRoot.textContent ?? "";
  if (!text.includes(HOST_EXTENSION_ID)) return undefined;
  return (
    (Object.entries(METHOD_META).find(([, meta]) =>
      text.includes(meta.label),
    )?.[0] ?? undefined) as QteMethodId | undefined
  );
}

/**
 * 解包 Studio paramsJson（兼容 lit / literal / value 封装）。
 *
 * @param paramsJson - 块上的 JSON 字符串
 * @returns 扁平参数表
 */
function literalParams(paramsJson: unknown): Record<string, unknown> {
  if (typeof paramsJson !== "string") return {};
  try {
    const raw: unknown = JSON.parse(paramsJson);
    if (!isRecord(raw)) return {};
    return Object.fromEntries(
      Object.entries(raw).map(([key, value]) => {
        if (!isRecord(value) || !("value" in value)) return [key, value];
        return [key, value.value];
      }),
    );
  } catch {
    return {};
  }
}

/**
 * 截断过长摘要文本。
 *
 * @param value - 原始值
 * @param limit - 最大长度
 * @returns 截断后字符串
 */
function truncate(value: unknown, limit = 72): string {
  if (typeof value !== "string") return "";
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > limit
    ? `${normalized.slice(0, limit - 1)}…`
    : normalized;
}

/**
 * 从 chapters 数组灌入 id→名称 映射。
 *
 * @param chapters - `project.chapters`
 * @param map - 输出表
 * @returns 是否写入了至少一条
 */
function ingestChapters(chapters: unknown, map: FragmentNameMap): boolean {
  if (!Array.isArray(chapters) || chapters.length === 0) return false;
  let count = 0;
  for (const chapter of chapters) {
    if (!isRecord(chapter)) continue;
    const chapterName =
      typeof chapter.name === "string" ? chapter.name.trim() : "";
    const fragments = chapter.fragments;
    if (!Array.isArray(fragments)) continue;
    for (const frag of fragments) {
      if (!isRecord(frag)) continue;
      const id = typeof frag.id === "string" ? frag.id.trim() : "";
      const name = typeof frag.name === "string" ? frag.name.trim() : "";
      if (!id || !name) continue;
      // 与 Inspector 选项文案一致：章节 / 片段
      map.set(id, chapterName ? `${chapterName} / ${name}` : name);
      count += 1;
    }
  }
  return count > 0;
}

/**
 * 在任意对象图中寻找 `project.chapters` / `chapters`。
 *
 * @param value - 待扫描值
 * @param map - 输出表
 * @param depth - 当前深度
 * @param seen - 防环
 */
function scanValueForChapters(
  value: unknown,
  map: FragmentNameMap,
  depth: number,
  seen: Set<unknown>,
): void {
  if (value == null || depth > 5) return;
  if (typeof value !== "object") return;
  if (seen.has(value)) return;
  seen.add(value);

  if (Array.isArray(value)) {
    if (
      value.length > 0 &&
      isRecord(value[0]) &&
      Array.isArray(value[0].fragments)
    ) {
      ingestChapters(value, map);
    }
    // 数组元素过多时只扫前几项，避免卡顿
    const limit = Math.min(value.length, 8);
    for (let i = 0; i < limit; i += 1) {
      scanValueForChapters(value[i], map, depth + 1, seen);
    }
    return;
  }

  if (!isRecord(value)) return;

  if (ingestChapters(value.chapters, map)) return;
  if (isRecord(value.project) && ingestChapters(value.project.chapters, map)) {
    return;
  }

  for (const key of [
    "project",
    "state",
    "value",
    "data",
    "store",
    "getState",
    "chapters",
    "_currentValue",
    "memoizedValue",
  ] as const) {
    if (!(key in value)) continue;
    const next = value[key];
    // Zustand getState 可能是函数
    if (typeof next === "function" && key === "getState") {
      try {
        scanValueForChapters(
          (next as () => unknown)(),
          map,
          depth + 1,
          seen,
        );
      } catch {
        // 忽略
      }
      continue;
    }
    scanValueForChapters(next, map, depth + 1, seen);
    if (map.size > 0 && depth >= 2) return;
  }
}

/**
 * 扫描单根 Fiber：props / hooks state / context。
 *
 * @param fiber - Fiber 节点
 * @param map - 输出表
 */
function scanFiberNode(fiber: ReactFiber, map: FragmentNameMap): void {
  const seen = new Set<unknown>();
  scanValueForChapters(fiber.memoizedProps, map, 0, seen);
  scanValueForChapters(fiber.pendingProps, map, 0, seen);
  scanValueForChapters(fiber.stateNode, map, 0, seen);

  // hooks 链表
  let hook: unknown = fiber.memoizedState;
  for (let i = 0; hook && i < 48; i += 1) {
    if (!isRecord(hook)) break;
    scanValueForChapters(hook.memoizedState, map, 0, seen);
    scanValueForChapters(hook.queue, map, 0, seen);
    hook = hook.next;
  }

  // Context._currentValue
  const type = fiber.type;
  if (isRecord(type) && isRecord(type._context)) {
    scanValueForChapters(type._context._currentValue, map, 0, seen);
  }

  // dependencies.firstContext
  const deps = fiber.dependencies;
  if (isRecord(deps)) {
    let ctx: unknown = deps.firstContext;
    for (let i = 0; ctx && i < 24; i += 1) {
      if (!isRecord(ctx)) break;
      scanValueForChapters(ctx.memoizedValue, map, 0, seen);
      ctx = ctx.next;
    }
  }
}

/**
 * 读取 DOM 节点上的 React Fiber 根。
 *
 * @param el - DOM 元素
 * @returns Fiber 或 undefined
 */
function fiberFromElement(el: Element | null | undefined): ReactFiber | undefined {
  if (!el) return undefined;
  const fiberKey = Object.keys(el).find((key) =>
    key.startsWith("__reactFiber$"),
  );
  if (!fiberKey) return undefined;
  return (el as unknown as Record<string, ReactFiber | undefined>)[fiberKey];
}

/**
 * 从编辑器 Fiber 树收集片段显示名目录（与 Inspector 同源数据）。
 *
 * paramsJson 只存 fragment id；名称在 `project.chapters[].fragments[].name`。
 *
 * @param content - 当前块内容节点（用于向上回溯）
 * @returns id → 显示名
 */
function collectFragmentNameMap(content: HTMLElement): FragmentNameMap {
  const now = Date.now();
  if (
    fragmentCatalogCache &&
    now - fragmentCatalogCache.at < FRAGMENT_CATALOG_TTL_MS &&
    fragmentCatalogCache.map.size > 0
  ) {
    return fragmentCatalogCache.map;
  }

  const map: FragmentNameMap = new Map();

  // 1) 从当前块向上找（常能碰到带 project 的布局/页面组件）
  let fiber = fiberFromElement(content);
  for (let hops = 0; fiber && hops < 100; hops += 1) {
    scanFiberNode(fiber, map);
    if (map.size > 0) break;
    fiber = fiber.return ?? undefined;
  }

  // 2) 仍空则从应用根 BFS（限步数）
  if (map.size === 0) {
    const rootEl =
      document.getElementById("root") ??
      document.querySelector("#app") ??
      document.body;
    const rootFiber = fiberFromElement(rootEl);
    if (rootFiber) {
      const queue: ReactFiber[] = [rootFiber];
      const visited = new Set<ReactFiber>();
      for (let steps = 0; queue.length > 0 && steps < 400; steps += 1) {
        const node = queue.shift();
        if (!node || visited.has(node)) continue;
        visited.add(node);
        scanFiberNode(node, map);
        if (map.size > 0) break;
        if (node.child) queue.push(node.child);
        if (node.sibling) queue.push(node.sibling);
      }
    }
  }

  fragmentCatalogCache = { map, at: now };
  return map;
}

/**
 * 从片段参数中取出稳定 id。
 *
 * @param value - 原始参数值
 * @returns fragment id 或空串
 */
function extractFragmentId(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (!isRecord(value)) return "";
  for (const key of ["fragmentId", "id", "value"] as const) {
    const id = value[key];
    if (typeof id === "string" && id.trim()) return id.trim();
  }
  return "";
}

/**
 * 沿 DOM / React Fiber 查找与当前块 id 匹配的扩展块。
 *
 * @param content - 块内容元素
 * @returns 扩展块或 undefined
 */
function findBlock(content: HTMLElement): ExtensionBlock | undefined {
  const blockRoot = content.closest<HTMLElement>("[data-id]");
  const expectedBlockId = blockRoot?.dataset.id;
  const candidates: Element[] = [];
  for (let node: HTMLElement | null = content; node; node = node.parentElement) {
    candidates.push(node);
    if (node === blockRoot) break;
  }
  candidates.push(...content.querySelectorAll("*"));

  let qteBlockFallback: ExtensionBlock | undefined;
  for (const candidate of candidates) {
    let fiber = fiberFromElement(candidate);
    while (fiber) {
      const blocks = [
        fiber.pendingProps?.block,
        fiber.memoizedProps?.block,
        fiber.alternate?.pendingProps?.block,
        fiber.alternate?.memoizedProps?.block,
      ];
      for (const block of blocks) {
        if (!block?.id) continue;
        if (expectedBlockId && String(block.id) === expectedBlockId) return block;
        if (!qteBlockFallback && qteMethodId(block)) qteBlockFallback = block;
      }
      fiber = fiber.return ?? undefined;
    }
  }
  return qteBlockFallback;
}

/**
 * 写入深绿色主题 CSS 变量。
 *
 * @param card - 卡片根节点
 * @param _content - 宿主块（预留）
 */
function applyTheme(card: HTMLElement, _content: HTMLElement): void {
  card.style.setProperty("--qte-inline-accent", ACCENT_GREEN);
  card.style.setProperty("--qte-inline-accent-text", ACCENT_TEXT);
}

/**
 * 注入内联卡片样式（幂等）。
 */
function addStyles(): void {
  if (document.querySelector(`style[${STYLE_ATTRIBUTE}]`)) return;
  const style = document.createElement("style");
  style.setAttribute(STYLE_ATTRIBUTE, "");
  style.textContent = `
[${HOST_ATTRIBUTE}] { align-self: stretch; flex: 0 0 100% !important; min-width: 0; width: 100% !important; box-sizing: border-box; }
[${CARD_ATTRIBUTE}] { align-self: stretch; flex: 0 0 100%; min-width: 0; width: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 7px; min-height: 42px; padding: 8px 11px; border: 1px solid var(--border-subtle, #383440); border-left: 3px solid var(--qte-inline-accent); border-radius: 5px; background: var(--bg-canvas, #1b1920); color: var(--fg-primary, #f4f0ff); font: 13px/1.4 var(--font-sans, sans-serif); user-select: none; }
[${CARD_ATTRIBUTE}] .qte-inline-card__header { display: inline-flex; align-items: center; align-self: flex-start; min-width: 0; padding: 3px 6px; border-radius: 3px; background: var(--qte-inline-accent); color: var(--qte-inline-accent-text, #052e16); }
[${CARD_ATTRIBUTE}] .qte-inline-card__badge { display: inline-flex; align-items: center; gap: 4px; min-width: 0; min-height: 22px; color: inherit; font-size: 13px; font-weight: 700; line-height: 1.25; }
[${CARD_ATTRIBUTE}] .qte-inline-card__icon { font-size: 14px; line-height: 1; }
[${CARD_ATTRIBUTE}] .qte-inline-card__title { overflow: hidden; color: inherit; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
[${CARD_ATTRIBUTE}] .qte-inline-card__chips { display: flex; flex-wrap: wrap; gap: 4px; }
[${CARD_ATTRIBUTE}] .qte-inline-card__chip { padding: 2px 5px; border: 1px solid var(--qte-inline-accent); border-radius: 3px; color: var(--fg-secondary, #c2bdcc); font-size: 11px; line-height: 1.35; }
`;
  document.head.append(style);
}

/**
 * 追加带 class 的文本节点。
 *
 * @param parent - 父元素
 * @param className - class
 * @param value - 文本
 */
function appendText(parent: HTMLElement, className: string, value: string): void {
  const element = document.createElement("span");
  element.className = className;
  element.textContent = value;
  parent.append(element);
}

/**
 * 追加一枚 chip。
 *
 * @param parent - chip 行
 * @param value - 文案
 */
function appendChip(parent: HTMLElement, value: string): void {
  const chip = document.createElement("span");
  chip.className = "qte-inline-card__chip";
  chip.textContent = value;
  parent.append(chip);
}

/**
 * 数字参数显示（带单位后缀）。
 *
 * @param value - 原始值
 * @param fallback - 缺省
 * @param suffix - 后缀
 * @returns 展示字符串
 */
function formatNumber(
  value: unknown,
  fallback: number,
  suffix = "",
): string {
  const n = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return `${n}${suffix}`;
}

/**
 * 将片段参数格式化为卡片可读文案（优先工程目录中的显示名）。
 *
 * @param value - perfectFragment / normalFragment / defeatFragment
 * @param names - Fiber 扫到的 id→名称表
 * @returns 片段显示名，或「未配置」
 */
function formatFragmentRef(
  value: unknown,
  names: FragmentNameMap,
): string {
  if (value == null) return "未配置";

  if (isRecord(value)) {
    for (const key of [
      "name",
      "title",
      "label",
      "displayName",
      "fragmentName",
    ] as const) {
      const named = value[key];
      if (typeof named === "string" && named.trim()) {
        return truncate(named.trim(), 40);
      }
    }
  }

  const id = extractFragmentId(value);
  if (!id) return "未配置";

  const fromCatalog = names.get(id);
  if (fromCatalog) return truncate(fromCatalog, 40);

  // 目录未就绪时暂显 id，避免空白
  return truncate(id, 32);
}

/**
 * 调用模式短后缀（默认 return 不显示）。
 *
 * @param mode - return / goto
 * @returns 如 `·切断`，默认空串
 */
function callModeSuffix(mode: unknown): string {
  return mode === "goto" ? "·切断" : "";
}

/**
 * 根据方法与参数生成 chips（不再渲染中间摘要行，避免与 tag 重复）。
 *
 * @param methodId - 方法 id
 * @param params - 解包后的参数
 * @param fragmentNames - 片段 id→显示名
 * @returns chips
 */
function renderDetails(
  methodId: QteMethodId,
  params: Record<string, unknown>,
  fragmentNames: FragmentNameMap,
): { chips: string[] } {
  switch (methodId) {
    case "start-qte": {
      const mash = params.mode === "mash";
      const modeLabel = mash ? "连打" : "单键限时";
      const keyCode = resolveQteKeyParam(params.key, params.customKeyCode);
      const keyLabel = displayKeyLabel(keyCode);
      const timeout = formatNumber(params.timeoutSec, 5, "s");
      const posX = formatNumber(params.posX, 50);
      const posY = formatNumber(params.posY, 50);
      const prompt = truncate(params.prompt, 40);

      const perfectLabel = formatFragmentRef(
        params.perfectFragment,
        fragmentNames,
      );
      const normalLabel = formatFragmentRef(
        params.normalFragment,
        fragmentNames,
      );
      const defeatLabel = formatFragmentRef(
        params.defeatFragment,
        fragmentNames,
      );

      const chips = [
        modeLabel,
        `键：${keyLabel}`,
        `时限：${timeout}`,
        `位置：${posX}%, ${posY}%`,
        `Perfect：${perfectLabel}${callModeSuffix(params.perfectCallMode)}`,
        `Normal：${normalLabel}${callModeSuffix(params.normalCallMode)}`,
        `Defeat：${defeatLabel}${callModeSuffix(params.defeatCallMode)}`,
      ];

      if (mash) {
        chips.splice(4, 0, `连打：${formatNumber(params.mashCount, 10)}次`);
      }

      if (prompt) {
        chips.push(`提示：${prompt}`);
      }
      if (params.failOnWrongKey === true) {
        chips.push("按错即失败");
      }
      if (params.skipCountsAsPass === false) {
        chips.push("跳过=失败");
      }

      return { chips };
    }
  }
}

/**
 * 渲染或更新内联卡片。
 *
 * @param content - 块内容宿主
 * @param block - Fiber 块
 * @param methodId - 方法 id
 * @param fragmentNames - 片段显示名目录
 */
function renderCard(
  content: HTMLElement,
  block: ExtensionBlock | undefined,
  methodId: QteMethodId,
  fragmentNames: FragmentNameMap,
): void {
  addStyles();
  content.setAttribute(HOST_ATTRIBUTE, "");
  const original = [...content.children].find(
    (child) =>
      !(child instanceof HTMLElement && child.hasAttribute(CARD_ATTRIBUTE)),
  );
  if (
    original instanceof HTMLElement &&
    !original.hasAttribute(ORIGINAL_DISPLAY_ATTRIBUTE)
  ) {
    original.setAttribute(
      ORIGINAL_DISPLAY_ATTRIBUTE,
      original.style.getPropertyValue("display"),
    );
    original.style.setProperty("display", "none", "important");
  }

  let card = content.querySelector<HTMLElement>(`:scope > [${CARD_ATTRIBUTE}]`);
  if (!card) {
    card = document.createElement("div");
    card.setAttribute(CARD_ATTRIBUTE, methodId);
    card.title = "点击此方法块后在 Inspector 编辑参数";
    content.append(card);
  }
  applyTheme(card, content);

  const params = literalParams(block?.props?.paramsJson);
  const { chips } = renderDetails(methodId, params, fragmentNames);
  const signature = `${methodId}\0${chips.join("\0")}`;
  if (card.dataset.signature === signature) return;
  card.dataset.signature = signature;
  card.replaceChildren();

  const header = document.createElement("div");
  header.className = "qte-inline-card__header";
  const badge = document.createElement("span");
  badge.className = "qte-inline-card__badge";
  appendText(badge, "qte-inline-card__icon", METHOD_META[methodId].icon);
  appendText(badge, "qte-inline-card__title", METHOD_META[methodId].label);
  header.append(badge);
  card.append(header);
  if (chips.length) {
    const chipRow = document.createElement("div");
    chipRow.className = "qte-inline-card__chips";
    chips.forEach((chip) => appendChip(chipRow, chip));
    card.append(chipRow);
  }
}

/**
 * 移除卡片并恢复原生块显示。
 *
 * @param content - 块内容宿主
 */
function restoreNativeBlock(content: HTMLElement): void {
  const card = content.querySelector(`:scope > [${CARD_ATTRIBUTE}]`);
  if (!card) return;
  card.remove();
  content.removeAttribute(HOST_ATTRIBUTE);
  const original = content.querySelector<HTMLElement>(
    `:scope > [${ORIGINAL_DISPLAY_ATTRIBUTE}]`,
  );
  if (!original) return;
  const display = original.getAttribute(ORIGINAL_DISPLAY_ATTRIBUTE);
  if (display) original.style.setProperty("display", display);
  else original.style.removeProperty("display");
  original.removeAttribute(ORIGINAL_DISPLAY_ATTRIBUTE);
}

/**
 * 扫描根节点下所有扩展方法块并刷新卡片。
 *
 * @param root - 扫描根（通常为 document）
 */
function refresh(root: ParentNode): void {
  const firstContent = root.querySelector<HTMLElement>(BLOCK_SELECTOR);
  const fragmentNames = firstContent
    ? collectFragmentNameMap(firstContent)
    : collectFragmentNameMap(document.body);

  for (const content of root.querySelectorAll<HTMLElement>(BLOCK_SELECTOR)) {
    const block = findBlock(content);
    const methodId = qteMethodIdFromContent(content, block);
    if (methodId) renderCard(content, block, methodId, fragmentNames);
    else if (content.querySelector(`:scope > [${CARD_ATTRIBUTE}]`)) {
      restoreNativeBlock(content);
    }
  }
}

/**
 * 安装 MutationObserver / 事件监听，开始维护内联卡片。
 * 重复调用会先 dispose 旧运行时，避免泄漏。
 */
function installInlineCards(): void {
  if (typeof document === "undefined") return;
  const globals = globalThis as typeof globalThis & {
    [RUNTIME_KEY]?: InlineCardRuntime;
  };
  globals[RUNTIME_KEY]?.dispose();

  const start = () => {
    const root = document;
    const runtime: InlineCardRuntime = {
      dispose() {
        if (runtime.frame !== undefined) cancelAnimationFrame(runtime.frame);
        runtime.observer?.disconnect();
        runtime.themeObserver?.disconnect();
        if (runtime.inspectorRefresh) {
          document.removeEventListener("input", runtime.inspectorRefresh, true);
          document.removeEventListener("change", runtime.inspectorRefresh, true);
        }
        document
          .querySelectorAll<HTMLElement>(BLOCK_SELECTOR)
          .forEach(restoreNativeBlock);
      },
    };
    const schedule = () => {
      if (runtime.frame !== undefined) return;
      runtime.frame = requestAnimationFrame(() => {
        runtime.frame = undefined;
        refresh(root);
      });
    };
    // Inspector 控件值常只写 Fiber，不一定改块 DOM；事件后下一帧重读。
    runtime.inspectorRefresh = () => schedule();
    document.addEventListener("input", runtime.inspectorRefresh, true);
    document.addEventListener("change", runtime.inspectorRefresh, true);
    runtime.observer = new MutationObserver(schedule);
    runtime.observer.observe(root, { childList: true, subtree: true });
    runtime.themeObserver = new MutationObserver(schedule);
    runtime.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    if (document.body) {
      runtime.themeObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ["class", "style"],
      });
    }
    window.addEventListener("pagehide", () => runtime.dispose(), { once: true });
    globals[RUNTIME_KEY] = runtime;
    schedule();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
}

installInlineCards();
