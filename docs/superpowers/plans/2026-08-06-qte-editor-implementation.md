# QTE 样式编辑器（qte-editor）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在扩展内新增 Studio 风格的 `qte-editor` 程序 UI（P1+P2）：图层 + 画布 + 属性，实时预览并写入现有 `qte` 项目样式设置；不改 `start-qte` 方法与位置参数。

**Architecture:** 抽出纯展示组件 `QteVisual` 供运行时 Overlay 与编辑器共用；新建 `@extension({ id: "qte-editor" })` 模块，用 `settings.cross` 读写 `qte` 的 8 个样式字段；编辑器用本地演示快照驱动环缩放/闪光，永不调用 `runQteSession`。

**Tech Stack:** TypeScript、React 18、Vite 5、`@avg-studio/sdk`（本地 `sdk/`）、Node `node:test` + `tsx`（仅测纯逻辑）。

## Global Constraints

- 扩展稳定 id：`ink.zenly.qte-f9e583`；不改 `extension.json.id` / 不擅自升版本
- 禁止手改 `sdk/` 与 `dist/`；只改 `src/` 后 `npm run build`
- 不引入第二份 React；保持 Vite `external`
- 新文件 kebab-case；禁止 `any` 掩盖 SDK 契约
- 源码顶部文件头：文件名、作者「池水三两升」、日期、版本；函数需详细中文注释与空行
- **不做 P3**：组件架、任意拖拽布局、多状态、动画页、脚本页
- **不**持久化或编辑 `posX`/`posY` / 方法参数
- Git commit 仅在用户明确要求时执行（计划中的 Commit 步骤默认跳过）
- 规格：`docs/superpowers/specs/2026-08-06-qte-editor-design.md`

---

## File Structure

| 文件 | 职责 |
|------|------|
| `src/qte-style.ts` | 增补 `QTE_STYLE_LIMITS`、`normalizeQteStyleField`（写入前 clamp） |
| `src/qte-style.test.ts` | 覆盖 normalize / limits |
| `src/qte-visual.tsx` | 纯展示：双环/按钮/提示/闪光（无 session 订阅） |
| `src/qte-overlay.tsx` | 改为订阅 session + 调 `QteVisual` |
| `src/qte-editor/demo-snapshot.ts` | 演示快照常量、tick 剩余时间、图层 id 类型 |
| `src/qte-editor/demo-snapshot.test.ts` | 纯函数单测 |
| `src/qte-editor/layer-list.tsx` | 左栏固定图层列表 |
| `src/qte-editor/property-panel.tsx` | 右栏属性表单 |
| `src/qte-editor/preview-stage.tsx` | 中栏网格画布 + `QteVisual` |
| `src/qte-editor/editor-shell.tsx` | 顶栏页签 + 三栏布局壳 |
| `src/qte-editor/editor-panel.tsx` | 状态编排、cross 读写、播放/闪光 |
| `src/qte-editor/index.tsx` | `QteEditorExtension` |
| `src/index.tsx` | 同时导出 `QteExtension` 与 `QteEditorExtension` |
| `package.json` | `test:logic` 加入新测试文件 |
| `README.md` | 打开编辑器说明、与设置关系、不含 P3 |

---

### Task 1: 样式写入规范化（limits + normalize）

**Files:**
- Modify: `src/qte-style.ts`
- Modify: `src/qte-style.test.ts`
- Modify: `package.json`（若测试列表需显式列出——已 glob 则跳过）

**Interfaces:**
- Produces:
  - `QTE_STYLE_LIMITS: { ringDiameter: { min: 64, max: 600 }, ringStroke: { min: 2, max: 20 }, buttonSize: { min: 48, max: 200 } }`
  - `type QteStyleFieldKey = keyof QteResolvedStyle`
  - `normalizeQteStyleField(field: QteStyleFieldKey, value: unknown): string | number`  
    颜色：非法则回退该字段默认值；数字：`asClampedNumber` 到对应 limits

