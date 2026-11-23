"use client"

import * as React from "react"

import { BILL_TODAY, TEMPLATE_LIBRARY, TEMPLATE_TEXTS, type ContractKind, type ContractTemplate, type StaffKey, type TemplateClause } from "./data"

/*
 * Templates library, with this session's changes (new versions, duplicates, new templates). Rules (brief §4):
 * - only one published version per template — new contracts use it;
 * - a contract stores the template id + version it was made from, so signed contracts never change;
 * - editing a published template creates a new draft version (New version); publishing it archives the old one
 *   (Publish in the template editor; signed contracts stay on the version they were signed on);
 * - clauses are stored in Arabic and English.
 */

type State = { edits: Record<string, ContractTemplate>; added: ContractTemplate[] }

const KEY = "ms.billing.templates"
const EMPTY: State = { edits: {}, added: [] }
let state: State = EMPTY
let loaded = false
const listeners = new Set<() => void>()

function load() {
  if (loaded || typeof window === "undefined") return
  loaded = true
  try {
    const raw = sessionStorage.getItem(KEY)
    if (raw) state = { ...state, ...(JSON.parse(raw) as Partial<State>) }
  } catch {}
}
function commit(next: State) {
  state = next
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state))
  } catch {}
  for (const l of listeners) l()
}
function subscribe(l: () => void) {
  load()
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

let cache: { s: State; list: ContractTemplate[] } | null = null
function listOf(s: State) {
  if (cache?.s === s) return cache.list
  const list = [...TEMPLATE_LIBRARY.map((t) => s.edits[t.id] ?? t), ...s.added.map((t) => s.edits[t.id] ?? t)]
  cache = { s, list }
  return list
}
const read = () => {
  load()
  return listOf(state)
}
const serverRead = () => TEMPLATE_LIBRARY

export const useTemplates = () => React.useSyncExternalStore(subscribe, read, serverRead)
export const templateById = (id: string) => read().find((t) => t.id === id)

export const publishedVersion = (t: ContractTemplate) => t.versions.find((v) => v.status === "published")
export const draftVersion = (t: ContractTemplate) => t.versions.find((v) => v.status === "draft")

/** Templates New contract can start from: the ones with a published version, of that type. */
export const publishedTemplates = (kind: ContractKind) => read().filter((t) => t.kind === kind && publishedVersion(t))

function save(t: ContractTemplate) {
  load()
  const base = TEMPLATE_LIBRARY.some((x) => x.id === t.id)
  commit(base ? { ...state, edits: { ...state.edits, [t.id]: t } } : { ...state, added: state.added.map((x) => (x.id === t.id ? t : x)) })
}

/** New version: a draft copy of the published version (one draft at a time — an existing draft is returned). */
export function newVersion(id: string, by: StaffKey): { template: ContractTemplate; version: number; created: boolean } | null {
  const t = templateById(id)
  if (!t) return null
  const draft = draftVersion(t)
  if (draft) return { template: t, version: draft.version, created: false }
  const top = Math.max(...t.versions.map((v) => v.version))
  const base = publishedVersion(t)
  const next: ContractTemplate = {
    ...t,
    versions: [
      // The draft starts as a copy of the published clauses; nothing is new yet.
      { version: top + 1, status: "draft", at: BILL_TODAY, by, basedOn: base?.version, clauses: base ? versionClauses(t, base.version).map((c) => ({ ...c, isNew: false })) : [] },
      ...t.versions,
    ],
  }
  save(next)
  return { template: next, version: top + 1, created: true }
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "template"

function uniqueId(base: string) {
  const ids = new Set(read().map((t) => t.id))
  let id = base
  for (let i = 2; ids.has(id); i++) id = `${base}-${i}`
  return id
}

/** Duplicate: a new template (draft v1) with the same clauses and placeholders. */
export function duplicateTemplate(id: string, by: StaffKey, copy: { en: string; ar: string }): ContractTemplate | null {
  const t = templateById(id)
  if (!t) return null
  const dup: ContractTemplate = {
    ...t,
    id: uniqueId(`${t.id}-copy`),
    name: { en: `${t.name.en} ${copy.en}`, ar: `${t.name.ar} ${copy.ar}` },
    usedIn: 0,
    copyOf: t.id,
    versions: [{ version: 1, status: "draft", at: BILL_TODAY, by }],
  }
  load()
  commit({ ...state, added: [...state.added, dup] })
  return dup
}

/** New template dialog: a draft v1, blank or copied from another template's clauses. */
export function createTemplate(input: { name: string; kind: ContractKind; from?: string; bilingual: boolean }, by: StaffKey): ContractTemplate {
  const src = input.from ? templateById(input.from) : undefined
  const t: ContractTemplate = {
    id: uniqueId(`${input.kind}-${slug(input.name)}`),
    kind: input.kind,
    name: { en: input.name.trim(), ar: input.name.trim() },
    basis: src?.basis,
    clauses: src?.clauses ?? [],
    placeholders: src?.placeholders ?? [],
    languages: input.bilingual ? "both" : "ar",
    firstSigner: src?.firstSigner ?? "party",
    usedIn: 0,
    copyOf: src?.id,
    versions: [{ version: 1, status: "draft", at: BILL_TODAY, by }],
  }
  load()
  commit({ ...state, added: [...state.added, t] })
  return t
}

/** The clause list of a version: its own clauses when the editor has them, else the template's titles + additions. */
export function clausesOfVersion(t: ContractTemplate, version: number) {
  const v = t.versions.find((x) => x.version === version)
  if (v?.clauses) return v.clauses.map((c) => c.title)
  return [...t.clauses, ...(v?.extraClauses ?? [])]
}

const keyOf = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "clause"

/** A version's clauses with their text (built from the titles for versions never opened in the editor; locked). */
export function versionClauses(t: ContractTemplate, version: number): TemplateClause[] {
  const v = t.versions.find((x) => x.version === version)
  if (v?.clauses) return v.clauses
  return clausesOfVersion(t, version).map((title) => ({ key: keyOf(title.en), title, text: TEMPLATE_TEXTS[title.en] ?? { en: "", ar: "" }, locked: true }))
}

/** Save draft (template editor): the draft's clauses, stamped with the save time. */
export function saveTemplateDraft(id: string, version: number, clauses: TemplateClause[], at: string) {
  const t = templateById(id)
  if (!t) return
  save({ ...t, versions: t.versions.map((v) => (v.version === version && v.status === "draft" ? { ...v, clauses, savedAt: at } : v)) })
}

/**
 * Publish: the draft becomes the one published version (new contracts use it from now); the old published version is
 * archived but kept, with the contracts signed on it. The template's clause titles follow the new version.
 */
export function publishTemplate(id: string, version: number, clauses: TemplateClause[], at: string) {
  const t = templateById(id)
  if (!t) return
  save({
    ...t,
    clauses: clauses.map((c) => c.title),
    usedIn: 0,
    versions: t.versions.map((v) =>
      v.version === version
        ? { ...v, status: "published", at: at.slice(0, 10), clauses, savedAt: at }
        : v.status === "published"
          ? { ...v, status: "archived", signedOn: t.usedIn }
          : v
    ),
  })
}

export type TemplateChange = { kind: "edited" | "added" | "removed"; n: number; title: TemplateClause["title"] }

/** "Changes from v4": clauses added, edited (title, text or lock) and removed since the version it was based on. */
export function changesFrom(base: TemplateClause[], draft: TemplateClause[]): TemplateChange[] {
  const out: TemplateChange[] = []
  draft.forEach((c, i) => {
    const old = base.find((b) => b.key === c.key)
    if (!old || c.isNew) out.push({ kind: "added", n: i + 1, title: c.title })
    else if (old.title.en !== c.title.en || old.title.ar !== c.title.ar || old.text.en !== c.text.en || old.text.ar !== c.text.ar || old.locked !== c.locked)
      out.push({ kind: "edited", n: i + 1, title: c.title })
  })
  base.forEach((b, i) => {
    if (!draft.some((c) => c.key === b.key)) out.push({ kind: "removed", n: i + 1, title: b.title })
  })
  return out.sort((a, z) => (a.kind === "removed" ? 1 : 0) - (z.kind === "removed" ? 1 : 0) || a.n - z.n)
}
