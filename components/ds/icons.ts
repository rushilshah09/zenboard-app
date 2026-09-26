// ─────────────────────────────────────────────────────────────────────────────
// THE ICON SEAM — the single place the whole app imports icon glyphs from.
//
// App code MUST import icons from here, never directly from an icon package.
// Routing every call site through this one module makes switching the underlying
// icon library a ONE-FILE change.
//
// ── NAV / RAIL ICON RULE (enforced) ──────────────────────────────────────────
// 1. One family. Sidebar & sub-nav (rail) icons come from the SAME set the
//    primary shell uses — the Phosphor exports below (House, Folder, Users,
//    Scroll…). Never mix a Tabler bulk-export glyph into a nav row next to them.
// 2. One weight. Nav rows render `weight="regular"` (outline, strokeWidth 1.75),
//    exactly like the shell (<Icon size={16|18} weight="regular">). `weight="fill"`
//    is ONLY for tiny active-state affordances, never for a nav-row glyph.
// 3. One metaphor per concept (glossary): Draft=FileText · All=Cards ·
//    Shared=ShareNetwork · Templates=Layout · a doc=FileText · a folder=Folder.
//    Reuse the concept's glyph everywhere it appears (rail + type icon + menu).
//
// 2026-07-16: the Figma HIfi design draws its glyphs from Phosphor, so the names
// the shell/Home screens use are re-pointed at @phosphor-icons/react below
// (House → SquaresFour, Calendar → CalendarBlank, ChevronDown → CaretDown, …).
// Everything else stays on @tabler/icons-react until its screen gets the
// pixel-perfect pass. Both sets are thin-line at 16–18px, so the transition
// state stays coherent.
//
// To re-point an icon at the design set: add `export const Name = phosphor(Ph.Glyph);`
// and REMOVE the Tabler line of the same name (duplicate exports won't compile).
// ─────────────────────────────────────────────────────────────────────────────
import * as React from "react";
import * as Ph from "@phosphor-icons/react";

// Adapt a Phosphor glyph to the Tabler-shaped API the app's call sites use.
// Phosphor icons are FILLED paths: the DS <Icon> wrapper's `fill="none"` +
// `strokeWidth` must not reach the <svg> (they'd blank the glyph), and the
// wrapper's weight="fill" shim (fill="currentColor") maps to Phosphor's
// weight="fill".
type AdapterProps = {
  size?: number | string;
  strokeWidth?: number | string;
  fill?: string;
  className?: string;
  style?: React.CSSProperties;
} & Omit<React.SVGProps<SVGSVGElement>, "fill" | "ref">;

function phosphor(G: Ph.Icon) {
  return React.forwardRef<SVGSVGElement, AdapterProps>(function PhosphorAdapter(
    { strokeWidth: _strokeWidth, fill, ...rest },
    ref,
  ) {
    return React.createElement(G, {
      ref,
      weight: fill === "currentColor" ? "fill" : "regular",
      ...rest,
    });
  });
}

// ── Figma HIfi glyphs (Phosphor) — shell, Home, tasks, schedule ──────────────
export const House = phosphor(Ph.SquaresFour);          // Home/Dashboard
export const SquarePen = phosphor(Ph.CheckSquareOffset); // Tasks
export const Calendar = phosphor(Ph.CalendarBlank);
export const CalendarDays = phosphor(Ph.CalendarBlank);
export const Target = phosphor(Ph.Target);               // Goals
export const Flame = phosphor(Ph.Fire);                  // Habits
export const Folder = phosphor(Ph.FolderNotchIcon);      // Projects
export const FolderOpen = phosphor(Ph.FolderNotchOpenIcon);
export const Users = phosphor(Ph.Users);                 // Clients
export const Landmark = phosphor(Ph.Bank);               // Finance
export const Scroll = phosphor(Ph.FileText);             // Documents
export const FileText = phosphor(Ph.FileText);
export const Forms = phosphor(Ph.ClipboardText);         // Forms hub
export const Cards = phosphor(Ph.Cards);                 // "All documents" collection (Docs rail)
export const ShareNetwork = phosphor(Ph.ShareNetwork);   // Shared (Docs rail)
export const Layout = phosphor(Ph.Layout);               // Templates / template doc-type
export const ChevronDown = phosphor(Ph.CaretDown);
export const ChevronUp = phosphor(Ph.CaretUp);
export const ChevronLeft = phosphor(Ph.CaretLeft);
export const ChevronRight = phosphor(Ph.CaretRight);
export const Search = phosphor(Ph.MagnifyingGlass);
export const Bell = phosphor(Ph.Bell);
export const Plus = phosphor(Ph.Plus);
export const X = phosphor(Ph.X);
export const Moon = phosphor(Ph.Moon);
export const Sun = phosphor(Ph.Sun);
export const PanelLeft = phosphor(Ph.SidebarSimple);
export const Power = phosphor(Ph.Power);
export const Check = phosphor(Ph.Check);
export const Play = phosphor(Ph.Play);
export const Ellipsis = phosphor(Ph.DotsThree);
export const MoreHorizontal = phosphor(Ph.DotsThree);
export const EllipsisVertical = phosphor(Ph.DotsThreeVertical);
export const Settings = phosphor(Ph.GearSix);
export const UnfoldHorizontal = phosphor(Ph.ArrowsOutLineHorizontal);
export const FoldHorizontal = phosphor(Ph.ArrowsInLineHorizontal);
export const MousePointerClick = phosphor(Ph.CursorClick);
export const List = phosphor(Ph.List);
export const Inbox = phosphor(Ph.Tray);
export const Keyboard = phosphor(Ph.Keyboard);
export const LogOut = phosphor(Ph.SignOut);
export const Star = phosphor(Ph.Star);
export const Clock = phosphor(Ph.Clock);
export const Flag = phosphor(Ph.Flag);
export const Pencil = phosphor(Ph.PencilSimple);
export const Trash = phosphor(Ph.Trash);
export const Trash2 = phosphor(Ph.Trash);
export const GripVertical = phosphor(Ph.DotsSixVertical);

