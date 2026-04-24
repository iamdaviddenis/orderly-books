import type { AppState, CategorizationRule, IsoDate, Tier } from '../schema'
import { newId } from '../ids'
import { isoNow } from '../dates'

export type CategorizationResult = { categoryId: string; tier?: Tier }

function normalize(s: string) {
  return s.trim().toLowerCase()
}

export function autoCategorize(state: AppState, payee: string): CategorizationResult | null {
  const p = normalize(payee)
  const rules = state.categorizationRules
    .slice()
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  const match = rules.find((r) => normalize(p).includes(normalize(r.pattern)))
  if (!match) return null
  return { categoryId: match.categoryId, tier: match.tier }
}

export function learnCategorizationOverride(
  payee: string,
  categoryId: string,
  tier?: Tier,
  at: IsoDate = isoNow(),
): CategorizationRule {
  const pattern = normalize(payee)
  return {
    id: newId('rule'),
    pattern: pattern.length > 32 ? pattern.slice(0, 32) : pattern,
    categoryId,
    tier,
    updatedAt: at,
  }
}
