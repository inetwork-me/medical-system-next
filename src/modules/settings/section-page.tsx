"use client"

import { BuildingCard, SettingsFrame } from "./frame"
import type { InnerPage, SectionId } from "./sections"

/** A section that lands in a later build step: the frame (menu, tab row, mobile page bar, access check) around a placeholder. */
export function SettingsSectionPage({ section, inner }: { section: SectionId; inner?: InnerPage }) {
  return (
    <SettingsFrame section={section} inner={inner}>
      <BuildingCard section={section} />
    </SettingsFrame>
  )
}
