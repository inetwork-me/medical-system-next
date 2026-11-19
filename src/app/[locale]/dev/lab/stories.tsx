"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { ORDERS, ORDER_OF_DRAW, TUBES, barcodeOf, timeOf, type Flag, type LabOrder, type OrderStatus, type TubeKey } from "@/modules/labs/data"
import {
  canRelease,
  collect,
  criticals,
  deltaFor,
  flagCounts,
  flagFor,
  logCall,
  receive,
  refText,
  reject,
  release,
  statusOf,
  stepper,
  submit,
  uncalledCriticals,
  type Step,
} from "@/modules/labs/machine"
import { CollectDialog } from "@/modules/labs/collect-dialog"
import { TodaysOrders } from "@/modules/labs/worklist"
import { FlagChip, LabStatusBadge, Latin, PriorityChip, StatChip, TubeDot, TubeLabel, useB } from "@/modules/labs/parts"

const FLAGS: (Flag | null)[] = ["H", "L", "C", null]
const STATUSES: OrderStatus[] = ["collect", "lab", "validate", "ready", "rejected"]
const T = (t: string) => `2026-11-19T${t}`

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-5">
      <h2 className="font-mono text-xs text-muted-foreground" dir="ltr">
        {title}
      </h2>
      {children}
    </section>
  )
}

/** The status machine walked through with the sample orders: every step shows the resulting status or the refusal. */
function machineRun(): { label: string; step: Step; status?: OrderStatus }[] {
  const out: { label: string; step: Step; status?: OrderStatus }[] = []
  const go = (label: string, o: LabOrder, run: (o: LabOrder) => Step) => {
    const step = run(o)
    out.push({ label, step, status: step.ok ? statusOf(step.order) : undefined })
    return step.ok ? step.order : o
  }
  const o142 = ORDERS.find((o) => o.no === "LAB-0142")!
  let o = go("LAB-0142 · release before the critical call", o142, (x) => release(x, ["hba1c", "lytes", "kidney"], "salma", T("11:24"), { inPatientApp: true }))
  o = go("LAB-0142 · log call without read-back", o, (x) => logCall(x, { analyte: "k", spokeTo: "zaki", how: "phone", at: T("11:04"), readBack: false, by: "ali" }))
  o = go("LAB-0142 · log call (read-back ticked)", o, (x) => logCall(x, { analyte: "k", spokeTo: "zaki", how: "phone", at: T("11:04"), readBack: true, by: "ali" }))
  o = go("LAB-0142 · partial release (3 of 5 panels)", o, (x) => release(x, ["hba1c", "lytes", "kidney"], "salma", T("11:24"), { inPatientApp: true }))
  o = go("LAB-0142 · submit lipid with a missing value", o, (x) => submit(x, "lipid", { chol: 182, ldl: 118, hdl: 48, tg: null }, undefined, "ali", T("11:58")))
  o = go("LAB-0142 · submit lipid (TG 84)", o, (x) => submit(x, "lipid", { chol: 182, ldl: 118, hdl: 48, tg: 84 }, undefined, "ali", T("11:58")))
  go("LAB-0142 · release lipid", o, (x) => release(x, ["lipid"], "salma", T("12:05"), { inPatientApp: true }))

  const o140 = ORDERS.find((x) => x.no === "LAB-0140")!
  let c = go("LAB-0140 · collect 2 of 3 tubes", o140, (x) => collect(x, [1, 2], "hanan", T("11:25")))
  c = go("LAB-0140 · collect the culture bottles", c, (x) => collect(x, [3], "hanan", T("11:27")))
  c = go("LAB-0140 · receive all", c, (x) => receive(x, [1, 2, 3], "ali", T("11:33")))
  go("LAB-0140 · reject lavender (clotted, new sample)", c, (x) => reject(x, 1, "clotted", { recollect: true, toldDoctor: true, ticket: "C-11" }, "ali", T("11:40")))
  return out
}

