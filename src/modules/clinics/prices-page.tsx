"use client"

import { useTranslations } from "next-intl"

import { Icon } from "@/components/ds/icon"
import { Button } from "@/components/ui/button"
import { ClinicPage, useCurrentClinic } from "./clinic/frame"
import { ClinicsFrame } from "./frame"
import { PriceList, useExportPrices } from "./prices"

/** Clinics · Services & prices (module tab): the price list for all clinics; action Export price list. */
export function AllPricesPage() {
  const t = useTranslations("clinics.prices")
  const exportPrices = useExportPrices()
  return (
    <ClinicsFrame
      actions={
        <Button variant="outline" onClick={exportPrices}>
          <Icon name="export" size={24} />
          {t("export")}
        </Button>
      }
    >
      <PriceList />
    </ClinicsFrame>
  )
}

/** Clinic page · Services & prices: this clinic's price table. */
export function ClinicPricesPage() {
  const c = useCurrentClinic()
  return (
    <ClinicPage>
      <PriceList clinic={c} />
    </ClinicPage>
  )
}
