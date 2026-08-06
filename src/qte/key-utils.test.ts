/**
 * 文件名：key-utils.test.ts
 * 作者：池水三两升
 * 日期：2026-08-06
 * 版本：1.1.0
 * 描述：key-utils 单元测试
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  displayKeyLabel,
  KEY_LETTER_PRESET_OPTIONS,
  normalizeShortcut,
  resolveQteKeyParam,
} from "./key-utils";

describe("normalizeShortcut", () => {
  it("trims and maps aliases", () => {
    assert.equal(normalizeShortcut(" f "), "KeyF");
    assert.equal(normalizeShortcut("space"), "Space");
    assert.equal(normalizeShortcut("KeyA"), "KeyA");
  });
});

describe("displayKeyLabel", () => {
  it("shows friendly labels", () => {
    assert.equal(displayKeyLabel("KeyF"), "F");
    assert.equal(displayKeyLabel("Space"), "空格");
  });
});

describe("KEY_LETTER_PRESET_OPTIONS", () => {
  it("covers A–Z as KeyA–KeyZ", () => {
    assert.equal(KEY_LETTER_PRESET_OPTIONS.length, 26);
    assert.deepEqual(KEY_LETTER_PRESET_OPTIONS[0], {
      label: "A",
      value: "KeyA",
    });
    assert.deepEqual(KEY_LETTER_PRESET_OPTIONS[25], {
      label: "Z",
      value: "KeyZ",
    });
  });
});

describe("resolveQteKeyParam", () => {
  it("prefers custom key code over preset", () => {
    assert.equal(resolveQteKeyParam("KeyF", "Space"), "Space");
    assert.equal(resolveQteKeyParam("KeyF", " Digit1 "), "Digit1");
  });

  it("falls back to preset when custom is empty", () => {
    assert.equal(resolveQteKeyParam("KeyA", ""), "KeyA");
    assert.equal(resolveQteKeyParam("KeyA", "   "), "KeyA");
    assert.equal(resolveQteKeyParam("KeyB", undefined), "KeyB");
  });

  it("defaults to KeyF when both missing", () => {
    assert.equal(resolveQteKeyParam(undefined, undefined), "KeyF");
  });
});
