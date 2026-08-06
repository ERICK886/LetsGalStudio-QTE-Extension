/**
 * 文件名：index.tsx
 * 作者：池水三两升
 * 日期：2026-08-06
 * 版本：1.0.0
 * 描述：QTE 扩展入口 —— 提供全屏 UI 覆盖层与 start-qte 剧本方法。
 *
 * 本文件是 AVG+ Studio 加载该扩展时的入口点：
 * - 通过 @extension({ id: "qte", label: "QTE" }) 声明模块身份
 * - 通过 render() 把 QteOverlay 组件暴露给「显示界面」Action
 * - 通过 static startQte = method({...}) 把 QTE 玩法暴露给「调用方法」Action
 *
 * 使用示例（在剧本中调用）：
 * ```
 * start-qte
 *   mode: single
 *   key: KeyF
 *   timeoutSec: 5
 *   perfectStartSec: 1
 *   perfectEndSec: 2
 *   perfectFragment: fragment_perfect
 *   normalFragment: fragment_normal
 *   defeatFragment: fragment_defeat
 * ```
 */
import {
  Extension,
  extension,
  method,
  type ExtensionRenderData,
} from "@avg-studio/sdk";
import { QteOverlay, type QteOverlayProps } from "./qte-overlay";
import { runQteSession, skipQteSession } from "./qte-session";
import type { QteMode } from "./qte-logic";

/**
 * 安全读取 schema 中 `fragment` 字段通过 `chapterField` 写入的辅助章节 id。
 *
 * `chapterField` 不会在 `ParamsOf<typeof schema>` 中出现，因此需要把参数对象
 * 收窄到 `Record<string, unknown>` 后再读取，避免使用 `any`。
 *
 * @param params - 方法运行时收到的参数对象（已做最小收窄）
 * @param key - chapterField 指定的辅助键名，例如 "perfectChapterId"
 * @returns 非空字符串时返回 trimmed 后的章节 id；否则 undefined
 */
function readChapterId(params: Record<string, unknown>, key: string): string | undefined {
  const value = params[key];
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return undefined;
}

/**
 * 将 startQte 方法的 params 转换为 runQteSession / skipQteSession 需要的配置。
 *
 * 因为 `chapterField` 辅助字段不在 schema 的 ParamsOf 中，这里先把参数对象
 * 收窄为 `Record<string, unknown>`，再用 readChapterId 安全读取章节 id。
 *
 * @param params - startQte 方法收到的参数
 * @returns 完整的 QTE 配置输入对象
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
    prompt: typeof params.prompt === "string" ? params.prompt : undefined,
  };
}

/**
 * QTE 扩展模块。
 *
 * 一个 Extension 子类同时承担 UI 与剧本方法：
 * - render() 供「显示界面」Action 使用，将 QteOverlay 渲染到舞台顶层
 * - startQte 方法供「调用方法」Action 使用，启动一场单键或连打 QTE
 */
@extension({ id: "qte", label: "QTE" })
class QteExtension extends Extension<QteOverlayProps> {
  /**
   * 返回本扩展的 UI 渲染描述。
   *
   * 当剧本调用「显示界面」或扩展预览 Tab 加载时，宿主会调用此方法。
   * this.data 可能为 undefined（例如 Studio 预览 Tab），这里回退到空 props。
   *
   * @returns 包含 React 组件与 props 的 ExtensionRenderData
   */
  render(): ExtensionRenderData<QteOverlayProps> {
    return {
      component: QteOverlay,
      props: this.data ?? {},
    };
  }

  /**
   * 剧本方法：启动 QTE。
   *
   * 在 Studio 的「调用方法」picker 中显示为「开始 QTE」，支持：
   * - 单键限时模式 / 连打模式
   * - Perfect 时间窗口与对应片段
   * - 失败/跳过/按错键等分支
   */
  static startQte = method({
    id: "start-qte",
    title: "开始 QTE",
    description: "单键或连打限时 QTE，结果可为 perfect / normal / defeat",
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
      normalFragment: {
        type: "fragment",
        label: "Normal片段",
        chapterField: "normalChapterId",
      },
      defeatFragment: {
        type: "fragment",
        label: "Defeat片段",
        chapterField: "defeatChapterId",
      },
      prompt: { type: "string", label: "提示文案" },
    },

    /**
     * 正常执行 QTE：显示 UI、绑定按键、等待玩家输入或超时，最后跳转对应片段。
     *
     * @param ctx - 扩展上下文，用于显示/隐藏 UI 与跳转片段
     * @param params - 从 schema 推导出的参数对象；chapterField 辅助字段需额外收窄
     */
    async run(ctx, params) {
      const allParams = params as Record<string, unknown>;
      await runQteSession(ctx, buildQteConfigInput(allParams));
    },

    /**
     * 玩家快进或跳过 QTE 时的简化行为。
     *
     * 直接按 skipCountsAsPass 计算结果并跳转对应片段，不等待玩家输入。
     *
     * @param ctx - 扩展上下文
     * @param params - 从 schema 推导出的参数对象
     */
    async skip(ctx, params) {
      const allParams = params as Record<string, unknown>;
      await skipQteSession(ctx, buildQteConfigInput(allParams));
    },
  });
}

export default QteExtension;
