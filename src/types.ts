export const STAT_KEYS = [
  'atk',
  'hp',
  'def',
  'critHitDmg',
  'critHitDmgRes',
] as const

export type StatKey = (typeof STAT_KEYS)[number]
export type SortKey = 'name' | StatKey
export type SortDirection = 'asc' | 'desc'

export interface SortState {
  key: SortKey
  direction: SortDirection
}

export const DEFAULT_SORT_STATE: SortState = {
  key: 'name',
  direction: 'asc',
}

export const STAT_LABELS: Record<StatKey, string> = {
  atk: 'ATK %',
  hp: 'HP%',
  def: 'DEF %',
  critHitDmg: 'Crit Hit & DMG %',
  critHitDmgRes: 'Crit Hit & DMG RES %',
}

export interface CharacterEntry {
  name: string
  stats: Partial<Record<StatKey, boolean>>
}

export interface BoardData {
  id: string
  name: string
  sort: SortState
  rows: CharacterEntry[]
}

export type Theme = 'light' | 'dark'

export interface PlannerData {
  boards: BoardData[]
  theme: Theme
}

export interface StatSummary {
  completed: number
  eligible: number
}