// ── Marketing site (zenboard.app) — fixed-weight Phosphor glyphs ─────────────
// The public site's feature tiles and illustrations draw filled/bold glyphs at
// one weight, never toggled by the app's `fill` shim. Prefixed `Site` so they
// never collide with (or leak into) the app's regular-weight nav set.
function phosphorAs(G: Ph.Icon, weight: Ph.IconWeight) {
  return React.forwardRef<SVGSVGElement, AdapterProps>(function PhosphorFixed(
    { strokeWidth: _strokeWidth, fill: _fill, ...rest },
    ref,
  ) {
    return React.createElement(G, { ref, weight, ...rest });
  });
}
export const SiteLink = phosphorAs(Ph.Link, "bold");               // "One link" tile
export const SiteEye = phosphorAs(Ph.Eye, "fill");                 // visibility tile + client view
export const SiteChat = phosphorAs(Ph.ChatCircleText, "fill");     // requests tile + request chip
export const SiteSealCheck = phosphorAs(Ph.SealCheck, "fill");     // approvals tile
export const SiteReceipt = phosphorAs(Ph.Receipt, "fill");         // invoices tile
export const SiteUsersThree = phosphorAs(Ph.UsersThree, "fill");   // client portal eyebrow
export const SiteLock = phosphorAs(Ph.LockSimple, "fill");         // private / internal
export const SiteCheckCircle = phosphorAs(Ph.CheckCircle, "fill"); // done / paid / approved
export const SiteCheck = phosphorAs(Ph.Check, "bold");             // copied / approved marks
export const SiteFileText = phosphorAs(Ph.FileText, "regular");    // shared file row

