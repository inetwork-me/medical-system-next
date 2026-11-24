"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { DEFAULT_FILTERS, previousOf } from "@/modules/reports/data"
import { MEASURES, toneOf, type MeasureId } from "@/modules/reports/measures"
import { ChangeBadge, Latin, useB, useNumbers, usePeriodText } from "@/modules/reports/parts"
import { FiltersBar, FiltersDialog } from "@/modules/reports/filters"
import { AreaCards, ComingUp, Favourites, OverviewKpis } from "@/modules/reports/overview"
import { ClinicalDashboard, DoctorsDashboard, FinanceDashboard, OperationsDashboard } from "@/modules/reports/dashboards"
import { ExportDialog, useDashboardExport } from "@/modules/reports/export-dialog"
import { ScheduleDialog } from "@/modules/reports/schedule-dialog"
import { REP_ROLES, repCan, repTabs, type RepAction } from "@/modules/reports/roles"
import { allowedBranches, enforceBranchAccess } from "@/modules/reports/server"
import { sessionEmail, setRepRole, useRepRole } from "@/modules/reports/store"
import { LIBRARY, reportById } from "@/modules/reports/library"
import { LibraryList } from "@/modules/reports/library-list"
import { ReportSide, ReportViewer } from "@/modules/reports/report-page"
import { ShareDialog } from "@/modules/reports/share-dialog"
import { BuilderPreview, BuilderSteps } from "@/modules/reports/builder"
import { NEW_REPORT, previewRows, type BuilderCfg } from "@/modules/reports/builder-data"
import { SaveReportDialog } from "@/modules/reports/save-dialog"
import { SchedulesList } from "@/modules/reports/schedules"
import { SCHEDULES } from "@/modules/reports/schedules-data"
import { ReturnChecks, ReturnProgress, ReturnSections, ReturnSide, ReturnsList, type ReturnView } from "@/modules/reports/returns"
import { RETURNS } from "@/modules/reports/returns-data"
import { SubmitReturnDialog } from "@/modules/reports/submit-dialog"

function Box({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-3 rounded-xl border bg-card p-5", className)}>
      <h2 className="font-mono text-xs text-muted-foreground" dir="ltr">
        {title}
      </h2>
      {children}
    </section>
  )
}

const ACTIONS: RepAction[] = ["build", "schedule", "export", "share", "returns", "signOff"]

