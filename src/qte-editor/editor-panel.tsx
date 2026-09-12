import React, { useEffect, useMemo, useRef, useState } from "react";
import { useExtensionContext, type ExtensionProps } from "@avg-studio/sdk";
import {
  QTE_STYLE_DEFAULTS,
  QTE_STYLE_ENUMS,
  QTE_STYLE_FIELDS,
  QTE_STYLE_LIMITS,
  isQteColorField,
  isQteEnumField,
  isQteNumericField,
  normalizeQteStyleField,
  resolveQteStyle,
  type QteResolvedStyle,
  type QteStyleFieldKey,
} from "../qte/qte-style";
import {
  QTE_PRESET_CATEGORIES,
  QTE_STYLE_PRESETS,
  matchesQtePreset,
  type QtePresetCategory,
} from "../qte/qte-presets";
import { QteVisual, type QteVisualModel } from "../qte/qte-visual";
import {
  QTE_EDITOR_LAYERS,
  createDemoVisualModel,
  fieldsForLayer,
  tickDemoRemaining,
  type QteEditorLayerId,
} from "./demo-snapshot";
import { QTE_LAB_STYLES } from "./qte-lab-styles";

export interface EditorPanelProps extends ExtensionProps {}

interface FieldMeta {
  label: string;
  description?: string;
}

const FIELD_META: Record<QteStyleFieldKey, FieldMeta> = {
  overlayColor: { label: "舞台遮罩", description: "覆盖整块游戏画面的颜色与透明度。" },
  overlayBlur: { label: "背景模糊", description: "模糊 QTE 后方的剧情画面。" },
  outerRingColor: { label: "倒计时环", description: "随剩余时间收缩的主环颜色。" },
  outerTrackColor: { label: "环形轨道", description: "完整尺寸的静态参照环。" },
  perfectColor: { label: "Perfect 环", description: "最佳判定窗口的颜色。" },
  tickColor: { label: "刻度颜色" },
  buttonBgColor: { label: "按钮底色" },
  buttonTextColor: { label: "按键文字" },
  buttonBorderColor: { label: "按钮描边" },
  buttonAccentColor: { label: "按钮强调色", description: "用于按钮内辉光、环境光点与渐变。" },
  promptColor: { label: "提示文字" },
  promptBgColor: { label: "提示底色" },
  progressColor: { label: "进度文字" },
  flashColor: { label: "命中闪光" },
  ringShape: { label: "环形状" },
  ringPattern: { label: "环纹理", description: "分段纹理在圆形模式下显示最完整。" },
  buttonShape: { label: "按钮形状" },
  promptWeight: { label: "提示字重" },
  progressMode: { label: "进度显示" },
  ringDiameter: { label: "环直径" },
  ringStroke: { label: "描边粗细" },
  ringGlow: { label: "环辉光" },
  ringRotationSpeed: { label: "旋转速度", description: "负值反向旋转；0 表示静止。" },
  tickCount: { label: "刻度数量", description: "设为 0 可完全隐藏刻度。" },
  tickLength: { label: "刻度长度" },
  buttonSize: { label: "按钮尺寸" },
  buttonBorderWidth: { label: "按钮描边" },
  buttonFontSize: { label: "按键字号" },
  buttonShadow: { label: "按钮阴影" },
  buttonPulse: { label: "呼吸幅度", description: "设为 0 可关闭按钮呼吸动画。" },
  promptFontSize: { label: "提示字号" },
  promptOffset: { label: "提示距离" },
  promptLetterSpacing: { label: "提示字距" },
  promptPadding: { label: "提示内边距" },
  promptRadius: { label: "提示圆角" },
  progressFontSize: { label: "进度字号" },
  progressOffset: { label: "进度距离" },
  flashSize: { label: "闪光尺寸" },
  flashIntensity: { label: "闪光强度" },
  flashDuration: { label: "反馈持续", description: "运行时命中 Perfect 后会等待这段反馈完成。" },
  ambientGlow: { label: "环境辉光" },
  sparkCount: { label: "光点数量", description: "设为 0 可关闭环绕光点。" },
  motionSpeed: { label: "动效倍率", description: "统一影响旋转、呼吸和光点速度。" },
};

const ENUM_LABELS: Record<string, string> = {
  circle: "圆形",
  "rounded-square": "圆角方形",
  diamond: "菱形",
  solid: "实线",
  dashed: "虚线",
  segmented: "分段",
  rounded: "圆角方形",
  regular: "常规",
  semibold: "半粗",
  bold: "粗体",
  none: "隐藏",
  time: "剩余秒数",
  percent: "剩余百分比",
};