// ── Remaining glyphs (Tabler) — screens not yet on the Figma pass ────────────
export {
  IconActivity as Activity,
  IconAlarm as AlarmClock,
  IconAlignCenter as AlignCenter,
  IconAlignLeft as AlignLeft,
  IconAlignRight as AlignRight,
  IconArchive as Archive,
  IconArrowDown as ArrowDown,
  IconArrowDownRight as ArrowDownRight,
  IconArrowsUpDown as ArrowDownUp,
  IconArrowLeft as ArrowLeft,
  IconArrowsHorizontal as ArrowLeftRight,
  IconArrowRight as ArrowRight,
  IconArrowUp as ArrowUp,
  IconArrowsUpDown as ArrowUpDown,
  IconArrowUpRight as ArrowUpRight,
  IconAt as AtSign,
  IconAtom as Atom,
  IconBike as Bike,
  IconBold as Bold,
  IconBook as Book,
  IconBook2 as BookOpen,
  IconBookmark as Bookmark,
  IconBrain as Brain,
  IconBriefcase as Briefcase,
  IconBuilding as Building2,
  IconCalendarCheck as CalendarCheck,
  IconCamera as Camera,
  IconCar as Car,
  IconLetterCase as CaseSensitive,
  IconChartBar as ChartBar,
  IconChartPie as ChartPie,
  IconCircleCheck as CheckCircle,
  IconCircle as Circle,
  IconAlertCircle as CircleAlert,
  IconCircleCheck as CircleCheck,
  IconCircleChevronDown as CircleChevronDown,
  IconCircleDashed as CircleDashed,
  IconUserCircle as CircleUser,
  IconClipboardList as ClipboardList,
  IconCloud as Cloud,
  IconCloudOff as CloudOff,
  IconCloud as CloudSun,
  IconCode as Code,
  IconCode as Code2,
  IconCode as CodeXml,
  IconCoffee as Coffee,
  IconComponents as Component,
  IconContrast as Contrast,
  IconCopy as Copy,
  IconCornerDownLeft as CornerDownLeft,
  IconCornerUpRight as CornerUpRight,
  IconCreditCard as CreditCard,
  IconCross as Cross,
  IconDatabase as Database,
  IconDownload as Download,
  IconBarbell as Dumbbell,
  IconExternalLink as ExternalLink,
  IconEye as Eye,
  IconEyeOff as EyeOff,
  IconFile as File,
  IconFiles as Files,
  IconFilter as Filter,
  IconFingerprint as Fingerprint,
  IconFlask as FlaskConical,
  IconFlower as Flower,
  IconFlower as Flower2,
  IconDeviceGamepad2 as Gamepad2,
  IconGift as Gift,
  IconGitBranch as GitBranch,
  IconGlobe as Globe,
  IconSchool as GraduationCap,
  IconLayoutGrid as Grid2x2,
  IconStack2 as Group,
  IconHash as Hash,
  IconH1 as Heading1,
  IconH2 as Heading2,
  IconH3 as Heading3,
  IconHeart as Heart,
  IconHistory as History,
  IconPhoto as Image,
  IconInfoCircle as Info,
  IconItalic as Italic,
  IconLayoutKanban as Kanban,
  IconKey as Key,
  IconStack2 as Layers,
  IconLayoutGrid as LayoutGrid,
  IconLayout as LayoutTemplate,
  IconLeaf as Leaf,
  IconBulb as Lightbulb,
  IconLink as Link,
  IconLink as Link2,
  IconListCheck as ListChecks,
  IconFilter as ListFilter,
  IconListNumbers as ListOrdered,
  IconLoader2 as Loader2,
  IconLock as Lock,
  IconMail as Mail,
  IconMapPin as MapPin,
  IconMaximize as Maximize2,
  IconMedal2 as Medal,
  IconMessageCircle as MessageCircle,
  IconMessage as MessageSquare,
  IconMessageExclamation as MessageSquareWarning,
  IconMinus as Minus,
  IconDeviceDesktop as Monitor,
  IconMountain as Mountain,
  IconArrowsMove as Move,
  IconArrowsHorizontal as MoveHorizontal,
  IconMusic as Music,
  IconNotebook as Notebook,
  IconAlertOctagon as OctagonAlert,
  IconGalaxy as Orbit,
  IconBrush as Paintbrush,
  IconPalette as Palette,
  IconLayoutSidebarLeftCollapse as PanelLeftClose,
  IconLayoutSidebarLeftExpand as PanelLeftOpen,
  IconLayoutDashboard as PanelsTopLeft,
  IconPaperclip as Paperclip,
  IconPlayerPause as Pause,
  IconPencil as PenTool,
  IconRulerMeasure as PencilRuler,
  IconPhone as Phone,
  IconColorPicker as Pipette,
  IconPlane as Plane,
  IconPlug as Plug,
  IconQuote as Quote,
  IconReceipt as Receipt,
  IconRefresh as RefreshCw,
  IconRepeat as Repeat,
  IconRocket as Rocket,
  IconRotate2 as RotateCcw,
  IconLayoutRows as Rows3,
  IconSend as Send,
  IconShare as Share2,
  IconShield as Shield,
  IconShoppingCart as ShoppingCart,
  IconArrowsShuffle as Shuffle,
  IconAdjustmentsHorizontal as SlidersHorizontal,
  IconMoodSmile as Smile,
  IconSparkles as Sparkles,
  IconSquareCheck as SquareCheck,
  IconSquareCheck as SquareCheckBig,
  IconMathFunction as SquareFunction,
  IconSquarePlus as SquarePlus,
  IconNote as StickyNote,
  IconStrikethrough as Strikethrough,
  IconTable as Table,
  IconTable as Table2,
  IconTag as Tag,
  IconTerminal as Terminal,
  IconCursorText as TextCursorInput,
  IconStopwatch as Timer,
  IconTrees as Trees,
  IconAlertTriangle as TriangleAlert,
  IconTrophy as Trophy,
  IconTypography as Type,
  IconUmbrella as Umbrella,
  IconUnderline as Underline,
  IconArrowBackUp as Undo2,
  IconUnlink as Unlink,
  IconUpload as Upload,
  IconCloudUpload as UploadCloud,
  IconUser as User,
  IconToolsKitchen2 as Utensils,
  IconVideo as Video,
  IconVolume as Volume2,
  IconWallet as Wallet,
  IconRipple as Waves,
  IconTextWrap as WrapText,
  IconTool as Wrench,
} from "@tabler/icons-react";

// Structural icon-component type — both Tabler and adapted Phosphor glyphs
// satisfy it, so `icon: <Component>` call sites type-check across the mix.
export type IconType = React.ComponentType<{
  size?: number | string;
  strokeWidth?: number | string;
  fill?: string;
  className?: string;
  style?: React.CSSProperties;
  "aria-hidden"?: boolean | "true" | "false";
  "aria-label"?: string;
}>;