export function ReportsStories() {
  const b = useB()
  const n = useNumbers()
  const p = usePeriodText()
  const role = useRepRole()
  const [dlg, setDlg] = React.useState<"default" | "custom" | "error" | null>(null)
  const close = (o: boolean) => !o && setDlg(null)
  const email = sessionEmail()
  const narrowed = enforceBranchAccess(email, { ...DEFAULT_FILTERS, branch: "jeddah" })
  const all = enforceBranchAccess(email, { ...DEFAULT_FILTERS, branch: "all" })
  const prev = previousOf(DEFAULT_FILTERS)

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Box title="Measure definitions (one place · the About card prints the rule)" className="lg:col-span-2">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="py-1 text-start font-normal">measure</th>
                <th className="py-1 text-start font-normal">rule</th>
                <th className="py-1 text-start font-normal" dir="ltr">
                  unit · better · source
                </th>
                <th className="py-1 text-start font-normal" dir="ltr">
                  thresholds
                </th>
              </tr>
            </thead>
            <tbody>
              {Object.values(MEASURES).map((m) => (
                <tr key={m.id} className="border-t">
                  <td className="py-1.5">{b(m.name)}</td>
                  <td className="py-1.5 text-muted-foreground">
                    {b(m.ruleLabel)}: {b(m.rule)}
                  </td>
                  <td className="py-1.5 font-mono text-xs" dir="ltr">
                    {m.unit} · {m.better} · {m.source}
                  </td>
                  <td className="py-1.5 font-mono text-xs" dir="ltr">
                    {[m.goal !== undefined && `goal ${m.goal}`, m.amberOver !== undefined && `amber > ${m.amberOver}`, m.redOver !== undefined && `red > ${m.redOver}`, m.amberUnder !== undefined && `amber < ${m.amberUnder}`]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Box>

      <Box title="Widget / Rep Filters · Wide and Compact (every chip opens Filters)" className="lg:col-span-2">
        <FiltersBar scope="stories" />
        <div className="max-w-[358px]">
          <FiltersBar scope="stories" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setDlg("default")}>
            Filters · drawn (this month, compare)
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDlg("custom")}>
            Filters · custom range, Dental
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDlg("error")}>
            Filters · end before start
          </Button>
        </div>
      </Box>

      <Box title="Change badges (signed number, no unit word) · thresholds">
        <div className="flex flex-wrap items-center gap-2">
          <ChangeBadge measure="visits" now={8412} before={7936} />
          <ChangeBadge measure="newPatients" now={1106} before={1074} />
          <ChangeBadge measure="noShowRate" now={9.8} before={11} kind="points" />
          <ChangeBadge measure="noShowRate" now={13.6} before={10.1} kind="points" />
          <ChangeBadge measure="avgWait" now={18} before={16} />
          <ChangeBadge measure="visits" now={100} before={100} />
        </div>
        <div className="flex flex-col gap-1 font-mono text-xs" dir="ltr">
          {(
            [
              ["noShowRate", 13.6],
              ["noShowRate", 7.2],
              ["avgWait", 22],
              ["avgWait", 14],
              ["notesOnTime", 86],
              ["notesOnTime", 95],
            ] as [MeasureId, number][]
          ).map(([m, v]) => (
            <span key={`${m}${v}`}>
              {m} {v} → {toneOf(m, v) ?? "normal"}
            </span>
          ))}
        </div>
      </Box>

      <Box title="Numbers · money · period text">
        <div className="flex flex-col gap-1 text-sm">
          <span>
            <Latin>{n.count(8412)}</Latin> · <Latin>{n.percent(9.8)}</Latin>
          </span>
          <span>
            {n.money(2_840_000)} · {n.money(182_000)} · {n.money(940)}
          </span>
          <span>
            {p.range(DEFAULT_FILTERS)} · {p.compare(DEFAULT_FILTERS)} · {p.range({ from: "2026-10-28", to: "2026-11-03" })}
          </span>
          <span className="font-mono text-xs" dir="ltr">
            previous of 1–22 Nov (this month): {prev.from} → {prev.to} (whole month: {String(prev.wholeMonth)})
          </span>
        </div>
      </Box>

      <Box title="Branch access is enforced on the server (server.ts)">
        <div className="flex flex-col gap-1 font-mono text-xs" dir="ltr">
          <span>
            {email} may see: {allowedBranches(email).join(", ")}
          </span>
          <span>asked for jeddah → ran with {narrowed.filters.branch}</span>
          <span>asked for all → covered {all.branches.join(", ")}</span>
        </div>
      </Box>

      <Box title="Roles · switch the demo role">
        <div className="flex flex-wrap gap-2">
          {REP_ROLES.map((x) => (
            <Button key={x} size="sm" variant={x === role ? "default" : "outline"} onClick={() => setRepRole(x)}>
              {x}
            </Button>
          ))}
        </div>
        <table className="w-full text-sm" dir="ltr">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="py-1 text-start font-normal">role</th>
              <th className="py-1 text-start font-normal">tabs</th>
              {ACTIONS.map((a) => (
                <th key={a} className="px-1 py-1 font-normal">
                  {a}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {REP_ROLES.map((x) => (
              <tr key={x} className={cn("border-t", x === role && "bg-accent")}>
                <td className="py-1 font-mono text-xs">{x}</td>
                <td className="py-1 text-xs">{repTabs(x).join(", ")}</td>
                {ACTIONS.map((a) => (
                  <td key={a} className="px-1 py-1 text-center">
                    {repCan(x, a) ? "✓" : ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Box>

      <Box title="Overview · KPIs" className="lg:col-span-2">
        <OverviewKpis />
      </Box>
      <Box title="Widget / Rep Areas (wide + compact)" className="lg:col-span-2">
        <AreaCards />
        <div className="max-w-[358px]">
          <AreaCards />
        </div>
      </Box>
      <Box title="Widget / Rep Favourites">
        <Favourites />
      </Box>
      <Box title="Widget / Rep Deadlines (Coming up)">
        <ComingUp />
      </Box>
      <DashboardStories />
      <LibraryStories />
      <BuilderStories />
      <ScheduleStories />
      <ReturnStories />
      {dlg === "default" && <FiltersDialog scope="stories" onOpenChange={close} />}
      {dlg === "custom" && <FiltersDialog scope="stories" onOpenChange={close} initial={{ period: "custom", from: "2026-11-10", to: "2026-11-20", clinic: "dental" }} />}
      {dlg === "error" && <FiltersDialog scope="stories" onOpenChange={close} initial={{ period: "custom", from: "2026-11-20", to: "2026-11-10" }} />}
    </div>
  )
}

/* ------------------------------------------------------------------ step 3: dashboards */

type DashDlg = "export" | "exportCsv" | "exportNothing" | "schedule" | "scheduleEmpty" | null

function DashboardStories() {
  const [dlg, setDlg] = React.useState<DashDlg>(null)
  const close = (o: boolean) => !o && setDlg(null)
  const content = useDashboardExport("operations")
  const dash: [string, React.ReactNode][] = [
    ["Rep Ops Charts + Rep Ops Table", <OperationsDashboard key="o" scope="stories-ops" />],
    ["Rep Fin Charts + Rep Fin Table", <FinanceDashboard key="f" scope="stories-fin" />],
    ["Rep Clin Charts + Rep Clin Table", <ClinicalDashboard key="c" />],
    ["Rep Doc Charts + Rep Doc Table", <DoctorsDashboard key="d" scope="stories-doc" />],
  ]
  const buttons: [Exclude<DashDlg, null>, string][] = [
    ["export", "Export · drawn (PDF)"],
    ["exportCsv", "Export · CSV (table only)"],
    ["exportNothing", "Export · nothing ticked"],
    ["schedule", "Schedule · drawn (weekly, 3 people)"],
    ["scheduleEmpty", "Schedule · nobody left"],
  ]
  return (
    <>
      {dash.map(([title, node]) => (
        <React.Fragment key={title}>
          <Box title={`Widget / ${title} · Wide`} className="lg:col-span-2">
            <div className="flex flex-col gap-4">{node}</div>
          </Box>
        </React.Fragment>
      ))}
      <Box title="Widget / Rep Ops Charts + Table · Compact" className="lg:col-span-2">
        <div className="flex max-w-[358px] flex-col gap-4">
          <OperationsDashboard scope="stories-ops" />
        </div>
      </Box>
      <Box title="Dialogs · Export, Schedule" className="lg:col-span-2">
        <div className="flex flex-wrap gap-2">
          {buttons.map(([k, label]) => (
            <Button key={k} size="sm" variant="outline" onClick={() => setDlg(k)}>
              {label}
            </Button>
          ))}
        </div>
      </Box>
      {dlg === "export" && <ExportDialog content={content} onOpenChange={close} />}
      {dlg === "exportCsv" && <ExportDialog content={content} onOpenChange={close} initial={{ format: "csv" }} />}
      {dlg === "exportNothing" && <ExportDialog content={content} onOpenChange={close} initial={{ charts: false, tables: false }} />}
      {dlg === "schedule" && <ScheduleDialog target="no-shows-by-clinic" targetName={{ en: "No-shows by clinic", ar: "عدم الحضور حسب العيادة" }} onOpenChange={close} />}
      {dlg === "scheduleEmpty" && <ScheduleDialog target="no-shows-by-clinic" targetName={{ en: "No-shows by clinic", ar: "عدم الحضور حسب العيادة" }} onOpenChange={close} initial={{ recipients: [], tried: true }} />}
    </>
  )
}

function LibraryStories() {
  const noShows = reportById("no-shows-by-clinic")!
  const plain = LIBRARY.find((r) => r.shares.length === 0 && !r.schedule) ?? LIBRARY[LIBRARY.length - 1]
  const [dlg, setDlg] = React.useState<"drawn" | "owner" | null>(null)
  const close = (o: boolean) => !o && setDlg(null)
  return (
    <>
      <Box title="Widget / Rep Library · Wide" className="lg:col-span-2">
        <LibraryList />
      </Box>
      <Box title="Widget / Rep Library · Compact" className="lg:col-span-2">
        <div className="max-w-[358px]">
          <LibraryList />
        </div>
      </Box>
      <Box title="Widget / Rep Viewer · Wide (drill-down to appointments)" className="lg:col-span-2">
        <div className="flex max-w-[736px] flex-col gap-4">
          <ReportViewer report={noShows} />
        </div>
      </Box>
      <Box title="Widget / Rep Viewer · Compact" className="lg:col-span-2">
        <div className="flex max-w-[358px] flex-col gap-4">
          <ReportViewer report={noShows} />
        </div>
      </Box>
      <Box title="Widget / Rep Viewer · No drill-down (seeded report)" className="lg:col-span-2">
        <div className="flex max-w-[736px] flex-col gap-4">
          <ReportViewer report={plain} />
        </div>
      </Box>
      <Box title="Widget / Rep Viewer Side · Scheduled + shared">
        <div className="flex max-w-[360px] flex-col gap-4">
          <ReportSide report={noShows} onSchedule={() => {}} onShare={() => setDlg("drawn")} />
        </div>
      </Box>
      <Box title="Widget / Rep Viewer Side · Not sent, not shared">
        <div className="flex max-w-[360px] flex-col gap-4">
          <ReportSide report={plain} onSchedule={() => {}} onShare={() => setDlg("owner")} />
        </div>
      </Box>
      <Box title="Dialog · Share" className="lg:col-span-2">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setDlg("drawn")}>
            Share · drawn (roles + owner)
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDlg("owner")}>
            Share · owner only
          </Button>
        </div>
      </Box>
      {dlg === "drawn" && <ShareDialog report={noShows} onOpenChange={close} />}
      {dlg === "owner" && <ShareDialog report={plain} onOpenChange={close} />}
    </>
  )
}

function BuilderStories() {
  const email = sessionEmail()
  const [cfg, setCfg] = React.useState<BuilderCfg>(NEW_REPORT)
  const [dlg, setDlg] = React.useState<"new" | "error" | "own" | "copy" | null>(null)
  const close = (o: boolean) => !o && setDlg(null)
  const drawn = previewRows(NEW_REPORT, email)
  const live = previewRows(cfg, email)
  const line: BuilderCfg = { ...NEW_REPORT, chart: "line" }
  const table: BuilderCfg = { ...NEW_REPORT, source: "visits", measure: "avgWait", thenBy: "doctor", chart: "table" }
  const tableRows = previewRows(table, email)
  const empty: BuilderCfg = { ...NEW_REPORT, groupBy: "doctor", filters: { ...NEW_REPORT.filters, clinic: "eyes" } }
  const noShows = reportById("no-shows-by-clinic")!
  const mine = reportById("rep-1")!
  return (
    <>
      <Box title="Widget / Rep Builder Steps · Wide (live: changes update the preview beside it)" className="lg:col-span-2">
        <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
          <BuilderSteps cfg={cfg} onChange={setCfg} onFilters={() => {}} onRemoveFilter={(k) => setCfg((c) => (k === "date" ? { ...c, dated: false } : k === "status" ? { ...c, status: false } : { ...c, filters: { ...c.filters, [k]: "all" } }))} />
          <BuilderPreview cfg={cfg} rows={live.rows} table={live.table} dirty />
        </div>
      </Box>
      <Box title="Widget / Rep Builder Steps · Compact · no filters">
        <div className="max-w-[358px]">
          <BuilderSteps cfg={{ ...NEW_REPORT, dated: false, status: false, filters: { ...NEW_REPORT.filters, branch: "all" } }} onChange={() => {}} onFilters={() => {}} onRemoveFilter={() => {}} />
        </div>
      </Box>
      <Box title="Widget / Rep Builder Preview · Compact (drawn)">
        <div className="max-w-[358px]">
          <BuilderPreview cfg={NEW_REPORT} rows={drawn.rows} table={drawn.table} dirty />
        </div>
      </Box>
      <Box title="Widget / Rep Builder Preview · Wide · Line">
        <BuilderPreview cfg={line} rows={drawn.rows} table={drawn.table} dirty />
      </Box>
      <Box title="Widget / Rep Builder Preview · Wide · Table only + Then by">
        <BuilderPreview cfg={table} rows={tableRows.rows} table={tableRows.table} dirty />
      </Box>
      <Box title="Widget / Rep Builder Preview · Saved (no chip) · running">
        <BuilderPreview cfg={NEW_REPORT} rows={drawn.rows} table={drawn.table} name="No-shows by clinic" dirty={false} busy />
      </Box>
      <Box title="Widget / Rep Builder Preview · Nothing matches">
        <BuilderPreview cfg={empty} rows={[]} table={[]} dirty />
      </Box>
      <Box title="Dialog · Save report" className="lg:col-span-2">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setDlg("new")}>
            Save · new (drawn)
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDlg("error")}>
            Save · no name
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDlg("copy")}>
            Save · someone else&apos;s (copy)
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDlg("own")}>
            Save · editing your own (rep-1)
          </Button>
        </div>
      </Box>
      {dlg === "new" && <SaveReportDialog cfg={NEW_REPORT} rows={drawn.rows} suggested="No-show rate by clinic" onOpenChange={close} />}
      {dlg === "error" && <SaveReportDialog cfg={NEW_REPORT} rows={drawn.rows} suggested="" initial={{ name: "", tried: true }} onOpenChange={close} />}
      {dlg === "copy" && <SaveReportDialog cfg={NEW_REPORT} rows={drawn.rows} editing={noShows} suggested="" onOpenChange={close} />}
      {dlg === "own" && <SaveReportDialog cfg={NEW_REPORT} rows={drawn.rows} editing={mine} suggested="" onOpenChange={close} />}
    </>
  )
}

function ScheduleStories() {
  const [dlg, setDlg] = React.useState<"fix" | "paused" | "new" | "newError" | null>(null)
  const close = (o: boolean) => !o && setDlg(null)
  const failed = SCHEDULES.find((x) => x.status === "failed")!
  const paused = SCHEDULES.find((x) => x.status === "paused")!
  return (
    <>
      <Box title="Widget / Rep Schedules · Wide (Send now · Fix · Edit live)" className="lg:col-span-2">
        <SchedulesList />
      </Box>
      <Box title="Widget / Rep Schedules · Compact" className="lg:col-span-2">
        <div className="max-w-[358px]">
          <SchedulesList />
        </div>
      </Box>
      <Box title="Dialog · Schedule (Fix, Edit paused, New schedule)" className="lg:col-span-2">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setDlg("fix")}>
            Fix · bounced address
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDlg("paused")}>
            Edit · paused, every 3 months
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDlg("new")}>
            New schedule · pick a report
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDlg("newError")}>
            New schedule · nothing picked
          </Button>
        </div>
      </Box>
      {dlg === "fix" && <ScheduleDialog target={failed.target} targetName={failed.targetName} existing={failed} onOpenChange={close} />}
      {dlg === "paused" && <ScheduleDialog target={paused.target} targetName={paused.targetName} existing={paused} onOpenChange={close} />}
      {dlg === "new" && <ScheduleDialog onOpenChange={close} />}
      {dlg === "newError" && <ScheduleDialog onOpenChange={close} initial={{ tried: true }} />}
    </>
  )
}

