import { CENTER, PATIENTS, insurerOf, type Claim } from "./data"

/*
 * NPHIES (CCHI's national health-insurance exchange) behind an interface. NPHIES speaks FHIR R4 messages: a Bundle
 * whose MessageHeader names the event ("claim-request", "priorauth-request", "poll-request") and whose entries carry
 * the Claim; the insurer answers with a ClaimResponse (outcome queued | complete | partial | error), usually later —
 * the provider polls for it. A rejection keeps its code and text (ClaimResponse.error / adjudication reason).
 *
 * The stub below accepts every message after a short delay with the same shapes: claims come back "queued"
 * (In review); pre-auth requests are queued too. Nothing here changes the store — callers apply the outcome.
 */

export type FhirCoding = { system: string; code: string; display?: string }

export type NphiesClaim = {
  resourceType: "Claim"
  id: string
  identifier: { system: string; value: string }[]
  status: "active"
  type: { coding: FhirCoding[] }
  use: "claim" | "preauthorization"
  patient: { identifier: { system: string; value: string } }
  created: string
  insurer: { identifier: { system: string; value: string } }
  provider: { identifier: { system: string; value: string } }
  priority: { coding: FhirCoding[] }
  insurance: { sequence: number; focal: boolean; coverage: { reference: string }; preAuthRef?: string[] }[]
  item: { sequence: number; productOrService: { coding: FhirCoding[] }; net: { value: number; currency: "SAR" } }[]
  total: { value: number; currency: "SAR" }
  supportingInfo?: { sequence: number; category: { coding: FhirCoding[] }; valueString?: string }[]
}

export type NphiesBundle = {
  resourceType: "Bundle"
  id: string
  type: "message"
  timestamp: string
  entry: (
    | { resource: { resourceType: "MessageHeader"; eventCoding: FhirCoding; source: { endpoint: string }; destination: { endpoint: string }[] } }
    | { resource: NphiesClaim }
  )[]
}

export type ClaimResponse = {
  resourceType: "ClaimResponse"
  request: { identifier: { value: string } }
  outcome: "queued" | "complete" | "partial" | "error"
  disposition?: string
  preAuthRef?: string
  error?: { code: { coding: FhirCoding[] } }[]
  total?: { category: { coding: FhirCoding[] }; amount: { value: number; currency: "SAR" } }[]
}

export interface NphiesClient {
  /** claim-request bundles, one per claim, sent as a batch. */
  submit(bundles: NphiesBundle[]): Promise<ClaimResponse[]>
  /** priorauth-request for a held-back claim. */
  requestPreauth(bundle: NphiesBundle): Promise<ClaimResponse>
  /** poll-request: answers that arrived since the last poll. */
  poll(): Promise<ClaimResponse[]>
}

const SYS = "http://nphies.sa/identifier"

/** A Claim (or pre-auth request) as NPHIES expects it. */
export function toNphiesClaim(c: Claim, use: NphiesClaim["use"] = "claim"): NphiesClaim {
  const ins = insurerOf(c.insurer)
  return {
    resourceType: "Claim",
    id: c.no,
    identifier: [{ system: `${SYS}/claim`, value: c.no }],
    status: "active",
    type: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/claim-type", code: "professional" }] },
    use,
    patient: { identifier: { system: `${SYS}/mrn`, value: PATIENTS[c.patient].mrn } },
    created: c.createdAt,
    insurer: { identifier: { system: `${SYS}/payer-license`, value: ins?.nphiesId ?? c.insurer } },
    provider: { identifier: { system: `${SYS}/provider-license`, value: CENTER.cr } },
    priority: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/processpriority", code: "normal" }] },
    insurance: [{ sequence: 1, focal: true, coverage: { reference: `Coverage/${c.patient}` }, ...(c.preauthNo ? { preAuthRef: [c.preauthNo] } : {}) }],
    item: [{ sequence: 1, productOrService: { coding: [{ system: `${SYS}/services`, code: c.invoiceNo, display: c.service.en }] }, net: { value: c.amount, currency: "SAR" } }],
    total: { value: c.amount, currency: "SAR" },
    ...(c.note ? { supportingInfo: [{ sequence: 1, category: { coding: [{ system: `${SYS}/info`, code: "info" }] }, valueString: c.note }] } : {}),
  }
}

export function toBundle(c: Claim, event: "claim-request" | "priorauth-request", at: string): NphiesBundle {
  return {
    resourceType: "Bundle",
    id: `${event}-${c.no}`,
    type: "message",
    timestamp: at,
    entry: [
      {
        resource: {
          resourceType: "MessageHeader",
          eventCoding: { system: "http://nphies.sa/terminology/CodeSystem/ksa-message-events", code: event },
          source: { endpoint: "https://alnoor.sa/nphies" },
          destination: [{ endpoint: `${SYS}/${insurerOf(c.insurer)?.nphiesId ?? c.insurer}` }],
        },
      },
      { resource: toNphiesClaim(c, event === "priorauth-request" ? "preauthorization" : "claim") },
    ],
  }
}

const claimId = (b: NphiesBundle) => (b.entry[1]?.resource as NphiesClaim).id

/** Stub: every message is queued (In review) after ~1 s; `fail` returns a transport error for the batch. */
export function nphiesStub(opts: { delayMs?: number; fail?: boolean } = {}): NphiesClient {
  const later = <T,>(v: () => T) =>
    new Promise<T>((resolve, reject) => setTimeout(() => (opts.fail ? reject(new Error("NPHIES unavailable")) : resolve(v())), opts.delayMs ?? 1000))
  return {
    submit: (bundles) => later(() => bundles.map((b) => ({ resourceType: "ClaimResponse" as const, request: { identifier: { value: claimId(b) } }, outcome: "queued" as const }))),
    requestPreauth: (b) => later(() => ({ resourceType: "ClaimResponse" as const, request: { identifier: { value: claimId(b) } }, outcome: "queued" as const })),
    poll: () => later(() => []),
  }
}

export const nphies: NphiesClient = nphiesStub()
