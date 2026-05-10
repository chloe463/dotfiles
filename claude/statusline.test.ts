import { expect, describe, it } from "bun:test";
import { isRateLimit, isStatuslineInput, formatResetTime } from "./statusline";

describe("isRateLimit", () => {
  it("returns true for valid RateLimit", () => {
    expect(isRateLimit({ used_percentage: 50, resets_at: 1700000000 })).toBe(true);
  });
  it("returns false for null", () => {
    expect(isRateLimit(null)).toBe(false);
  });
  it("returns false for non-object", () => {
    expect(isRateLimit("string")).toBe(false);
    expect(isRateLimit(42)).toBe(false);
  });
  it("returns false when used_percentage is missing", () => {
    expect(isRateLimit({ resets_at: 1700000000 })).toBe(false);
  });
  it("returns false when resets_at is NaN", () => {
    expect(isRateLimit({ used_percentage: 50, resets_at: NaN })).toBe(false);
  });
  it("returns false when resets_at is Infinity", () => {
    expect(isRateLimit({ used_percentage: 50, resets_at: Infinity })).toBe(false);
  });
});

describe("isStatuslineInput", () => {
  it("returns true for minimal valid input", () => {
    expect(
      isStatuslineInput({
        model: { display_name: "Claude Sonnet 4.6" },
        workspace: { current_dir: "/home/user/project" },
      }),
    ).toBe(true);
  });
  it("returns true with optional fields present", () => {
    expect(
      isStatuslineInput({
        model: { id: "claude-sonnet-4-6", display_name: "Claude Sonnet 4.6" },
        workspace: { current_dir: "/home/user/project" },
        rate_limits: {
          five_hour: { used_percentage: 30, resets_at: 1700000000 },
          seven_day: { used_percentage: 60, resets_at: 1700000000 },
        },
      }),
    ).toBe(true);
  });
  it("returns false for null", () => {
    expect(isStatuslineInput(null)).toBe(false);
  });
  it("returns false when model.display_name is missing", () => {
    expect(
      isStatuslineInput({ model: {}, workspace: { current_dir: "/home" } }),
    ).toBe(false);
  });
  it("returns false when workspace.current_dir is missing", () => {
    expect(
      isStatuslineInput({ model: { display_name: "Claude" }, workspace: {} }),
    ).toBe(false);
  });
  it("returns false when five_hour has invalid resets_at", () => {
    expect(
      isStatuslineInput({
        model: { display_name: "Claude" },
        workspace: { current_dir: "/home" },
        rate_limits: { five_hour: { used_percentage: 50, resets_at: NaN } },
      }),
    ).toBe(false);
  });
  it("returns false when seven_day has invalid resets_at", () => {
    expect(
      isStatuslineInput({
        model: { display_name: "Claude" },
        workspace: { current_dir: "/home" },
        rate_limits: { seven_day: { used_percentage: 80, resets_at: Infinity } },
      }),
    ).toBe(false);
  });
});

describe("formatResetTime", () => {
  it("returns ??:?? for 0", () => {
    expect(formatResetTime(0)).toBe("??:??");
  });
  it("returns ??:?? for negative values", () => {
    expect(formatResetTime(-1)).toBe("??:??");
  });
  it("returns ??:?? for NaN", () => {
    expect(formatResetTime(NaN)).toBe("??:??");
  });
  it("returns ??:?? for Infinity", () => {
    expect(formatResetTime(Infinity)).toBe("??:??");
  });
  it("returns HH:MM format for a valid timestamp", () => {
    const result = formatResetTime(1700000000);
    expect(result).toMatch(/^\d{2}:\d{2}$/);
  });
});
