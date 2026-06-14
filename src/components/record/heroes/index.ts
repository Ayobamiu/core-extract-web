import React from "react";
import { MgsWellLogHero } from "./MgsWellLogHero";
import { BoreholeLogHero } from "./BoreholeLogHero";
import { AquiferTestHero } from "./AquiferTestHero";

/**
 * Hero registry. A "hero" is a tailored, top-of-record visualization for a slug
 * with a natural shape (a well diagram, a depth column, a chart). It's a
 * complementary Layer-2 visual — the generic engine still renders the data
 * tables below. When no hero is registered, the record uses the generic body
 * alone. Heroes must be defensive: render nothing when their data is missing.
 */
export type HeroComponent = React.ComponentType<{ data: Record<string, unknown> }>;

const REGISTRY: Record<string, HeroComponent> = {
  mgs_well_log: MgsWellLogHero,
  borehole_log: BoreholeLogHero,
  aquifer_test: AquiferTestHero,
};

export function heroForSlug(slug?: string | null): HeroComponent | null {
  if (!slug) return null;
  return REGISTRY[slug] ?? null;
}
