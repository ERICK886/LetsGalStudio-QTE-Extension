/**
 * 文件名：index.tsx
 * 作者：池水三两升
 * 日期：2026-08-06
 * 版本：1.0.0
 * 描述：QTE 扩展入口 —— UI 覆盖层、项目样式设置、start-qte 剧本方法（含百分比定位）
 *
 * 使用示例（在剧本中调用）：
 * ```
 * start-qte
 *   mode: single
 *   key: KeyF
 *   timeoutSec: 5
 *   posX: 50
 *   posY: 70
 *   perfectFragment: ...
 * ```
 *
 * 样式在 Studio「扩展设置」中配置（颜色 / 环直径 / 描边 / 按钮尺寸）。
 */
import {
  Extension,
  extension,
  method,
  settings,
  type ExtensionRenderData,
} from "@avg-studio/sdk";
import { QteOverlay, type QteOverlayProps } from "./qte-overlay";
import { runQteSession, skipQteSession } from "./qte-session";
import type { QteFragmentCallMode, QteMode } from "./qte-logic";
import { QTE_STYLE_DEFAULTS } from "./qte-style";

/** 片段调用模式在检查器中的选项 */
const CALL_MODE_OPTIONS = [
  { label: "结束后返回", value: "return" },
  { label: "不返回(切断)", value: "goto" },
] as const;

/**
 * 安全读取 schema 中 `fragment` 字段通过 `chapterField` 写入的辅助章节 id。
 *
 * @param params - 方法运行时收到的参数对象
 * @param key - chapterField 指定的辅助键名
 * @returns 非空章节 id 或 undefined
 */
function readChapterId(params: Record<string, unknown>, key: string): string | undefined {
  const value = params[key];
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return undefined;
}

/**
 * 将 startQte 方法的 params 转换为会话配置。
 *
 * @param params - startQte 方法收到的参数
 * @returns QteConfigInput
 */
function buildQteConfigInput(params: Record<string, unknown>): import("./qte-logic").QteConfigInput {
  return {
    mode: params.mode as QteMode,
    key: typeof params.key === "string" ? params.key : "KeyF",
    timeoutSec: typeof params.timeoutSec === "number" ? params.timeoutSec : 5,
    perfectStartSec: typeof params.perfectStartSec === "number" ? params.perfectStartSec : 0,
    perfectEndSec: typeof params.perfectEndSec === "number" ? params.perfectEndSec : 1,
    mashCount: typeof params.mashCount === "number" ? params.mashCount : 10,
    failOnWrongKey: typeof params.failOnWrongKey === "boolean" ? params.failOnWrongKey : false,
    skipCountsAsPass: typeof params.skipCountsAsPass === "boolean" ? params.skipCountsAsPass : true,
    perfectFragment: typeof params.perfectFragment === "string" ? params.perfectFragment : undefined,
    normalFragment: typeof params.normalFragment === "string" ? params.normalFragment : undefined,
    defeatFragment: typeof params.defeatFragment === "string" ? params.defeatFragment : undefined,
    perfectChapterId: readChapterId(params, "perfectChapterId"),
    normalChapterId: readChapterId(params, "normalChapterId"),
    defeatChapterId: readChapterId(params, "defeatChapterId"),
    perfectCallMode: params.perfectCallMode as QteFragmentCallMode | undefined,
    normalCallMode: params.normalCallMode as QteFragmentCallMode | undefined,
    defeatCallMode: params.defeatCallMode as QteFragmentCallMode | undefined,
    prompt: typeof params.prompt === "string" ? params.prompt : undefined,
    posX: typeof params.posX === "number" ? params.posX : 50,
    posY: typeof params.posY === "number" ? params.posY : 50,
  };
}

/**
 * QTE 扩展模块：UI + 项目设置 + 剧本方法。
 */
