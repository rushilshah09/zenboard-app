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
// 2. One weight, TWO cuts. Nav rows render `weight="regular"` (outline,
//    strokeWidth 1.75) — and the SELECTED row renders `weight="fill"`, the
//    filled cut of the same glyph.
//
//    REVISED 2026-09-07 (user directive). This rule used to read "`fill` is only
//    for tiny active-state affordances, never for a nav-row glyph", and the
//    consequence was that a selected nav row carried its state entirely in the
//    wash behind it: correct up close, invisible at a glance, because an outline
//    glyph has identical ink mass selected or not. Filling it changes the
//    glyph's weight, not its shape or its family, which is precisely what
//    Phosphor's weights are for. The rule is enforced in ONE place —
//    `navWeight()` in components/shell/app-shell.tsx — so every sidebar row,
//    project row and mobile tab answers it the same way. Do not re-derive it.
// 3. One metaphor per concept (glossary): Draft=FileText · All=Cards ·
//    Shared=ShareNetwork · Templates=Layout · a doc=FileText · a folder=Folder.
//    Reuse the concept's glyph everywhere it appears (rail + type icon + menu).
//
// 2026-08-01: **Phosphor is the ONE icon family** (user directive). The seam used
// to be a hybrid — Phosphor for the screens that had taken the Figma pass, Tabler
// for the rest — which meant two drawing styles could meet inside a single row.
// The remaining ~160 Tabler glyphs were re-pointed at their Phosphor equivalents
// in one pass, so every glyph in the app now comes from the same family.
//
// To add an icon: `export const Name = glyph("<PhosphorName>");`, then run
// `node scripts/gen-icon-glyphs.mjs` to add its paths to the table. Never import an icon
// library directly in a component — this file is the only place that may.
// ─────────────────────────────────────────────────────────────────────────────
import * as React from "react";
import { GLYPHS, type GlyphPart } from "./icon-glyphs.generated";

// ── HOW A GLYPH IS DRAWN ─────────────────────────────────────────────────────
// Phosphor is still the one family; what changed (2026-09-11) is that its
// COMPONENTS no longer ship. Each Phosphor component carries its paths in six
// weights, and this seam only ever draws two — `regular`, and `fill` when the
// DS <Icon> asks for weight="fill" (its "bold" is a stroke width, which
// Phosphor's filled paths ignore). Four dead weights × ~380 glyphs were two
// thirds of the largest chunk in a worker that had reached 3,006 of
// Cloudflare's 3,072 KiB ceiling, and of every page's client JavaScript.
//
// So `scripts/gen-icon-glyphs.mjs` reads Phosphor's own definitions and writes
// just those two weights to `icon-glyphs.generated.ts`, and `glyph()` draws
// them with the SAME markup Phosphor's IconBase produces — same attributes,
// same order, same defaults. `icon-glyphs.test.ts` renders every glyph both
// ways and requires them to be identical, so nothing on screen moved.
//
// The one-file-swap property holds: this module and its generator are still the
// only places that know which icon package the app uses.
type AdapterProps = {
  size?: number | string;
  strokeWidth?: number | string;
  fill?: string;
  className?: string;
  style?: React.CSSProperties;
} & Omit<React.SVGProps<SVGSVGElement>, "fill" | "ref">;

const SVG_NS = "http://www.w3.org/2000/svg";
const draw = (parts: readonly GlyphPart[]) => parts.map(([tag, attrs]) => React.createElement(tag, attrs));

/**
 * One glyph, by its Phosphor name. The DS <Icon> passes `fill="none"` and a
 * `strokeWidth` for every glyph; neither may reach this <svg> (a filled path
 * with fill="none" is blank), and fill="currentColor" selects the fill weight.
 * A picker-only glyph has no fill weight in the table and draws regular.
 */
