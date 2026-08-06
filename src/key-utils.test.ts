/**
 * 文件名：key-utils.test.ts
 * 作者：池水三两七
 * 日期：2026-08-06
 * 版本：1.0.0
 * 描述：key-utils 单元测试
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { displayKeyLabel, normalizeShortcut } from "./key-utils";

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
