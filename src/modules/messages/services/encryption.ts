/**
 * Encrypted outside mail (brief §4): the recipient gets a link to a secure page instead of the content, and opens it with a
 * one-time code sent by SMS to their mobile on file (or, without one, by a second email). The server keeps the message and
 * its opens in the audit log. This stub returns what the server would.
 */
export type EncryptResult = { link: string; codeBy: "sms" | "email"; codeTo: string; expiresDays: number }

export interface MailEncryption {
  encrypt(input: { recipient: string; mobile?: string }): Promise<EncryptResult>
}

export const encryptionStub: MailEncryption = {
  async encrypt({ recipient, mobile }) {
    await new Promise((r) => setTimeout(r, 500))
    const id = Math.random().toString(36).slice(2, 10)
    return { link: `https://secure.alnoor.sa/m/${id}`, codeBy: mobile ? "sms" : "email", codeTo: mobile ?? recipient, expiresDays: 30 }
  },
}
