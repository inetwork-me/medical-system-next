"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { useDates } from "@/i18n/dates"
import { pdfDocument, type PdfBlock } from "@/lib/export/pdf"
import { saveBlob } from "@/lib/export/files"
import { Icon } from "@/components/ds/icon"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { LAB_FACILITY, analyteOf, staffOf, timeOf, type LabOrder, type Panel } from "../data"
import { refText, valueText } from "../machine"
import { FLAG_TEXT, Latin, ltrRun } from "../parts"
import { labCan, seesUnreleased } from "../roles"
import { useLabRole } from "../store"
import { useLabText } from "../text"
import { OrderPage, useCurrentOrder } from "./frame"
import { OrderHeader } from "./header"
import { usePanelTitle } from "./results"
import { SendDialog } from "./send-dialog"

/** Panels on the report: staff see everything resulted (preliminary); patients only released panels. */
export const reportPanels = (o: LabOrder, audience: "staff" | "patient") =>
  o.panels.filter((p) => (audience === "patient" ? p.state === "released" : p.state === "validate" || p.state === "released") && p.results.length)

/** Everything the report says, for the page, the PDF and the patient app alike. */
export function useReportModel(o: LabOrder, audience: "staff" | "patient") {
  const t = useTranslations("labs.report")
  const tsex = useTranslations("labs.order.sex")
  const { b, age, doctorName } = useLabText()
  const dates = useDates()
  const title = usePanelTitle()
  const panels = reportPanels(o, audience)
  const final = o.panels.length > 0 && o.panels.every((p) => p.state === "released")
  const collected = o.tubes.filter((x) => x.collectedAt).map((x) => x.collectedAt!).sort()[0]
  const validator = panels.map((p) => p.validatedBy).find(Boolean)
  const calls = o.calls
    .filter((c) => c.readBack)
    .map((c) => {
      const r = o.panels.flatMap((p) => p.results).find((x) => x.analyte === c.analyte)
      return t("callLine", {
        analyte: b(analyteOf(c.analyte)!.name),
        value: ltrRun(r ? valueText(c.analyte, r.value) : ""),
        doctor: doctorName(c.spokeTo),
        time: timeOf(c.at),
      })
    })
  const notes = [...new Set(panels.map((p) => p.comment).filter(Boolean) as string[])]
  const info: [string, string][] = [
    [t("patient"), b(o.patient.name)],
    [t("mrn"), o.patient.mrn],
    [t("ageSex"), `${age(o.patient)} · ${tsex(o.patient.sex)}`],
    [t("orderedBy"), doctorName(o.doctorId)],
    [t("collected"), collected ? `${dates.short(collected)} · ${timeOf(collected)}` : "—"],
    [t("report"), t(final ? "final" : "preliminary", { no: o.no })],
  ]
  const v = validator ? staffOf(validator) : undefined
  return {
    t,
    panels,
    title: (p: Panel) => title(p),
    info,
    comment: [...calls, ...notes].join(" "),
    validatedBy: v ? `${b(v.name)} · ${b(v.title).toLowerCase()}` : null,
    verify: t("verify", { url: LAB_FACILITY.verifyUrl, code: o.verifyCode ?? o.no.replace(/\D/g, "") }),
  }
}

/**
 * Widget / Lab Patient Report: the printable report, also the patient-app view (`audience="patient"` shows released
 * panels only). Wide (desktop, tablet): an A4-width paper (816) with letterhead, QR, a 3-column patient block; compact
 * (mobile): a card, 2 columns. Each result line: value + flag letter (coloured), unit, range. Comment (critical calls
 * + the validator's comment), validated by, verify link + code. Printing the page prints only this paper at A4.
 */
