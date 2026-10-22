import { Activity, Briefcase, CheckCircle2, Database, Server, ShieldAlert, ShieldCheck, Sparkles, Users } from "lucide-react";
import { AddViewerForm } from "@/components/features/admin/AddViewerForm";
import { LocalTime } from "@/components/features/admin/LocalTime";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, SoftPanel } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { formatDate, formatNumber } from "@/lib/format";
import { ACTIVE_DAYS, aiHealth, buildUserRows, RULE_LABELS, threatLevel, totalsOf, type Level } from "@/server/admin/overview";
import type { PersonRow } from "@/server/admin/people-table";
import { ErrorLogs } from "@/components/features/admin/ErrorLogs";
import { PeopleTable } from "@/components/features/admin/PeopleTable";
import { ownerEmail } from "@/server/admin/access";
import { requireAdmin } from "@/server/auth/admin";
import { setupStatus } from "@/server/store/setup-check";
import { removeViewer } from "./actions";

export const metadata = { title: "Admin dashboard", robots: { index: false, follow: false } };

const DAY = 86_400_000;
const ERROR_DAYS = 30;
const LEVEL_TEXT: Record<Level, string> = { normal: "Normal", elevated: "Elevated", high: "High" };
const LEVEL_TONE = { normal: "ok", elevated: "warn", high: "bad" } as const;
const EVENT_TEXT = { sign_in_failed: "Wrong password at sign-in", rate_limited: "Request turned away, too many tries", account_removed: "Account deleted by the owner" } as const;

const count = (n: number, noun: string) => `${formatNumber(n)} ${noun}${n === 1 ? "" : "s"}`;
const score = (n: number | null) => (n === null ? "—" : `${n}%`);

