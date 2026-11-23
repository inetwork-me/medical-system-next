/**
 * Reminders (Chart completion · Remind / Remind all): an app notification and an SMS to the doctor. Behind an
 * interface so the notification service replaces the stub.
 */
export type ReminderInput = { doctorId: string; items: string[] }

export interface Reminders {
  send(input: ReminderInput): Promise<{ app: boolean; sms: boolean }>
}

export const remindersStub: Reminders = {
  async send() {
    await new Promise((r) => setTimeout(r, 300))
    return { app: true, sms: true }
  },
}

export const reminders: Reminders = remindersStub
