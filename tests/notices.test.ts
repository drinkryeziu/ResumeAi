import { describe, expect, it } from "vitest";
import { NOTICES, notice, noticeMessage, withoutNotice, type NoticeKey } from "@/lib/notices";

describe("confirmation notices", () => {
  it("knows every message it can show, and only those", () => {
    for (const [key, text] of Object.entries(NOTICES)) expect(noticeMessage(key)).toBe(text);
    expect(noticeMessage("something-else")).toBeNull();
    expect(noticeMessage("")).toBeNull();
    expect(noticeMessage(null)).toBeNull();
    expect(noticeMessage(undefined)).toBeNull();
  });

  it("accepts a key with its random tag, and makes a different tag each time", () => {
    const keys = Object.keys(NOTICES) as NoticeKey[];
    for (const key of keys) {
      const value = notice(key);
      expect(value).toMatch(new RegExp(`^${key}\\.[a-z0-9]+$`));
      expect(noticeMessage(value)).toBe(NOTICES[key]);
    }
    expect(new Set(Array.from({ length: 20 }, () => notice("version-saved"))).size).toBeGreaterThan(15);
    expect(noticeMessage("version-saved.")).toBe(NOTICES["version-saved"]);
    expect(noticeMessage(".abc")).toBeNull();
  });

  it("can't be made to show arbitrary text, or object internals, from a link", () => {
    expect(noticeMessage("Your account was hacked, call this number")).toBeNull();
    for (const key of ["__proto__", "constructor", "toString", "hasOwnProperty"]) expect(noticeMessage(key)).toBeNull();
  });

  it("writes plain sentences", () => {
    for (const text of Object.values(NOTICES)) {
      expect(text).toMatch(/^[A-Z]/);
      expect(text).toMatch(/[.]$/);
      expect(text.length).toBeLessThan(80);
    }
  });

  it("takes the notice out of the address and keeps everything else", () => {
    expect(withoutNotice("/jobs/job_1", "doc=resume&notice=version-saved.k3j2a")).toBe("/jobs/job_1?doc=resume");
    expect(withoutNotice("/jobs/job_1", "notice=job-analyzed")).toBe("/jobs/job_1");
    expect(withoutNotice("/jobs/job_1", "new=1&notice=application-created&doc=cover-letter")).toBe("/jobs/job_1?new=1&doc=cover-letter");
    expect(withoutNotice("/jobs/job_1", "doc=resume&notice=ats-checked", "#ats")).toBe("/jobs/job_1?doc=resume#ats");
    expect(withoutNotice("/dashboard", "")).toBe("/dashboard");
  });
});