/** The operator's page: how the site is doing, who uses it, anything unusual. Opened by the owner and by people the owner added. */
export default async function AdminPage() {
  const { role, store } = await requireAdmin();
  const now = new Date();
  const since = new Date(+now - DAY);
  const started = Date.now();
  const [setup, snapshot, aiStats, security, errorLog, viewers] = await Promise.all([
    setupStatus(),
    store.adminSnapshot(),
    store.aiRunStats(since),
    store.securitySummary(since, 10),
    store.errorSummary(new Date(+now - ERROR_DAYS * DAY), 200),
    role === "owner" ? store.listAdmins() : Promise.resolve([]),
  ]);
  const checkedMs = Date.now() - started;
  const rows = buildUserRows(snapshot, now);
  const totals = totalsOf(rows);
  // Dates travel to the browser as text.
  const people: PersonRow[] = rows.map((r) => ({ id: r.id, name: r.name, email: r.email, hasProfile: r.hasProfile, applications: r.applications, applied: r.applied, averageScore: r.averageScore, lastActiveAt: r.lastActiveAt.toISOString(), active: r.active }));
  const level = threatLevel(security.counts);
  const ai = aiHealth(aiStats);
  const siteOk = setup.ready;
  const dbText = setup.database === "ok" ? "Connected" : setup.database === "failed" ? "Unreachable" : "In memory";

  return (
    <>
      <PageHeader
        title="Admin dashboard"
        description="How the site is doing, who is using it, and anything unusual. The numbers are read each time you open this page."
        actions={<Badge tone="info">{role === "owner" ? "Owner" : "Viewer"}</Badge>}
      />

      <div className="flex flex-col gap-ds-5">
        <section aria-labelledby="health-h" className="flex flex-col gap-ds-3">
          <h2 id="health-h" className="text-heading-section">
            System health
          </h2>
          <div className="grid gap-ds-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Site"
              value={siteOk ? "Healthy" : "Needs attention"}
              tone={siteOk ? "ok" : "bad"}
              icon={<Server size={22} />}
              hint={`${setup.onVercel ? "Vercel" : "Local"}${setup.version ? ` · version ${setup.version}` : ""}`}
            />
            <StatCard
              label="Database"
              value={dbText}
              tone={setup.database === "ok" ? "ok" : setup.database === "failed" ? "bad" : "warn"}
              icon={<Database size={22} />}
              hint={setup.database === "ok" ? `Answered within ${formatNumber(checkedMs)} ms` : setup.database === "failed" ? "Could not be reached" : "Data is lost on restart"}
            />
            <StatCard
              label="AI writing (last 24 hours)"
              value={!setup.ai ? "Not set up" : ai === "degraded" ? "Degraded" : ai === "idle" ? "Ready" : "Healthy"}
              tone={!setup.ai || ai === "degraded" ? "bad" : "ok"}
              icon={<Sparkles size={22} />}
              hint={aiStats.total === 0 ? "No runs yet today" : `${count(aiStats.total, "run")}, ${formatNumber(aiStats.failed)} failed or turned down`}
            />
            <StatCard
              label="Security (last 24 hours)"
              value={LEVEL_TEXT[level]}
              tone={LEVEL_TONE[level]}
              icon={level === "normal" ? <ShieldCheck size={22} /> : <ShieldAlert size={22} />}
              hint={`${count(security.counts.sign_in_failed, "wrong password")}, ${count(security.counts.rate_limited, "request")} turned away`}
            />
          </div>
          {setup.problems.length > 0 && (
            <SoftPanel>
              <p className="text-label-bold">To fix</p>
              <ul className="mt-ds-1 list-disc pl-5 text-body-sm">
                {setup.problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </SoftPanel>
          )}
        </section>

        <section aria-labelledby="usage-h" className="flex flex-col gap-ds-3">
          <h2 id="usage-h" className="text-heading-section">
            Usage
          </h2>
          <div className="grid gap-ds-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="People" value={formatNumber(totals.users)} icon={<Users size={22} />} hint={`${formatNumber(totals.active)} active in the last ${ACTIVE_DAYS} days`} />
            <StatCard label="Applications created" value={formatNumber(totals.applications)} icon={<Briefcase size={22} />} hint="Jobs with a tailored resume or cover letter" />
            <StatCard label="Applied" value={formatNumber(totals.applied)} icon={<CheckCircle2 size={22} />} hint="Applications people ticked as applied" />
            <StatCard label="Average Job Match Score" value={score(totals.averageScore)} icon={<Activity size={22} />} hint="Across all applications" />
          </div>
        </section>

        <Card aria-labelledby="events-h">
          <CardHeader title={<span id="events-h">Security events</span>} subtitle="Wrong passwords and requests turned away because of too many tries. No names, emails or addresses are kept." />
          {security.recent.length === 0 ? (
            <p className="text-body-sm">Nothing unusual in the last 24 hours.</p>
          ) : (
            <ul className="flex flex-col gap-ds-2">
              {security.recent.map((e, i) => (
                <li key={`${e.type}-${+new Date(e.at)}-${i}`} className="flex flex-wrap items-center justify-between gap-x-ds-4 gap-y-1 rounded-md bg-gray-100 px-ds-3 py-ds-2 text-body-sm">
                  <span>
                    {EVENT_TEXT[e.type]}
                    {e.rule && <span className="text-caption"> · {RULE_LABELS[e.rule] ?? e.rule}</span>}
                  </span>
                  <span className="text-caption">
                    <LocalTime iso={new Date(e.at).toISOString()} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card aria-labelledby="people-h">
          <CardHeader
            title={<span id="people-h">People using ResumeAi</span>}
            subtitle={`Most recently active first; press a column heading to sort. Active means any activity in the last ${ACTIVE_DAYS} days. Application counts only include jobs with a tailored resume or cover letter.`}
          />
          {rows.length === 0 ? (
            <p className="text-body-sm">Nobody has signed up yet.</p>
          ) : (
            <PeopleTable rows={people} canRemove={role === "owner"} ownerEmail={ownerEmail()} />
          )}
        </Card>

        {role === "owner" && (
          <Card aria-labelledby="access-h">
            <CardHeader
              title={<span id="access-h">Who can open this dashboard</span>}
              subtitle="You always can. Viewers can read this page and nothing else: they cannot add people or change anything. They need an account first."
            />
            <div className="flex flex-col gap-ds-4">
              {viewers.length === 0 ? (
                <p className="text-body-sm">Nobody else has access yet.</p>
              ) : (
                <ul className="flex flex-col gap-ds-2">
                  {viewers.map((v) => (
                    <li key={v.userId} className="flex flex-wrap items-center justify-between gap-ds-3 rounded-md bg-gray-100 px-ds-3 py-ds-2">
                      <span className="min-w-0">
                        <span className="text-label-bold">{v.name}</span>
                        <span className="text-caption block truncate">
                          {v.email} · added {formatDate(v.addedAt)}
                        </span>
                      </span>
                      <form action={removeViewer}>
                        <input type="hidden" name="userId" value={v.userId} />
                        <button type="submit" aria-label={`Remove ${v.name}`} className="text-body-sm text-danger underline">
                          Remove
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
              <AddViewerForm />
            </div>
          </Card>
        )}

        <ErrorLogs
          total={errorLog.total}
          entries={errorLog.entries}
          who={new Map(snapshot.users.map((u) => [u.id, { name: u.name, email: u.email }]))}
          canClear={role === "owner"}
          days={ERROR_DAYS}
        />
      </div>
    </>
  );
}
