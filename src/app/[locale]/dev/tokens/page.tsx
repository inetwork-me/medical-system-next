import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Icon, ICON_NAMES } from "@/components/ds/icon";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { hasLocale } from "next-intl";
import { cn } from "@/lib/utils";

/** Dev-only token sheet to check the theme against the Design System page (01–05). Not shipped in production. */

const SEMANTIC = [
  "background", "foreground", "card", "primary", "secondary", "muted", "muted-foreground", "accent",
  "accent-foreground", "destructive", "success", "warning", "info", "success-soft", "warning-soft",
  "destructive-soft", "info-soft", "border", "input", "ring", "sidebar", "sidebar-accent",
  "chart-1", "chart-2", "chart-3", "chart-4", "chart-5",
];

const TYPE = [
  ["Display", "text-4xl font-bold tracking-tight"],
  ["H1", "text-3xl font-semibold tracking-tight"],
  ["H2", "text-2xl font-semibold tracking-tight"],
  ["H3", "text-xl font-semibold"],
  ["H4", "text-lg font-semibold"],
  ["Body/Large", "text-base"],
  ["Body/Default", "text-sm"],
  ["Body/Default Medium", "text-sm font-medium"],
  ["Body/Small", "text-xs"],
  ["Body/Small Medium", "text-xs font-medium"],
] as const;

export default async function TokensPage({ params }: PageProps<"/[locale]/dev/tokens">) {
  if (process.env.NODE_ENV === "production") notFound();
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("common");
  const format = await getFormatter();
  const ar = locale === "ar";
  const sample = ar ? "نظرة عامة على المريض" : "Patient overview";

  return (
    <main className="mx-auto w-full max-w-screen-2xl space-y-10 p-4 md:p-6 lg:p-8">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Icon name="hospital" size={24} />
          </span>
          <h1 className="text-3xl font-semibold tracking-tight">{t("app.name")} · tokens</h1>
        </div>
        <Link
          href="/dev/tokens"
          locale={ar ? "en" : "ar"}
          className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
        >
          <Icon name="language-square" size={20} />
          {t("language.other")}
        </Link>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Semantic colours</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
          {SEMANTIC.map((n) => (
            <div key={n} className="overflow-hidden rounded-xl border bg-card">
              <div className="h-12 border-b" style={{ background: `var(--${n})` }} />
              <p className="px-2 py-1.5 text-xs font-medium">{n}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Type scale · {ar ? "AR (IBM Plex Sans Arabic)" : "EN (Inter)"}</h2>
        <div className="divide-y rounded-xl border bg-card">
          {TYPE.map(([name, cls]) => (
            <div key={name} className="flex items-baseline gap-6 px-4 py-3">
              <span className="w-40 shrink-0 text-xs text-muted-foreground">{name}</span>
              <span className={cn(cls)}>{sample}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Radius & elevation</h2>
        <div className="flex flex-wrap gap-4">
          {["rounded-sm", "rounded-md", "rounded-lg", "rounded-xl", "rounded-2xl", "rounded-full"].map((r) => (
            <div key={r} className={cn("flex size-24 items-center justify-center border bg-card text-xs", r)}>{r}</div>
          ))}
          {["shadow-xs", "shadow-sm", "shadow-md", "shadow-lg"].map((s) => (
            <div key={s} className={cn("flex size-24 items-center justify-center rounded-xl bg-card text-xs", s)}>{s}</div>
          ))}
          <button className="h-9 rounded-md border border-ring bg-card px-4 text-sm ring-[3px] ring-ring/50">Focus ring</button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Status (soft)</h2>
        <div className="flex flex-wrap gap-2">
          {["success", "warning", "destructive", "info"].map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
              style={{ background: `var(--${s}-soft)`, color: `var(--${s}-soft-foreground)` }}
            >
              <span className="size-1.5 rounded-full" style={{ background: `var(--${s})` }} />
              {s}
            </span>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Icons · Linear / Bold (directional ones mirror in AR)</h2>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 xl:grid-cols-10">
          {ICON_NAMES.map((n) => (
            <div key={n} className="flex flex-col items-center gap-2 rounded-lg border bg-card p-3">
              <div className="flex gap-2">
                <Icon name={n} size={24} />
                <Icon name={n} size={24} variant="bold" className="text-primary" />
              </div>
              <span className="text-center text-xs text-muted-foreground">{n}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Numbers, dates & bidi</h2>
        <div className="grid gap-2 rounded-xl border bg-card p-4 text-sm tabular-nums">
          <p>integer: {format.number(1284, "integer")}</p>
          <p>delta: <bdi>{format.number(0.125, "delta")}</bdi></p>
          <p>sar: {format.number(2450.5, "sar")}</p>
          <p>short: {format.dateTime(new Date(2011, 2, 12), "short")}</p>
          <p>dayMonth: {format.dateTime(new Date(2026, 9, 28), "dayMonth")}</p>
          <p>time: {format.dateTime(new Date(2026, 10, 16, 9, 30), "time")}</p>
          <p>
            {ar ? "جوال المريض:" : "Patient mobile:"} <bdi className="ltr-value">+966 55 123 4567</bdi> ·{" "}
            {ar ? "فصيلة الدم" : "Blood type"} <bdi className="ltr-value">O+</bdi>
          </p>
        </div>
      </section>
    </main>
  );
}
