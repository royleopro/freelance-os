import type { Etiquette } from "@/lib/types";

export const etiquetteConfig: Record<
  Etiquette,
  { label: string; className: string; color: string }
> = {
  "projet": {
    label: "Projet",
    className: "bg-teal-500/20 text-teal-400 border-teal-500/30",
    color: "hsl(170 55% 45%)",
  },
  "prospection": {
    label: "Prospection",
    className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    color: "hsl(48 80% 55%)",
  },
  "wireframe": {
    label: "Wireframe",
    className: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
    color: "hsl(230 60% 60%)",
  },
  "communication": {
    label: "Communication",
    className: "bg-sky-500/20 text-sky-400 border-sky-500/30",
    color: "hsl(200 75% 55%)",
  },
  "design ui": {
    label: "Design UI",
    className: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    color: "hsl(270 60% 60%)",
  },
  "réunion": {
    label: "Réunion",
    className: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    color: "hsl(25 80% 55%)",
  },
  "analyse": {
    label: "Analyse",
    className: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    color: "hsl(190 70% 50%)",
  },
  "organisation": {
    label: "Organisation",
    className: "bg-slate-500/20 text-slate-400 border-slate-500/30",
    color: "hsl(215 15% 55%)",
  },
  "administration": {
    label: "Administration",
    className: "bg-stone-500/20 text-stone-400 border-stone-500/30",
    color: "hsl(30 10% 50%)",
  },
  "brainstorming": {
    label: "Brainstorming",
    className: "bg-pink-500/20 text-pink-400 border-pink-500/30",
    color: "hsl(330 65% 55%)",
  },
  "formation": {
    label: "Formation",
    className: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    color: "hsl(217 70% 55%)",
  },
  "tests utilisateurs": {
    label: "Tests utilisateurs",
    className: "bg-red-500/20 text-red-400 border-red-500/30",
    color: "hsl(0 65% 55%)",
  },
  "design system": {
    label: "Design System",
    className: "bg-violet-500/20 text-violet-400 border-violet-500/30",
    color: "hsl(260 55% 60%)",
  },
  "prototypage": {
    label: "Prototypage",
    className: "bg-rose-500/20 text-rose-400 border-rose-500/30",
    color: "hsl(350 65% 55%)",
  },
  "mail/discussion": {
    label: "Mail/Discussion",
    className: "bg-blue-600/20 text-blue-300 border-blue-600/30",
    color: "hsl(220 65% 55%)",
  },
  "study case": {
    label: "Study Case",
    className: "bg-emerald-600/20 text-emerald-300 border-emerald-600/30",
    color: "hsl(160 50% 45%)",
  },
  "facturation": {
    label: "Facturation",
    className: "bg-lime-500/20 text-lime-400 border-lime-500/30",
    color: "hsl(85 60% 50%)",
  },
  "graphisme": {
    label: "Graphisme",
    className: "bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/30",
    color: "hsl(290 60% 55%)",
  },
  "outillage": {
    label: "Outillage",
    className: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    color: "hsl(38 80% 55%)",
  },
  "design thinking": {
    label: "Design Thinking",
    className: "bg-pink-600/20 text-pink-300 border-pink-600/30",
    color: "hsl(340 55% 55%)",
  },
  "maintenance": {
    label: "Maintenance",
    className: "bg-amber-600/20 text-amber-300 border-amber-600/30",
    color: "hsl(35 70% 50%)",
  },
  "benchmark": {
    label: "Benchmark",
    className: "bg-orange-600/20 text-orange-300 border-orange-600/30",
    color: "hsl(20 70% 50%)",
  },
  "veille": {
    label: "Veille",
    className: "bg-indigo-600/20 text-indigo-300 border-indigo-600/30",
    color: "hsl(240 50% 60%)",
  },
  "retouches UI/UX": {
    label: "Retouches UI/UX",
    className: "bg-purple-600/20 text-purple-300 border-purple-600/30",
    color: "hsl(275 50% 55%)",
  },
  "code": {
    label: "Code",
    className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    color: "hsl(152 60% 50%)",
  },
  "autre": {
    label: "Autre",
    className: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
    color: "hsl(240 5% 50%)",
  },
};

const fallback = {
  label: "Autre",
  className: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  color: "hsl(240 5% 50%)",
};

/** Safe lookup — returns fallback for unknown etiquettes */
export function getEtiquette(key: string) {
  return etiquetteConfig[key as Etiquette] ?? { ...fallback, label: key };
}

/** All valid etiquette keys */
export const ETIQUETTES = Object.keys(etiquetteConfig) as Etiquette[];

// Lookup map: normalized (lowercase, no accents) → canonical DB value
const normalizeMap = new Map<string, Etiquette>();
for (const key of ETIQUETTES) {
  // exact
  normalizeMap.set(key, key);
  // lowercase
  normalizeMap.set(key.toLowerCase(), key);
  // lowercase + strip accents
  const stripped = key
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  normalizeMap.set(stripped, key);
}

/**
 * Normalize a raw etiquette string to a valid DB value.
 * Matches case-insensitively and accent-insensitively.
 * Returns "autre" if no match found.
 */
export function normalizeEtiquette(raw: string): Etiquette {
  const trimmed = raw.trim();
  if (!trimmed) return "autre";

  // Try exact, then lowercase, then stripped accents
  const lower = trimmed.toLowerCase();
  const stripped = lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  return normalizeMap.get(trimmed)
    ?? normalizeMap.get(lower)
    ?? normalizeMap.get(stripped)
    ?? "autre";
}