- [ ] **Step 1: 写失败测试**

在 `src/qte-style.test.ts` 追加：

```ts
import {
  QTE_STYLE_DEFAULTS,
  QTE_STYLE_LIMITS,
  normalizeQteStyleField,
} from "./qte-style";

describe("normalizeQteStyleField", () => {
  it("clamps ring diameter", () => {
    assert.equal(normalizeQteStyleField("ringDiameter", 10), QTE_STYLE_LIMITS.ringDiameter.min);
    assert.equal(normalizeQteStyleField("ringDiameter", 999), QTE_STYLE_LIMITS.ringDiameter.max);
  });

  it("falls back invalid color", () => {
    assert.equal(
      normalizeQteStyleField("outerRingColor", ""),
      QTE_STYLE_DEFAULTS.outerRingColor,
    );
  });
});
```

- [ ] **Step 2: 跑测确认失败**

Run: `npx --yes tsx --test src/qte-style.test.ts`  
Expected: FAIL（`QTE_STYLE_LIMITS` / `normalizeQteStyleField` 未导出）

- [ ] **Step 3: 实现**

在 `qte-style.ts` 导出 limits；将现有 `asClampedNumber` / `asColor` 复用于 `normalizeQteStyleField`（可把 `asClampedNumber` 保持文件内私有）。颜色字段走 `asColor(value, QTE_STYLE_DEFAULTS[field])`；尺寸字段走对应 min/max。

- [ ] **Step 4: 跑测通过**

Run: `npm run test:logic`  
Expected: 全部 pass

- [ ] **Step 5: Commit（默认跳过，除非用户要求）**

---

### Task 2: 抽出 `QteVisual` 并改写 Overlay

**Files:**
- Create: `src/qte-visual.tsx`
- Modify: `src/qte-overlay.tsx`

**Interfaces:**
- Consumes: `QteResolvedStyle`（`qte-style`）、`colorToRgba` / `dimColor` / `glowShadow`
- Produces:
  - `export type QteVisualModel = { keyLabel: string; prompt: string; mode: "single" | "mash"; mashCount: number; hitCount: number; timeoutSec: number; remainingSec: number; perfectStartSec: number; perfectEndSec: number; perfectEnabled: boolean; showPerfectFlash: boolean; posX: number; posY: number }`
  - `export type QteVisualProps = { style: QteResolvedStyle; model: QteVisualModel; interactive?: boolean; onButtonClick?: () => void; highlightLayer?: QteEditorLayerId | null }`  
    （`QteEditorLayerId` 可先在本文件定义为联合类型，Task 3 再抽到 `demo-snapshot.ts` 并 re-export，避免循环依赖时：先在 `qte-visual.tsx` 定义 `export type QteVisualHighlightLayer = "outer" | "perfect" | "button" | "prompt" | "flash" | null`）
  - `export const QteVisual: React.FC<QteVisualProps>`

**行为：**
- 把现有 overlay 中圆环/按钮/提示/闪光 DOM 移入 `QteVisual`
- `interactive === false` 时按钮 `pointerEvents: "none"`，不触发点击
- `highlightLayer` 非空时给对应层加 2px 描边高亮（编辑器选中反馈）；运行时传 `null`
- Overlay：继续 `subscribeQteUi` + `getActiveQteSnapshot`；无 snapshot 时透明占位；有则 `<QteVisual style={...} model={...} interactive onButtonClick={reportQteCorrectInput} />`

- [ ] **Step 1: 创建 `qte-visual.tsx`**

将缩放计算 `computeOuterScale` / `computeInnerScale` / `isInPerfectWindow` / `buttonHoverColor` 一并移入（或留在 visual 文件内私有）。保留 `@keyframes qte-perfect-flash`。

`QteVisual` 根节点仍为 `position:absolute; inset:0` 透明层；内部锚点用 `model.posX/posY`。

- [ ] **Step 2: 改写 `qte-overlay.tsx`**

删除已迁移的绘制代码；仅保留 session 订阅与空态占位。

