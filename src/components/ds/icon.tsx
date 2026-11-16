import * as Iconsax from "iconsax-reactjs";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Iconsax only (DS sheet 05). `name` is the icon name used in the FigCraft file (Icon/Linear/<name>),
 * which follows the Iconify set. It differs from the iconsax-reactjs export in a few places — mapped here,
 * verified against the file's components:
 *   arrow-left-1 / arrow-right-1 / arrow-up-1 / arrow-down  → chevrons (ArrowLeft2 / ArrowRight2 / ArrowUp2 / ArrowDown2)
 *   arrow-left / arrow-right                                 → straight arrows
 *   menu → HamburgerMenu · menu-1 (2×2 circle grid) → Menu · note-2 → Notepad2
 * Add icons to ICONS as screens need them.
 */
const ICONS = {
  activity: Iconsax.Activity,
  add: Iconsax.Add,
  "arrow-down": Iconsax.ArrowDown2,
  "arrow-up-1": Iconsax.ArrowUp2,
  "arrow-left": Iconsax.ArrowLeft,
  "arrow-right": Iconsax.ArrowRight,
  "arrow-left-1": Iconsax.ArrowLeft2,
  "arrow-right-1": Iconsax.ArrowRight2,
  briefcase: Iconsax.Briefcase,
  "building-4": Iconsax.Building4,
  "buildings-2": Iconsax.Buildings2,
  "calendar-2": Iconsax.Calendar2,
  "calendar-add": Iconsax.CalendarAdd,
  "calendar-tick": Iconsax.CalendarTick,
  call: Iconsax.Call,
  category: Iconsax.Category,
  "chart-2": Iconsax.Chart2,
  "clipboard-text": Iconsax.ClipboardText,
  clock: Iconsax.Clock,
  "close-circle": Iconsax.CloseCircle,
  danger: Iconsax.Danger,
  "document-download": Iconsax.DocumentDownload,
  "document-text": Iconsax.DocumentText,
  "document-upload": Iconsax.DocumentUpload,
  drop: Iconsax.Drop,
  "edit-2": Iconsax.Edit2,
  "element-plus": Iconsax.ElementPlus,
  export: Iconsax.Export,
  eye: Iconsax.Eye,
  "eye-slash": Iconsax.EyeSlash,
  filter: Iconsax.Filter,
  gallery: Iconsax.Gallery,
  glass: Iconsax.Glass,
  global: Iconsax.Global,
  health: Iconsax.Health,
  heart: Iconsax.Heart,
  "home-2": Iconsax.Home2,
  hospital: Iconsax.Hospital,
  import: Iconsax.Import,
  "info-circle": Iconsax.InfoCircle,
  "language-square": Iconsax.LanguageSquare,
  location: Iconsax.Location,
  lock: Iconsax.Lock,
  logout: Iconsax.Logout,
  menu: Iconsax.HamburgerMenu,
  "menu-1": Iconsax.Menu,
  message: Iconsax.Message,
  minus: Iconsax.Minus,
  moon: Iconsax.Moon,
  more: Iconsax.More,
  "note-2": Iconsax.Notepad2,
  notification: Iconsax.Notification,
  people: Iconsax.People,
  personalcard: Iconsax.Personalcard,
  printer: Iconsax.Printer,
  "profile-2user": Iconsax.Profile2User,
  "profile-circle": Iconsax.ProfileCircle,
  "receipt-2": Iconsax.Receipt2,
  refresh: Iconsax.Refresh,
  "search-normal-1": Iconsax.SearchNormal1,
  "setting-2": Iconsax.Setting2,
  "shield-tick": Iconsax.ShieldTick,
  "sidebar-left": Iconsax.SidebarLeft,
  "sidebar-right": Iconsax.SidebarRight,
  sms: Iconsax.Sms,
  sort: Iconsax.Sort,
  "star-1": Iconsax.Star1,
  "sun-1": Iconsax.Sun1,
  "tick-circle": Iconsax.TickCircle,
  "tick-square": Iconsax.TickSquare,
  trash: Iconsax.Trash,
  "trend-down": Iconsax.TrendDown,
  "trend-up": Iconsax.TrendUp,
  user: Iconsax.User,
  "user-add": Iconsax.UserAdd,
  video: Iconsax.Video,
  "wallet-money": Iconsax.WalletMoney,
  "warning-2": Iconsax.Warning2,
} as const;

export type IconName = keyof typeof ICONS;
export const ICON_NAMES = Object.keys(ICONS) as IconName[];

/** Directional icons mirror in RTL (sheet 05 · "Directional · mirror in RTL"). */
const DIRECTIONAL = new Set<IconName>([
  "arrow-left",
  "arrow-right",
  "arrow-left-1",
  "arrow-right-1",
  "sidebar-left",
  "sidebar-right",
]);

type IconProps = Omit<ComponentProps<"svg">, "ref"> & {
  name: IconName;
  /** Linear by default; Bold only for active / selected states. */
  variant?: "linear" | "bold";
  /** 16 (badges, inputs, dense tables) · 20 (buttons, nav, cards) · 24 (headers, empty states) */
  size?: 16 | 20 | 24 | number;
  /** Set false to keep a directional icon un-mirrored. */
  mirror?: boolean;
  /** Accessible label; omit for decorative icons. */
  label?: string;
};

export function Icon({ name, variant = "linear", size = 20, mirror = true, label, className, ...rest }: IconProps) {
  const Cmp = ICONS[name];
  return (
    <Cmp
      variant={variant === "bold" ? "Bold" : "Linear"}
      size={size}
      color="currentColor"
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
      focusable={false}
      className={cn("shrink-0", mirror && DIRECTIONAL.has(name) && "rtl:-scale-x-100", className)}
      {...rest}
    />
  );
}
