/**
 * 文件名：demo-snapshot.test.ts
 * 作者：池水三两升
 * 日期：2026-08-06
 * 版本：1.0.0
 * 描述：编辑器演示快照纯函数测试
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createDemoVisualModel,
  fieldsForLayer,
  tickDemoRemaining,
} from "./demo-snapshot";

describe("tickDemoRemaining", () => {
  it("decrements and loops", () => {
    assert.equal(tickDemoRemaining(0.05, 0.1, 5), 5);
    assert.ok(tickDemoRemaining(5, 0.1, 5) < 5);
  });
});

describe("fieldsForLayer", () => {
  it("maps layers", () => {
    assert.deepEqual(fieldsForLayer(null), [
      "ringDiameter",
      "ringStroke",
      "buttonSize",
    ]);
    assert.deepEqual(fieldsForLayer("perfect"), ["perfectColor"]);
    assert.deepEqual(fieldsForLayer("prompt"), []);
  });
});

describe("createDemoVisualModel", () => {
  it("centers at 50/50", () => {
    const m = createDemoVisualModel();
    assert.equal(m.posX, 50);
    assert.equal(m.posY, 50);
  });
});
