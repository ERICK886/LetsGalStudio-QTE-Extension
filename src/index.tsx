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
 *   customKeyCode:   # 非空时优先于 key，如 Space / Digit1
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
import { QteOverlay, type QteOverlayProps } from "./qte/qte-overlay";
import { runQteSession, skipQteSession } from "./qte/qte-session";
import type {
  QteConfigInput,
  QteFragmentCallMode,
  QteMode,
} from "./qte/qte-logic";
import { QTE_STYLE_DEFAULTS } from "./qte/qte-style";
import {
  KEY_LETTER_PRESET_OPTIONS,
  resolveQteKeyParam,
} from "./qte/key-utils";
import { QteEditorExtension } from "./qte-editor";
// Studio 剧本编辑器内联卡片（DOM/Fiber hack，非正式 SDK）
import "./studio/qte-inline-cards";

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
function buildQteConfigInput(params: Record<string, unknown>): QteConfigInput {
  return {
    mode: params.mode as QteMode,
    key: resolveQteKeyParam(params.key, params.customKeyCode),
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
  /** 项目级样式设置；自定义样式实验室与这里读写同一组字段。 */
  static settings = settings((s) => ({
    overlayColor: s
      .color("舞台遮罩")
      .allowAlpha()
      .default(QTE_STYLE_DEFAULTS.overlayColor),
    overlayBlur: s
      .number("背景模糊(px)")
      .default(QTE_STYLE_DEFAULTS.overlayBlur)
      .range(0, 20)
      .step(1),
    outerRingColor: s
      .color("外环颜色")
      .allowAlpha()
      .default(QTE_STYLE_DEFAULTS.outerRingColor)
      .describe("倒计时外环描边颜色"),
    outerTrackColor: s
      .color("环形轨道颜色")
      .allowAlpha()
      .default(QTE_STYLE_DEFAULTS.outerTrackColor),
    perfectColor: s
      .color("Perfect颜色")
      .allowAlpha()
      .default(QTE_STYLE_DEFAULTS.perfectColor)
      .describe("恰到好处内环与高亮颜色"),
    tickColor: s
      .color("刻度颜色")
      .allowAlpha()
      .default(QTE_STYLE_DEFAULTS.tickColor),
    buttonBgColor: s
      .color("按钮底色")
      .allowAlpha()
      .default(QTE_STYLE_DEFAULTS.buttonBgColor),
    buttonTextColor: s
      .color("按钮文字色")
      .default(QTE_STYLE_DEFAULTS.buttonTextColor),
    buttonBorderColor: s
      .color("按钮描边色")
      .allowAlpha()
      .default(QTE_STYLE_DEFAULTS.buttonBorderColor),
    buttonAccentColor: s
      .color("按钮强调色")
      .allowAlpha()
      .default(QTE_STYLE_DEFAULTS.buttonAccentColor),
    promptColor: s
      .color("提示文字色")
      .allowAlpha()
      .default(QTE_STYLE_DEFAULTS.promptColor),
    promptBgColor: s
      .color("提示底色")
      .allowAlpha()
      .default(QTE_STYLE_DEFAULTS.promptBgColor),
    progressColor: s
      .color("进度文字色")
      .allowAlpha()
      .default(QTE_STYLE_DEFAULTS.progressColor),
    flashColor: s
      .color("闪光颜色")
      .allowAlpha()
      .default(QTE_STYLE_DEFAULTS.flashColor)
      .describe("Perfect 命中时的扩散闪光"),
    ringShape: s
      .enum("计时环形状", ["circle", "rounded-square", "diamond"] as const)
      .labels({ circle: "圆形", "rounded-square": "圆角方形", diamond: "菱形" })
      .default(QTE_STYLE_DEFAULTS.ringShape),
    ringPattern: s
      .enum("计时环纹理", ["solid", "dashed", "segmented"] as const)
      .labels({ solid: "实线", dashed: "虚线", segmented: "分段" })
      .default(QTE_STYLE_DEFAULTS.ringPattern),
    buttonShape: s
      .enum("按钮形状", ["circle", "rounded", "diamond"] as const)
      .labels({ circle: "圆形", rounded: "圆角方形", diamond: "菱形" })
      .default(QTE_STYLE_DEFAULTS.buttonShape),
    promptWeight: s
      .enum("提示字重", ["regular", "semibold", "bold"] as const)
      .labels({ regular: "常规", semibold: "半粗", bold: "粗体" })
      .default(QTE_STYLE_DEFAULTS.promptWeight),
    progressMode: s
      .enum("进度显示", ["none", "time", "percent"] as const)
      .labels({ none: "隐藏", time: "剩余秒数", percent: "剩余百分比" })
      .default(QTE_STYLE_DEFAULTS.progressMode),
    ringDiameter: s
      .number("环直径(px)")
      .default(QTE_STYLE_DEFAULTS.ringDiameter)
      .range(96, 640)
      .step(1)
      .describe("外环基准直径，实际大小随倒计时缩放"),
    ringStroke: s
      .number("描边粗细(px)")
      .default(QTE_STYLE_DEFAULTS.ringStroke)
      .range(1, 24)
      .step(1),
    ringGlow: s
      .number("环辉光(px)")
      .default(QTE_STYLE_DEFAULTS.ringGlow)
      .range(0, 80)
      .step(1),
    ringRotationSpeed: s
      .number("环旋转速度(度/秒)")
      .default(QTE_STYLE_DEFAULTS.ringRotationSpeed)
      .range(-180, 180)
      .step(5),
    tickCount: s
      .number("刻度数量")
      .default(QTE_STYLE_DEFAULTS.tickCount)
      .range(0, 36)
      .step(1),
    tickLength: s
      .number("刻度长度(px)")
      .default(QTE_STYLE_DEFAULTS.tickLength)
      .range(2, 28)
      .step(1),
    buttonSize: s
      .number("按钮尺寸(px)")
      .default(QTE_STYLE_DEFAULTS.buttonSize)
      .range(40, 220)
      .step(1),
    buttonBorderWidth: s
      .number("按钮描边(px)")
      .default(QTE_STYLE_DEFAULTS.buttonBorderWidth)
      .range(0, 12)
      .step(1),
    buttonFontSize: s
      .number("按键字号(px)")
      .default(QTE_STYLE_DEFAULTS.buttonFontSize)
      .range(12, 72)
      .step(1),
    buttonShadow: s
      .number("按钮阴影(px)")
      .default(QTE_STYLE_DEFAULTS.buttonShadow)
      .range(0, 64)
      .step(1),
    buttonPulse: s
      .number("按钮呼吸幅度(%)")
      .default(QTE_STYLE_DEFAULTS.buttonPulse)
      .range(0, 16)
      .step(1),
    promptFontSize: s
      .number("提示字号(px)")
      .default(QTE_STYLE_DEFAULTS.promptFontSize)
      .range(10, 42)
      .step(1),
    promptOffset: s
      .number("提示距离(px)")
      .default(QTE_STYLE_DEFAULTS.promptOffset)
      .range(24, 160)
      .step(1),
    promptLetterSpacing: s
      .number("提示字距(px)")
      .default(QTE_STYLE_DEFAULTS.promptLetterSpacing)
      .range(-1, 12)
      .step(0.1),
    promptPadding: s
      .number("提示内边距(px)")
      .default(QTE_STYLE_DEFAULTS.promptPadding)
      .range(0, 32)
      .step(1),
    promptRadius: s
      .number("提示圆角(px)")
      .default(QTE_STYLE_DEFAULTS.promptRadius)
      .range(0, 32)
      .step(1),
    progressFontSize: s
      .number("进度字号(px)")
      .default(QTE_STYLE_DEFAULTS.progressFontSize)
      .range(9, 30)
      .step(1),
    progressOffset: s
      .number("进度距离(px)")
      .default(QTE_STYLE_DEFAULTS.progressOffset)
      .range(24, 160)
      .step(1),
    flashSize: s
      .number("闪光尺寸(px)")
      .default(QTE_STYLE_DEFAULTS.flashSize)
      .range(80, 480)
      .step(1),
    flashIntensity: s
      .number("闪光强度(%)")
      .default(QTE_STYLE_DEFAULTS.flashIntensity)
      .range(0, 100)
      .step(1),
    flashDuration: s
      .number("反馈持续(ms)")
      .default(QTE_STYLE_DEFAULTS.flashDuration)
      .range(120, 1200)
      .step(20),
    ambientGlow: s
      .number("环境辉光(px)")
      .default(QTE_STYLE_DEFAULTS.ambientGlow)
      .range(0, 140)
      .step(1),
    sparkCount: s
      .number("光点数量")
      .default(QTE_STYLE_DEFAULTS.sparkCount)
      .range(0, 24)
      .step(1),
    motionSpeed: s
      .number("动效速度")
      .default(QTE_STYLE_DEFAULTS.motionSpeed)
      .range(0.25, 3)
      .step(0.05),
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
      key: {
        type: "enum",
        label: "按键",
        default: "KeyF",
        required: true,
        options: [...KEY_LETTER_PRESET_OPTIONS],
      },
      customKeyCode: {
        type: "string",
        label: "自定义键盘码",
        default: "",
        suggestions: { key: "qte-key-code" },
      },
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
     * 立即生效（不等动画 / 不等玩家操作）：与 skip 相同，按跳过规则结算。
     *
     * @param ctx - 扩展上下文
     * @param params - 方法参数
     */
    async runImmediately(ctx, params) {
      const allParams = params as Record<string, unknown>;
      await skipQteSession(ctx, buildQteConfigInput(allParams));
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

export { QteExtension, QteEditorExtension };
export default [QteExtension, QteEditorExtension];
