import { describe, expect, it } from "vitest";
import { isAppAdminEmail } from "./app-admins";

describe("isAppAdminEmail", () => {
  it("accepts the configured admin emails case-insensitively", () => {
    expect(isAppAdminEmail("fanharrison4@gmail.com")).toBe(true);
    expect(isAppAdminEmail("FanHaiPeng@gmail.com")).toBe(true);
  });

  it("rejects unknown or empty emails", () => {
    expect(isAppAdminEmail("someone@example.com")).toBe(false);
    expect(isAppAdminEmail(undefined)).toBe(false);
    expect(isAppAdminEmail(null)).toBe(false);
  });
});
