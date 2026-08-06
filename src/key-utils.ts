/**
 * 文件名：key-utils.ts
 * 作者：池水三两七
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