/** Widget / Lab … stories: each widget at its Wide and Compact widths (switch language for Dir=RTL). */
function WidgetStory({ name, wide, compact, render }: { name: string; wide: number; compact: number; render: () => React.ReactNode }) {
  return (
    <Box title={`${name} · Wide ${wide} / Compact ${compact}`}>
      <div className="flex flex-wrap items-start gap-6">
        <div style={{ width: wide }}>{render()}</div>
        <div style={{ width: compact }}>{render()}</div>
      </div>
    </Box>
  )
}

export function LabStories() {
  const [collecting, setCollecting] = React.useState<string | null>(null)
  const b = useB()
  const t = useTranslations("labs")
  const run = React.useMemo(() => machineRun(), [])
  const o142 = ORDERS.find((o) => o.no === "LAB-0142")!
  const ldl = o142.panels.find((p) => p.test === "lipid")!.results.find((r) => r.analyte === "ldl")!

  return (
    <div className="flex flex-col gap-6">
      <WidgetStory name="Widget / Lab Worklist" wide={1120} compact={358} render={() => <TodaysOrders onCollect={setCollecting} />} />
      {collecting && <CollectDialog orderNo={collecting} onOpenChange={(o) => !o && setCollecting(null)} />}

      <Box title="Tube dot + name · 12 / 14 / 16 · short and full">
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          {(Object.keys(TUBES) as TubeKey[]).map((k) => (
            <div key={k} className="flex flex-col gap-2">
              <TubeLabel tube={k} />
              <TubeLabel tube={k} size={14} gap="gap-2.5" textClassName="text-sm text-foreground" full />
              <span className="flex items-center gap-2">
                <TubeDot tube={k} size={16} />
                <Latin className="font-mono text-[11px] text-muted-foreground">{TUBES[k].hex}</Latin>
              </span>
            </div>
          ))}
        </div>
      </Box>

      <Box title="Tube guide (order of draw)">
        <ol className="flex max-w-80 flex-col gap-3">
          {ORDER_OF_DRAW.map((x, i) => (
            <li key={x.tube} className="flex items-center gap-2.5">
              <span className="w-3 text-xs font-medium text-muted-foreground tabular-nums">{i + 1}</span>
              <TubeDot tube={x.tube} size={16} />
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-medium text-foreground">{b(TUBES[x.tube].full)}</span>
                <span className="text-xs text-muted-foreground">{b(x.use)}</span>
              </span>
            </li>
          ))}
        </ol>
      </Box>

      <Box title="Flag chip · High = warning · Low = info · Critical = destructive · none = Normal">
        <div className="flex flex-wrap items-center gap-3">
          {FLAGS.map((f) => (
            <FlagChip key={String(f)} flag={f} />
          ))}
        </div>
      </Box>

      <Box title="Priority · STAT chip · Routine chip">
        <div className="flex flex-wrap items-center gap-3">
          <StatChip />
          <PriorityChip priority="routine" />
          <span className="text-xs text-muted-foreground" dir="ltr">
            statOnly routine → (nothing):
          </span>
          <PriorityChip priority="routine" statOnly />
        </div>
      </Box>

      <Box title="Order status badge">
        <div className="flex flex-wrap items-center gap-3">
          {STATUSES.map((s) => (
            <LabStatusBadge key={s} status={s} />
          ))}
        </div>
      </Box>

      <Box title="Sample orders · derived status · barcodes · flags · critical deadline">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-start text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="[&>th]:px-2 [&>th]:py-2 [&>th]:text-start [&>th]:font-medium">
                <th>Order</th>
                <th>Patient</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Tubes</th>
                <th>Flags C/H/L</th>
                <th>Critical</th>
                <th>Release</th>
                <th>Stepper</th>
              </tr>
            </thead>
            <tbody>
              {ORDERS.map((o) => {
                const fc = flagCounts(o)
                const cr = criticals(o)
                const g = canRelease(o)
                return (
                  <tr key={o.no} className="border-t align-top [&>td]:px-2 [&>td]:py-2">
                    <td>
                      <Latin className="font-medium">{o.no}</Latin>
                    </td>
                    <td>{b(o.patient.name)}</td>
                    <td>
                      <PriorityChip priority={o.priority} />
                    </td>
                    <td>
                      <LabStatusBadge status={statusOf(o)} />
                    </td>
                    <td>
                      <ul className="flex flex-col gap-1">
                        {o.tubes.map((tb) => (
                          <li key={tb.no} className="flex items-center gap-2">
                            <TubeLabel tube={tb.type} />
                            <Latin className="text-xs">{barcodeOf(o, tb.no)}</Latin>
                            <span className="font-mono text-[11px] text-muted-foreground" dir="ltr">
                              {tb.state}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td>
                      <Latin>{`${fc.C}/${fc.H}/${fc.L}`}</Latin>
                    </td>
                    <td>
                      {cr.map((c) => (
                        <span key={c.result.analyte} className="text-xs" dir="ltr">
                          {c.result.analyte} · {timeOf(c.resultedAt)} → call by {timeOf(c.deadline)} · {c.called ? "called" : "not called"}
                        </span>
                      ))}
                    </td>
                    <td className="font-mono text-[11px]" dir="ltr">
                      {g.ok ? "ok" : g.reason}
                    </td>
                    <td>
                      <span className="flex flex-wrap gap-1">
                        {stepper(o).map((s) => (
                          <span
                            key={s.key}
                            className={s.state === "done" ? "text-success" : s.state === "now" ? "font-semibold text-primary" : "text-muted-foreground"}
                          >
                            {t(`step.${s.key}`)}
                            {s.at && <Latin className="ms-1 text-[11px]">{timeOf(s.at)}</Latin>}
                          </span>
                        ))}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Box>

      <Box title="Rules · auto flag · reference text · delta check">
        <ul className="flex flex-col gap-1.5 text-sm" dir="ltr">
          <li>
            K+ 2.7 → {String(flagFor("k", 2.7))} · 3.2 → {String(flagFor("k", 3.2))} · 4.3 → {String(flagFor("k", 4.3))} · 5.6 → {String(flagFor("k", 5.6))} · 6.3 →{" "}
            {String(flagFor("k", 6.3))}
          </li>
          <li>
            HDL 40 → {String(flagFor("hdl", 40))} · TG 95 → {String(flagFor("tg", 95))} · HbA1c 9.1 → {String(flagFor("hba1c", 9.1))}
          </li>
          <li>
            refs: {refText({ analyte: "hba1c", refLow: 4, refHigh: 5.6 })} · {refText({ analyte: "chol", refHigh: 170 })} ·{" "}
            {refText({ analyte: "hdl", refLow: 45 })} · {refText({ analyte: "k", refLow: 3.5, refHigh: 5.1 })}
          </li>
          <li>
            delta LDL 89 → 118: {String(deltaFor(ldl))}% (threshold 30%) · LDL 89 → 110: {String(deltaFor({ ...ldl, value: 110 }))}
          </li>
          <li>LAB-0142 uncalled criticals: {uncalledCriticals(o142).length}</li>
        </ul>
      </Box>

      <Box title="Status machine run">
        <ol className="flex flex-col gap-1.5 text-sm">
          {run.map((s, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2">
              <span className="w-6 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
              <span dir="ltr">{s.label}</span>
              <span>→</span>
              {s.step.ok && s.status ? (
                <LabStatusBadge status={s.status} />
              ) : (
                <span className="rounded-sm bg-destructive-soft px-2 font-mono text-xs text-destructive-soft-foreground" dir="ltr">
                  refused: {!s.step.ok && s.step.reason}
                </span>
              )}
            </li>
          ))}
        </ol>
      </Box>
    </div>
  )
}
