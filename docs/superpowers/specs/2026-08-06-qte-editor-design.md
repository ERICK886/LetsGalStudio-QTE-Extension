# QTE 样式可视化编辑器（qte-editor）设计

**日期**：2026-08-06  
**状态**：已确认（待实现）  
**范围**：P1 + P2（Studio 风壳 + 画布交互）；不含 P3

## 1. 背景与目标

创作者希望在扩展内拥有类似 Studio「可视化界面编辑器」气质的样式编辑面板：左侧图层、中间画布、右侧属性，并能实时预览 QTE 外观。

本需求**只编辑项目级样式**（颜色与尺寸），结果写入现有 `qte` 模块的项目设置。不改变：

- `start-qte` 方法 schema 与行为
- 方法参数（含 `posX` / `posY`、按键、片段、callMode 等）
- 运行时判定与片段跳转逻辑

## 2. 范围分期

| 阶段 | 内容 | 本轮 |
|------|------|------|
| P1 | Studio 风壳：顶栏（设计/预览）+ 左图层 + 中画布 + 右属性；点选改样式并写入 settings | 做 |
| P2 | 倒计时环循环播放/暂停、闪光预览、预览页去壳全屏看效果 | 做 |
| P3 | 组件架、任意拖拽布局、多界面状态、动画时间轴、脚本页 | **不做** |

## 3. 架构与边界

### 3.1 模块

| 模块 id | 职责 |
|---------|------|
| `qte`（现有） | 运行时 Overlay、`start-qte`、样式 **settings schema**（唯一数据源） |
| `qte-editor`（新建） | 创作者侧编辑面板；无剧本方法；无独立 settings |

入口 `src/index.tsx` 同时导出两个 `Extension` 子类（清单 id 不变：`ink.zenly.qte-f9e583`）。

### 3.2 目录

```text
src/qte-editor/
  index.tsx           # @extension({ id: "qte-editor", label: "QTE样式编辑器" })
  editor-shell.tsx    # 顶栏 / 左栏 / 画布 / 右栏布局
  editor-panel.tsx    # 状态编排（选中图层、页签、预览播放）
  preview-stage.tsx   # 画布内 QTE 视觉（假快照）
  layer-list.tsx      # 固定图层列表
  property-panel.tsx  # 随选中项的属性表单
```

共享视觉从现有 overlay 抽出（纯展示组件或绘制函数），供运行时 `QteOverlay` 与编辑器预览共用，避免两套圆环实现漂移。

### 3.3 数据流

1. 编辑器通过 `ctx.settings.cross.get/set("qte", field, value)`（及必要的订阅）读写现有字段。
2. Studio 端 `set` 持久化到 `project.json`；Player 端仅内存写入——编辑器面向 Studio，非 Studio 时只读或提示。
3. 预览**不**调用 `runQteSession`，不碰活跃 session，避免与真 QTE 串扰。
4. 运行时仍走现有 `readQteStyleFromContext` / 会话 `snapshot.style`。

### 3.4 样式字段（不变）

`outerRingColor`、`perfectColor`、`buttonBgColor`、`buttonTextColor`、`flashColor`、`ringDiameter`、`ringStroke`、`buttonSize`。

范围与现有 settings schema 一致：直径 64–600、描边 2–20、按钮 48–200；越界 clamp 后再写入。

## 4. UI 与交互

### 4.1 壳布局（对齐 Studio 可视化编辑器气质）

- **顶栏**：标题「QTE 样式」；页签仅 **设计 / 预览**（无动画、脚本）。
- **左栏「图层」**：固定节点，不可增删——`外环`、`Perfect环`、`中心按钮`、`提示文案`、`闪光`。
- **中栏「画布」**：深色网格 + 居中舞台框；舞台内 QTE 预览固定居中（视觉上 50%/50%），**禁止拖拽改位置，不持久化 pos**。
- **右栏「属性」**：随选中图层显示字段；未选中时显示全局尺寸（环直径、描边、按钮尺寸）。

### 4.2 属性映射

| 选中图层 | 可编辑字段 |
|----------|------------|
| 外环 | `outerRingColor`；尺寸可走全局项 |
| Perfect环 | `perfectColor` |
| 中心按钮 | `buttonBgColor`、`buttonTextColor`、`buttonSize` |
| 提示文案 | 仅编辑器内假文案预览（不新增 settings；真实 `prompt` 仍由方法参数） |
| 闪光 | `flashColor` +「播放闪光预览」 |
| 全局 / 未选中 | `ringDiameter`、`ringStroke`、`buttonSize` |

### 4.3 预览行为（P2）

- 演示快照：固定 `timeoutSec`（如 5）、Perfect 窗口为演示区间；键位标签固定（如 `F`），与真实方法参数无关。
- `remainingSec` 可循环递减；设计页提供播放/暂停。
- 「闪光预览」短暂打开闪光态，验证 `flashColor`。
- **预览页签**：隐藏编辑壳杂讯，全屏看外观；可播倒计时与闪光；不触发片段、不跑真实判定。

### 4.4 打开方式

- 非 `autonomous`：在 Studio 扩展模块列表中打开「QTE样式编辑器」程序 UI。
- 现有「扩展设置」数值面板保留，与编辑器读写同一数据源。

## 5. 明确不做

- P3：组件架、任意布局拖拽、多界面状态、动画时间轴、脚本页
- 修改或持久化 `posX`/`posY` 及任何方法参数
- 第二套样式存储或独立 settings schema
- 玩家游玩时的常驻编辑 HUD

## 6. 兼容与错误处理

- 不改 `extension.json.id`、不改 `start-qte` 行为与字段名/默认值。
- 编辑器打开时若正在跑真实 QTE：互不影响。
- 跨模块读设置失败时回退 `QTE_STYLE_DEFAULTS`，预览仍可用。
- 数值/颜色写入前按 schema 范围规范化。

## 7. 验收（Studio 人工）

1. 打开「QTE样式编辑器」→ 设计页可见图层 / 画布 / 属性。
2. 改外环颜色 → 画布立刻变色；扩展设置同字段同步。
3. 改环直径 → 预览与真开 `start-qte` 外观一致。
4. 预览页可播倒计时与闪光；不触发片段跳转。
5. 剧本中位置、按键、片段、callMode 等行为与改编辑器前一致。

## 8. 文档

README 补充：如何打开编辑器、与项目设置的关系、本轮不含 P3。