const LAYER_DESCRIPTIONS: Record<QteEditorLayerId, string> = {
  backdrop: "舞台遮罩与背景聚焦",
  outer: "倒计时主环、轨道与运动",
  ticks: "外围定位刻度",
  perfect: "最佳判定窗口",
  button: "中心按键与呼吸反馈",
  prompt: "顶部操作提示",
  progress: "剩余时间或连打进度",
  flash: "命中闪光与环境光点",
};

function readStyle(ctx: {
  settings: { cross: { get<T = unknown>(uiId: string, key: string): T | undefined } };
}): QteResolvedStyle {
  const values: Record<string, unknown> = {};
  for (const field of QTE_STYLE_FIELDS) {
    try {
      values[field] = ctx.settings.cross.get("qte", field);
    } catch {
      values[field] = undefined;
    }
  }
  return resolveQteStyle(values);
}

function toNativeHex(value: string): string {
  const match = /^#([0-9a-fA-F]{6})/.exec(value);
  if (match) return `#${match[1]}`;
  const short = /^#([0-9a-fA-F]{3})$/.exec(value);
  if (short) return `#${short[1]!.split("").map((part) => part + part).join("")}`;
  return "#ffffff";
}

function replaceRgb(value: string, rgb: string): string {
  const alpha = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})$/.exec(value)?.[1];
  return alpha ? `${rgb}${alpha}` : rgb;
}

function styleEquals(a: QteResolvedStyle, b: QteResolvedStyle): boolean {
  return QTE_STYLE_FIELDS.every((field) => a[field] === b[field]);
}

function isCompleteColor(value: string): boolean {
  const text = value.trim();
  return (
    /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(text) ||
    /^rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+(?:\s*,\s*[\d.]+)?\s*\)$/i.test(text)
  );
}

function ColorTextInput({
  id,
  value,
  onCommit,
}: {
  id: string;
  value: string;
  onCommit(value: string): void;
}) {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(value);
  }, [value]);

  return (
    <input
      id={id}
      type="text"
      spellCheck={false}
      value={draft}
      onFocus={() => { focused.current = true; }}
      onBlur={() => {
        focused.current = false;
        if (isCompleteColor(draft)) onCommit(draft);
        else setDraft(value);
      }}
      onChange={(event) => {
        const next = event.currentTarget.value;
        setDraft(next);
        if (isCompleteColor(next)) onCommit(next);
      }}
    />
  );
}

function NumberDraftInput({
  label,
  value,
  min,
  max,
  step,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onCommit(value: number): void;
}) {
  const [draft, setDraft] = useState(String(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(String(value));
  }, [value]);

  return (
    <input
      type="number"
      aria-label={label}
      min={min}
      max={max}
      step={step}
      value={draft}
      onFocus={() => { focused.current = true; }}
      onBlur={() => {
        focused.current = false;
        const next = Number(draft);
        if (draft.trim() && Number.isFinite(next)) onCommit(next);
        else setDraft(String(value));
      }}
      onChange={(event) => {
        const text = event.currentTarget.value;
        setDraft(text);
        const next = Number(text);
        if (text.trim() && Number.isFinite(next)) onCommit(next);
      }}
    />
  );
}