- [ ] **Step 3: 构建**

Run: `npm run build`  
Expected: success，`dist/index.js` 更新

- [ ] **Step 4: Commit（默认跳过）**

---

### Task 3: 演示快照纯逻辑

**Files:**
- Create: `src/qte-editor/demo-snapshot.ts`
- Create: `src/qte-editor/demo-snapshot.test.ts`
- Modify: `package.json` → `test:logic` 加入 `src/qte-editor/demo-snapshot.test.ts`

**Interfaces:**
- Produces:
  - `export type QteEditorLayerId = "outer" | "perfect" | "button" | "prompt" | "flash"`
  - `export const QTE_EDITOR_LAYERS: { id: QteEditorLayerId; label: string }[]`  
    顺序与标签：外环 / Perfect环 / 中心按钮 / 提示文案 / 闪光
  - `export const DEMO_TIMEOUT_SEC = 5`
  - `export const DEMO_PERFECT_START = 1.5`
  - `export const DEMO_PERFECT_END = 2.5`
  - `export function createDemoVisualModel(patch?: Partial<QteVisualModel>): QteVisualModel`  
    默认：`keyLabel:"F"`, `prompt:"按 F 键"`, `mode:"single"`, `mashCount:1`, `hitCount:0`, `timeoutSec:5`, `remainingSec:5`, perfect 窗口如上，`perfectEnabled:true`, `showPerfectFlash:false`, `posX:50`, `posY:50`
  - `export function tickDemoRemaining(remainingSec: number, dtSec: number, timeoutSec: number): number`  
    递减；≤0 时重置为 `timeoutSec`（循环）
  - `export function fieldsForLayer(layer: QteEditorLayerId | null): QteStyleFieldKey[]`  
    - `null` → `ringDiameter`, `ringStroke`, `buttonSize`  
    - `outer` → `outerRingColor`, `ringDiameter`, `ringStroke`  
    - `perfect` → `perfectColor`  
    - `button` → `buttonBgColor`, `buttonTextColor`, `buttonSize`  
    - `prompt` → `[]`（仅本地假文案，不写 settings）  
    - `flash` → `flashColor`

- [ ] **Step 1: 写失败测试**

```ts
/**
 * 文件名：demo-snapshot.test.ts
 * 作者：池水三两升
 * 日期：2026-08-06
 * 版本：1.0.0
 * 描述：编辑器演示快照纯函数测试
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createDemoVisualModel,
  fieldsForLayer,
  tickDemoRemaining,
} from "./demo-snapshot";

describe("tickDemoRemaining", () => {
  it("decrements and loops", () => {
    assert.equal(tickDemoRemaining(0.05, 0.1, 5), 5);
    assert.ok(tickDemoRemaining(5, 0.1, 5) < 5);
  });
});

describe("fieldsForLayer", () => {
  it("maps layers", () => {
    assert.deepEqual(fieldsForLayer(null), [
      "ringDiameter",
      "ringStroke",
      "buttonSize",
    ]);
    assert.deepEqual(fieldsForLayer("perfect"), ["perfectColor"]);
    assert.deepEqual(fieldsForLayer("prompt"), []);
  });
});

describe("createDemoVisualModel", () => {
  it("centers at 50/50", () => {
    const m = createDemoVisualModel();
    assert.equal(m.posX, 50);
    assert.equal(m.posY, 50);
  });
});
```

- [ ] **Step 2: 跑测失败 → 实现 → 跑测通过**

Run: `npx --yes tsx --test src/qte-editor/demo-snapshot.test.ts`  
然后更新 `package.json` 的 `test:logic`，再 `npm run test:logic`。

- [ ] **Step 3: Commit（默认跳过）**

---

### Task 4: 编辑器壳与子面板（UI）

**Files:**
- Create: `src/qte-editor/layer-list.tsx`
- Create: `src/qte-editor/property-panel.tsx`
- Create: `src/qte-editor/preview-stage.tsx`
- Create: `src/qte-editor/editor-shell.tsx`