function glyph(name: string) {
  const def = GLYPHS[name];
  if (!def) throw new Error(`Icon glyph "${name}" is not in the generated table — run: node scripts/gen-icon-glyphs.mjs`);
  const Glyph = React.forwardRef<SVGSVGElement, AdapterProps>(function Glyph(
    // `strokeWidth` is named only to keep it OUT of `rest` — see above.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    { strokeWidth: _strokeWidth, fill, size, color, ...rest },
    ref,
  ) {
    return React.createElement("svg", {
      ref,
      xmlns: SVG_NS,
      width: size ?? "1em",
      height: size ?? "1em",
      fill: color ?? "currentColor",
      viewBox: "0 0 256 256",
      ...rest,
    }, ...draw(fill === "currentColor" && def.f ? def.f : def.r));
  });
  Glyph.displayName = `${name}Glyph`;
  return Glyph;
}

// ── ZENBOARD'S OWN GLYPH ────────────────────────────────────────────────────
//
// Identity move 2 (IDENTITY_BRIEF.md, 2026-09-25). The one icon in this seam that is not
// Phosphor's: the Zenboard mark, drawn at icon size, meaning "your one thing today" — the
// highlight. Linear owns its status glyphs; this is Zenboard's. It also UNTANGLES a glyph that
// meant three things: the star stood for the highlight, a pinned memory AND a favourite doc. The
// highlight now has its own mark; pins and favourites keep the star.
//
// It speaks the seam's two-weight grammar exactly: `fill="currentColor"` (what <Icon weight="fill">
// passes) draws the solid mark — highlighted; anything else draws its outline — not highlighted.
// The geometry lives HERE, once: the logo's <Mark> (components/ds/ui/icon.tsx) reads this path too,
// so the glyph and the logo cannot drift.

/** The Zenboard mark's geometry, in a 20×20 box. The ONE copy — the logo reads it from here. */
export const MARK_PATH = "M18.4226 8.14215L18.6403 7.92451C20.4532 6.11147 20.4532 3.1733 18.6403 1.36026L18.6383 1.35832C16.8254 -0.452773 13.8873 -0.452773 12.0763 1.35832L11.8567 1.57791C10.8326 2.60199 9.16736 2.60199 8.14137 1.57791L7.92373 1.36026C6.11076 -0.452773 3.1727 -0.452773 1.35973 1.36026C-0.453243 3.1733 -0.453243 6.11147 1.35973 7.92451L1.57736 8.14215C2.60141 9.16818 2.60141 10.8335 1.57736 11.8576L1.35973 12.0753C-0.453243 13.8883 -0.453243 16.8265 1.35973 18.6395C3.1727 20.4525 6.11076 20.4545 7.92373 18.6395L8.14137 18.4219C9.16736 17.3958 10.8326 17.3958 11.8567 18.4219L12.0743 18.6395C13.8873 20.4525 16.8254 20.4525 18.6383 18.6395H18.6403V18.6376C20.4532 16.8245 20.4532 13.8863 18.6403 12.0733L18.4226 11.8557C17.3966 10.8316 17.3966 9.16623 18.4226 8.1402V8.14215ZM4.85936 15.1397C7.69832 12.3007 7.69832 7.69909 4.85936 4.86003C7.69832 7.69909 12.3017 7.69909 15.1406 4.86003C12.3017 7.69909 12.3017 12.3007 15.1406 15.1397C12.3017 12.3007 7.69832 12.3007 4.85936 15.1397Z";

export const Highlight = React.forwardRef<SVGSVGElement, AdapterProps>(function Highlight(
  // `strokeWidth` is named only to keep it OUT of `rest`: the outline's weight is set below to
  // match Phosphor's regular stroke at icon size, whatever the caller passes.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  { strokeWidth: _strokeWidth, fill, size, color, ...rest },
  ref,
) {
  const solid = fill === "currentColor";
  return React.createElement("svg", {
    ref,
    xmlns: SVG_NS,
    width: size ?? "1em",
    height: size ?? "1em",
    // A pixel of air round the 20-unit mark, so the outline's stroke is never clipped at the edge.
    viewBox: "-1 -1 22 22",
    fill: solid ? (color ?? "currentColor") : "none",
    stroke: solid ? "none" : (color ?? "currentColor"),
    strokeWidth: solid ? undefined : 1.4,
    strokeLinejoin: "round",
    ...rest,
  }, React.createElement("path", { d: MARK_PATH }));
});
Highlight.displayName = "HighlightGlyph";

