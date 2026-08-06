# QTE 扩展（qte-f9e583）

为 AVG+ Studio 项目提供「单键限时」与「连打」两种 QTE 玩法扩展。

---

> 这是一个 AVG+ Light Engine **扩展**。
> 一个类同时承担 UI、可调用方法、存档字段、项目设置 —— 用统一基类 `Extension`。
> 它通过 React 组件渲染到游戏舞台，可以读取宿主提供的片段 / 章节等数据。

## 目录结构

```
src/
  index.tsx        扩展入口 - 导出 QteExtension（UI + start-qte 方法）
  qte-overlay.tsx  视觉组件 - 全屏透明覆盖层、双环进度、Perfect 区域、连打计数
  qte-session.ts   会话生命周期 - 计时、按键绑定、判定结算
  qte-logic.ts     判定逻辑 - 参数规范化、perfect/normal/defeat 计算
  key-utils.ts     按键工具 - 键名标准化与友好标签
  *.test.ts        逻辑单元测试
extension.json     manifest - id / 版本 / sdkVersion（id 保持 qte-f9e583 不变）
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

- **扩展**：`qte-f9e583`
- **方法**：`start-qte`

### 参数说明

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `mode` | enum | 否 | `single` | `single` = 单键限时；`mash` = 连打 |
| `key` | string | 是 | `KeyF` | 按键代码，如 `KeyF`、`Space`、`KeyA` |
| `timeoutSec` | number | 是 | `5` | 总时限（秒），最小 0.1 |
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

## Studio 验收步骤

1. 打开 AVG+ Studio，进入目标项目。
2. 在「扩展」设置中确认已加载 `qte-f9e583`（manifest id 不变）。
3. 在剧本中新增 Action：
   - 类型选择「调用方法」
   - 扩展选择 `qte-f9e583`
   - 方法选择 `start-qte`
4. 配置参数，为 `perfectFragment` / `normalFragment` / `defeatFragment`
   分别选择目标片段。
5. 保存剧本，点击 Preview。
6. 运行到该 Action 时，屏幕中央出现 QTE 圆环：
   - 单键模式：在 Perfect 窗口内按键跳 `perfectFragment`
   - 连打模式：快速按键直到计数达到 `mashCount`
   - 超时或按错键跳 `defeatFragment`
7. 验证三种结果都能正确跳转对应片段，且 Preview 控制台无报错。

## 关键概念

- **Extension 子类**：一个类 = 一个完整子模块。身份用 `@extension({ id, label })`
  装饰器声明；`id` 在剧本里以 `<扩展id>/<id>` 被引用，是稳定标识。
- **render()**：实现了就有界面，Action block「显示界面」会列出来；不实现 = 纯方法模块。
- **method()**：通过 `static xxx = method({...})` 暴露给「调用方法」Action。
- **ctx (ExtensionContext)**：运行时上下文，暴露 `ctx.ui.show/hide`、
  `ctx.input.bindShortcut`、`ctx.flow.unsafe_goToFragment` 等接口。
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
- 项目设置：加 `static settings = settings(s => ({ ... }))`，在 Studio 项目设置里可见。
- 完整 SDK 文档：Studio 顶部 · 帮助 · SDK 手册。