function FieldControl({
  field,
  value,
  onChange,
}: {
  field: QteStyleFieldKey;
  value: QteResolvedStyle[QteStyleFieldKey];
  onChange(value: unknown): void;
}) {
  const meta = FIELD_META[field];

  if (isQteColorField(field)) {
    const text = String(value);
    return (
      <div className="ql-field">
        <div className="ql-field-title"><label htmlFor={`ql-${field}`}>{meta.label}</label><output>{text}</output></div>
        <div className="ql-color-row">
          <span className="ql-color-swatch" style={{ "--field-color": text } as React.CSSProperties}>
            <i />
            <input
              type="color"
              aria-label={`${meta.label}取色`}
              value={toNativeHex(text)}
              onChange={(event) => onChange(replaceRgb(text, event.currentTarget.value.toUpperCase()))}
            />
          </span>
          <ColorTextInput
            id={`ql-${field}`}
            value={text}
            onCommit={onChange}
          />
        </div>
        {meta.description && <p className="ql-help">{meta.description}</p>}
      </div>
    );
  }

  if (isQteNumericField(field)) {
    const limits = QTE_STYLE_LIMITS[field];
    const number = Number(value);
    return (
      <div className="ql-field">
        <div className="ql-field-title">
          <label htmlFor={`ql-${field}`}>{meta.label}</label>
          <output>{number}{limits.unit}</output>
        </div>
        <div className="ql-field-row">
          <input
            id={`ql-${field}`}
            type="range"
            min={limits.min}
            max={limits.max}
            step={limits.step}
            value={number}
            onChange={(event) => onChange(Number(event.currentTarget.value))}
          />
          <NumberDraftInput
            label={`${meta.label}数值`}
            min={limits.min}
            max={limits.max}
            step={limits.step}
            value={number}
            onCommit={onChange}
          />
        </div>
        {meta.description && <p className="ql-help">{meta.description}</p>}
      </div>
    );
  }

  if (isQteEnumField(field)) {
    return (
      <div className="ql-field">
        <div className="ql-field-title"><label htmlFor={`ql-${field}`}>{meta.label}</label></div>
        <select id={`ql-${field}`} value={String(value)} onChange={(event) => onChange(event.currentTarget.value)}>
          {(QTE_STYLE_ENUMS[field] as readonly string[]).map((option) => (
            <option key={option} value={option}>{ENUM_LABELS[option] ?? option}</option>
          ))}
        </select>
        {meta.description && <p className="ql-help">{meta.description}</p>}
      </div>
    );
  }

  return null;
}

const TICK_MS = 50;

