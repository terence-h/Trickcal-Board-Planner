import { DEFAULT_SORT_STATE, STAT_KEYS, STAT_LABELS } from '../types'
import type {
  BoardData,
  PlannerData,
  SortDirection,
  SortKey,
  SortState,
  StatKey,
  StatSummary,
  Theme,
} from '../types'

const STORAGE_KEY = 'trickcal-board-planner:data'

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }
  return value as Record<string, unknown>
}

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark'
}

function isSortDirection(value: unknown): value is SortDirection {
  return value === 'asc' || value === 'desc'
}

function isSortKey(value: unknown): value is SortKey {
  return typeof value === 'string' && (value === 'name' || value in STAT_LABELS)
}

function normalizeSortState(value: unknown): SortState {
  const input = asRecord(value)
  if (!input) {
    return { ...DEFAULT_SORT_STATE }
  }

  const key = isSortKey(input.key) ? input.key : DEFAULT_SORT_STATE.key
  const direction = isSortDirection(input.direction)
    ? input.direction
    : DEFAULT_SORT_STATE.direction

  return { key, direction }
}

function hasStatKey(stats: Partial<Record<StatKey, boolean>>, key: StatKey): boolean {
  return Object.prototype.hasOwnProperty.call(stats, key)
}

export function cloneBoards(boards: BoardData[]): BoardData[] {
  return boards.map((board) => ({
    id: board.id,
    name: board.name,
    sort: { ...board.sort },
    hideCompletedCharacters: board.hideCompletedCharacters,
    rows: board.rows.map((row) => ({
      name: row.name,
      stats: { ...row.stats },
    })),
  }))
}

export function normalizePlannerData(
  value: unknown,
  templateBoards: BoardData[],
): PlannerData | null {
  const root = asRecord(value)
  if (!root || !Array.isArray(root.boards)) {
    return null
  }

  const incomingBoardMap = new Map<string, Record<string, unknown>>()
  root.boards.forEach((board) => {
    const boardRecord = asRecord(board)
    if (!boardRecord || typeof boardRecord.id !== 'string') {
      return
    }
    incomingBoardMap.set(boardRecord.id, boardRecord)
  })

  const boards = templateBoards.map((templateBoard) => {
    const incomingBoard = incomingBoardMap.get(templateBoard.id)
    const incomingRows = Array.isArray(incomingBoard?.rows) ? incomingBoard.rows : []

    const incomingRowMap = new Map<string, Record<string, unknown>>()
    incomingRows.forEach((row) => {
      const rowRecord = asRecord(row)
      if (!rowRecord || typeof rowRecord.name !== 'string') {
        return
      }
      incomingRowMap.set(rowRecord.name, rowRecord)
    })

    return {
      id: templateBoard.id,
      name: templateBoard.name,
      sort: normalizeSortState(incomingBoard?.sort ?? templateBoard.sort),
      hideCompletedCharacters: incomingBoard?.hideCompletedCharacters === true,
      rows: templateBoard.rows.map((templateRow) => {
        const incomingRow = incomingRowMap.get(templateRow.name)
        const incomingStats = asRecord(incomingRow?.stats) ?? {}
        const normalizedStats: Partial<Record<StatKey, boolean>> = {}

        STAT_KEYS.forEach((key) => {
          if (!hasStatKey(templateRow.stats, key)) {
            return
          }
          normalizedStats[key] = incomingStats[key] === true
        })

        return {
          name: templateRow.name,
          stats: normalizedStats,
        }
      }),
    }
  })

  return {
    boards,
    theme: isTheme(root.theme) ? root.theme : 'dark',
  }
}

export function loadStoredPlannerData(templateBoards: BoardData[]): PlannerData | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw === null) {
    return null
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw) as unknown
  } catch (error) {
    console.error('Ignoring invalid stored planner JSON.', error)
    localStorage.removeItem(STORAGE_KEY)
    return null
  }

  const normalized = normalizePlannerData(parsed, templateBoards)
  if (!normalized) {
    console.error('Ignoring stored planner data with invalid schema.')
    localStorage.removeItem(STORAGE_KEY)
    return null
  }

  return normalized
}

export function savePlannerData(data: PlannerData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function calculateBoardSummary(
  board: BoardData,
): Record<StatKey, StatSummary> {
  const summary = {
    atk: { completed: 0, eligible: 0 },
    hp: { completed: 0, eligible: 0 },
    def: { completed: 0, eligible: 0 },
    critHitDmg: { completed: 0, eligible: 0 },
    critHitDmgRes: { completed: 0, eligible: 0 },
  } satisfies Record<StatKey, StatSummary>

  board.rows.forEach((row) => {
    STAT_KEYS.forEach((key) => {
      if (!hasStatKey(row.stats, key)) {
        return
      }
      summary[key].eligible += 1
      if (row.stats[key] === true) {
        summary[key].completed += 1
      }
    })
  })

  return summary
}