**Interfaces:**
- `LayerListProps`: `{ layers: typeof QTE_EDITOR_LAYERS; selected: QteEditorLayerId | null; onSelect: (id: QteEditorLayerId | null) => void }`  
  点击已选中项可取消选中（传 `null` → 显示全局尺寸）
- `PropertyPanelProps`: `{ fields: QteStyleFieldKey[]; style: QteResolvedStyle; readOnly?: boolean; onChange: (field: QteStyleFieldKey, value: string | number) => void; onFlashPreview?: () => void; showFlashButton?: boolean; localPrompt?: string; onLocalPromptChange?: (v: string) => void }`  
  - 颜色：`<input type="color">`；若值含 alpha，另附 text input 编辑完整 CSS 色  
  - 数字：`<input type="range">` + number，min/max 来自 `QTE_STYLE_LIMITS`  
  - `fields` 为空且提供 `onLocalPromptChange` 时显示「预览提示文案」输入（仅本地）  
  - `showFlashButton` 时显示「播放闪光预览」
- `PreviewStageProps`: `{ style: QteResolvedStyle; model: QteVisualModel; highlightLayer: QteEditorLayerId | null; fullBleed?: boolean }`  
  - 默认：深色网格背景 + 居中 16:9 舞台框（可用 `aspectRatio: "16 / 9"`, `maxWidth: "90%"`, `maxHeight: "90%"`）  
  - `fullBleed`：无框无网格边距，铺满（预览页签）  
  - 内部：`QteVisual` 且 `interactive={false}`，`pos` 来自 model（固定 50/50）
- `EditorShellProps`: `{ tab: "design" | "preview"; onTabChange: (t) => void; title?: string; left: React.ReactNode; center: React.ReactNode; right: React.ReactNode; toolbar?: React.ReactNode }`  
  - 设计页：显示左/中/右三栏  
  - 预览页：只渲染 `center`（全宽），顶栏仍保留页签  
  - 视觉：深色炭黑底、品红强调选中（对齐 Studio 气质，避免紫白渐变模板风）

- [ ] **Step 1: 实现四个组件**（无单测；Studio 验收）

颜色控件示例逻辑：

```ts
function toColorInputValue(css: string): string {
  // 取 #RRGGBB；若是其它格式，回退 #ffffff
  const m = /^#([0-9a-fA-F]{6})/.exec(css.trim());
  return m ? `#${m[1]}` : "#ffffff";
}
```

写入时：若原值带 alpha（长度 > 7 的 hex 或 rgba），range 色板只改 RGB，尽量保留原 alpha 后缀；否则写 `#rrggbb`。

- [ ] **Step 2: `npm run build` 确保类型通过**

- [ ] **Step 3: Commit（默认跳过）**

---

### Task 5: `editor-panel` + `QteEditorExtension` + 入口导出

**Files:**
- Create: `src/qte-editor/editor-panel.tsx`
- Create: `src/qte-editor/index.tsx`
- Modify: `src/index.tsx`

