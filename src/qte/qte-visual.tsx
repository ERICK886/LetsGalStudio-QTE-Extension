import React from "react";
import {
  colorToRgba,
  dimColor,
  type QteResolvedStyle,
  type QteRingShape,
  type QteRingPattern,
} from "./qte-style";
import { FONT_UI } from "../ui-fonts";

export type QteVisualHighlightLayer =
  | "backdrop"
  | "outer"
  | "ticks"
  | "perfect"
  | "button"
  | "prompt"
  | "progress"
  | "flash"
  | null;

export interface QteVisualModel {
  keyLabel: string;
  prompt: string;
  mode: "single" | "mash";
  mashCount: number;
  hitCount: number;
  timeoutSec: number;
  remainingSec: number;
  perfectStartSec: number;
  perfectEndSec: number;
  perfectEnabled: boolean;
  showPerfectFlash: boolean;
  posX: number;
  posY: number;
}

export interface QteVisualProps {
  style: QteResolvedStyle;
  model: QteVisualModel;
  interactive?: boolean;
  onButtonClick?: () => void;
  highlightLayer?: QteVisualHighlightLayer;
}

const HIGHLIGHT = "2px solid #f43f5e";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function computeOuterRingScale(model: QteVisualModel): number {
  return model.timeoutSec > 0
    ? 0.5 + 0.5 * clamp01(model.remainingSec / model.timeoutSec)
    : 0.5;
}

/**
 * 将 Perfect 环固定在判定窗口终点对应的计时环半径上。
 * 当 elapsed === perfectEndSec 时，收缩中的外环会与 Perfect 环精确重合。
 */
export function computePerfectRingScale(model: QteVisualModel): number {
  if (!model.perfectEnabled || model.timeoutSec <= 0) return 0.62;
  const remainingAtPerfectEnd = model.timeoutSec - model.perfectEndSec;
  return 0.5 + 0.5 * clamp01(remainingAtPerfectEnd / model.timeoutSec);
}

function inPerfectWindow(model: QteVisualModel): boolean {
  const elapsed = model.timeoutSec - model.remainingSec;
  return (
    model.perfectEnabled &&
    elapsed >= model.perfectStartSec &&
    elapsed <= model.perfectEndSec
  );
}

function shapeRadius(shape: QteRingShape): string {
  if (shape === "circle") return "50%";
  if (shape === "rounded-square") return "24%";
  return "18%";
}

function buttonRadius(shape: QteResolvedStyle["buttonShape"]): string {
  if (shape === "circle") return "50%";
  if (shape === "rounded") return "24%";
  return "18%";
}

function weightValue(weight: QteResolvedStyle["promptWeight"]): number {
  if (weight === "bold") return 750;
  if (weight === "semibold") return 620;
  return 420;
}

function Ring({
  size,
  color,
  stroke,
  shape,
  pattern,
  glow,
  speed = 0,
  dimmed = false,
  highlight = false,
}: {
  size: number;
  color: string;
  stroke: number;
  shape: QteRingShape;
  pattern: QteRingPattern;
  glow: number;
  speed?: number;
  dimmed?: boolean;
  highlight?: boolean;
}) {
  const segmented = pattern === "segmented" && shape === "circle";
  const duration = speed === 0 ? 0 : 360 / Math.max(1, Math.abs(speed));
  const shownColor = dimmed ? dimColor(color) : color;
  const innerTransform = shape === "diamond" ? "rotate(45deg) scale(.72)" : undefined;
  const ringStyle: React.CSSProperties = segmented
    ? {
        background: `repeating-conic-gradient(from 0deg, ${shownColor} 0deg 10deg, transparent 10deg 17deg)`,
        WebkitMask: `radial-gradient(farthest-side, transparent calc(100% - ${stroke}px - 1px), #000 calc(100% - ${stroke}px))`,
        mask: `radial-gradient(farthest-side, transparent calc(100% - ${stroke}px - 1px), #000 calc(100% - ${stroke}px))`,
      }
    : {
        border: `${stroke}px ${pattern === "solid" ? "solid" : "dashed"} ${shownColor}`,
      };

  return (
    <div
      className="qte-ring-motion"
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: size,
        height: size,
        transform: "translate(-50%, -50%)",
        animation:
          duration > 0
            ? `${speed > 0 ? "qte-ring-spin" : "qte-ring-spin-reverse"} ${duration}s linear infinite`
            : undefined,
        pointerEvents: "none",
        outline: highlight ? HIGHLIGHT : undefined,
        outlineOffset: 5,
        borderRadius: "50%",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          boxSizing: "border-box",
          borderRadius: shapeRadius(shape),
          transform: innerTransform,
          filter: glow > 0 ? `drop-shadow(0 0 ${glow}px ${colorToRgba(color, 0.74)})` : undefined,
          ...ringStyle,
        }}
      />
    </div>
  );
}

