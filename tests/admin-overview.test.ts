import { describe, expect, it } from "vitest";
import { aiHealth, buildUserRows, threatLevel, totalsOf, type AdminSnapshot } from "@/server/admin/overview";


const now = new Date("2026-10-23T12:00:00Z");
const d = (s: string) => new Date(s);
const snapshot: AdminSnapshot = {
  users: [
    { id: "u1", name: "Ana Active", email: "ana@example.com", createdAt: d("2026-09-01") },
    { id: "u2", name: "Ben Old", email: "ben@example.com", createdAt: d("2026-01-01") },
    { id: "u3", name: "Cy New", email: "cy@example.com", createdAt: d("2026-10-22") },
  ],
  profileUserIds: ["u1", "u2"],
  jobs: [
    { id: "j1", userId: "u1", appliedAt: d("2026-10-20"), updatedAt: d("2026-10-20") },
    { id: "j2", userId: "u1", appliedAt: null, updatedAt: d("2026-10-21") },
    { id: "j3", userId: "u1", appliedAt: null, updatedAt: d("2026-10-22") }, // analyzed only: no tailored document, so not an application
    { id: "j4", userId: "u2", appliedAt: d("2026-02-01"), updatedAt: d("2026-02-01") },
  ],
  documents: [
    { userId: "u1", jobId: "j1", updatedAt: d("2026-10-20") },
    { userId: "u1", jobId: "j1", updatedAt: d("2026-10-21") }, // resume and letter of one job count once
    { userId: "u1", jobId: "j2", updatedAt: d("2026-10-22") },
    { userId: "u2", jobId: "j4", updatedAt: d("2026-02-01") },
  ],
  matches: [
    { userId: "u1", jobId: "j1", overallScore: 60, createdAt: d("2026-10-19") },
    { userId: "u1", jobId: "j1", overallScore: 80, createdAt: d("2026-10-20") }, // the later score is the one that counts
    { userId: "u1", jobId: "j2", overallScore: 70, createdAt: d("2026-10-21") },
    { userId: "u1", jobId: "j3", overallScore: 10, createdAt: d("2026-10-22") }, // not an application: left out of the average
  ],
};

describe("admin overview", () => {
  const rows = buildUserRows(snapshot, now);
  const by = (id: string) => rows.find((r) => r.id === id)!;

  it("counts applications (jobs with a tailored document), applied ones and the average Job Match Score", () => {
    expect(by("u1")).toMatchObject({ applications: 2, applied: 1, averageScore: 75, hasProfile: true });
    expect(by("u2")).toMatchObject({ applications: 1, applied: 1, averageScore: null }); // no score saved
    expect(by("u3")).toMatchObject({ applications: 0, applied: 0, averageScore: null, hasProfile: false });
  });

  it("marks people active when they did anything in the last 30 days, and lists the latest activity first", () => {
    expect(by("u1").active).toBe(true);
    expect(by("u3").active).toBe(true); // just signed up
    expect(by("u2").active).toBe(false);
    expect(rows.map((r) => r.id)).toEqual(["u1", "u3", "u2"]);
    expect(+by("u1").lastActiveAt).toBe(+d("2026-10-22"));
  });

  it("adds the totals, with the average weighted by applications", () => {
    expect(totalsOf(rows)).toEqual({ users: 3, active: 2, applications: 3, applied: 2, averageScore: 75 });
    expect(totalsOf([]).averageScore).toBeNull();
  });

  it("reads the day's security events as normal, elevated or high", () => {
    expect(threatLevel({ sign_in_failed: 3, rate_limited: 0 })).toBe("normal");
    expect(threatLevel({ sign_in_failed: 15, rate_limited: 0 })).toBe("elevated");
    expect(threatLevel({ sign_in_failed: 0, rate_limited: 5 })).toBe("elevated");
    expect(threatLevel({ sign_in_failed: 50, rate_limited: 0 })).toBe("high");
    expect(threatLevel({ sign_in_failed: 0, rate_limited: 20 })).toBe("high");
  });

  it("reads AI health from the share of runs that failed", () => {
    expect(aiHealth({ total: 0, failed: 0 })).toBe("idle");
    expect(aiHealth({ total: 10, failed: 2 })).toBe("healthy");
    expect(aiHealth({ total: 10, failed: 3 })).toBe("degraded");
  });
});
