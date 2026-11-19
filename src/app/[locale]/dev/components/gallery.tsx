"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import { toast } from "@/components/ds/toast"
import { Icon } from "@/components/ds/icon"
import { Field } from "@/components/ds/field"
import { StatusBadge } from "@/components/ds/status-badge"
import { StatCard } from "@/components/ds/stat-card"
import { PasswordInput } from "@/components/ds/password-input"
import { PasswordStrength } from "@/components/ds/password-strength"
import { RadioOption } from "@/components/ds/radio-option"
import { EmptyState, LoadingState, SkeletonCard, SkeletonRow } from "@/components/ds/states"
import { DropZone, UploadItem } from "@/components/ds/upload"
import { FilterChip, Pagination, ProgressField } from "@/components/ds/module-controls"
import { Combobox, DatePicker } from "@/components/ds/pickers"
import { Spinner } from "@/components/ds/spinner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog"
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerBody, DrawerClose } from "@/components/ui/drawer"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Popover, PopoverContent, PopoverDescription, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import { Progress } from "@/components/ui/progress"
import { RadioGroup } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TabCount, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"

/** Dev-only gallery mirroring DS sheets 08 / 10 / 11. Sample copy comes from the design scripts. */
export function Gallery() {
  const ar = useLocale() === "ar"
  const L = (en: string, a: string) => (ar ? a : en)
  const t = useTranslations("common")
  const open = useSearchParams().get("open")
  const [pw, setPw] = React.useState("Clinic2026")
  const [date, setDate] = React.useState<Date | undefined>(new Date(2026, 10, 18))
  const [nat, setNat] = React.useState("sa")
  const [page, setPage] = React.useState(1)
  const [chip, setChip] = React.useState(true)
  const [otp, setOtp] = React.useState("4829")

  return (
    <div className="space-y-10">
      <Section title="Button · Icon Button · Loading">
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">{L("Button", "زر")}</Button>
          <Button>
            <Icon name="add" />
            {L("Add patient", "أضف مريض")}
          </Button>
          <Button size="lg">{L("Sign in", "سجّل دخول")}</Button>
          <Button variant="secondary">{L("Secondary", "ثانوي")}</Button>
          <Button variant="outline">
            <Icon name="export" />
            {L("Export", "تصدير")}
          </Button>
          <Button variant="ghost">{L("Ghost", "شفاف")}</Button>
          <Button variant="destructive">{L("Delete record", "احذف السجل")}</Button>
          <Button variant="link">
            {L("Open report", "افتح التقرير")}
            <Icon name="arrow-right-1" />
          </Button>
          <Button loading>{t("actions.saving")}</Button>
          <Button variant="outline" loading>
            {t("actions.saving")}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {(["icon-sm", "icon", "icon-lg"] as const).map((s) => (
            <React.Fragment key={s}>
              <Button size={s} aria-label="more">
                <Icon name="more" />
              </Button>
              <Button size={s} variant="outline" aria-label="more">
                <Icon name="more" />
              </Button>
              <Button size={s} variant="ghost" aria-label="more">
                <Icon name="more" />
              </Button>
            </React.Fragment>
          ))}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" aria-label={L("Export as PDF", "صدّر PDF")}>
                <Icon name="document-download" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{L("Export as PDF", "صدّر PDF")}</TooltipContent>
          </Tooltip>
        </div>
      </Section>

      <Section title="Badge · Status Badge · Avatar">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{L("Badge", "شارة")}</Badge>
          <Badge variant="secondary">{L("Secondary", "ثانوي")}</Badge>
          <Badge variant="outline">{L("Outline", "إطار")}</Badge>
          <Badge variant="destructive">{L("Destructive", "خطر")}</Badge>
          <StatusBadge tone="success">{L("Confirmed", "مؤكد")}</StatusBadge>
          <StatusBadge tone="warning">{L("Pending", "بالانتظار")}</StatusBadge>
          <StatusBadge tone="destructive">{L("Critical", "حرج")}</StatusBadge>
          <StatusBadge tone="info">{L("Under observation", "تحت الملاحظة")}</StatusBadge>
          <StatusBadge tone="neutral">{L("Discharged", "خرج")}</StatusBadge>
          <StatusBadge tone="success">+12.5%</StatusBadge>
          <Avatar size="sm"><AvatarFallback>SA</AvatarFallback></Avatar>
          <Avatar><AvatarFallback>SA</AvatarFallback></Avatar>
          <Avatar size="lg"><AvatarFallback>{L("SA", "سأ")}</AvatarFallback></Avatar>
        </div>
      </Section>

      <Section title="Form controls · Field · Password · OTP">
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <Field label={L("Search", "دوّر")}>
            <Input startIcon={<Icon name="search-normal-1" size={16} />} placeholder={L("Search patients, MRN…", "دوّر على مريض…")} />
          </Field>
          <Field label={L("Email or mobile", "الإيميل أو الجوال")} error={L("Enter a valid email or mobile", "اكتب إيميل أو جوال صحيح")}>
            <Input fieldSize="lg" startIcon={<Icon name="sms" size={16} />} defaultValue="khaled.m@clinic" dir="ltr" />
          </Field>
          <Field label={L("Disabled", "معطّل")}>
            <Input disabled placeholder="—" />
          </Field>
          <Field label={L("Password", "كلمة المرور")} labelEnd={<Button variant="link" className="h-auto p-0">{L("Forgot password?", "نسيت كلمة المرور؟")}</Button>}>
            <PasswordInput value={pw} onChange={(e) => setPw(e.target.value)} />
          </Field>
          <div className="space-y-2">
            <Field label={L("New password", "كلمة المرور الجديدة")}>
              <PasswordInput defaultValue="clinic" autoComplete="new-password" />
            </Field>
            <PasswordStrength level="fair" />
          </div>
          <Field label={L("Range", "الفترة")}>
            <Select defaultValue="month">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="week">{L("This week", "هالأسبوع")}</SelectItem>
                <SelectItem value="month">{L("This month", "هالشهر")}</SelectItem>
                <SelectItem value="year">{L("This year", "هالسنة")}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label={L("Note", "ملاحظة")} helper="0 / 500">
            <Textarea placeholder={L("Write your note…", "اكتب ملاحظتك…")} />
          </Field>
          <Field label={L("Date of birth", "تاريخ الميلاد")}>
            <DatePicker value={date} onChange={setDate} placeholder={L("Pick a date", "اختر تاريخ")} />
          </Field>
          <Field label={L("Nationality", "الجنسية")}>
            <Combobox
              value={nat}
              onChange={setNat}
              placeholder={L("Choose", "اختر")}
              searchPlaceholder={L("Search…", "دوّر…")}
              emptyText={L("No results", "ما فيه نتايج")}
              options={[
                { value: "sa", label: L("Saudi", "سعودي"), group: L("Nationalities", "الجنسيات") },
                { value: "sd", label: L("Sudanese", "سوداني"), group: L("Nationalities", "الجنسيات") },
                { value: "eg", label: L("Egyptian", "مصري"), group: L("Nationalities", "الجنسيات") },
              ]}
            />
          </Field>
          <div className="flex flex-col gap-4">
            <label className="flex items-center gap-2 text-sm"><Checkbox defaultChecked />{L("Keep me signed in on this device", "خلني مسجّل دخول على هالجهاز")}</label>
            <label className="flex items-center gap-2 text-sm"><Checkbox />{L("Send SMS reminder", "أرسل تذكير SMS")}</label>
            <label className="flex items-center gap-2 text-sm"><Switch defaultChecked />{L("VIP patient", "مريض VIP")}</label>
            <label className="flex items-center gap-2 text-sm"><Switch />{L("Night mode", "الوضع الليلي")}</label>
          </div>
          <RadioGroup defaultValue="mada" className="gap-2">
            <RadioOption value="mada" title={L("Mada card", "بطاقة مدى")} description={L("Card payment at the desk", "الدفع بالبطاقة عند الاستقبال")} />
            <RadioOption value="cash" title={L("Cash", "كاش")} description={L("Paid in cash", "مدفوع كاش")} />
          </RadioGroup>
          <div className="space-y-3">
            <InputOTP maxLength={6} value={otp} onChange={setOtp}>
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((i) => <InputOTPSlot key={i} index={i} />)}
              </InputOTPGroup>
            </InputOTP>
            <InputOTP maxLength={6} value="482961" onChange={() => {}} aria-invalid>
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((i) => <InputOTPSlot key={i} index={i} />)}
              </InputOTPGroup>
            </InputOTP>
          </div>
        </div>
      </Section>

      <Section title="Tabs · Module Tabs · Filter chips · Pagination">
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">{L("Overview", "نظرة عامة")}</TabsTrigger>
            <TabsTrigger value="vitals">{L("Vitals", "المؤشرات")}</TabsTrigger>
            <TabsTrigger value="meds">{L("Medications", "الأدوية")}</TabsTrigger>
            <TabsTrigger value="visits">{L("Visits", "الزيارات")}</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="text-sm text-muted-foreground">…</TabsContent>
        </Tabs>
        <Tabs defaultValue="list">
          <TabsList variant="module">
            <TabsTrigger value="list">
              <TabIcon name="profile-2user" />
              {L("Patients list", "قائمة المرضى")}
              <TabCount>1,284</TabCount>
            </TabsTrigger>
            <TabsTrigger value="reports">
              <TabIcon name="chart-2" />
              {L("Reports", "التقارير")}
            </TabsTrigger>
            <TabsTrigger value="payments">
              <TabIcon name="wallet-money" />
              {L("Payments", "المدفوعات")}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap gap-2">
          <FilterChip selected={chip} onClick={() => setChip(!chip)} count={42}>VIP</FilterChip>
          <FilterChip count={128}>{L("Insured", "عليهم تأمين")}</FilterChip>
          <FilterChip count={9}>{L("Banned", "محظورين")}</FilterChip>
        </div>
        <Pagination
          page={page}
          pageCount={161}
          onPage={setPage}
          info={t("pagination.showing", { from: (page - 1) * 8 + 1, to: page * 8, total: "1,284" })}
          className="max-w-xl"
        />
      </Section>

      <Section title="Card · Stat Card · Table">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard icon="profile-2user" label={L("Total patients", "عدد المرضى")} value="1,284" delta="+12.5%" caption={t("stat.vsLastMonth")} />
          <StatCard icon="user-add" tile="info" label={L("New this month", "جدد هالشهر")} value="86" delta="+9%" caption={t("stat.vsLastMonth")} />
          <StatCard label={L("Collected this month", "المحصّل هالشهر")} value={L("SAR 482,350", "482,350 ر.س")} delta="+8.2%" caption={t("stat.vsLastMonth")} />
          <SkeletonCard />
        </div>
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>{L("Upcoming appointments", "المواعيد الجاية")}</CardTitle>
            <CardDescription>{L("Today · 12 scheduled", "اليوم · 12 موعد")}</CardDescription>
            <CardAction>
              <RowMenu />
            </CardAction>
          </CardHeader>
          <CardContent className="flex h-40 items-center justify-center rounded-lg border bg-muted text-xs text-muted-foreground">
            {L("Content slot", "المحتوى")}
          </CardContent>
        </Card>
        <div className="overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{L("Patient", "المريض")}</TableHead>
                <TableHead>{L("Doctor", "الطبيب")}</TableHead>
                <TableHead>{L("Date", "التاريخ")}</TableHead>
                <TableHead className="hidden md:table-cell">{L("Department", "القسم")}</TableHead>
                <TableHead>{L("Status", "الحالة")}</TableHead>
                <TableHead><span className="sr-only">{L("Actions", "إجراءات")}</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                ["SA", L("Sara Ahmed", "سارة أحمد"), "004812", L("Dr. Khaled Mansour", "د. خالد منصور"), "success", L("Confirmed", "مؤكد")],
                ["FH", L("Faisal Al-Harbi", "فيصل الحربي"), "004813", L("Dr. Noura Al-Qahtani", "د. نورة القحطاني"), "warning", L("Pending", "بالانتظار")],
              ].map(([ini, name, mrn, doc, tone, status]) => (
                <TableRow key={mrn}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar size="sm"><AvatarFallback>{ini}</AvatarFallback></Avatar>
                      <div>
                        <div className="font-medium">{name}</div>
                        <div className="text-xs text-muted-foreground">{L("MRN", "رقم الملف")} <bdi>{mrn}</bdi></div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{doc}</TableCell>
                  <TableCell className="tabular-nums">{ar ? "15 نوفمبر 2026 · 09:30" : "15 Nov 2026 · 09:30"}</TableCell>
                  <TableCell className="hidden md:table-cell">{L("Cardiology", "القلب")}</TableCell>
                  <TableCell><StatusBadge tone={tone as "success"}>{status}</StatusBadge></TableCell>
                  <TableCell className="w-12"><RowMenu /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <SkeletonRow />
        </div>
      </Section>

      <Section title="Alert · Progress · Loading · Skeleton">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Alert>
            <Icon name="info-circle" />
            <AlertTitle>{L("Lab results are ready", "نتائج التحاليل جاهزة")}</AlertTitle>
            <AlertDescription>{L("3 new results for Sara Ahmed were added at 09:12.", "انضافت 3 نتايج جديدة لسارة أحمد الساعة 09:12.")}</AlertDescription>
          </Alert>
          <Alert variant="warning">
            <Icon name="warning-2" />
            <AlertTitle>{L("Follow-up overdue", "المتابعة متأخرة")}</AlertTitle>
            <AlertDescription>{L("Patient missed the 2-week follow-up. Contact before 18:00.", "المريض فاته موعد المتابعة. تواصل معه قبل 18:00.")}</AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <Icon name="danger" />
            <AlertTitle>{L("Critical value", "قيمة حرجة")}</AlertTitle>
            <AlertDescription>
              <span>{L("Potassium", "البوتاسيوم")} <bdi>6.4 mmol/L</bdi>{L(", above the critical limit.", "، فوق الحد الحرج.")}</span>
            </AlertDescription>
          </Alert>
          <div className="space-y-4">
            <Progress value={60} />
            <Progress value={60} tone="success" />
            <Progress value={60} tone="warning" />
            <Progress value={60} tone="destructive" />
            <ProgressField label={L("Treatment plan", "خطة العلاج")} value={60} helper={L("6 of 10 sessions completed", "خلصت 6 من 10 جلسات")} />
          </div>
          <LoadingState title={L("Loading patients…", "لحظات، نجهّز قائمة المرضى…")} description={L("This can take a few seconds", "ثواني وتكون جاهزة")} />
          <div className="flex items-center gap-4">
            <Spinner size="sm" /><Spinner /><Spinner size="lg" />
            <Skeleton className="h-3 w-40" />
            <Skeleton className="size-10 rounded-full" />
          </div>
        </div>
      </Section>

      <Section title="Upload & drag-and-drop · Empty states">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <DropZone onFiles={(f) => toast.success(`${f.length} file(s)`)} />
          <div className="space-y-2">
            <UploadItem name="lab-report-004812.pdf" state="uploading" progress={64} doneMb="2.4" totalMb="3.8" />
            <UploadItem name="lab-report-004812.pdf" state="complete" totalMb="3.8" />
            <UploadItem name="lab-report-004812.pdf" state="error" totalMb="3.8" />
          </div>
          <EmptyState
            icon="search-normal-1"
            title={L("No matching patients", "ما فيه مرضى مطابقين")}
            description={L("Try another name, MRN or phone, or clear the filters.", "جرّب اسم أو رقم ملف أو جوال ثاني، أو امسح الفلاتر.")}
            actions={
              <>
                <Button variant="outline"><Icon name="close-circle" />{t("actions.clearFilters")}</Button>
                <Button><Icon name="user-add" />{L("Add patient", "أضف مريض")}</Button>
              </>
            }
          />
        </div>
      </Section>

      <Section title="Overlays · Dialog · Sheet · Bottom sheet · Popover · Toast">
        <div className="flex flex-wrap gap-3">
          <Dialog defaultOpen={open === "dialog"}>
            <DialogTrigger asChild><Button variant="outline">Dialog</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader icon="info-circle">
                <DialogTitle>{L("Archive patient file?", "تبي تأرشف ملف المريض؟")}</DialogTitle>
                <DialogDescription>{L("A short description of what will happen.", "وصف قصير للي بيصير.")}</DialogDescription>
              </DialogHeader>
              <div className="flex h-24 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">{L("Content", "المحتوى")}</div>
              <DialogFooter>
                <DialogClose asChild><Button variant="outline">{t("actions.cancel")}</Button></DialogClose>
                <Button>{t("actions.confirm")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Sheet defaultOpen={open === "sheet"}>
            <SheetTrigger asChild><Button variant="outline">Sheet</Button></SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>{L("Visit details", "تفاصيل الزيارة")}</SheetTitle>
                <SheetDescription>{L("Opens from the end edge", "يفتح من طرف الشاشة")}</SheetDescription>
              </SheetHeader>
              <SheetBody><div className="h-40 rounded-lg bg-muted" /></SheetBody>
            </SheetContent>
          </Sheet>
          <Drawer defaultOpen={open === "drawer"}>
            <DrawerTrigger asChild><Button variant="outline">Bottom sheet</Button></DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>{L("Sheet title", "عنوان النافذة")}</DrawerTitle>
                <DrawerDescription>{L("Slides up on mobile", "تطلع من تحت في الجوال")}</DrawerDescription>
              </DrawerHeader>
              <DrawerBody><div className="h-30 rounded-lg bg-muted" /></DrawerBody>
              <DrawerFooter>
                <Button size="lg">{t("actions.confirm")}</Button>
                <DrawerClose asChild><Button size="lg" variant="outline">{t("actions.cancel")}</Button></DrawerClose>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
          <Popover defaultOpen={open === "popover"}>
            <PopoverTrigger asChild><Button variant="outline">Popover</Button></PopoverTrigger>
            <PopoverContent>
              <PopoverTitle>{L("Popover title", "عنوان")}</PopoverTitle>
              <PopoverDescription>{L("Short content tied to the trigger; closes on outside click.", "محتوى قصير مرتبط بالزر، يتسكّر لما تضغط برّا.")}</PopoverDescription>
            </PopoverContent>
          </Popover>
          <Button variant="ghost" asChild>
            <a href={`/${ar ? "ar" : "en"}/dev/toasts`}>Toasts (sheet 12) →</a>
          </Button>
        </div>
      </Section>
    </div>
  )

  function TabIcon({ name }: { name: React.ComponentProps<typeof Icon>["name"] }) {
    return (
      <>
        <Icon name={name} size={18} className="group-data-[state=active]/tab:hidden" />
        <Icon name={name} size={18} variant="bold" className="hidden group-data-[state=active]/tab:block" />
      </>
    )
  }

  function RowMenu() {
    return (
      <DropdownMenu defaultOpen={open === "menu"} modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={L("More actions", "إجراءات أكثر")}>
            <Icon name="more" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{L("Actions", "الإجراءات")}</DropdownMenuLabel>
          <DropdownMenuItem><Icon name="eye" size={16} />{L("View profile", "شوف الملف")}</DropdownMenuItem>
          <DropdownMenuItem><Icon name="edit-2" size={16} />{L("Edit details", "عدّل البيانات")}</DropdownMenuItem>
          <DropdownMenuItem><Icon name="calendar-add" size={16} />{L("Schedule visit", "احجز زيارة")}</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive"><Icon name="trash" size={16} />{L("Delete record", "احذف السجل")}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="space-y-4 rounded-xl border bg-background p-4 md:p-6">{children}</div>
    </section>
  )
}
