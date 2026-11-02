import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ownerInactivityState } from "./components/OwnerInactivityGuard";

describe("workspace owner inactivity state", () => {
  const idle = 5 * 60_000;

  it("remains active before five minutes", () => {
    assert.deepEqual(ownerInactivityState(0, idle - 1, idle, 30), { phase: "active", seconds: 30 });
  });

  it("shows a thirty-second warning after five minutes", () => {
    assert.deepEqual(ownerInactivityState(0, idle, idle, 30), { phase: "warning", seconds: 30 });
    assert.deepEqual(ownerInactivityState(0, idle + 21_000, idle, 30), { phase: "warning", seconds: 9 });
  });

  it("expires after the warning period", () => {
    assert.deepEqual(ownerInactivityState(0, idle + 30_000, idle, 30), { phase: "expired", seconds: 0 });
  });
});
