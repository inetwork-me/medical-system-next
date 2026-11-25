import { ActionAccess } from "@/components/shell/permissions"

/** Create page: needs Create on Doctors in the permission matrix (Settings › Roles and access). */
export default function NewDoctorsLayout({ children }: { children: React.ReactNode }) {
  return (
    <ActionAccess module="doctors" action="create">
      {children}
    </ActionAccess>
  )
}