// ── Figma HIfi glyphs (Phosphor) — shell, Home, tasks, schedule ──────────────
export const House = glyph("SquaresFour");          // Home/Dashboard
export const SquarePen = glyph("CheckSquareOffset"); // Tasks
export const Calendar = glyph("CalendarBlank");
export const CalendarDays = glyph("CalendarBlank");
export const Target = glyph("Target");               // Goals
export const Flame = glyph("Fire");                  // Habits
export const Folder = glyph("FolderNotchIcon");      // Projects
export const FolderOpen = glyph("FolderNotchOpenIcon");
export const Users = glyph("Users");                 // Clients
export const Landmark = glyph("Bank");               // Finance
export const Scroll = glyph("FileText");             // Documents
export const FileText = glyph("FileText");
export const Forms = glyph("ClipboardText");         // Forms hub
export const Cards = glyph("Cards");                 // "All documents" collection (Docs rail)
export const ShareNetwork = glyph("ShareNetwork");   // Shared (Docs rail)
export const Layout = glyph("Layout");               // Templates / template doc-type
export const ChevronDown = glyph("CaretDown");
export const ChevronUp = glyph("CaretUp");
export const ChevronLeft = glyph("CaretLeft");
export const ChevronRight = glyph("CaretRight");
export const Search = glyph("MagnifyingGlass");
export const Bell = glyph("Bell");
// The portal's Updates section — something the studio SAID, as distinct from
// the Bell's "something happened to you".
export const Megaphone = glyph("Megaphone");
export const Plus = glyph("Plus");
export const X = glyph("X");
export const Moon = glyph("Moon");
export const Sun = glyph("Sun");
// "Follow the OS" in the appearance submenu. A monitor, not a gear: the choice
// is about which machine decides, so the glyph names the machine.
export const Desktop = glyph("Desktop");
// The Content inbox — the pile you dump into before deciding what it is.
export const Tray = glyph("Tray");
// The morning counterpart to Moon on Home's staged prompts (§7V) — a sun on the
// horizon reads as "start of day" where a plain Sun reads as "light/theme".
export const Sunrise = glyph("SunHorizon");
export const PanelLeft = glyph("SidebarSimple");
export const Power = glyph("Power");
export const Check = glyph("Check");
export const Play = glyph("Play");
export const Ellipsis = glyph("DotsThree");
export const MoreHorizontal = glyph("DotsThree");
export const EllipsisVertical = glyph("DotsThreeVertical");
export const Settings = glyph("GearSix");
export const UnfoldHorizontal = glyph("ArrowsOutLineHorizontal");
export const FoldHorizontal = glyph("ArrowsInLineHorizontal");
export const MousePointerClick = glyph("CursorClick");
export const List = glyph("List");
export const Inbox = glyph("Tray");
export const Keyboard = glyph("Keyboard");
export const LogOut = glyph("SignOut");
export const Star = glyph("Star");
export const Clock = glyph("Clock");
export const Flag = glyph("Flag");
export const Pencil = glyph("PencilSimple");
export const Trash = glyph("Trash");
export const Trash2 = glyph("Trash");
export const GripVertical = glyph("DotsSixVertical");