export function PatientReport({ order: o, audience = "staff", className }: { order: LabOrder; audience?: "staff" | "patient"; className?: string }) {
  const { b } = useLabText()
  const m = useReportModel(o, audience)
  const { t } = m
  return (
    <article
      data-lab-report
      className={cn(
        "@container/rp mx-auto flex w-full max-w-[816px] flex-col gap-5 rounded-xl border bg-card p-4 md:rounded-lg md:p-10 md:shadow-md",
        className
      )}
    >
      <header className="flex items-center gap-3 border-b pb-5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
          <Icon name="glass" size={22} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 className="text-lg font-semibold text-foreground">{t("lab")}</h2>
          <p className="text-xs text-muted-foreground">
            <bdi>{t("labLine", { phone: ltrRun(LAB_FACILITY.phone) })}</bdi>
          </p>
        </div>
        <span className="hidden size-14 shrink-0 items-center justify-center rounded-md border bg-muted md:flex" role="img" aria-label={t("qr")}>
          <Icon name="scan-barcode" size={28} />
        </span>
      </header>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-4 md:grid-cols-3">
        {m.info.map(([k, v]) => (
          <div key={k} className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="text-sm font-medium text-foreground">
              <bdi>{v}</bdi>
            </dd>
          </div>
        ))}
      </dl>

      {m.panels.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{audience === "patient" ? t("nothingPatient") : t("nothing")}</p>
      ) : (
        m.panels.map((p) => (
          <section key={p.test} className="flex flex-col">
            <h3 className="pb-2 text-sm font-medium text-foreground">{m.title(p)}</h3>
            <table className="w-full table-fixed border-collapse text-sm">
              <colgroup>
                <col />
                <col className="w-14 md:w-[76px]" />
                <col className="hidden w-[76px] md:table-column" />
                <col className="w-16 md:w-20" />
              </colgroup>
              <thead className="sr-only">
                <tr>
                  <th>{t("col.test")}</th>
                  <th>{t("col.result")}</th>
                  <th>{t("col.unit")}</th>
                  <th>{t("col.range")}</th>
                </tr>
              </thead>
              <tbody>
                {p.results.map((r) => (
                  <tr key={r.analyte} className="border-b">
                    <td className="py-2 pe-3 text-foreground">{b(analyteOf(r.analyte)!.name)}</td>
                    <td className={cn("py-2", r.flag ? cn("font-medium", FLAG_TEXT[r.flag]) : "text-foreground")}>
                      <Latin>{`${valueText(r.analyte, r.value)}${r.flag ? ` ${r.flag}` : ""}`}</Latin>
                    </td>
                    <td className="hidden py-2 text-xs text-muted-foreground md:table-cell">
                      <Latin>{r.unit}</Latin>
                    </td>
                    <td className="py-2 text-xs text-muted-foreground">
                      <Latin>{refText(r)}</Latin>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))
      )}

      {m.comment && (
        <div className="flex flex-col gap-1 rounded-lg bg-muted p-3">
          <span className="text-xs font-medium text-foreground">{t("comment")}</span>
          <span className="text-xs text-muted-foreground">
            <bdi>{m.comment}</bdi>
          </span>
        </div>
      )}

      <footer className="flex flex-col gap-4 md:flex-row md:items-end">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">{t("validatedBy")}</span>
          <span className="text-sm font-medium text-foreground">{m.validatedBy ?? t("notValidated")}</span>
        </div>
        <span className="text-xs text-muted-foreground">
          <bdi>{m.verify}</bdi>
        </span>
      </footer>
    </article>
  )
}

/** Download PDF: the same report drawn into an A4 PDF in the browser (lib/export/pdf). */
function useReportPdf(o: LabOrder) {
  const { b, ar } = useLabText()
  const m = useReportModel(o, "staff")
  const t = m.t
  const run = async () => {
    const name = `${o.no}-report.pdf`
    const blocks: PdfBlock[] = [
      { kind: "brand", title: t("lab"), subtitle: t("labLine", { phone: LAB_FACILITY.phone }) },
      { kind: "kv", rows: m.info },
      ...m.panels.flatMap((p): PdfBlock[] => [
        { kind: "title", text: m.title(p) },
        {
          kind: "table",
          head: [t("col.test"), t("col.result"), t("col.unit"), t("col.range")],
          rows: p.results.map((r) => [b(analyteOf(r.analyte)!.name), `${valueText(r.analyte, r.value)}${r.flag ? ` ${r.flag}` : ""}`, r.unit, refText(r)]),
          weights: [3, 1.2, 1.2, 1.4],
        },
      ]),
      ...(m.comment ? [{ kind: "note", text: `${t("comment")}: ${m.comment.replace(/[⁦⁩]/g, "")}` } as PdfBlock] : []),
      { kind: "meta", text: `${t("validatedBy")}: ${m.validatedBy ?? t("notValidated")}` },
      { kind: "meta", text: m.verify },
    ]
    try {
      saveBlob(await pdfDocument(blocks, { dir: ar ? "rtl" : "ltr", title: name }), name)
      toast.success(t("pdf"), { description: name })
    } catch {
      toast.error(t("pdfFailed"), { description: t("pdfFailedText"), retry: () => void run() })
    }
  }
  return run
}

/** Lab order page · Report: actions Download PDF · Send results; the order header, then the report paper. */
export function OrderReport() {
  const t = useTranslations("labs.report")
  const role = useLabRole()
  const o = useCurrentOrder()
  const [sending, setSending] = React.useState(false)
  const download = useReportPdf(o)
  return (
    <OrderPage
      actions={
        <>
          <Button variant="outline" onClick={() => void download()}>
            <Icon name="document-download" size={24} />
            {t("download")}
          </Button>
          {labCan(role, "send") && (
            <Button onClick={() => setSending(true)}>
              <Icon name="send-2" size={24} />
              {t("send")}
            </Button>
          )}
        </>
      }
    >
      <OrderHeader order={o} />
      <PatientReport order={o} audience={seesUnreleased(role) ? "staff" : "patient"} />
      {sending && <SendDialog orderNo={o.no} onOpenChange={setSending} />}
    </OrderPage>
  )
}
