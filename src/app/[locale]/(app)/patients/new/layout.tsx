import { ActionAccess } from "@/components/shell/permissions"

/** Create page: needs Create on Patients in the permission matrix (Settings › Roles and access). */
export default function NewPatientsLayout({ children }: { children: React.ReactNode }) {
  return (
    <ActionAccess module="patients" action="create">
      {children}
    </ActionAccess>
  )
}