// ── Remaining glyphs — Phosphor (ONE family, per the DS icon rule) ───────────
export const Activity = glyph("Pulse");
export const AlarmClock = glyph("Alarm");
export const AlignCenter = glyph("TextAlignCenter");
export const AlignLeft = glyph("TextAlignLeft");
export const AlignRight = glyph("TextAlignRight");
export const Archive = glyph("Archive");
export const ArrowDown = glyph("ArrowDown");
export const ArrowDownRight = glyph("ArrowDownRight");
export const ArrowDownUp = glyph("ArrowsDownUp");
export const ArrowLeft = glyph("ArrowLeft");
export const ArrowLeftRight = glyph("ArrowsLeftRight");
export const ArrowRight = glyph("ArrowRight");
export const ArrowUp = glyph("ArrowUp");
export const ArrowUpDown = glyph("ArrowsDownUp");
export const ArrowUpRight = glyph("ArrowUpRight");
export const AtSign = glyph("At");
export const Atom = glyph("Atom");
export const Bike = glyph("Bicycle");
export const Bold = glyph("TextB");
export const Book = glyph("Book");
export const BookOpen = glyph("BookOpen");
export const Bookmark = glyph("BookmarkSimple");
export const Brain = glyph("Brain");
export const Briefcase = glyph("Briefcase");
export const Building2 = glyph("Buildings");
export const CalendarCheck = glyph("CalendarCheck");
export const Camera = glyph("Camera");
export const Car = glyph("Car");
export const CaseSensitive = glyph("TextAa");
export const ChartBar = glyph("ChartBar");
export const ChartBarHorizontal = glyph("ChartBarHorizontal"); // the Timeline layout: bars across time
export const ChartPie = glyph("ChartPie");
export const CheckCircle = glyph("CheckCircle");
export const Circle = glyph("Circle");
export const CircleAlert = glyph("WarningCircle");
export const CircleCheck = glyph("CheckCircle");
export const CircleChevronDown = glyph("CaretCircleDown");
export const CircleDashed = glyph("CircleDashed");
export const CircleUser = glyph("UserCircle");
export const ClipboardList = glyph("ClipboardText");
export const Cloud = glyph("Cloud");
export const CloudOff = glyph("CloudSlash");
export const CloudSun = glyph("CloudSun");
export const Code = glyph("Code");
export const Code2 = glyph("CodeSimple");
export const CodeXml = glyph("CodeBlock");
export const Coffee = glyph("Coffee");
export const Component = glyph("PuzzlePiece");
export const Contrast = glyph("CircleHalf");
export const Copy = glyph("Copy");
export const CornerDownLeft = glyph("ArrowElbowDownLeft");
export const CornerUpRight = glyph("ArrowElbowUpRight");
export const CreditCard = glyph("CreditCard");
export const Cross = glyph("Plus");
export const Database = glyph("Database");
export const Download = glyph("DownloadSimple");
export const Printer = glyph("Printer");
export const CursorClick = glyph("CursorClick");
export const Question = glyph("Question");
export const Dumbbell = glyph("Barbell");
export const ExternalLink = glyph("ArrowSquareOut");
export const Eye = glyph("Eye");
export const EyeOff = glyph("EyeSlash");
export const File = glyph("File");
export const Files = glyph("Files");
export const Filter = glyph("FunnelSimple");
export const Fingerprint = glyph("Fingerprint");
export const FlaskConical = glyph("Flask");
export const Flower = glyph("Flower");
export const Flower2 = glyph("FlowerLotus");
export const Gamepad2 = glyph("GameController");
export const Gift = glyph("Gift");
export const GitBranch = glyph("GitBranch");
export const Globe = glyph("Globe");
export const GraduationCap = glyph("GraduationCap");
export const Grid2x2 = glyph("GridFour");
export const Group = glyph("Stack");
export const Hash = glyph("Hash");
export const Heading1 = glyph("TextHOne");
export const Heading2 = glyph("TextHTwo");
export const Heading3 = glyph("TextHThree");
export const Heart = glyph("Heart");
export const History = glyph("ClockCounterClockwise");
export const Image = glyph("Image");
/** A database's Collection layout — pictures of different sizes, overlapping. */
export const Images = glyph("Images");
export const Info = glyph("Info");
export const Italic = glyph("TextItalic");
export const Kanban = glyph("Kanban");
export const Key = glyph("Key");
export const Layers = glyph("Stack");
export const LayoutGrid = glyph("SquaresFour");
export const LayoutTemplate = glyph("Layout");
export const Leaf = glyph("Leaf");
export const Lightbulb = glyph("Lightbulb");
export const Link = glyph("Link");
export const Link2 = glyph("LinkSimple");
export const ListChecks = glyph("ListChecks");
export const ListFilter = glyph("FunnelSimple");
export const ListOrdered = glyph("ListNumbers");
export const Loader2 = glyph("CircleNotch");
export const Lock = glyph("Lock");
export const Mail = glyph("Envelope");
export const MapPin = glyph("MapPin");
export const Maximize2 = glyph("ArrowsOut");
export const Medal = glyph("Medal");
export const MessageCircle = glyph("ChatCircle");
export const MessageSquare = glyph("Chat");
export const MessageSquareWarning = glyph("ChatCenteredDots");
export const Minus = glyph("Minus");
export const Monitor = glyph("Monitor");
export const Mountain = glyph("Mountains");
export const Move = glyph("ArrowsOutCardinal");
/** A Collection's canvas: a frame with handles, where things are arranged by hand. */
export const BoundingBox = glyph("BoundingBox");
/** Fit the canvas to what is on it. */
export const FrameCorners = glyph("FrameCorners");
export const MoveHorizontal = glyph("ArrowsHorizontal");
export const Music = glyph("MusicNote");
export const Notebook = glyph("Notebook");
export const OctagonAlert = glyph("WarningOctagon");
export const Orbit = glyph("Planet");
export const Paintbrush = glyph("PaintBrush");
export const Palette = glyph("Palette");
export const PanelLeftClose = glyph("SidebarSimple");
export const PanelLeftOpen = glyph("Sidebar");
export const ModeSidePeek = glyph("SidebarSimple");
export const ModeCenterPeek = glyph("AppWindow");
export const ModeFullPage = glyph("CornersOut");
export const PanelsTopLeft = glyph("Layout");
export const Paperclip = glyph("Paperclip");
export const Pause = glyph("Pause");
export const PenTool = glyph("PenNib");
export const PencilRuler = glyph("Ruler");
export const Phone = glyph("Phone");
export const Pipette = glyph("Eyedropper");
export const Plane = glyph("AirplaneTilt");
export const Plug = glyph("Plug");
export const Quote = glyph("Quotes");
export const Receipt = glyph("Receipt");
export const RefreshCw = glyph("ArrowsClockwise");
export const Repeat = glyph("Repeat");
export const Rocket = glyph("Rocket");
export const RotateCcw = glyph("ArrowCounterClockwise");
export const Rows3 = glyph("Rows");
export const Send = glyph("PaperPlaneTilt");
export const Share2 = glyph("ShareNetwork");
export const Shield = glyph("Shield");
export const ShoppingCart = glyph("ShoppingCart");
export const Shuffle = glyph("Shuffle");
export const SlidersHorizontal = glyph("SlidersHorizontal");
export const Smile = glyph("Smiley");
export const Sparkles = glyph("Sparkle");
export const Square = glyph("Square");
export const SquareCheck = glyph("CheckSquare");
export const SquareCheckBig = glyph("CheckSquare");
export const SquareFunction = glyph("MathOperations");
export const SquarePlus = glyph("PlusSquare");
export const StickyNote = glyph("Note");
export const Strikethrough = glyph("TextStrikethrough");
export const Table = glyph("Table");
export const Table2 = glyph("Table");
export const Tag = glyph("Tag");
export const Terminal = glyph("Terminal");
export const TextCursorInput = glyph("CursorText");
export const Timer = glyph("Timer");
export const SkipForward = glyph("SkipForward");
export const Minimize2 = glyph("ArrowsIn");
export const VolumeX = glyph("SpeakerX");
export const Trees = glyph("Tree");
export const TriangleAlert = glyph("Warning");
export const Trophy = glyph("Trophy");
export const Type = glyph("TextT");
export const Umbrella = glyph("Umbrella");
export const Underline = glyph("TextUnderline");
export const Undo2 = glyph("ArrowUUpLeft");
export const Unlink = glyph("LinkBreak");
export const Upload = glyph("UploadSimple");
export const UploadCloud = glyph("CloudArrowUp");
export const User = glyph("User");
export const Utensils = glyph("ForkKnife");
export const Video = glyph("VideoCamera");
export const Volume2 = glyph("SpeakerHigh");
export const Wallet = glyph("Wallet");
export const Waves = glyph("Waves");
export const WrapText = glyph("TextAlignJustify");
export const Wrench = glyph("Wrench");

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

