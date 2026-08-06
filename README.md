# QTE 扩展（ink.zenly.qte-f9e583）

为 AVG+ Studio 项目提供「单键限时」与「连打」两种 QTE 玩法扩展。

---

> 这是一个 AVG+ Light Engine **扩展**。
> 一个类同时承担 UI、可调用方法、存档字段、项目设置 —— 用统一基类 `Extension`。
> 它通过 React 组件渲染到游戏舞台，可以读取宿主提供的片段 / 章节等数据。

## 目录结构

```
src/
  index.tsx        扩展入口 - QteExtension（UI + settings + start-qte）
  qte-overlay.tsx  视觉组件 - 百分比定位、可配置样式、双环进度
  qte-session.ts   会话生命周期 - 计时、按键绑定、判定结算
  qte-logic.ts     判定逻辑 - 参数规范化、perfect/normal/defeat
  qte-style.ts     样式默认值与从项目设置解析
  key-utils.ts     按键工具 - 键名标准化与友好标签
  *.test.ts        逻辑单元测试
extension.json     manifest - id / 版本 / sdkVersion
vite.config.ts     build 配置 - lib 模式 ESM 输出
sdk/               @avg-studio/sdk 源码副本 - npm install 会建立 symlink
dist/              build 产物（npm run build 生成）
```

## 开发/构建命令

安装依赖（项目含 `pnpm-lock.yaml` 时优先使用 pnpm；也可使用 npm）：

```bash
pnpm install          # 推荐：安装 react / vite + 建立 sdk symlink
# 或
npm install           # 同上
```

构建与测试（无论用 pnpm 还是 npm 安装，以下 npm scripts 均可用）：

```bash
npm run build         # 构建到 dist/index.js
npm run watch         # 监听 src/ 改动并增量 build 到 dist/
npm run test:logic    # 运行逻辑单元测试：key-utils + qte-logic
```

Studio 的 Preview 会自动接住 `dist/index.js` 的更新（约 200ms 延迟）。

## 在剧本中使用

在 Studio 的 Action 编辑器里添加「调用方法」：

- **扩展**：`ink.zenly.qte-f9e583`
- **方法**：`start-qte`

### 参数说明

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `mode` | enum | 否 | `single` | `single` = 单键限时；`mash` = 连打 |
| `key` | string | 是 | `KeyF` | 按键代码，如 `KeyF`、`Space`、`KeyA` |
| `timeoutSec` | number | 是 | `5` | 总时限（秒），最小 0.1 |
| `posX` | number | 否 | `50` | 水平位置：舞台宽度百分比 0–100（50=居中） |
| `posY` | number | 否 | `50` | 垂直位置：舞台高度百分比 0–100（50=居中） |
| `perfectStartSec` | number | 否 | `0` | Perfect 窗口起点（秒） |
| `perfectEndSec` | number | 否 | `1` | Perfect 窗口终点（秒） |
| `mashCount` | number | 否 | `10` | 连打模式需要按下的次数，最小 1 |
| `failOnWrongKey` | boolean | 否 | `false` | 是否按错键立即判定失败 |
| `skipCountsAsPass` | boolean | 否 | `true` | 玩家跳过时是否计为 normal（通过） |
| `perfectFragment` | fragment | 否 | - | Perfect 结果跳转的片段 |
| `normalFragment` | fragment | 否 | - | Normal 结果跳转的片段 |
| `defeatFragment` | fragment | 否 | - | Defeat 结果跳转的片段 |
| `prompt` | string | 否 | - | 覆盖层顶部提示文案 |

> fragment 类型参数会通过 `chapterField` 自动把所属章节 id 写入
> `perfectChapterId` / `normalChapterId` / `defeatChapterId` 辅助字段，
> 运行时据此跨章节跳转，无需手动填写章节 id。

### 判定结果

QTE 结束后会根据玩家输入自动跳转到对应片段：

- `perfect`：在 Perfect 窗口内完成单键，或在窗口内完成连打次数
- `normal`：在时限内完成但不在 Perfect 窗口内
- `defeat`：超时、按错键、或跳过时 `skipCountsAsPass=false`

## 扩展设置（样式）

在 Studio 的扩展 / 项目设置中可配置本扩展样式（全局默认皮肤）：

| 设置项 | 说明 | 默认 |
|--------|------|------|
| 外环颜色 | 倒计时外环 | `#FFFFFFB8` |
| Perfect颜色 | 内环与高亮 | `#FFD66B` |
| 按钮底色 / 文字色 / 闪光颜色 | 中心按钮与 Perfect 闪光 | 见默认表 |
| 环直径(px) | 120–600 | `320` |
| 描边粗细(px) | 2–20 | `6` |
| 按钮尺寸(px) | 48–200 | `88` |

每次调用仍用 `posX` / `posY`（百分比）单独摆放位置。

## Studio 验收步骤

1. 打开 AVG+ Studio，进入目标项目。
2. 在「扩展」设置中确认已加载 `ink.zenly.qte-f9e583`。
3. （可选）在扩展设置中改颜色 / 尺寸，预览是否生效。
4. 在剧本中新增 Action：
   - 类型选择「调用方法」
   - 扩展选择 `ink.zenly.qte-f9e583`
   - 方法选择 `start-qte`
5. 配置参数，设置 `posX`/`posY`（如 30 / 70）与三种结果片段。
6. 保存剧本，点击 Preview。
7. 运行到该 Action 时，QTE 应出现在对应百分比位置，并套用设置中的样式。
8. 验证三种结果跳转与 Preview 控制台无报错。

## 关键概念

- **Extension 子类**：一个类 = 一个完整子模块。身份用 `@extension({ id, label })`
  装饰器声明；`id` 在剧本里以 `<扩展id>/<id>` 被引用，是稳定标识。
- **render()**：实现了就有界面，Action block「显示界面」会列出来；不实现 = 纯方法模块。
- **method()**：通过 `static xxx = method({...})` 暴露给「调用方法」Action。
- **settings()**：项目级扩展设置，作者在 Studio 配置面板修改。
- **ctx (ExtensionContext)**：运行时上下文，暴露 `ctx.ui.show/hide`、
  `ctx.input.bindShortcut`、`ctx.flow.callFragment`、`ctx.settings` 等接口。
- **props**：从剧本的「显示界面」block 传入，通过 `this.data` 在 `render()` 里拿到。

## 测试

```bash
npx --yes tsx --test src/key-utils.test.ts src/qte-logic.test.ts
```

或直接运行：

```bash
npm run test:logic
```

## 下一步

- 多子模块：在 `src/index.tsx` 中再加一个 `@extension({...}) export class XxxExtension extends Extension<...>`。
- 持久化数据：加 `static saveSchema = defineSave({ ... })`，`this.save` 自动可读写。
- 完整 SDK 文档：Studio 顶部 · 帮助 · SDK 手册。
