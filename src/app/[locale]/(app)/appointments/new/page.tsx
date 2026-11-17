import { getTranslations } from "next-intl/server"

import { SoonNew } from "@/modules/appointments/soon"

export async function generateMetadata() {
  return { title: (await getTranslations("appointments"))("newAppointment") }
}

/** Appointments · New appointment: built in a later slice from its FigCraft screens. */
export default function NewAppointmentPage() {
  return <SoonNew />
}