// ── PLATFORM MARKS ───────────────────────────────────────────────────────────
// The logos of the places creators publish to and save from, drawn in the ONE
// family (Phosphor's own brand glyphs) and in ink — so a link from YouTube reads
// as YouTube in a black-and-white interface, the way Eden draws them, rather than
// as whatever favicon a site happens to serve. `lib/platforms.ts` decides which
// platform a link or channel is; the DS `LinkMark` / `ChannelMark` draw it.
// (Vimeo is recognised there but has no glyph here, so it keeps its favicon.)
export const YoutubeLogo = glyph("YoutubeLogo");
export const XLogo = glyph("XLogo");
export const InstagramLogo = glyph("InstagramLogo");
export const TiktokLogo = glyph("TiktokLogo");
export const LinkedinLogo = glyph("LinkedinLogo");
export const ThreadsLogo = glyph("ThreadsLogo");
export const FacebookLogo = glyph("FacebookLogo");
export const PinterestLogo = glyph("PinterestLogo");
export const BehanceLogo = glyph("BehanceLogo");
export const DribbbleLogo = glyph("DribbbleLogo");
export const SpotifyLogo = glyph("SpotifyLogo");
export const TwitchLogo = glyph("TwitchLogo");
export const RedditLogo = glyph("RedditLogo");
export const MediumLogo = glyph("MediumLogo");
export const FigmaLogo = glyph("FigmaLogo");
export const GithubLogo = glyph("GithubLogo");

