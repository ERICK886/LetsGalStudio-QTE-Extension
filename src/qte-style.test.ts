/**
 * 文件名：qte-style.test.ts
 * 作者：池水三两升
 * 日期：2026-08-06
 * 版本：1.0.1
 * 描述：qte-style 键名前缀兼容与颜色解析单测
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pickSettingValue, resolveQteStyle } from "./qte-style";

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
});
