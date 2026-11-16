import { getTranslations } from "next-intl/server"

import { Icon } from "@/components/ds/icon"
import { SkeletonRow } from "@/components/ds/states"
import { Button } from "@/components/ui/button"
import { ModuleTabsNav, PageContainer, PageHeader } from "@/components/shell/page"

/** Shared Patients module frame (page header + module tabs). Tab bodies arrive in step 6. */
export async function PatientsFrame({ tab }: { tab: "list" | "reports" | "payments" }) {
  const t = await getTranslations("patients")
  return (
    <PageContainer>
      <PageHeader
        title={t("title")}
        description={t(`description.${tab}`)}
        actions={
          <Button>
            <Icon name="user-add" />
            {t("addPatient")}
          </Button>
        }
      />
      <ModuleTabsNav module="patients" counts={{ list: "1,284" }} />
      <div className="overflow-hidden rounded-xl border">
        {[0, 1, 2, 3, 4].map((i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    </PageContainer>
  )
}