function ReturnStories() {
  const [dlg, setDlg] = React.useState<"drawn" | "empty" | "wrong" | "hesn" | null>(null)
  const close = (o: boolean) => !o && setDlg(null)
  const view = (id: string): ReturnView => {
    const r = RETURNS.find((x) => x.id === id)!
    return { ...r, state: r.status }
  }
  const moh = view("moh-monthly-2611")
  const hesn = view("hesn-weekly-47")
  const vat = view("zatca-vat-q4")
  const done = view("moh-monthly-2610")
  return (
    <>
      <Box title="Widget / Rep Official · Wide" className="lg:col-span-2">
        <ReturnsList />
      </Box>
      <Box title="Widget / Rep Official · Compact">
        <div className="max-w-[358px]">
          <ReturnsList />
        </div>
      </Box>
      <Box title="Widget / Rep Return Side · Draft (MOH November)">
        <div className="max-w-[360px]">
          <ReturnSide r={moh} />
        </div>
      </Box>
      <Box title="Widget / Rep Return · Draft with 2 warnings (Add a note works)" className="lg:col-span-2">
        <div className="flex max-w-[736px] flex-col gap-4">
          <ReturnProgress r={moh} />
          <ReturnChecks r={moh} />
          <ReturnSections r={moh} />
        </div>
      </Box>
      <Box title="Widget / Rep Return · Ready, no warnings (HESN)">
        <div className="flex flex-col gap-4">
          <ReturnProgress r={hesn} />
          <ReturnChecks r={hesn} />
        </div>
      </Box>
      <Box title="Widget / Rep Return · Collecting (ZATCA) · Submitted (MOH October)">
        <div className="flex flex-col gap-4">
          <ReturnProgress r={vat} />
          <ReturnSections r={vat} />
          <ReturnProgress r={done} />
        </div>
      </Box>
      <Box title="Dialog · Sign off and submit" className="lg:col-span-2">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setDlg("drawn")}>
            Drawn (ticked, PIN typed)
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDlg("empty")}>
            Nothing filled
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDlg("wrong")}>
            Wrong PIN
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDlg("hesn")}>
            HESN · no warnings
          </Button>
        </div>
      </Box>
      {dlg === "drawn" && <SubmitReturnDialog r={moh} onOpenChange={close} initial={{ checked: true, pin: "4821" }} />}
      {dlg === "empty" && <SubmitReturnDialog r={moh} onOpenChange={close} initial={{ tried: true }} />}
      {dlg === "wrong" && <SubmitReturnDialog r={hesn} onOpenChange={close} initial={{ checked: true, tried: true, wrong: true }} />}
      {dlg === "hesn" && <SubmitReturnDialog r={hesn} onOpenChange={close} />}
    </>
  )
}
