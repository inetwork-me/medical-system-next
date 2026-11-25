import { ActionAccess } from "@/components/shell/permissions"

/** Create page: needs Create on Clinics in the permission matrix (Settings › Roles and access). */
export default function NewClinicsLayout({ children }: { children: React.ReactNode }) {
  return (
    <ActionAccess module="clinics" action="create">
      {children}
    </ActionAccess>
  )
}
