import { ActionAccess } from "@/components/shell/permissions"

/** Create page: needs Create on Appointments in the permission matrix (Settings › Roles and access). */
export default function NewAppointmentsLayout({ children }: { children: React.ReactNode }) {
  return (
    <ActionAccess module="appointments" action="create">
      {children}
    </ActionAccess>
  )
}
