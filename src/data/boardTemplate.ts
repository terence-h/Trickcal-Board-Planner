import board1Csv from './board_1.csv?raw'
import board2Csv from './board_2.csv?raw'
import board3Csv from './board_3.csv?raw'
import { DEFAULT_SORT_STATE, STAT_KEYS } from '../types'
import type { BoardData, CharacterEntry, StatKey } from '../types'
import { parseCsvLine } from '../utils/csv'

interface RawBoardTemplate {
  id: string
  name: string
  rows: CharacterEntry[]
}

const BOARD_FILES: Array<{ id: string; name: string; csv: string }> = [
  { id: 'board-1', name: 'Board 1', csv: board1Csv },
  { id: 'board-2', name: 'Board 2', csv: board2Csv },
  { id: 'board-3', name: 'Board 3', csv: board3Csv },
]

const HEADER_INDEX = {
  name: 0,
  atk: 1,
  hp: 2,
  def: 3,
  critHitDmg: 4,
  critHitDmgRes: 5,
} satisfies Record<StatKey | 'name', number>

function parseTemplateRows(csv: string): CharacterEntry[] {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.replace(/\r$/, ''))
    .filter((line) => line.trim().length > 0)

  if (lines.length < 3) {
    return []
  }

  return lines.slice(2).map((line) => {
    const cols = parseCsvLine(line)
    const stats: Partial<Record<StatKey, boolean>> = {}

    STAT_KEYS.forEach((key) => {
      const value = cols[HEADER_INDEX[key]]
      if (value !== undefined && value.trim() !== '') {
        stats[key] = false
      }
    })

    return {
      name: cols[HEADER_INDEX.name] ?? '',
      stats,
    }
  })
}

function buildTemplateBoards(): RawBoardTemplate[] {
  return BOARD_FILES.map((board) => ({
    id: board.id,
    name: board.name,
    rows: parseTemplateRows(board.csv),
  }))
}

export function createInitialBoardsFromTemplate(): BoardData[] {
  return buildTemplateBoards().map((board) => ({
    id: board.id,
    name: board.name,
    sort: { ...DEFAULT_SORT_STATE },
    hideCompletedCharacters: false,
    rows: board.rows.map((row) => ({
      name: row.name,
      stats: { ...row.stats },
    })),
  }))
}
