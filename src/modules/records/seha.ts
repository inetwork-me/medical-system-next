/**
 * Seha (the national platform for sick leaves): a sick leave is registered there, the patient gets it by SMS and
 * the employer checks it with the QR. Behind an interface so the real Seha API replaces the stub; the stub hands
 * out the next reference number.
 */
export type SehaLeave = { patientIdLast3: string; from: string; days: number; sector: "private" | "government" | "none"; showDiagnosis: boolean; diagnosis?: string }
export type SehaResult = { ref: string; smsSent: boolean }

export interface SehaClient {
  register(leave: SehaLeave): Promise<SehaResult>
}

let next = 4471905
export const sehaStub: SehaClient = {
  async register() {
    await new Promise((r) => setTimeout(r, 400))
    return { ref: String(next++), smsSent: true }
  },
}

export const seha: SehaClient = sehaStub
