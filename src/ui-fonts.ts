/**
 * 文件名：ui-fonts.ts
 * 作者：池水三两升
 * 日期：2026-08-06
 * 版本：1.0.0
 * 描述：扩展 UI 字体栈与默认字号（编辑器壳 / 标题 / 等宽输入）
 *
 * 约定：
 * - UI / 标题：MiSans，中文回退 PingFang SC、Microsoft YaHei UI
 * - 等宽：Geist Mono → JetBrains Mono → SF Mono → Fira Code
 * - 默认字号：13px
 *
 * @example
 * ```ts
 * import { FONT_UI, FONT_MONO, FONT_SIZE_UI } from "./ui-fonts";
 * style={{ fontFamily: FONT_UI, fontSize: FONT_SIZE_UI }}
 * ```
 */

/**
 * UI / 标题正文字体栈。
 *
 * 优先 MiSans；无则中文回退 PingFang SC、Microsoft YaHei UI。
 */
export const FONT_UI =
  '"MiSans", "PingFang SC", "Microsoft YaHei UI", sans-serif';

/**
 * 等宽字体栈（色值、数值等代码感输入）。
 *
 * 顺序：Geist Mono → JetBrains Mono → SF Mono → Fira Code → 系统等宽兜底。
 */
export const FONT_MONO =
  '"Geist Mono", "JetBrains Mono", "SF Mono", "Fira Code", ui-monospace, monospace';

/**
 * 编辑器 UI 默认字号（px）。
 */
export const FONT_SIZE_UI = 13;
