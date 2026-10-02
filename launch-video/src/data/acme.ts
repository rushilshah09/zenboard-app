/**
 * The film's single dataset (DIRECTION_V2.md §2 "UI fidelity"): one consistent
 * world, real names, amounts and times, dense enough to hold up in close-up.
 * Every screen reads from here; nothing is invented per scene.
 */
import type { Category } from "../brand/tokens";

export const TODAY = { weekday: "Thursday", date: "25 September", iso: "2026-09-25" };

export const PEOPLE = {
  me: { name: "Rushil Shah", initials: "RS", role: "Founder, Life Design Studio" },
  mara: { name: "Mara Okafor", initials: "MO", role: "Head of Brand, Acme Studio" },
  theo: { name: "Theo Lindqvist", initials: "TL", role: "Lumen Co." },
  ines: { name: "Inés Duarte", initials: "ID", role: "Northwind" },
  sam: { name: "Sam Patel", initials: "SP", role: "Fieldhouse" },
} as const;

export const CLIENTS = [
  { id: "acme", name: "Acme Studio", contact: "mara", since: "2025", projects: 3, status: "Active", unbilled: 1875 },
  { id: "lumen", name: "Lumen Co.", contact: "theo", since: "2024", projects: 2, status: "Active", unbilled: 640 },
  { id: "northwind", name: "Northwind", contact: "ines", since: "2026", projects: 1, status: "Proposal", unbilled: 0 },
  { id: "fieldhouse", name: "Fieldhouse", contact: "sam", since: "2023", projects: 1, status: "Paused", unbilled: 0 },
] as const;

/** The one job we follow through the whole film. */
export const JOB = {
  title: "Rebrand proposal for Acme",
  project: "Acme Studio — Rebrand",
  doc: "Acme: rebrand proposal",
  event: { day: "Thursday", start: "10:00", end: "12:00" },
  progress: 0.64,
  hours: [
    { day: "Mon 22", what: "Brand system, round 2", h: 3.0 },
    { day: "Tue 23", what: "Brand system, round 2", h: 5.0 },
    { day: "Wed 24", what: "Pricing page", h: 2.5 },
  ],
  rate: 150,
  invoice: { id: "INV-1042", amount: 1875 },
} as const;

/** Today list: 10 real tasks so the list is dense (the job is added live in shot 3.1). */
export const TASKS: { t: string; project: string; category: Category; due?: string; done?: boolean }[] = [
  { t: "Review Lumen feedback", project: "Lumen Co.", category: "projects", due: "9:30" },
  { t: "Send September invoices", project: "Money", category: "money", due: "11:00" },
  { t: "Call with Mara", project: "Acme Studio", category: "clients", due: "12:00" },
  { t: "Update pricing page copy", project: "Acme Studio", category: "docs" },
  { t: "Northwind intro deck", project: "Northwind", category: "projects", due: "14:00" },
  { t: "Book accountant", project: "Admin", category: "money" },
  { t: "Reply to Theo", project: "Lumen Co.", category: "clients" },
  { t: "Sketch logo options", project: "Acme Studio", category: "projects" },
  { t: "Walk, 20 min", project: "Life", category: "life", due: "18:00" },
  { t: "Leave at 6", project: "Life", category: "life", due: "18:00" },
];

/** The Acme project board. */
export const BOARD: Record<"todo" | "doing" | "review" | "done", string[]> = {
  todo: ["Sketch logo options", "Moodboard v2", "Icon grid"],
  doing: ["Type scale", "Component kit"],
  review: ["Colour tokens"],
  done: ["Kickoff call", "Brand audit", "Competitor scan"],
};

/** Thursday on the calendar (24h, minutes from midnight). */
export const EVENTS = [
  { title: "Standup", start: 9 * 60, end: 9 * 60 + 15, category: "tasks" as Category },
  { title: "Call with Mara", start: 12 * 60, end: 13 * 60, category: "calendar" as Category },
  { title: "Northwind intro", start: 14 * 60, end: 15 * 60, category: "projects" as Category },
  { title: "Deep work", start: 15 * 60 + 30, end: 17 * 60, category: "tasks" as Category },
];

export const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
