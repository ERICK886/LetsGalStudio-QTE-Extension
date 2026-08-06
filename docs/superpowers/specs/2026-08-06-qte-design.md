# QTE 扩展设计规格

> 文件名：`2026-08-06-qte-design.md`  
> 作者：池水三两升 / Auto  
> 日期：2026-08-06  
> 版本：1.0.0  
> 扩展 id：`ink.zenly.qte-f9e583`  
> 版本：`1.0.0`

## 1. 目标

为 LetsGal / AVG+ 作品提供运行时 QTE：

- 支持 **单键限时** 与 **连打**
- 支持 **键盘** 与 **屏幕中央按钮**
- 三种结果：**perfect / normal / defeat**，各自可配置跳转片段；片段为空则继续当前剧情
- 作者可配置按键、总时限、Perfect 时间窗、连打次数、按错是否失败、跳过是否算过

## 2. 范围

### 2.1 包含

- 程序扩展模块 + React 覆盖层 UI
- 剧本方法 `start-qte`
- 中央双环视觉：外环随总倒计时半径收缩；内环表示 Perfect 区
- Perfect 命中时金色反馈（不额外写变量）

### 2.2 不包含

- 玩家全局改键（按键由作者每次调用指定）
- 按键序列 QTE（第二版再议）
- 存档字段 / 项目设置页 / 系统插槽
- 修改 `extension.json.id`、`sdk/`、手改 `dist/`

## 3. 核心判定

| 结果 | 单键 `single` | 连打 `mash` |
|------|---------------|-------------|
| **perfect** | 正确输入落在 `[perfectStartSec, perfectEndSec]` | 凑满 `mashCount` 的时刻 `t ≤ perfectEndSec`（连打以窗口终点为界；`perfectStartSec` 主要用于单键判定与内环提示） |
| **normal** | 总时限内正确输入，但不满足 perfect | 总时限内凑满次数，但 `t > perfectEndSec` |
| **defeat** | 超时；或开启按错即败且按下错误键 | 超时；或开启按错即败且按下错误键 |

跳转规则：

- 若对应结果配置了 fragment → `ctx.flow.unsafe_goToFragment(fragmentId)`
- 若未配置（空）→ 结束方法，剧本继续往下执行

Perfect 额外效果：UI 金色闪烁反馈；逻辑上仍按 perfect 结果结算（可跳 perfect 片段）。

## 4. 剧本方法

### 4.1 标识

- 属性名：`startQte`
- 方法 id：`start-qte`
- 标题：开始 QTE
- 模块：`@extension({ id: "qte", label: "QTE" })`（替换模板 Welcome）

### 4.2 参数 Schema

| 字段 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| `mode` | enum `single` \| `mash` | 是 | `single` | QTE 模式 |
| `key` | string | 是 | `KeyF` | 作者指定物理键（KeyboardEvent.code 风格，如 `KeyF`、`Space`） |
| `timeoutSec` | number | 是 | `5` | 总时限（秒），外环收缩基准 |
| `perfectStartSec` | number | 否 | `0` | Perfect 窗口起点（相对开始） |
| `perfectEndSec` | number | 否 | `1` | Perfect 窗口终点 |
| `mashCount` | number | mash 时建议填 | `10` | 连打目标次数 |
| `failOnWrongKey` | boolean | 否 | `false` | true 时错键立即 defeat |
| `skipCountsAsPass` | boolean | 否 | `true` | 玩家快进/方法 skip 时是否算过；默认 true → 按 **normal** 结算；false → **defeat** |
| `perfectFragment` | fragment | 否 | 空 | perfect 跳转；空=继续 |
| `normalFragment` | fragment | 否 | 空 | normal 跳转；空=继续 |
| `defeatFragment` | fragment | 否 | 空 | defeat 跳转；空=继续 |
| `prompt` | string | 否 | 空 | 可选提示文案 |

`fragment` 字段使用 SDK `type: "fragment"`，必要时用 `chapterField` 同步章节 id（若宿主跳转需要）。

### 4.3 执行流程

1. 校验并规范化参数（时限 > 0；Perfect 窗口裁剪到 `[0, timeoutSec]`；无效窗口则本场无法 perfect，仍可 normal）
2. 若已有进行中的 QTE：先取消旧会话（清理 UI/键位），再开新场
3. `ctx.ui.show` 显示覆盖层，传入会话 props
4. 绑定作者指定快捷键（`ctx.input.bindShortcut`）；屏幕按钮触发同一 `onCorrectInput`
5. 监听 `ctx.flow.signal`：中止时清理并结束
6. 结算：hide UI、解绑、按结果跳转或 resolve
7. `method.skip`：若 `skipCountsAsPass` → normal；否则 defeat（均走统一结算，含片段跳转）

## 5. UI 规格

- 布局：舞台中央
- **外环**：发光圆环，半径随 `remaining / timeout` 从外向内收缩（真实半径/scale，而非仅 stroke-dash）
- **内环**：Perfect 区提示环（虚线或金色描边）；可在窗口活跃期加强亮度
- **中央按钮**：显示键名；点击 = 正确输入
- **连打**：按钮下方 `current / mashCount`
- **Perfect 反馈**：短促金色闪光 / 光晕
- 不使用卡片式仪表盘；全屏透明覆盖，只突出中央交互

## 6. 模块结构

```
src/
  index.tsx          QteExtension：render + startQte method
  qte-overlay.tsx    双环视觉与点击
  qte-session.ts     会话状态机、计时、结算、清理
  key-utils.ts       键名规范化与显示名
```

删除或停用模板 `welcome-ui.tsx` 的默认导出路径（可删文件，避免残留）。

## 7. 边界情况

| 场景 | 行为 |
|------|------|
| 重复调用 | 取消旧会话，开启新会话 |
| 预览重置 / AbortSignal | 清理 UI 与键位，不跳片段 |
| Perfect 窗口非法 | 裁剪；若 start≥end 则禁用 perfect |
| mashCount ≤ 0 | 视为 1 |
| 错键且 failOnWrongKey=false | 忽略 |
| 错键且 failOnWrongKey=true | defeat |
| skip 且 skipCountsAsPass=true（默认） | normal |
| skip 且 skipCountsAsPass=false | defeat |
| 片段为空 | 继续当前剧情 |

## 8. 实现约束（遵循 llms.txt）

- 只改 `src/` 等源码，用 `npm run build` 生成 `dist/`
- 不改 `extension.json.id`、不手改 `sdk/`、不手改 `dist/`
- 不引入第二份 React；保持 Vite 外置配置
- 新文件 kebab-case；TypeScript 严格，避免 `any`
- 详细中文注释（文件头含文件名/作者/日期/版本）

## 9. Studio 验收清单

1. 单键：窗内按键 → perfect（可选跳转）；窗外未超时 → normal；超时 → defeat  
2. 连打：perfectEnd 前凑满 → perfect；总时限内凑满 → normal；超时 → defeat  
3. 屏幕按钮与键盘等价  
4. `failOnWrongKey` 开关行为正确  
5. 三个片段全空时，三种结果均继续当前剧本  
6. 只填 defeat 片段时，成功继续、失败跳转  
7. 快进默认算 normal；关闭「跳过算过」后快进为 defeat  
8. 外环半径随剩余时间收缩；Perfect 有金色反馈  

## 10. 架构选型摘要

采用 **单一方法 `start-qte` + React 覆盖层**（方案 1）：模式用 enum 切换，避免双方法逻辑分叉。
