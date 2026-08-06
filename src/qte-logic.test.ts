/**
 * 文件名：qte-logic.test.ts
 * 作者：池水三两七
 * 日期：2026-08-06
 * 版本：1.0.0
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  judgeMash,
  judgeSingle,
  normalizeQteConfig,
  outcomeFromSkip,
} from "./qte-logic";

describe("normalizeQteConfig", () => {
  it("clamps perfect window and disables when start>=end", () => {
    const cfg = normalizeQteConfig({
      mode: "single",
      key: "KeyF",
      timeoutSec: 5,
      perfectStartSec: -1,
      perfectEndSec: 9,
      mashCount: 0,
      failOnWrongKey: false,
      skipCountsAsPass: true,
    });
    assert.equal(cfg.timeoutSec, 5);
    assert.equal(cfg.perfectStartSec, 0);
    assert.equal(cfg.perfectEndSec, 5);
    assert.equal(cfg.perfectEnabled, true);
    assert.equal(cfg.mashCount, 1);

    const bad = normalizeQteConfig({
      mode: "single",
      key: "KeyF",
      timeoutSec: 5,
      perfectStartSec: 3,
      perfectEndSec: 3,
      mashCount: 10,
      failOnWrongKey: false,
      skipCountsAsPass: true,
    });
    assert.equal(bad.perfectEnabled, false);
  });
});

describe("judgeSingle", () => {
  it("returns perfect / normal by window", () => {
    const cfg = normalizeQteConfig({
      mode: "single",
      key: "KeyF",
      timeoutSec: 5,
      perfectStartSec: 1,
      perfectEndSec: 2,
      mashCount: 1,
      failOnWrongKey: false,
      skipCountsAsPass: true,
    });
    assert.equal(judgeSingle(1.5, cfg), "perfect");
    assert.equal(judgeSingle(3, cfg), "normal");
  });
});

describe("judgeMash", () => {
  it("perfect when filled before perfectEnd", () => {
    const cfg = normalizeQteConfig({
      mode: "mash",
      key: "KeyF",
      timeoutSec: 5,
      perfectStartSec: 0,
      perfectEndSec: 2,
      mashCount: 3,
      failOnWrongKey: false,
      skipCountsAsPass: true,
    });
    assert.equal(judgeMash(1.5, 2, cfg), null);
    assert.equal(judgeMash(1.5, 3, cfg), "perfect");
    assert.equal(judgeMash(3, 3, cfg), "normal");
  });
});

describe("outcomeFromSkip", () => {
  it("defaults to normal when pass", () => {
    assert.equal(outcomeFromSkip(true), "normal");
    assert.equal(outcomeFromSkip(false), "defeat");
  });
});