export const EditorPanel: React.FC<EditorPanelProps> = () => {
  const ctx = useExtensionContext();
  const [style, setStyle] = useState<QteResolvedStyle>(() => readStyle(ctx));
  const styleRef = useRef(style);
  const [selectedLayer, setSelectedLayer] = useState<QteEditorLayerId>("outer");
  const [category, setCategory] = useState<"全部" | QtePresetCategory>("全部");
  const [model, setModel] = useState<QteVisualModel>(() => createDemoVisualModel());
  const [playing, setPlaying] = useState(true);
  const [previewSpeed, setPreviewSpeed] = useState(1);
  const [background, setBackground] = useState("night");
  const [grid, setGrid] = useState(true);
  const [localPrompt, setLocalPrompt] = useState("在最佳时机按下 F");
  const [status, setStatus] = useState("已读取项目样式");
  const [statusError, setStatusError] = useState(false);
  const [historyVersion, setHistoryVersion] = useState(0);
  const historyRef = useRef<{ past: QteResolvedStyle[]; future: QteResolvedStyle[] }>({
    past: [],
    future: [],
  });
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [jsonFeedback, setJsonFeedback] = useState("可以导出完整样式，或粘贴 JSON 后导入。");
  const [jsonError, setJsonError] = useState(false);

  useEffect(() => {
    styleRef.current = style;
  }, [style]);

  useEffect(() => {
    setModel((previous) => previous.prompt === localPrompt ? previous : { ...previous, prompt: localPrompt });
  }, [localPrompt]);

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setModel((previous) => ({
        ...previous,
        remainingSec: tickDemoRemaining(
          previous.remainingSec,
          (TICK_MS / 1000) * previewSpeed,
          previous.timeoutSec,
        ),
      }));
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [playing, previewSpeed]);

  useEffect(() => () => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
  }, []);

  const persist = (
    next: QteResolvedStyle,
    fields: readonly QteStyleFieldKey[] = QTE_STYLE_FIELDS,
  ) => {
    let failed = false;
    for (const field of fields) {
      try {
        ctx.settings.cross.set("qte", field, next[field]);
      } catch {
        failed = true;
      }
    }
    setStatus(failed ? "宿主未提供写入能力，仅本地预览" : "已同步到项目设置");
    setStatusError(failed);
  };

  const commit = (
    next: QteResolvedStyle,
    record = true,
    fields: readonly QteStyleFieldKey[] = QTE_STYLE_FIELDS,
  ) => {
    const current = styleRef.current;
    if (styleEquals(current, next)) return;
    if (record) {
      historyRef.current.past.push(current);
      if (historyRef.current.past.length > 80) historyRef.current.past.shift();
      historyRef.current.future = [];
    }
    styleRef.current = next;
    setStyle(next);
    persist(next, fields);
    setHistoryVersion((value) => value + 1);
  };

  const changeField = (field: QteStyleFieldKey, value: unknown) => {
    commit(
      {
        ...styleRef.current,
        [field]: normalizeQteStyleField(field, value),
      },
      true,
      [field],
    );
  };

  const restoreHistory = (redo = false) => {
    const source = redo ? historyRef.current.future : historyRef.current.past;
    const destination = redo ? historyRef.current.past : historyRef.current.future;
    const restored = source.pop();
    if (!restored) return;
    destination.push(styleRef.current);
    commit(restored, false);
  };

  const triggerFlash = () => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setModel((previous) => ({ ...previous, showPerfectFlash: true }));
    flashTimerRef.current = setTimeout(() => {
      setModel((previous) => ({ ...previous, showPerfectFlash: false }));
      flashTimerRef.current = null;
    }, styleRef.current.flashDuration);
  };

  const pressPreview = () => {
    if (model.mode === "mash") {
      setModel((previous) => ({
        ...previous,
        hitCount: previous.hitCount + 1 >= previous.mashCount ? 0 : previous.hitCount + 1,
      }));
    }
    triggerFlash();
  };

  const activePreset = useMemo(
    () => QTE_STYLE_PRESETS.find((preset) => matchesQtePreset(style, preset)),
    [style],
  );
  const visiblePresets = useMemo(
    () => QTE_STYLE_PRESETS.filter((preset) => category === "全部" || preset.category === category),
    [category],
  );
  const selectedFields = fieldsForLayer(selectedLayer);
  const elapsed = model.timeoutSec - model.remainingSec;
  const elapsedPercent = Math.max(0, Math.min(100, (elapsed / model.timeoutSec) * 100));
  const perfectLeft = Math.max(0, Math.min(100, (model.perfectStartSec / model.timeoutSec) * 100));
  const perfectWidth = Math.max(0, Math.min(100 - perfectLeft, ((model.perfectEndSec - model.perfectStartSec) / model.timeoutSec) * 100));

  const openJson = () => {
    setJsonText(JSON.stringify(styleRef.current, null, 2));
    setJsonFeedback("已导出当前完整样式。");
    setJsonError(false);
    setJsonOpen(true);
  };

  const importJson = () => {
    try {
      const parsed: unknown = JSON.parse(jsonText);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("根节点必须是对象");
      commit(resolveQteStyle(parsed as Record<string, unknown>));
      setJsonText(JSON.stringify(styleRef.current, null, 2));
      setJsonFeedback("导入成功，已经同步到项目设置。");
      setJsonError(false);
    } catch (error) {
      setJsonFeedback(`导入失败：${error instanceof Error ? error.message : "JSON 无效"}`);
      setJsonError(true);
    }
  };

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(jsonText);
      setJsonFeedback("已复制到剪贴板。");
      setJsonError(false);
    } catch {
      setJsonFeedback("无法访问剪贴板，请在文本框中手动全选复制。");
      setJsonError(true);
    }
  };

  return (
    <div
      className="qte-lab-scope"
      onKeyDown={(event) => {
        if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
        const key = event.key.toLowerCase();
        if (key === "z" || key === "y") {
          event.preventDefault();
          restoreHistory(key === "y" || event.shiftKey);
        }
      }}
    >
      <style>{QTE_LAB_STYLES}</style>
      <div className="qte-style-lab">
        <header className="ql-header">
          <span className="ql-logo" aria-hidden="true">Q</span>
          <div className="ql-heading">
            <h1>QTE 样式实验室</h1>
            <p>TIMING INTERFACE / ADVANCED STYLE</p>
          </div>
          <div className="ql-header-actions">
            <span className="ql-save-state" data-error={statusError}>{status}</span>
            <button className="ql-button ql-quiet ql-icon" title="撤销 · Ctrl Z" aria-label="撤销" disabled={!historyRef.current.past.length} onClick={() => restoreHistory()}>↶</button>
            <button className="ql-button ql-quiet ql-icon" title="重做 · Ctrl Y" aria-label="重做" disabled={!historyRef.current.future.length} onClick={() => restoreHistory(true)}>↷</button>
            <button className="ql-button ql-quiet" onClick={openJson}>{"{ }"} JSON 配置</button>
            <button className="ql-button ql-primary" onClick={() => commit({ ...QTE_STYLE_DEFAULTS })}>恢复经典样式</button>
          </div>
        </header>

        <div className="ql-body">
          <aside className="ql-presets" aria-label="QTE 样式预设">
            <h2 className="ql-section-title">样式预设 / PRESETS <span>{QTE_STYLE_PRESETS.length}</span></h2>
            <div className="ql-filter" role="group" aria-label="预设分类">
              {QTE_PRESET_CATEGORIES.map((item) => (
                <button key={item} className="ql-button" aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>
              ))}
            </div>
            <div className="ql-preset-list">
              {visiblePresets.map((preset) => {
                const shapeRadius = preset.style.ringShape === "circle" ? "50%" : "23%";
                const rotation = preset.style.ringShape === "diamond" ? "45deg" : "0deg";
                return (
                  <button
                    key={preset.id}
                    className="ql-preset"
                    aria-pressed={activePreset?.id === preset.id}
                    title={preset.description}
                    onClick={() => commit({ ...preset.style })}
                  >
                    <span
                      className="ql-preset-art"
                      style={{
                        "--preset-color": preset.style.outerRingColor,
                        "--preset-glow": preset.style.buttonAccentColor,
                        "--preset-pattern": preset.style.ringPattern === "solid" ? "solid" : "dashed",
                        "--preset-radius": shapeRadius,
                        "--preset-rotation": rotation,
                      } as React.CSSProperties}
                    ><i /></span>
                    <span className="ql-preset-copy"><strong>{preset.name}</strong><small>{preset.category} · {preset.description}</small></span>
                  </button>
                );
              })}
            </div>
            <p className="ql-preset-help">预设会替换整套参数；之后在右侧继续调整即成为自定义样式。所有修改直接写入 QTE 项目设置。</p>
          </aside>

          <main className="ql-workspace">
            <div className="ql-workspace-top">
              <div className="ql-workspace-title">
                <div className="ql-eyebrow">LIVE RUNTIME PREVIEW / 1920 × 1080</div>
                <h2>{activePreset?.name ?? "自定义样式"}</h2>
                <p>编辑结果与游戏运行时共享同一视觉组件；点击中心按钮可测试反馈。</p>
              </div>
              <span className="ql-live" data-paused={!playing}>{playing ? "LIVE" : "PAUSED"}</span>
            </div>

            <section className="ql-stage-card" aria-label="QTE 实时预览">
              <div className="ql-stage" data-background={background}>
                {grid && <div className="ql-grid" />}
                <QteVisual
                  style={style}
                  model={model}
                  interactive
                  onButtonClick={pressPreview}
                  highlightLayer={selectedLayer}
                />
                <span className="ql-stage-badge">1920 × 1080 / DESIGN SPACE</span>
                <span className="ql-stage-tip">点击按键测试 · 右侧分层调参</span>
              </div>
              <div className="ql-stage-toolbar">
                <button className="ql-button" onClick={() => setPlaying((value) => !value)}>{playing ? "Ⅱ 暂停" : "▶ 播放"}</button>
                <button className="ql-button" onClick={() => {
                  setModel((previous) => ({ ...previous, remainingSec: previous.timeoutSec, hitCount: 0 }));
                  setPlaying(true);
                }}>↻ 重播</button>
                <button className="ql-button" onClick={triggerFlash}>✦ 命中反馈</button>
                <div className="ql-mode-toggle" role="group" aria-label="预览 QTE 模式">
                  <button className="ql-button" aria-pressed={model.mode === "single"} onClick={() => setModel((value) => ({ ...value, mode: "single", hitCount: 0 }))}>单键</button>
                  <button className="ql-button" aria-pressed={model.mode === "mash"} onClick={() => setModel((value) => ({ ...value, mode: "mash", mashCount: 10, hitCount: 4 }))}>连打</button>
                </div>
                <div className="ql-toolbar-right">
                  <button className="ql-button" aria-pressed={grid} onClick={() => setGrid((value) => !value)}>网格</button>
                  <select className="ql-select" aria-label="预览背景" value={background} onChange={(event) => setBackground(event.currentTarget.value)}>
                    <option value="night">夜幕背景</option>
                    <option value="warm">暖色场景</option>
                    <option value="light">浅色场景</option>
                    <option value="checker">透明棋盘</option>
                  </select>
                  <select className="ql-select" aria-label="预览速度" value={previewSpeed} onChange={(event) => setPreviewSpeed(Number(event.currentTarget.value))}>
                    <option value={0.25}>0.25×</option>
                    <option value={0.5}>0.5×</option>
                    <option value={1}>1×</option>
                    <option value={2}>2×</option>
                  </select>
                </div>
              </div>
            </section>

            <section className="ql-timeline" aria-label="QTE 时间轴">
              <div className="ql-timeline-head"><strong>判定时间轴</strong><output>{elapsed.toFixed(2)}s / {model.timeoutSec.toFixed(1)}s</output></div>
              <input
                className="ql-time-slider"
                type="range"
                min={0}
                max={model.timeoutSec}
                step={0.01}
                value={elapsed}
                onChange={(event) => {
                  setPlaying(false);
                  setModel((previous) => ({ ...previous, remainingSec: previous.timeoutSec - Number(event.currentTarget.value) }));
                }}
              />
              <div className="ql-window-track">
                <i style={{ marginLeft: `${perfectLeft}%`, width: `${perfectWidth}%` }} />
              </div>
              <div className="ql-window-caption"><span>开始 · {Math.round(elapsedPercent)}%</span><span>高亮条 = Perfect 窗口</span><span>超时</span></div>
            </section>

            <div className="ql-statbar" aria-label="当前样式摘要">
              <div className="ql-stat"><span>环尺寸 / RING</span><strong>{style.ringDiameter}px</strong></div>
              <div className="ql-stat"><span>运动 / MOTION</span><strong>{style.motionSpeed.toFixed(2)}×</strong></div>
              <div className="ql-stat"><span>光点 / SPARKS</span><strong>{Math.round(style.sparkCount)}</strong></div>
              <div className="ql-stat"><span>反馈 / HIT FX</span><strong>{style.flashDuration}ms</strong></div>
            </div>
          </main>

          <aside className="ql-inspector" aria-label="样式属性">
            <div className="ql-inspector-head">
              <h2>{QTE_EDITOR_LAYERS.find((layer) => layer.id === selectedLayer)?.label}</h2>
              <p>{LAYER_DESCRIPTIONS[selectedLayer]}</p>
            </div>
            <div className="ql-layer-tabs" role="tablist" aria-label="视觉图层">
              {QTE_EDITOR_LAYERS.map((layer) => (
                <button
                  key={layer.id}
                  className="ql-button"
                  role="tab"
                  aria-selected={selectedLayer === layer.id}
                  aria-pressed={selectedLayer === layer.id}
                  onClick={() => setSelectedLayer(layer.id)}
                >{layer.icon} {layer.label}</button>
              ))}
            </div>
            <div className="ql-fields">
              {selectedFields.map((field) => (
                <FieldControl
                  key={field}
                  field={field}
                  value={style[field]}
                  onChange={(value) => changeField(field, value)}
                />
              ))}
            </div>
            {selectedLayer === "prompt" && (
              <div className="ql-prompt-input">
                <label htmlFor="ql-preview-prompt">预览文案（仅预览）</label>
                <input id="ql-preview-prompt" value={localPrompt} maxLength={64} onChange={(event) => setLocalPrompt(event.currentTarget.value)} />
              </div>
            )}
            {selectedLayer === "flash" && (
              <div className="ql-inspector-note">点击“命中反馈”可反复检查闪光、光点和持续时间。真实游戏会在 Perfect 后等待反馈结束再进入结果片段。</div>
            )}
          </aside>
        </div>

        <footer className="ql-footer">
          <span>{activePreset ? `内置预设 · ${activePreset.name}` : "自定义样式 · 已覆盖内置预设参数"}</span>
          <span>RUNTIME-SHARED · AUTO SAVE · {historyVersion}</span>
        </footer>

        {jsonOpen && (
          <div className="ql-modal-backdrop" role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget) setJsonOpen(false);
          }}>
            <section className="ql-json-panel" role="dialog" aria-modal="true" aria-label="QTE JSON 配置">
              <div className="ql-json-head">
                <div><h2>QTE 样式 JSON</h2><p>导入会规范化全部字段并立即写入项目设置。</p></div>
                <button className="ql-button ql-icon" aria-label="关闭" onClick={() => setJsonOpen(false)}>×</button>
              </div>
              <textarea value={jsonText} spellCheck={false} onChange={(event) => {
                setJsonText(event.currentTarget.value);
                setJsonFeedback("JSON 已修改，点击导入进行校验。");
                setJsonError(false);
              }} />
              <div className="ql-json-feedback" data-error={jsonError} role="status">{jsonFeedback}</div>
              <div className="ql-json-actions">
                <button className="ql-button ql-primary" onClick={importJson}>导入并应用</button>
                <button className="ql-button" onClick={() => {
                  setJsonText(JSON.stringify(styleRef.current, null, 2));
                  setJsonFeedback("已重新导出当前样式。");
                  setJsonError(false);
                }}>导出当前</button>
                <button className="ql-button" onClick={copyJson}>复制 JSON</button>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};