@extension({ id: "qte", label: "QTE" })
class QteExtension extends Extension<QteOverlayProps> {
  /**
   * 项目级样式设置（Studio 扩展配置面板可见）。
   *
   * 颜色支持 alpha；尺寸有 min/max，便于检查器使用范围控件。
   */
  static settings = settings((s) => ({
    outerRingColor: s
      .color("外环颜色")
      .allowAlpha()
      .default(QTE_STYLE_DEFAULTS.outerRingColor)
      .describe("倒计时外环描边颜色"),
    perfectColor: s
      .color("Perfect颜色")
      .allowAlpha()
      .default(QTE_STYLE_DEFAULTS.perfectColor)
      .describe("恰到好处内环与高亮颜色"),
    buttonBgColor: s
      .color("按钮底色")
      .allowAlpha()
      .default(QTE_STYLE_DEFAULTS.buttonBgColor),
    buttonTextColor: s
      .color("按钮文字色")
      .default(QTE_STYLE_DEFAULTS.buttonTextColor),
    flashColor: s
      .color("闪光颜色")
      .allowAlpha()
      .default(QTE_STYLE_DEFAULTS.flashColor)
      .describe("Perfect 命中时的扩散闪光"),
    ringDiameter: s
      .number("环直径(px)")
      .default(QTE_STYLE_DEFAULTS.ringDiameter)
      .range(64, 600)
      .step(1)
      .describe("外环基准直径，实际大小随倒计时缩放"),
    ringStroke: s
      .number("描边粗细(px)")
      .default(QTE_STYLE_DEFAULTS.ringStroke)
      .range(2, 20)
      .step(1),
    buttonSize: s
      .number("按钮尺寸(px)")
      .default(QTE_STYLE_DEFAULTS.buttonSize)
      .range(48, 200)
      .step(1),
  }));

  /**
   * 返回本扩展的 UI 渲染描述。
   *
   * @returns ExtensionRenderData
   */
  render(): ExtensionRenderData<QteOverlayProps> {
    return {
      component: QteOverlay,
      props: this.data ?? {},
    };
  }

  /**
   * 剧本方法：启动 QTE。
   */
  static startQte = method({
    id: "start-qte",
    title: "开始 QTE",
    description: "单键或连打限时 QTE；可用 posX/posY（百分比）放置位置",
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
      posX: {
        type: "number",
        label: "水平位置(%)",
        default: 50,
        min: 0,
        max: 100,
        step: 1,
      },
      posY: {
        type: "number",
        label: "垂直位置(%)",
        default: 50,
        min: 0,
        max: 100,
        step: 1,
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
      perfectCallMode: {
        type: "enum",
        label: "Perfect调用",
        default: "return",
        options: [...CALL_MODE_OPTIONS],
      },
      normalFragment: {
        type: "fragment",
        label: "Normal片段",
        chapterField: "normalChapterId",
      },
      normalCallMode: {
        type: "enum",
        label: "Normal调用",
        default: "return",
        options: [...CALL_MODE_OPTIONS],
      },
      defeatFragment: {
        type: "fragment",
        label: "Defeat片段",
        chapterField: "defeatChapterId",
      },
      defeatCallMode: {
        type: "enum",
        label: "Defeat调用",
        default: "return",
        options: [...CALL_MODE_OPTIONS],
      },
      prompt: { type: "string", label: "提示文案" },
    },

    /**
     * 正常执行 QTE。
     *
     * @param ctx - 扩展上下文
     * @param params - 方法参数
     */
    async run(ctx, params) {
      const allParams = params as Record<string, unknown>;
      await runQteSession(ctx, buildQteConfigInput(allParams));
    },

    /**
     * 快进/跳过时的结算。
     *
     * @param ctx - 扩展上下文
     * @param params - 方法参数
     */
    async skip(ctx, params) {
      const allParams = params as Record<string, unknown>;
      await skipQteSession(ctx, buildQteConfigInput(allParams));
    },
  });
}

export default QteExtension;