**Interfaces:**
- `QteEditorExtension`：`@extension({ id: "qte-editor", label: "QTE样式编辑器" })`，无 `settings`、无 `method`；`render()` 返回 `{ component: EditorPanel, props: this.data ?? {} }`
- `EditorPanel`：`useExtensionContext()`  
  - 样式：优先 `resolveQteStyle` 合并自  
    `ctx.settings.cross.get("qte", field)` 填入的对象 + `ctx.settings.snapshot()`（防御）；也可用定时/`subscribe` 无则每改 onChange 后本地 state 乐观更新  
  - **推荐实现**：`const [style, setStyle] = useState(() => readStyle(ctx))`；`onChange` 时  
    `const next = normalizeQteStyleField(field, value)` → `ctx.settings.cross.set("qte", field, next)` → `setStyle(s => ({...s, [field]: next}))`  
  - `readStyle(ctx)`：对每个 `keyof QteResolvedStyle`，`cross.get("qte", k) ?? defaults`，再 `resolveQteStyle`  
  - 状态：`tab`, `selectedLayer`, `playing`, `model`（`createDemoVisualModel`）, `localPrompt`  
  - `useEffect`：当 `playing` 时 `requestAnimationFrame` 或 `setInterval(50)` 调 `tickDemoRemaining` 更新 `model.remainingSec`  
  - 闪光：`onFlashPreview` → `setModel` 开 `showPerfectFlash`，`setTimeout` 400ms 后关  
  - 顶栏 toolbar：播放/暂停倒计时按钮  
  - 设计页：`LayerList` + `PreviewStage` + `PropertyPanel`（`fields={fieldsForLayer(selected)}`，flash 层 `showFlashButton`）  
  - 预览页：`PreviewStage fullBleed` + 底部简单工具条（播放、闪光）  
  - 若无法写入（可选检测）：`readOnly` 提示「请在 Studio 中编辑样式」——若 SDK 无环境 API，则始终尝试 `set`，不阻断

**入口导出（`src/index.tsx`）：**

```ts
import { QteEditorExtension } from "./qte-editor";

export { QteExtension, QteEditorExtension };
export default [QteExtension, QteEditorExtension];
```

若构建后 Studio 只识别 default 单类，改为：

```ts
export default [QteExtension, QteEditorExtension];
```

并保留 named export。实现后在 README 写明：模块列表应出现「QTE」与「QTE样式编辑器」。

- [ ] **Step 1: 实现 panel + extension 类**

- [ ] **Step 2: 改 `index.tsx` 双模块导出**

- [ ] **Step 3: `npm run build` + `npm run test:logic`**

Expected: 全绿；`dist/index.js` 含 `qte-editor` 字符串

- [ ] **Step 4: Commit（默认跳过）**

---

### Task 6: README 与 Studio 验收清单

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 更新目录结构**，加入 `src/qte-editor/`

- [ ] **Step 2: 新增章节「样式可视化编辑器」**

内容必须包含：

1. 在 Studio 扩展程序 UI / 模块列表中打开 **QTE样式编辑器**
2. 设计页改颜色/尺寸 → 写入项目设置（与「扩展设置」面板同一数据）
3. 预览页可看倒计时与闪光；**不会**跳转片段
4. 位置与玩法仍由 `start-qte` 方法参数配置；本编辑器**不含** P3（组件架/拖拽/动画/脚本）

- [ ] **Step 3: 人工验收清单（交给用户）**

1. 打开编辑器 → 见图层/画布/属性  
2. 改外环颜色 → 画布变色；扩展设置同步  
3. 改环直径 → `start-qte` 真开外观一致  
4. 预览页播倒计时与闪光，无片段跳转  
5. 方法里 `posX`/`posY`/按键/片段行为不变  

- [ ] **Step 4: 最终 `npm run build`**

- [ ] **Step 5: Commit（默认跳过）**

---

## Spec coverage（自检）

| Spec 项 | Task |
|---------|------|
| 独立模块 `qte-editor`、无独立 settings | 5 |
| `cross` 读写 `qte` 八字段 | 1, 5 |
| 不改方法/位置 | 全局约束 + 3 固定 pos 50/50 |
| Studio 风壳：设计/预览、图层、画布、属性 | 4, 5 |
| 图层属性映射与假 prompt | 3, 4, 5 |
| 倒计时循环、闪光预览、预览全屏 | 3, 5 |
| 抽出共享视觉 | 2 |
| 写入 clamp、默认回退 | 1, 5 |
| README / 验收 | 6 |
| 不做 P3 | 全局约束 |

## Placeholder / 类型一致性自检

- `QteEditorLayerId` / `fieldsForLayer` / `QteVisualModel` / `normalizeQteStyleField` 在各 Task Interfaces 中命名一致
- 无 TBD；React 部分以 build + Studio 清单验收，纯逻辑有单测
