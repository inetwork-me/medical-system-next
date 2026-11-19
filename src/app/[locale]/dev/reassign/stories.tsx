"use client"

import * as React from "react"
import { useLocale } from "next-intl"

import { ReassignBookings, type ReassignCandidate, type ReassignChoice } from "@/components/ds/reassign-bookings"

/** Design sample data (Deactivate Dr. Ahmed Zaki · Pause Pediatrics 20–24 Nov), EN / AR. */
const L = (ar: boolean) => (en: string, a: string) => (ar ? a : en)

function useSamples() {
  const ar = useLocale() === "ar"
  const s = L(ar)
  const doctors = (total: number, [a, b2, c]: number[]): ReassignCandidate[] => [
    { key: "saud", name: s("Dr. Lama Al-Saud", "د. لمى آل سعود"), sub: s("Pediatrics specialist", "أخصائية أطفال"), initials: "LS", coverage: { state: "all", covered: a, total } },
    { key: "oghamdi", name: s("Dr. Omar Al-Ghamdi", "د. عمر الغامدي"), sub: s("Consultant pediatrician", "استشاري طب أطفال"), initials: "OG", coverage: { state: "some", covered: b2, total } },
    { key: "mutlaq", name: s("Dr. Rana Al-Mutlaq", "د. رنا المطلق"), sub: s("Pediatrics specialist", "أخصائية أطفال"), initials: "RM", coverage: { state: "some", covered: c, total } },
    { key: "hdossari", name: s("Dr. Hessa Al-Dossari", "د. حصة الدوسري"), sub: s("Pediatrics specialist", "أخصائية أطفال"), initials: "HD", coverage: { state: "leave", until: s("5 Jan", "5 يناير") } },
  ]
  const clinics: ReassignCandidate[] = [
    { key: "malqa", name: s("Pediatrics · Al-Malqa branch", "الأطفال · فرع الملقا"), sub: s("Same visits · 12 min away", "نفس الزيارات · يبعد 12 دقيقة"), coverage: { state: "some", covered: 18, total: 23 } },
    { key: "family", name: s("Family medicine", "طب الأسرة"), sub: s("This branch · Floor 1", "نفس الفرع · الدور 1"), coverage: { state: "some", covered: 15, total: 23 } },
    { key: "rawdah", name: s("Pediatrics · Al-Rawdah branch", "الأطفال · فرع الروضة"), sub: s("Paused too 20–22 Nov", "موقفة بعد 20–22 نوفمبر"), coverage: { state: "unavailable" } },
  ]
  return {
    dept: { name: s("Pediatrics", "الأطفال"), short: s("Peds", "أطفال") },
    deactivate: doctors(38, [38, 31, 26]),
    leave: doctors(14, [14, 12, 9]),
    clinics,
    preview: {
      days: [
        { key: "25", label: s("Wed 25 Nov", "الأربعاء 25 نوفمبر"), n: 12 },
        { key: "26", label: s("Thu 26 Nov", "الخميس 26 نوفمبر"), n: 8 },
      ],
      waiting: 3,
    },
  }
}

function Story({ name, initial, render }: { name: string; initial: ReassignChoice; render: (v: ReassignChoice, set: (v: ReassignChoice) => void, picked: string | undefined, pick: (k: string) => void) => React.ReactNode }) {
  const [v, setV] = React.useState(initial)
  const [picked, setPicked] = React.useState<string>()
  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-[11px] text-muted-foreground" dir="ltr">
        {name}
      </span>
      <div className="w-full max-w-118 rounded-xl border bg-card p-6">{render(v, setV, picked, setPicked)}</div>
    </div>
  )
}

export function ReassignStories() {
  const x = useSamples()
  const grid = "grid grid-cols-[repeat(auto-fill,minmax(min(100%,472px),1fr))] items-start gap-6"
  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">target = doctor · Deactivate doctor (38) / Request leave (14)</h2>
        <div className={grid}>
          {(["doctor", "spread", "cancel"] as const).map((c) => (
            <Story
              key={c}
              name={`target=doctor · selected=${c}`}
              initial={c}
              render={(v, set, p, pick) => (
                <ReassignBookings target="doctor" count={38} department={x.dept} value={v} onValueChange={set} picked={p ?? "saud"} onPick={pick} candidates={x.deactivate} />
              )}
            />
          ))}
          <Story
            name="target=doctor · leave · selected=doctor"
            initial="doctor"
            render={(v, set, p, pick) => <ReassignBookings target="doctor" leave count={14} department={x.dept} value={v} onValueChange={set} picked={p ?? "saud"} onPick={pick} candidates={x.leave} />}
          />
        </div>
      </section>
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">target = clinic · Pause clinic (23)</h2>
        <div className={grid}>
          {(["date", "clinic", "cancel"] as const).map((c) => (
            <Story
              key={c}
              name={`target=clinic · selected=${c}`}
              initial={c}
              render={(v, set, p, pick) => (
                <ReassignBookings target="clinic" count={23} department={x.dept} value={v} onValueChange={set} picked={p ?? "malqa"} onPick={pick} candidates={x.clinics} preview={x.preview} />
              )}
            />
          ))}
        </div>
      </section>
    </div>
  )
}