// ── THE PICKER CATALOGUE ─────────────────────────────────────────────────────
// Every glyph a person may choose FOR A RECORD — a project, a page, a list.
//
// It lives here, and not in the picker, because of the rule at the top of this
// file: this module is the only one allowed to import an icon package. A
// picker that reached for Phosphor directly would be the second importer, and
// the one-file-swap property would be gone.
//
// It is a CATALOGUE rather than 260 named exports because nothing imports these
// by name — they are looked up by a stored string (`ph:Rocket`). Exporting each
// one individually would add 169 symbols no call site references, which reads
// as an API and is really a data table.
//
// WHAT IS IN IT, and what is deliberately not: objects, places, creatures,
// tools, subjects — things a piece of work can be ABOUT. No chevrons, arrows,
// spinners or carets. The app has 229 named exports above for interface
// chrome; a project called "↓" is not a project anyone meant to create, and
// letting UI glyphs into the picker is how an icon set stops meaning anything.
//
// Keys are the Phosphor name and are STORED (`projects.icon`, page icons), so
// they must stay stable. Renaming one orphans every row that chose it.
export const PICKER_ICONS: Record<string, IconType> = {
  Airplane: glyph("Airplane"), Alarm: AlarmClock, Alien: glyph("Alien"), Anchor: glyph("Anchor"),
  Aperture: glyph("Aperture"), Archive, Armchair: glyph("Armchair"), Article: glyph("Article"),
  At: AtSign, Atom, Avocado: glyph("Avocado"), Balloon: glyph("Balloon"),
  Bandaids: glyph("Bandaids"), Bank: Landmark, Barbell: Dumbbell, Barcode: glyph("Barcode"),
  Baseball: glyph("Baseball"), Basket: glyph("Basket"), Basketball: glyph("Basketball"), Bathtub: glyph("Bathtub"),
  BatteryFull: glyph("BatteryFull"), BeachBall: glyph("BeachBall"), Bed: glyph("Bed"), BeerStein: glyph("BeerStein"),
  Bell, Bicycle: Bike, Binoculars: glyph("Binoculars"), Bird: glyph("Bird"),
  Boat: glyph("Boat"), BookOpen, Bookmark: glyph("Bookmark"), Books: glyph("Books"),
  BowlFood: glyph("BowlFood"), Brain, Bread: glyph("Bread"), Briefcase,
  Broadcast: glyph("Broadcast"), Broom: glyph("Broom"), Browser: glyph("Browser"), Bug: glyph("Bug"),
  Buildings: Building2, Butterfly: glyph("Butterfly"), Cactus: glyph("Cactus"), Cake: glyph("Cake"),
  Calendar: glyph("Calendar"), CalendarCheck, Camera, Campfire: glyph("Campfire"),
  Car, Cards, Carrot: glyph("Carrot"), Cat: glyph("Cat"),
  Certificate: glyph("Certificate"), ChartBar, ChartLine: glyph("ChartLine"), ChartPie,
  Chat: MessageSquare, Chats: glyph("Chats"), Checks: glyph("Checks"), Cherries: glyph("Cherries"),
  Circle, Circuitry: glyph("Circuitry"), Clipboard: glyph("Clipboard"), Clock,
  Cloud, CloudRain: glyph("CloudRain"), Code, Coffee,
  Coins: glyph("Coins"), Compass: glyph("Compass"), Confetti: glyph("Confetti"), Cookie: glyph("Cookie"),
  Cpu: glyph("Cpu"), CreditCard, Crosshair: glyph("Crosshair"), Crown: glyph("Crown"),
  Cube: glyph("Cube"), Database, Desktop, DeviceMobile: glyph("DeviceMobile"),
  Devices: glyph("Devices"), Diamond: glyph("Diamond"), Dna: glyph("Dna"), Dog: glyph("Dog"),
  Door: glyph("Door"), Drop: glyph("Drop"), Egg: glyph("Egg"), Envelope: Mail,
  Eye, Factory: glyph("Factory"), File, FilmReel: glyph("FilmReel"),
  FilmSlate: glyph("FilmSlate"), Fingerprint, Fire: Flame, FirstAid: glyph("FirstAid"),
  Fish: glyph("Fish"), Flag, Flask: FlaskConical, Flower,
  Folder: glyph("Folder"), Football: glyph("Football"), ForkKnife: Utensils, Gavel: glyph("Gavel"),
  Gear: glyph("Gear"), Ghost: glyph("Ghost"), Gift, GitBranch,
  Globe, Graph: glyph("Graph"), Guitar: glyph("Guitar"), Hamburger: glyph("Hamburger"),
  Hammer: glyph("Hammer"), Handshake: glyph("Handshake"), HardDrives: glyph("HardDrives"), Hash,
  Headphones: glyph("Headphones"), Heart, Heartbeat: glyph("Heartbeat"), Hexagon: glyph("Hexagon"),
  Hourglass: glyph("Hourglass"), House: glyph("House"), IceCream: glyph("IceCream"), Image,
  Images: glyph("Images"), Infinity: glyph("Infinity"), Invoice: glyph("Invoice"), Island: glyph("Island"),
  Kanban, Key, Ladder: glyph("Ladder"), Lamp: glyph("Lamp"),
  Laptop: glyph("Laptop"), Layout: PanelsTopLeft, Leaf, Lifebuoy: glyph("Lifebuoy"),
  Lightbulb, Lightning: glyph("Lightning"), Link, ListChecks,
  Lock, LockOpen: glyph("LockOpen"), MagicWand: glyph("MagicWand"), MapPin,
  MapTrifold: glyph("MapTrifold"), Martini: glyph("Martini"), Medal, Megaphone,
  Microphone: glyph("Microphone"), MicrophoneStage: glyph("MicrophoneStage"), Microscope: glyph("Microscope"), Money: glyph("Money"),
  Moon, Motorcycle: glyph("Motorcycle"), Mountains: Mountain, MusicNote: Music,
  MusicNotes: glyph("MusicNotes"), Needle: glyph("Needle"), Newspaper: glyph("Newspaper"), Note: StickyNote,
  NotePencil: glyph("NotePencil"), Notebook, Nut: glyph("Nut"), Orange: glyph("Orange"),
  Package: glyph("Package"), PaintBrush: Paintbrush, PaintBucket: glyph("PaintBucket"), PaintRoller: glyph("PaintRoller"),
  Palette, PaperPlane: glyph("PaperPlane"), Path: glyph("Path"), PawPrint: glyph("PawPrint"),
  PenNib: PenTool, Pencil: glyph("Pencil"), Person: glyph("Person"), PersonSimpleRun: glyph("PersonSimpleRun"),
  PersonSimpleSwim: glyph("PersonSimpleSwim"), Phone, PianoKeys: glyph("PianoKeys"), PiggyBank: glyph("PiggyBank"),
  Pill: glyph("Pill"), Pizza: glyph("Pizza"), Planet: Orbit, Plant: glyph("Plant"),
  Playlist: glyph("Playlist"), Plug, Presentation: glyph("Presentation"), Pulse: Activity,
  Radio: glyph("Radio"), Rainbow: glyph("Rainbow"), Receipt, Robot: glyph("Robot"),
  Rocket, Rows: Rows3, Ruler: PencilRuler, Sailboat: glyph("Sailboat"),
  Scales: glyph("Scales"), Scissors: glyph("Scissors"), Screwdriver: glyph("Screwdriver"), Scroll: glyph("Scroll"),
  Seal: glyph("Seal"), Shapes: glyph("Shapes"), Share: glyph("Share"), ShareNetwork: Share2,
  Shield, ShieldCheck: glyph("ShieldCheck"), ShoppingBag: glyph("ShoppingBag"), ShoppingCart,
  Skull: glyph("Skull"), Smiley: Smile, Snowflake: glyph("Snowflake"), SoccerBall: glyph("SoccerBall"),
  Sparkle: Sparkles, SpeakerHigh: Volume2, Sphere: glyph("Sphere"), Spiral: glyph("Spiral"),
  Square, Stairs: glyph("Stairs"), Stamp: glyph("Stamp"), Star,
  Stethoscope: glyph("Stethoscope"), Sticker: glyph("Sticker"), Storefront: glyph("Storefront"), Suitcase: glyph("Suitcase"),
  Sun, Swatches: glyph("Swatches"), Sword: glyph("Sword"), Tag,
  Target, Television: glyph("Television"), TennisBall: glyph("TennisBall"), Tent: glyph("Tent"),
  Terminal, TestTube: glyph("TestTube"), ThumbsUp: glyph("ThumbsUp"), Ticket: glyph("Ticket"),
  Timer, Toolbox: glyph("Toolbox"), Tooth: glyph("Tooth"), Train: glyph("Train"),
  Tray: Inbox, Tree: Trees, TreeStructure: glyph("TreeStructure"), TrendUp: glyph("TrendUp"),
  Triangle: glyph("Triangle"), Trophy, Truck: glyph("Truck"), User,
  UserCircle: CircleUser, Users, UsersThree: glyph("UsersThree"), Video: glyph("Video"),
  VinylRecord: glyph("VinylRecord"), Wallet, Warehouse: glyph("Warehouse"), Watch: glyph("Watch"),
  Waves, Wind: glyph("Wind"), Wine: glyph("Wine"), Wrench,
};

/** Sorted keys, for a grid that must not reorder between renders. */
export const PICKER_ICON_NAMES: readonly string[] = Object.keys(PICKER_ICONS).sort();
