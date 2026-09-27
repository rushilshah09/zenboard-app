"use client";
// Zenboard product illustrations. Each scene is one moment of the product, told
// with the product's own parts (kit: ./primitives). Drawn at a fixed design size
// in its finished pose; hover replays the moment. Copy uses the shared sample
// workspace (Ridgeline rebrand · Beacon Health site · Alex, Priya).
import * as React from "react";
import { Icon } from "@/components/ds/ui/icon";
import {
  ArrowRight,
  Bell,
  Calendar,
  CalendarDays,
  Check,
  Clock,
  CornerDownLeft,
  FileText,
  Folder,
  House,
  Inbox,
  Keyboard,
  Landmark,
  List,
  Mail,
  MessageCircle,
  Paperclip,
  Pause,
  Plug,
  Plus,
  Search,
  Sparkles,
  Sun,
  Star,
  Timer,
  Upload,
  X,
} from "@/components/ds/icons";
import { At, Bar, BrandMark, Chip, Connector, Cursor, Dot, Key, Meter, Person, Ring, Scene, TaskRow, Tick, Window } from "./primitives";
import { cn } from "@/lib/cn";

// ════════════════════════════════════════════════════════════════════════════
// 01 · A request, turned into a task (hero, wide)
// ════════════════════════════════════════════════════════════════════════════
export function RequestToTaskScene() {
  return (
    <Scene width={1200} height={380} label="A client asks for social sizes of the logo in their portal; Zenboard turns the request into a task on your day.">
      {/* Client portal */}
      <At x={96} y={64} w={344}>
        <Window glass>
          <div className="flex items-center gap-3 px-5 pt-5 pb-4">
            <Person initials="PR" size={36} />
            <div className="min-w-0 flex-1">
              <div className="ill-t-h4">Ridgeline rebrand</div>
              <div className="ill-t-caption text-ill-ink-3">Priya’s portal</div>
            </div>
            <Chip tone="quiet">Client</Chip>
          </div>
          <div className="mx-5 border-t border-ill-line" />
          <div className="flex flex-col gap-3 px-5 py-4">
            <div className="flex items-center gap-2">
              <Person initials="PR" size={20} />
              <span className="ill-t-caption text-ill-ink-3">Priya · 9:12</span>
            </div>
            <div className="ill-t-small rounded-xl rounded-tl-sm bg-ill-surface-2 px-3 py-2 text-ill-ink-1" style={{ boxShadow: "inset 0 0 0 1px var(--ill-line)" }}>
              Could we get social sizes of the logo? Instagram, LinkedIn and a favicon.
            </div>
            <div className="flex items-center gap-2">
              <Chip tone="quiet" icon={<Icon icon={Paperclip} size={12} />}>logo-final.svg</Chip>
              <Chip tone="accent" icon={<Icon icon={MessageCircle} size={12} />}>Request</Chip>
            </div>
          </div>
          <div className="flex items-center gap-2 border-t border-ill-line bg-ill-surface-2 px-5 py-3">
            <span className="ill-t-caption flex-1 text-ill-ink-4">Reply to Priya…</span>
            <span className="grid size-6 place-items-center rounded-md bg-ill-solid text-ill-on-solid">
              <Icon icon={ArrowRight} size={12} />
            </span>
          </div>
        </Window>
      </At>

      {/* Flow: request → Zenboard → task */}
      <At x={456} y={190}>
        <Connector width={96} />
      </At>
      <At x={488} y={176} z={2}>
        <Chip icon={<Icon icon={MessageCircle} size={12} />}>Request</Chip>
      </At>

      <At x={536} y={110} w={128} className="flex flex-col items-center">
        <span className="relative grid size-24 place-items-center">
          <svg width="96" height="96" className="ill-anim ill-orbit absolute inset-0">
            <circle cx="48" cy="48" r="46" fill="none" stroke="var(--ill-line-strong)" strokeDasharray="2 4" />
            <circle cx="48" cy="48" r="46" fill="none" stroke="var(--ill-accent)" strokeWidth="1.5" strokeLinecap="round" pathLength={100} strokeDasharray="22 78" />
          </svg>
          <span className="grid size-16 place-items-center rounded-full bg-ill-surface shadow-ill-float">
            <BrandMark size={28} />
          </span>
        </span>
        <span className="ill-t-h4 mt-4">Zenboard</span>
      </At>

      <At x={648} y={190}>
        <Connector width={104} delay={1.2} />
      </At>
      <At x={660} y={176} z={2}>
        <Chip icon={<Tick done size={12} />}>New task</Chip>
      </At>

      {/* Your day */}
      <At x={768} y={52} w={344}>
        <Window glass>
          <div className="flex items-center gap-2 px-5 pt-5 pb-3">
            <BrandMark size={18} />
            <span className="ill-t-h4 flex-1">Your day</span>
            <span className="ill-t-caption text-ill-ink-3">Thursday</span>
          </div>
          <div className="mx-5 mb-2 flex items-center gap-2">
            <Meter value={0.25} w={120} />
            <span className="ill-t-micro text-ill-ink-3">1 of 4 done</span>
          </div>
          <TaskRow title="Logo presentation" meta="Fri" />
          <div className="ill-anim ill-arrive relative">
            <TaskRow title="Social sizes of the logo" className="bg-ill-accent-soft">
              <Chip tone="accent" className="!py-0.5">
                <Person initials="PR" size={14} /> From Priya
              </Chip>
            </TaskRow>
            <span className="absolute inset-y-0 left-0 w-0.5 bg-ill-accent" />
          </div>
          <TaskRow title="Type and color system" meta="Ridgeline" />
          <TaskRow title="Weekly review" meta="9:40" done />
        </Window>
      </At>
      <Cursor name="You" style={{ left: 1098, top: 200 }} />
    </Scene>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 02 · Your day, with one highlight
// ════════════════════════════════════════════════════════════════════════════
export function TodayScene() {
  return (
    <Scene width={400} height={300} label="The Today screen: a greeting, one highlighted task, and the rest of the day's plan.">
      {/* meeting chip peeking behind */}
      <At x={252} y={6} z={2}>
        <Window elevation="raised" className="flex items-center gap-2 px-3 py-2">
          <span className="h-6 w-0.5 rounded-full" style={{ background: "var(--ill-label-slate)" }} />
          <div>
            <div className="ill-t-micro text-ill-ink-3">11:30 · 30m</div>
            <div className="ill-t-caption font-medium text-ill-ink-1">Ridgeline call</div>
          </div>
        </Window>
      </At>

      <At x={40} y={44} w={320} z={1}>
        <Window glass>
          <div className="flex items-center gap-2 px-4 pt-4">
            <BrandMark size={18} />
            <span className="ill-t-h4 font-semibold">Good morning, Alex.</span>
          </div>
          <div className="mx-4 mt-3 flex items-center gap-3 rounded-lg p-3" style={{ boxShadow: "inset 0 0 0 1px var(--ill-accent-line)", background: "linear-gradient(135deg, var(--ill-accent-soft), transparent 70%)" }}>
            <Ring size={36} stroke={3} value={0.35}>
              <Icon icon={Star} size={14} weight="fill" style={{ color: "var(--ill-accent)" }} />
            </Ring>
            <div className="min-w-0 flex-1">
              <div className="ill-t-micro text-ill-accent">Today’s highlight</div>
              <div className="ill-t-small truncate font-medium text-ill-ink-1">Send the Ridgeline invoice</div>
              <div className="ill-t-micro mt-0.5 flex items-center gap-2 text-ill-ink-3">
                <Dot color="var(--ill-label-berry)" size={6} /> Finance <span>·</span> 15m
              </div>
            </div>
          </div>
          <div className="mt-2 pb-1">
            <TaskRow title="Finish the logo presentation" meta="Ridgeline" divider={false} />
            <TaskRow title="Reply to Beacon about scope" meta="Beacon" />
            <TaskRow title="Weekly review" done />
          </div>
        </Window>
      </At>

      <At x={228} y={250} z={2} className="ill-anim ill-rise">
        <Chip tone="solid" icon={<span className="grid size-3.5 place-items-center rounded-full bg-ill-success"><Icon icon={Check} size={10} strokeWidth={3} /></span>}>
          Weekly review done
        </Chip>
      </At>
    </Scene>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 03 · Projects: one plan, list or board
// ════════════════════════════════════════════════════════════════════════════
function BoardColumn({ title, cards }: { title: string; cards: number[] }) {
  return (
    <div className="flex w-24 flex-col gap-2">
      <div className="ill-t-micro text-ill-ink-3">{title}</div>
      {cards.map((w, i) => (
        <div key={i} className="flex flex-col gap-1 rounded-md bg-ill-surface p-2 shadow-ill-1">
          <Bar w={w} />
          <Bar w={w * 0.5} h={4} />
        </div>
      ))}
    </div>
  );
}

export function ProjectScene() {
  return (
    <Scene width={400} height={300} label="The Ridgeline rebrand project as a list grouped by phase, with the board view behind it.">
      {/* Board view behind */}
      <At x={148} y={24} w={236} z={0} style={{ transform: "rotate(3deg)", opacity: 0.9 }}>
        <Window elevation="raised" className="flex gap-3 p-3">
          <BoardColumn title="Discovery" cards={[64, 48]} />
          <BoardColumn title="Design" cards={[72, 56, 40]} />
        </Window>
      </At>

      <At x={24} y={28} w={308} z={1}>
        <Window glass>
          <div className="flex items-center gap-2 px-4 pt-4 pb-3">
            <span className="grid size-6 place-items-center rounded-md" style={{ background: "var(--ill-label-indigo-soft)", color: "var(--ill-label-indigo)" }}>
              <Icon icon={Folder} size={14} />
            </span>
            <span className="ill-t-h4 flex-1 truncate font-semibold">Ridgeline rebrand</span>
            <span className="flex rounded-md bg-ill-surface-3 p-0.5">
              <span className="ill-t-micro flex items-center gap-1 rounded-[5px] bg-ill-surface px-1.5 py-1 text-ill-ink-1 shadow-ill-1">
                List
              </span>
              <span className="ill-t-micro flex items-center gap-1 px-1.5 py-1 text-ill-ink-3">
                Board
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2 px-4 pb-3">
            <span className="flex -space-x-1.5">
              <Person initials="AL" size={18} hue="slate" />
              <Person initials="PR" size={18} />
              <Person initials="SM" size={18} hue="ochre" />
            </span>
            <span className="ill-t-micro flex-1 text-ill-ink-3">3 of 7 done · due Nov 14</span>
            <Meter value={3 / 7} w={56} tone="accent" />
          </div>
          <Section title="Design" count="1/3" />
          <TaskRow title="Three logo routes" done />
          <TaskRow title="Logo presentation" meta="Fri" />
          <Section title="Delivery" count="0/2" />
          <TaskRow title="Brand guidelines" meta="Nov 14" />
        </Window>
      </At>
      <Cursor name="You" className="ill-anim ill-drift" style={{ left: 300, top: 70, ["--ill-dx" as string]: "-10px", ["--ill-dy" as string]: "4px" }} />
    </Scene>
  );
}

function Section({ title, count }: { title: string; count: string }) {
  return (
    <div className="ill-t-micro flex items-center gap-2 border-t border-ill-line bg-ill-surface-2 px-4 py-1.5 text-ill-ink-2">
      <span className="font-semibold">{title}</span>
      <span className="text-ill-ink-3">{count}</span>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 04 · Command palette
// ════════════════════════════════════════════════════════════════════════════
const PALETTE_ROW = 26;

export function CommandScene() {
  const rows: { icon: typeof Folder; label: string; keys: string[] }[] = [
    { icon: Folder, label: "Go to Projects", keys: ["G", "P"] },
    { icon: Landmark, label: "Go to Finance", keys: ["G", "M"] },
    { icon: FileText, label: "Go to Documents", keys: ["G", "D"] },
  ];
  return (
    <Scene width={400} height={380} label="The command palette over the app: type a command, move with the arrow keys, press Enter.">
      {/* The app behind, dimmed */}
      <At x={20} y={20} w={360} h={340}>
        <Window elevation="raised" className="flex h-full">
          <div className="flex w-20 flex-col gap-2 border-r border-ill-line bg-ill-surface-2 p-3">
            <BrandMark size={14} />
            {[House, Inbox, CalendarDays, Folder].map((g, i) => (
              <span key={i} className="flex items-center gap-1.5 text-ill-ink-4">
                <Icon icon={g} size={10} /> <Bar w={32} h={4} />
              </span>
            ))}
          </div>
          <div className="flex flex-1 flex-col gap-3 p-4">
            <Bar w={120} h={8} strong />
            {[180, 150, 200, 130, 170, 110, 160, 190].map((w, i) => (
              <span key={i} className="flex items-center gap-2"><Tick size={10} /><Bar w={w} h={5} /></span>
            ))}
          </div>
          <span className="absolute inset-0 bg-ill-scrim" />
        </Window>
      </At>

      <At x={52} y={38} w={296} z={1}>
        <Window>
          <div className="flex items-center gap-2 border-b border-ill-line px-3 py-2.5">
            <Icon icon={Search} size={14} className="text-ill-ink-3" />
            <span className="ill-t-small text-ill-ink-1">go to</span>
            <span className="ill-anim ill-blink -ml-1.5 h-4 w-px bg-ill-ink-1" />
            <span className="flex-1" />
            <Key>esc</Key>
          </div>
          <div className="px-2 pt-2 pb-1">
            <div className="ill-t-micro px-2 pb-1 text-ill-ink-3">Navigate</div>
            <div className="relative" style={{ ["--ill-row" as string]: `${PALETTE_ROW}px` }}>
              <span className="ill-anim ill-select absolute inset-x-0 top-0 rounded-md bg-ill-surface-3" style={{ height: PALETTE_ROW }} />
              {rows.map((r) => (
                <div key={r.label} className="relative flex items-center gap-2 px-2" style={{ height: PALETTE_ROW }}>
                  <Icon icon={r.icon} size={14} className="text-ill-ink-3" />
                  <span className="ill-t-small flex-1 text-ill-ink-1">{r.label}</span>
                  <span className="flex gap-0.5">{r.keys.map((k) => <Key key={k}>{k}</Key>)}</span>
                </div>
              ))}
            </div>
            <div className="ill-t-micro px-2 pt-2 pb-1 text-ill-ink-3">Recent</div>
            {[
              { icon: Folder, label: "Ridgeline rebrand", meta: "Project" },
              { icon: FileText, label: "Beacon Health scope", meta: "Doc" },
            ].map((r) => (
              <div key={r.label} className="flex items-center gap-2 px-2" style={{ height: PALETTE_ROW }}>
                <Icon icon={r.icon} size={14} className="text-ill-ink-3" />
                <span className="ill-t-small flex-1 text-ill-ink-1">{r.label}</span>
                <span className="ill-t-micro text-ill-ink-3">{r.meta}</span>
              </div>
            ))}
            <div className="ill-t-micro px-2 pt-2 pb-1 text-ill-ink-3">Actions</div>
            <div className="flex items-center gap-2 px-2" style={{ height: PALETTE_ROW }}>
              <Icon icon={Plus} size={14} className="text-ill-ink-3" />
              <span className="ill-t-small flex-1 text-ill-ink-1">New task</span>
              <Key>C</Key>
            </div>
            <div className="flex items-center gap-2 px-2" style={{ height: PALETTE_ROW }}>
              <Icon icon={Timer} size={14} className="text-ill-ink-3" />
              <span className="ill-t-small flex-1 text-ill-ink-1">Focus mode</span>
              <Key>F</Key>
            </div>
          </div>
          <div className="ill-t-micro flex items-center gap-3 border-t border-ill-line bg-ill-surface-2 px-3 py-2 text-ill-ink-3">
            <span className="flex items-center gap-1"><Key>↑</Key><Key>↓</Key> move</span>
            <span className="flex items-center gap-1"><Key><Icon icon={CornerDownLeft} size={10} /></Key> run</span>
            <span className="flex-1" />
            <span className="flex items-center gap-1"><Key>⌘</Key><Key>K</Key></span>
          </div>
        </Window>
      </At>
    </Scene>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 05 · Shortcuts you learn once
// ════════════════════════════════════════════════════════════════════════════
export function ShortcutsScene() {
  return (
    <Scene width={400} height={300} label="Keyboard shortcuts that follow the words: H highlights a task, E completes it, G then P goes to Projects.">
      <At x={96} y={20} z={2} className="ill-anim ill-rise">
        <Window elevation="float" className="flex items-center gap-2 px-3 py-2">
          <Icon icon={Star} size={14} weight="fill" style={{ color: "var(--ill-accent)" }} />
          <span className="ill-t-caption text-ill-ink-3">Highlighted</span>
          <span className="ill-t-caption font-medium text-ill-ink-1">Logo presentation</span>
        </Window>
      </At>

      {/* Keyboard slab */}
      <At x={36} y={64} w={328} z={1}>
        <div className="rounded-2xl bg-ill-surface-3 px-4 pt-3 pb-6" style={{ boxShadow: "inset 0 0 0 1px var(--ill-line), var(--ill-shadow-2)" }}>
          <div className="flex gap-2">
            {["Q", "W", "E", "R", "T"].map((k) => (
              <KeyWithHint key={k} k={k} hint={k === "E" ? "Complete" : undefined} />
            ))}
          </div>
          <div className="mt-6 ml-4 flex gap-2">
            {["S", "D", "F", "G", "H"].map((k) => (
              <KeyWithHint key={k} k={k} hint={k === "F" ? "Focus" : undefined} pressed={k === "H"} />
            ))}
          </div>
          <div className="mt-6 ml-10 flex gap-2">
            {["Z", "X", "C", "V", "B"].map((k) => (
              <KeyWithHint key={k} k={k} hint={k === "C" ? "Capture" : undefined} />
            ))}
          </div>
        </div>
      </At>

      <At x={40} y={268} w={320} className="flex items-center justify-center gap-2">
        <Key>G</Key>
        <span className="ill-t-micro text-ill-ink-3">then</span>
        <Key>P</Key>
        <Icon icon={ArrowRight} size={12} className="text-ill-ink-4" />
        <span className="ill-t-caption font-medium text-ill-ink-1">Projects</span>
      </At>
    </Scene>
  );
}

function KeyWithHint({ k, hint, pressed }: { k: string; hint?: string; pressed?: boolean }) {
  const lit = Boolean(hint) || pressed;
  return (
    <span className="relative">
      <Key big active={pressed} className={cn(pressed && "ill-anim ill-press", !lit && "text-ill-ink-4")}>
        {k}
      </Key>
      {hint && <span className="ill-t-micro absolute -bottom-1 left-1/2 -translate-x-1/2 translate-y-full whitespace-nowrap text-ill-ink-3">{hint}</span>}
    </span>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 06 · Focus mode
// ════════════════════════════════════════════════════════════════════════════
export function FocusScene() {
  return (
    <Scene width={400} height={300} label="Focus mode: one task on screen with a 25 minute timer, and nothing else.">
      {/* The rest of the day, stepped back */}
      <At x={32} y={36} w={336} h={228} style={{ filter: "blur(2px)", opacity: 0.55 }}>
        <Window elevation="flat" className="flex h-full flex-col gap-3 p-4">
          {[150, 200, 120, 170, 140].map((w, i) => (
            <span key={i} className="flex items-center gap-2"><Tick size={12} /><Bar w={w} h={5} /></span>
          ))}
        </Window>
      </At>

      <At x={88} y={18} w={224} z={1}>
        <Window glass>
          <div className="flex items-center justify-between px-4 pt-3">
            <Chip tone="quiet" icon={<Icon icon={Bell} size={10} />}>Quiet</Chip>
            <span className="grid size-5 place-items-center rounded-full text-ill-ink-3"><Icon icon={X} size={12} /></span>
          </div>
          <div className="flex flex-col items-center px-4 pt-1 pb-3">
            <Ring size={112} stroke={5} value={0.68} animate>
              <span className="flex flex-col items-center">
                <span className="ill-t-stat">24:03</span>
                <span className="ill-t-micro mt-1 text-ill-ink-3">of 25:00</span>
              </span>
            </Ring>
            <span className="ill-t-small mt-3 font-medium text-ill-ink-1">Finish the logo presentation</span>
            <span className="ill-t-micro mt-0.5 flex items-center gap-1 text-ill-ink-3">
              <Dot color="var(--ill-label-indigo)" size={6} /> Ridgeline rebrand
            </span>
            <div className="mt-3 flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-full bg-ill-solid text-ill-on-solid">
                <Icon icon={Pause} size={14} />
              </span>
              <span className="ill-t-caption grid h-8 place-items-center rounded-full bg-ill-surface-3 px-3 font-medium text-ill-ink-2">Done</span>
            </div>
          </div>
        </Window>
      </At>
    </Scene>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 07 · Your calendar, beside your tasks
// ════════════════════════════════════════════════════════════════════════════
const HOUR = 44;

export function CalendarScene() {
  const hours = ["9", "10", "11", "12"];
  return (
    <Scene width={400} height={300} label="Your calendar next to your plan: drag a task from the list onto an open slot in the day.">
      <At x={24} y={32} w={352} h={236}>
        <Window glass className="h-full">
          <div className="flex h-full">
            {/* Plan column */}
            <div className="flex w-36 flex-col border-r border-ill-line">
              <div className="ill-t-micro flex items-center gap-1 px-3 pt-3 pb-2 text-ill-ink-3">
                <Icon icon={List} size={10} /> Not on the day yet
              </div>
              <div className="mx-2 flex h-9 items-center rounded-md border border-dashed border-ill-line-strong" />
              <div className="mx-2 mt-2 flex items-center gap-2 rounded-md bg-ill-surface-2 px-2 py-2 shadow-ill-1">
                <Tick size={12} />
                <span className="ill-t-caption truncate text-ill-ink-1">Asset handover</span>
              </div>
              <div className="mx-2 mt-2 flex items-center gap-2 rounded-md bg-ill-surface-2 px-2 py-2 shadow-ill-1">
                <Tick size={12} />
                <span className="ill-t-caption truncate text-ill-ink-1">Beacon scope</span>
              </div>
            </div>
            {/* Day column */}
            <div className="relative flex-1">
              <div className="ill-t-micro flex items-center justify-between px-3 pt-3 pb-2 text-ill-ink-3">
                <span className="flex items-center gap-1"><Icon icon={Calendar} size={10} /> Thursday</span>
                <Chip tone="quiet" className="!px-1.5 !py-0">Google</Chip>
              </div>
              {hours.map((h, i) => (
                <div key={h} className="absolute inset-x-0 flex items-start gap-2 pl-2" style={{ top: 36 + i * HOUR }}>
                  <span className="ill-t-micro w-5 -translate-y-1/2 text-right text-ill-ink-4">{h}</span>
                  <span className="mt-0 h-px flex-1 bg-ill-line" />
                </div>
              ))}
              <CalEvent top={36 + 4} h={HOUR * 0.5 - 6} color="var(--ill-label-slate)" soft="var(--ill-label-slate-soft)" time="9:00" title="Standup" />
              <CalEvent top={36 + HOUR * 2.5 + 2} h={HOUR - 6} color="var(--ill-label-indigo)" soft="var(--ill-label-indigo-soft)" time="11:30" title="Ridgeline call" />
              {/* Drop slot at 10:00 */}
              <div className="absolute rounded-md border border-dashed" style={{ left: 30, right: 8, top: 36 + HOUR + 2, height: HOUR - 6, borderColor: "var(--ill-accent-line)", background: "var(--ill-accent-soft)" }} />
              <span className="absolute h-0.5 rounded-full bg-ill-accent" style={{ left: 26, right: 8, top: 36 + HOUR * 1.8 }}>
                <span className="absolute -left-1 -top-[3px] size-2 rounded-full bg-ill-accent" />
              </span>
            </div>
          </div>
        </Window>
      </At>

      {/* Dragged task, travelling to its slot */}
      <At
        x={40}
        y={74}
        w={128}
        z={3}
        className="ill-anim ill-drag"
        style={{ ["--ill-dx" as string]: "146px", ["--ill-dy" as string]: "8px", transform: "rotate(-2deg)" }}
      >
        <div className="flex items-center gap-2 rounded-md bg-ill-surface px-2 py-2 shadow-ill-float" style={{ boxShadow: "var(--ill-shadow-float), inset 2px 0 0 var(--ill-accent)" }}>
          <Tick size={12} />
          <span className="min-w-0 flex-1">
            <span className="ill-t-caption block truncate font-medium text-ill-ink-1">Type and color</span>
            <span className="ill-t-micro block text-ill-ink-3">45m</span>
          </span>
        </div>
        <Cursor name="You" style={{ left: 100, top: 22 }} />
      </At>
    </Scene>
  );
}

function CalEvent({ top, h, color, soft, time, title }: { top: number; h: number; color: string; soft: string; time: string; title: string }) {
  return (
    <div className="absolute flex overflow-hidden rounded-md" style={{ left: 30, right: 8, top, height: h, background: soft }}>
      <span className="w-0.5 shrink-0" style={{ background: color }} />
      <span className="flex items-baseline gap-1.5 px-2 py-1">
        <span className="ill-t-micro text-ill-ink-3">{time}</span>
        <span className="ill-t-caption truncate font-medium text-ill-ink-1">{title}</span>
      </span>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 08 · Your day, in your inbox
// ════════════════════════════════════════════════════════════════════════════
export function DigestScene() {
  return (
    <Scene width={400} height={300} label="A short email each morning with the highlight, the plan, and what is waiting on others.">
      {/* Inbox behind */}
      <At x={28} y={24} w={344} h={120}>
        <Window elevation="raised" className="h-full">
          {[0, 1, 2].map((i) => (
            <div key={i} className={cn("flex items-center gap-2 px-3 py-2.5", i > 0 && "border-t border-ill-line")}>
              <span className="size-5 rounded-full bg-ill-surface-3" />
              <Bar w={64} h={5} strong={i === 0} />
              <Bar w={140} h={5} />
              <span className="flex-1" />
              <Bar w={24} h={4} />
            </div>
          ))}
        </Window>
      </At>

      <At x={52} y={60} w={296} z={1}>
        <Window glass>
          <div className="flex items-center gap-2 px-4 pt-4">
            <span className="grid size-7 place-items-center rounded-full bg-ill-surface-2 shadow-ill-1"><BrandMark size={14} /></span>
            <div className="flex-1">
              <div className="ill-t-caption font-medium text-ill-ink-1">Zenboard</div>
              <div className="ill-t-micro text-ill-ink-3">to Alex · 7:30</div>
            </div>
            <Icon icon={Mail} size={14} className="text-ill-ink-4" />
          </div>
          <div className="px-4 pt-3">
            <div className="ill-t-h4 font-semibold">Thursday: 4 tasks, 2 meetings</div>
          </div>
          <div className="mx-4 mt-3 flex items-center gap-2 rounded-md px-3 py-2" style={{ background: "var(--ill-accent-soft)" }}>
            <Icon icon={Star} size={12} weight="fill" style={{ color: "var(--ill-accent)" }} />
            <span className="ill-t-caption text-ill-ink-1"><span className="text-ill-ink-3">Highlight:</span> Send the Ridgeline invoice</span>
          </div>
          <div className="flex flex-col gap-1.5 px-4 pt-3">
            <DigestLine icon={<Icon icon={Clock} size={10} />} text="11:30 Ridgeline call · 3:00 Beacon sync" />
            <DigestLine icon={<Icon icon={ArrowRight} size={10} />} text="Waiting on Beacon: scope sign-off" />
          </div>
          <div className="mt-3 flex items-center gap-2 border-t border-ill-line bg-ill-surface-2 px-4 py-2">
            <span className="ill-t-micro text-ill-ink-3">Arrives at</span>
            {["6:30", "7:30", "8:30"].map((t) => (
              <span key={t} className={cn("ill-t-micro rounded-[5px] px-1.5 py-0.5", t === "7:30" ? "bg-ill-surface text-ill-ink-1 shadow-ill-1" : "text-ill-ink-3")}>{t}</span>
            ))}
          </div>
        </Window>
      </At>
    </Scene>
  );
}

function DigestLine({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="ill-t-micro flex items-center gap-2 text-ill-ink-2">
      <span className="grid size-4 place-items-center rounded-sm bg-ill-surface-3 text-ill-ink-3">{icon}</span>
      {text}
    </span>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 09 · Bring your work with you (imports + MCP)
// ════════════════════════════════════════════════════════════════════════════
export function IntegrationsScene() {
  const cx = 200;
  const cy = 142;
  const nodes = [
    { x: 86, y: 52, icon: Upload, title: "Notion import", sub: "142 pages" },
    { x: 314, y: 52, icon: Calendar, title: "Google Calendar", sub: "Synced" },
    { x: 86, y: 244, icon: Mail, title: "Morning email", sub: "7:30" },
    { x: 314, y: 244, icon: Sparkles, title: "AI assistant", sub: "via MCP" },
  ];
  return (
    <Scene width={400} height={300} label="Zenboard at the center, connected to a Notion import, Google Calendar, the morning email and an AI assistant through Zenboard's MCP server.">
      <svg width="400" height="300" className="absolute inset-0">
        <circle cx={cx} cy={cy} r="74" fill="none" stroke="var(--ill-line-strong)" strokeDasharray="2 5" />
        {nodes.map((n, i) => (
          <g key={i}>
            <line x1={cx} y1={cy} x2={n.x} y2={n.y} stroke="var(--ill-line-strong)" strokeDasharray="3 4" />
            <circle r="3" fill="var(--ill-accent)" className="ill-anim" style={{ offsetPath: `path("M ${n.x} ${n.y} L ${cx} ${cy}")`, animationName: "ill-offset", animationDuration: "2.4s", animationDelay: `${i * 0.6}s` }} />
          </g>
        ))}
      </svg>

      <At x={cx - 32} y={cy - 32} w={64} h={64} z={2}>
        <span className="grid size-16 place-items-center rounded-2xl bg-ill-surface shadow-ill-float">
          <BrandMark size={28} />
        </span>
      </At>

      {nodes.map((n) => (
        <At key={n.title} x={n.x - 74} y={n.y - 22} w={148} z={1}>
          <Window elevation="raised" className="flex items-center gap-2 px-2.5 py-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-md bg-ill-surface-3 text-ill-ink-2">
              <Icon icon={n.icon} size={14} />
            </span>
            <span className="min-w-0">
              <span className="ill-t-caption block truncate font-medium text-ill-ink-1">{n.title}</span>
              <span className="ill-t-micro block text-ill-ink-3">{n.sub}</span>
            </span>
          </Window>
        </At>
      ))}

      <At x={cx - 80} y={cy + 44} w={160} z={2} className="flex justify-center">
        <Chip tone="surface" className="ill-t-mono" icon={<span className="ill-anim ill-pulse size-1.5 rounded-full bg-ill-success" style={{ ["--ill-pulse" as string]: "var(--ill-success-soft)" }} />}>
          <Icon icon={Plug} size={10} /> mcp · connected
        </Chip>
      </At>
    </Scene>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Catalog — the board, the marketing site and onboarding read from here
// ════════════════════════════════════════════════════════════════════════════
export interface IllustrationEntry {
  id: string;
  title: string;
  description: string;
  /** Glyph for the feature cell's icon tile. */
  icon: typeof Search;
  wide?: boolean;
  Scene: () => React.ReactElement;
}

export const ILLUSTRATIONS: IllustrationEntry[] = [
  { id: "request-to-task", icon: MessageCircle, title: "A request, turned into a task", description: "A client asks in their portal. It lands on your day, with who asked and why.", wide: true, Scene: RequestToTaskScene },
  { id: "today", icon: Sun, title: "Your day, with one highlight", description: "One thing that matters most, then the plan. Done items stay, quietly.", Scene: TodayScene },
  { id: "projects", icon: Folder, title: "One plan, as a list or a board", description: "Phases, progress and dates for every project, in the view you think in.", Scene: ProjectScene },
  { id: "command", icon: Search, title: "Everything is a few keys away", description: "The command palette opens with ⌘K. Type, move with the arrow keys, press Enter.", Scene: CommandScene },
  { id: "shortcuts", icon: Keyboard, title: "Shortcuts you learn once", description: "The keys follow the words: H highlights, E completes, G then P goes to Projects.", Scene: ShortcutsScene },
  { id: "focus", icon: Timer, title: "Focus mode", description: "One task on screen, a timer, and nothing else until you come back.", Scene: FocusScene },
  { id: "calendar", icon: Calendar, title: "Your calendar, beside your tasks", description: "Connect Google Calendar and your meetings sit on the same day as your plan.", Scene: CalendarScene },
  { id: "digest", icon: Mail, title: "Your day, in your inbox", description: "A short email each morning: the highlight, the plan, and what is waiting on others.", Scene: DigestScene },
  { id: "integrations", icon: Plug, title: "Bring your work with you", description: "Import your pages from Notion. Connect an AI assistant through Zenboard’s MCP server.", Scene: IntegrationsScene },
];
