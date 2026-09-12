/**
 * 文件名：qte-style.test.ts
 * 作者：池水三两升
 * 日期：2026-08-06
 * 版本：1.0.1
 * 描述：qte-style 键名前缀兼容与颜色解析单测
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  QTE_STYLE_DEFAULTS,
  QTE_STYLE_FIELDS,
  QTE_STYLE_LIMITS,
  normalizeQteStyleField,
  pickSettingValue,
  resolveQteStyle,
} from "./qte-style";
import { QTE_STYLE_PRESETS, matchesQtePreset } from "./qte-presets";

describe("pickSettingValue", () => {
  it("reads bare, prefixed and nested keys", () => {
    assert.equal(pickSettingValue({ buttonBgColor: "#111111" }, "buttonBgColor"), "#111111");
    assert.equal(
      pickSettingValue({ "qte.buttonBgColor": "#222222" }, "buttonBgColor"),
      "#222222",
    );
    assert.equal(
      pickSettingValue({ qte: { buttonBgColor: "#333333" } }, "buttonBgColor"),
      "#333333",
    );
  });
});

describe("resolveQteStyle", () => {
  it("applies prefixed snapshot values to button styles", () => {
    const style = resolveQteStyle({
      "qte.buttonBgColor": "#FF0000",
      "qte.buttonTextColor": "#00FF00",
      "qte.buttonSize": 120,
    });
    assert.equal(style.buttonBgColor, "#FF0000");
    assert.equal(style.buttonTextColor, "#00FF00");
    assert.equal(style.buttonSize, 120);
  });

  it("fills every advanced field for old eight-field snapshots", () => {
    const style = resolveQteStyle({ ringDiameter: 280 });
    assert.equal(Object.keys(style).length, QTE_STYLE_FIELDS.length);
    assert.equal(style.ringDiameter, 280);
    assert.equal(style.ringPattern, QTE_STYLE_DEFAULTS.ringPattern);
    assert.equal(style.flashDuration, QTE_STYLE_DEFAULTS.flashDuration);
  });
});

describe("normalizeQteStyleField", () => {
  it("clamps ring diameter", () => {
    assert.equal(normalizeQteStyleField("ringDiameter", 10), QTE_STYLE_LIMITS.ringDiameter.min);
    assert.equal(normalizeQteStyleField("ringDiameter", 999), QTE_STYLE_LIMITS.ringDiameter.max);
  });

  it("falls back invalid color", () => {
    assert.equal(
      normalizeQteStyleField("outerRingColor", ""),
      QTE_STYLE_DEFAULTS.outerRingColor,
    );
  });

  it("rejects invalid enums and clamps motion fields", () => {
    assert.equal(
      normalizeQteStyleField("ringShape", "triangle"),
      QTE_STYLE_DEFAULTS.ringShape,
    );
    assert.equal(
      normalizeQteStyleField("sparkCount", 99),
      QTE_STYLE_LIMITS.sparkCount.max,
    );
  });
});

describe("QTE_STYLE_PRESETS", () => {
  it("provides complete, distinct built-in skins", () => {
    assert.ok(QTE_STYLE_PRESETS.length >= 8);
    for (const preset of QTE_STYLE_PRESETS) {
      assert.equal(Object.keys(preset.style).length, QTE_STYLE_FIELDS.length);
      assert.equal(matchesQtePreset(preset.style, preset), true);
    }
    assert.notEqual(
      QTE_STYLE_PRESETS[0]!.style.outerRingColor,
      QTE_STYLE_PRESETS[2]!.style.outerRingColor,
    );
  });
});
