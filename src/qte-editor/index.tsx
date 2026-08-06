/**
 * 文件名：index.tsx
 * 作者：池水三两升
 * 日期：2026-08-06
 * 版本：1.0.0
 * 描述：QTE 样式编辑器扩展模块入口
 *
 * `QteEditorExtension` 是一个独立的扩展模块（id: `qte-editor`），
 * 仅承担「在 Studio 中编辑 QTE 样式」的职责：
 * - 无 `settings`：编辑器自身不暴露项目级配置，所有样式写入 `qte` 模块
 * - 无 `method`：不参与剧本调用
 * - `render()` 返回 `{ component: EditorPanel, props: this.data ?? {} }`
 *
 * 编辑器通过 `ctx.settings.cross.set("qte", field, value)` 把字段写回
 * `qte` 模块的项目设置，运行时由 `QteExtension` 读取使用。
 *
 * 本模块从不调用 `runQteSession`，仅做静态预览。
 */

import {
  Extension,
  extension,
  type ExtensionRenderData,
} from "@avg-studio/sdk";
import { EditorPanel, type EditorPanelProps } from "./editor-panel";

/**
 * QTE 样式编辑器扩展模块。
 *
 * 装饰器声明 `id: "qte-editor"`，label 显示为「QTE样式编辑器」。
 * 不声明 `settings` / `method`，仅实现 `render()` 挂载 `EditorPanel`。
 */
@extension({ id: "qte-editor", label: "QTE样式编辑器" })
export class QteEditorExtension extends Extension<EditorPanelProps> {
  /**
   * 返回编辑器 UI 渲染描述。
   *
   * `props` 透传 `this.data ?? {}`，与 SDK `ExtensionRenderData` 契约一致；
   * 当前 `EditorPanel` 不依赖外部 props，预留扩展位。
   *
   * @returns ExtensionRenderData
   */
  render(): ExtensionRenderData<EditorPanelProps> {
    return {
      component: EditorPanel,
      props: this.data ?? {},
    };
  }
}