export const QteVisual: React.FC<QteVisualProps> = ({
  style,
  model,
  interactive = true,
  onButtonClick,
  highlightLayer = null,
}) => {
  const base = style.ringDiameter;
  const currentOuterScale = computeOuterRingScale(model);
  const currentPerfectScale = computePerfectRingScale(model);
  const perfectActive = inPerfectWindow(model);
  const percent = model.timeoutSec > 0
    ? Math.round(clamp01(model.remainingSec / model.timeoutSec) * 100)
    : 0;
  const rotationSpeed = style.ringRotationSpeed * style.motionSpeed;
  const pulseDuration = 1.25 / style.motionSpeed;
  const sparks = Array.from({ length: Math.round(style.sparkCount) }, (_, index) => index);
  const progressText =
    model.mode === "mash"
      ? `${model.hitCount} / ${model.mashCount}`
      : style.progressMode === "percent"
        ? `${percent}%`
        : `${Math.max(0, model.remainingSec).toFixed(1)}s`;

  return (
    <div
      className="qte-visual-root"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        overflow: "hidden",
        background: style.overlayColor,
        backdropFilter: style.overlayBlur ? `blur(${style.overlayBlur}px)` : undefined,
        WebkitBackdropFilter: style.overlayBlur ? `blur(${style.overlayBlur}px)` : undefined,
        fontFamily: FONT_UI,
        userSelect: "none",
        outline: highlightLayer === "backdrop" ? HIGHLIGHT : undefined,
        outlineOffset: -4,
      }}
    >
      <style>{`
        @keyframes qte-ring-spin {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
        @keyframes qte-ring-spin-reverse {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(-360deg); }
        }
        @keyframes qte-origin-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes qte-origin-spin-reverse {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }
        @keyframes qte-button-pulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(var(--qte-pulse)); }
        }
        @keyframes qte-spark-breathe {
          0%, 100% { opacity: .2; transform: rotate(var(--qte-angle)) translateY(var(--qte-distance)) scale(.65); }
          50% { opacity: .9; transform: rotate(var(--qte-angle)) translateY(calc(var(--qte-distance) - 10px)) scale(1.15); }
        }
        @keyframes qte-perfect-flash {
          0% { transform: translate(-50%, -50%) scale(.5); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(1.45); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .qte-visual-root .qte-ring-motion,
          .qte-visual-root .qte-button-motion,
          .qte-visual-root .qte-spark { animation: none !important; }
        }
      `}</style>

      <div
        style={{
          position: "absolute",
          left: `${model.posX}%`,
          top: `${model.posY}%`,
          width: base,
          height: base,
          transform: "translate(-50%, -50%)",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: base * 0.82,
            height: base * 0.82,
            borderRadius: "50%",
            transform: "translate(-50%, -50%)",
            background: `radial-gradient(circle, ${colorToRgba(style.buttonAccentColor, 0.22)} 0%, ${colorToRgba(style.buttonAccentColor, 0.06)} 42%, transparent 72%)`,
            filter: style.ambientGlow ? `blur(${Math.max(1, style.ambientGlow / 5)}px)` : undefined,
            opacity: Math.min(1, style.ambientGlow / 80),
          }}
        />

        <Ring
          size={base}
          color={style.outerTrackColor}
          stroke={style.ringStroke}
          shape={style.ringShape}
          pattern="solid"
          glow={0}
        />

        {style.tickCount > 0 && (
          <div
            className="qte-ring-motion"
            style={{
              position: "absolute",
              inset: 0,
              animation:
                rotationSpeed === 0
                  ? undefined
                  : `${rotationSpeed > 0 ? "qte-origin-spin" : "qte-origin-spin-reverse"} ${720 / Math.max(1, Math.abs(rotationSpeed))}s linear infinite`,
              outline: highlightLayer === "ticks" ? HIGHLIGHT : undefined,
              outlineOffset: 6,
              borderRadius: "50%",
            }}
          >
            {Array.from({ length: Math.round(style.tickCount) }, (_, index) => (
              <i
                key={index}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: Math.max(1, style.ringStroke / 3),
                  height: style.tickLength,
                  marginLeft: -Math.max(1, style.ringStroke / 3) / 2,
                  marginTop: -style.tickLength / 2,
                  borderRadius: 99,
                  background: style.tickColor,
                  transform: `rotate(${(360 / style.tickCount) * index}deg) translateY(${-base / 2 - style.tickLength / 2 - 8}px)`,
                }}
              />
            ))}
          </div>
        )}

        <Ring
          size={base * currentOuterScale}
          color={style.outerRingColor}
          stroke={style.ringStroke}
          shape={style.ringShape}
          pattern={style.ringPattern}
          glow={style.ringGlow}
          speed={rotationSpeed}
          highlight={highlightLayer === "outer"}
        />

        {model.perfectEnabled && (
          <Ring
            size={base * currentPerfectScale}
            color={style.perfectColor}
            stroke={Math.max(1, style.ringStroke * 0.75)}
            shape={style.ringShape}
            pattern={style.ringPattern === "solid" ? "dashed" : style.ringPattern}
            glow={perfectActive ? style.ringGlow * 1.2 : style.ringGlow * 0.3}
            speed={-rotationSpeed * 0.65}
            dimmed={!perfectActive}
            highlight={highlightLayer === "perfect"}
          />
        )}

        {sparks.map((index) => {
          const angle = (360 / Math.max(1, sparks.length)) * index;
          const delay = -(index / Math.max(1, sparks.length)) * (1.8 / style.motionSpeed);
          return (
            <i
              className="qte-spark"
              key={index}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: 2 + (index % 3),
                height: 2 + (index % 3),
                marginLeft: -2,
                marginTop: -2,
                borderRadius: "50%",
                background: index % 2 ? style.perfectColor : style.buttonAccentColor,
                boxShadow: `0 0 8px ${style.buttonAccentColor}`,
                animation: `qte-spark-breathe ${1.8 / style.motionSpeed}s ease-in-out ${delay}s infinite`,
                ["--qte-angle" as string]: `${angle}deg`,
                ["--qte-distance" as string]: `${-Math.max(style.buttonSize * 0.7, base * 0.28)}px`,
              }}
            />
          );
        })}

        <div
          className="qte-button-motion"
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: style.buttonSize,
            height: style.buttonSize,
            transform: "translate(-50%, -50%)",
            animation:
              style.buttonPulse > 0
                ? `qte-button-pulse ${pulseDuration}s ease-in-out infinite`
                : undefined,
            ["--qte-pulse" as string]: String(1 + style.buttonPulse / 100),
            outline: highlightLayer === "button" ? HIGHLIGHT : undefined,
            outlineOffset: 4,
            borderRadius: "50%",
          }}
        >
          <button
            type="button"
            aria-label={`QTE 按键 ${model.keyLabel}`}
            onClick={interactive ? onButtonClick : undefined}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              padding: 0,
              borderRadius: buttonRadius(style.buttonShape),
              border: `${style.buttonBorderWidth}px solid ${style.buttonBorderColor}`,
              background: `linear-gradient(145deg, ${colorToRgba(style.buttonAccentColor, 0.3)}, transparent 56%), ${style.buttonBgColor}`,
              color: style.buttonTextColor,
              font: `750 ${style.buttonFontSize}px/1 ${FONT_UI}`,
              letterSpacing: ".02em",
              cursor: interactive ? "pointer" : "default",
              pointerEvents: interactive ? "auto" : "none",
              boxShadow: `0 ${Math.round(style.buttonShadow / 3)}px ${style.buttonShadow}px rgba(0,0,0,.42), inset 0 0 ${Math.max(4, style.buttonShadow / 2)}px ${colorToRgba(style.buttonAccentColor, 0.2)}`,
              transform: style.buttonShape === "diamond" ? "rotate(45deg) scale(.78)" : undefined,
            }}
          >
            <span
              style={{
                display: "grid",
                placeItems: "center",
                width: "100%",
                height: "100%",
                transform: style.buttonShape === "diamond" ? "rotate(-45deg) scale(1.28)" : undefined,
              }}
            >
              {model.keyLabel}
            </span>
          </button>
        </div>

        {model.prompt && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: `calc(50% - ${base / 2 + style.promptOffset}px)`,
              transform: "translate(-50%, -50%)",
              maxWidth: base * 1.5,
              padding: `${Math.max(4, Math.round(style.promptPadding * 0.55))}px ${style.promptPadding}px`,
              borderRadius: style.promptRadius,
              border: `1px solid ${colorToRgba(style.promptColor, 0.16)}`,
              background: style.promptBgColor,
              color: style.promptColor,
              fontSize: style.promptFontSize,
              fontWeight: weightValue(style.promptWeight),
              letterSpacing: style.promptLetterSpacing,
              lineHeight: 1.3,
              textAlign: "center",
              whiteSpace: "nowrap",
              textShadow: "0 2px 8px rgba(0,0,0,.45)",
              outline: highlightLayer === "prompt" ? HIGHLIGHT : undefined,
              outlineOffset: 3,
            }}
          >
            {model.prompt}
          </div>
        )}

        {(style.progressMode !== "none" || model.mode === "mash") && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: `calc(50% + ${base / 2 + style.progressOffset}px)`,
              transform: "translate(-50%, -50%)",
              color: style.progressColor,
              fontSize: style.progressFontSize,
              fontWeight: 650,
              letterSpacing: ".14em",
              fontVariantNumeric: "tabular-nums",
              textShadow: "0 2px 8px rgba(0,0,0,.55)",
              outline: highlightLayer === "progress" ? HIGHLIGHT : undefined,
              outlineOffset: 4,
            }}
          >
            {progressText}
          </div>
        )}

        {model.showPerfectFlash && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: style.flashSize,
              height: style.flashSize,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${colorToRgba(style.flashColor, style.flashIntensity / 100)} 0%, ${colorToRgba(style.flashColor, style.flashIntensity / 250)} 38%, transparent 72%)`,
              filter: `blur(${Math.max(0, (100 - style.flashIntensity) / 18)}px)`,
              animation: `qte-perfect-flash ${style.flashDuration}ms ease-out forwards`,
              outline: highlightLayer === "flash" ? HIGHLIGHT : undefined,
              outlineOffset: 5,
            }}
          />
        )}
      </div>
    </div>
  );
};
