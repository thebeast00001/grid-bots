import type { CritterConfig } from "./types";

export type Template = { name: string; job: string; avatar: CritterConfig };

export const TEMPLATES: Template[] = [
  { name: "Atlas", job: "Runs my week and briefs me every morning", avatar: { shape: "orb", color: 10, eyes: "sparkle", acc: "glasses", material: "clay" } },
  { name: "Luna", job: "Works overnight and preps my morning digest", avatar: { shape: "cloud", color: 1, eyes: "happy", acc: "halo", material: "fuzzy" } },
  { name: "Bea", job: "Sorts my email and drafts replies in my voice", avatar: { shape: "bean", color: 13, eyes: "oval", acc: "bow", material: "fuzzy" } },
];
