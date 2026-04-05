import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import changelogCsv from './data/changelog.csv?raw'
import { createInitialBoardsFromTemplate } from './data/boardTemplate'
import { STAT_KEYS, STAT_LABELS } from './types'
import type {
  BoardData,
  PlannerData,
  SortKey,
  SortState,
  StatKey,
  Theme,
} from './types'
import {
  calculateBoardSummary,
  cloneBoards,
  loadStoredPlannerData,
  normalizePlannerData,
  savePlannerData,
} from './utils/plannerData'
import { parseCsvLine } from './utils/csv'

const TEMPLATE_BOARDS = createInitialBoardsFromTemplate()

interface ChangelogEntry {
  id: string
  date: Date
  changeItems: string[]
}

const CHANGELOG_MONTH_INDEX: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
}

const CHANGELOG_DATE_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

function parseChangelogDate(value: string): Date | null {
  const match = value.trim().match(/^(\d{2})\s([A-Za-z]{3})\s(\d{4})$/)
  if (!match) {
    return null
  }

  const day = Number(match[1])
  const month = CHANGELOG_MONTH_INDEX[match[2]]
  const year = Number(match[3])

  if (!Number.isInteger(day) || month === undefined || !Number.isInteger(year)) {
    return null
  }

  const parsedDate = new Date(Date.UTC(year, month, day))
  if (
    parsedDate.getUTCFullYear() !== year ||
    parsedDate.getUTCMonth() !== month ||
    parsedDate.getUTCDate() !== day
  ) {
    return null
  }

  return parsedDate
}

function parseChangelogEntries(csv: string): ChangelogEntry[] {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.replace(/\r$/, ''))
    .filter((line) => line.trim().length > 0)

  if (lines.length < 2) {
    return []
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.trim())
  const dateIndex = headers.indexOf('Date')
  const changesIndex = headers.indexOf('Changes')

  if (dateIndex === -1 || changesIndex === -1) {
    return []
  }

  return lines
    .slice(1)
    .map((line, index) => {
      const columns = parseCsvLine(line)
      const rawDate = (columns[dateIndex] ?? '').trim()
      const rawChanges = (columns[changesIndex] ?? '').trim()
      const parsedDate = parseChangelogDate(rawDate)
      const changeItems = rawChanges
        .split('[*]')
        .map((item) => item.trim())
        .filter((item) => item.length > 0)

      if (!parsedDate || changeItems.length === 0) {
        return null
      }

      return {
        id: `${parsedDate.toISOString()}-${index}`,
        date: parsedDate,
        changeItems,
      }
    })
    .filter((entry): entry is ChangelogEntry => entry !== null)
    .sort((a, b) => b.date.getTime() - a.date.getTime())
}

const CHANGELOG_ENTRIES = parseChangelogEntries(changelogCsv)

function hasStat(
  stats: Partial<Record<StatKey, boolean>>,
  key: StatKey,
): boolean {
  return Object.prototype.hasOwnProperty.call(stats, key)
}

function getDefaultPlannerData(): PlannerData {
  return {
    boards: cloneBoards(TEMPLATE_BOARDS),
    theme: 'dark',
  }
}

function getInitialPlannerData(): PlannerData {
  const storedData = loadStoredPlannerData(TEMPLATE_BOARDS)
  if (storedData) {
    return storedData
  }
  return getDefaultPlannerData()
}

function parseImportErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message
  }
  return 'Import failed. Please verify the file is valid JSON.'
}

interface BoardPageProps {
  board: BoardData
  sortState: SortState
  onSortChange: (boardId: string, nextSort: SortState) => void
  onHideCompletedChange: (boardId: string, nextHideCompletedCharacters: boolean) => void
  onToggle: (
    boardId: string,
    characterName: string,
    statKey: StatKey,
    nextChecked: boolean,
  ) => void
}

type BoardRow = BoardData['rows'][number]

function compareRows(a: BoardRow, b: BoardRow, sortState: SortState): number {
  const nameCompare = a.name.localeCompare(b.name)

  if (sortState.key === 'name') {
    return sortState.direction === 'asc' ? nameCompare : -nameCompare
  }

  const statKey = sortState.key
  const eligibleA = hasStat(a.stats, statKey)
  const eligibleB = hasStat(b.stats, statKey)

  if (eligibleA !== eligibleB) {
    return eligibleA ? -1 : 1
  }

  if (!eligibleA && !eligibleB) {
    return nameCompare
  }

  const checkedA = a.stats[statKey] === true
  const checkedB = b.stats[statKey] === true

  if (checkedA !== checkedB) {
    if (sortState.direction === 'asc') {
      return checkedA ? 1 : -1
    }
    return checkedA ? -1 : 1
  }

  return nameCompare
}

function isRowFullyCompleted(row: BoardRow): boolean {
  const statValues = Object.values(row.stats)
  return statValues.length > 0 && statValues.every((value) => value === true)
}

function BoardPage({
  board,
  sortState,
  onSortChange,
  onHideCompletedChange,
  onToggle,
}: BoardPageProps) {
  const summary = calculateBoardSummary(board)

  const sortedRows = useMemo(() => {
    const nextRows = [...board.rows]
    nextRows.sort((a, b) => compareRows(a, b, sortState))
    return nextRows
  }, [board.rows, sortState])

  const visibleRows = useMemo(() => {
    if (!board.hideCompletedCharacters) {
      return sortedRows
    }
    return sortedRows.filter((row) => !isRowFullyCompleted(row))
  }, [board.hideCompletedCharacters, sortedRows])

  const handleSort = (key: SortKey) => {
    if (sortState.key === key) {
      onSortChange(board.id, {
        key,
        direction: sortState.direction === 'asc' ? 'desc' : 'asc',
      })
      return
    }

    onSortChange(board.id, {
      key,
      direction: 'asc',
    })
  }

  const getSortIndicator = (key: SortKey): string => {
    if (sortState.key !== key) {
      return '↕'
    }
    return sortState.direction === 'asc' ? '↑' : '↓'
  }

  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
        {board.name}
      </h1>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {STAT_KEYS.map((key) => (
          <article
            key={key}
            className="rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {STAT_LABELS[key]}
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
              {summary[key].completed}/{summary[key].eligible}
            </p>
          </article>
        ))}
      </div>

      <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
        <input
          type="checkbox"
          checked={board.hideCompletedCharacters}
          onChange={(event) => onHideCompletedChange(board.id, event.target.checked)}
          className="h-4 w-4 accent-sky-600"
        />
        Hide completed characters
      </label>

      <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead className="bg-slate-100 dark:bg-slate-800">
              <tr>
                <th className="border-b border-slate-200 bg-slate-100 px-4 py-3 text-left font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <button
                    type="button"
                    onClick={() => handleSort('name')}
                    className="inline-flex items-center gap-1 hover:text-sky-600 dark:hover:text-sky-400"
                  >
                    Character Name
                    <span aria-hidden="true" className="text-xs">
                      {getSortIndicator('name')}
                    </span>
                  </button>
                </th>
                {STAT_KEYS.map((key) => (
                  <th
                    key={key}
                    className="border-b border-slate-200 bg-slate-100 px-4 py-3 text-center font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <button
                      type="button"
                      onClick={() => handleSort(key)}
                      className="inline-flex items-center justify-center gap-1 hover:text-sky-600 dark:hover:text-sky-400"
                    >
                      {STAT_LABELS[key]}
                      <span aria-hidden="true" className="text-xs">
                        {getSortIndicator(key)}
                      </span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.name}>
                  <th className="whitespace-nowrap border-t border-slate-200 px-4 py-3 text-left font-medium text-slate-800 dark:border-slate-700 dark:text-slate-100">
                    {row.name}
                  </th>
                  {STAT_KEYS.map((key) => {
                    const eligible = hasStat(row.stats, key)
                    if (!eligible) {
                      return (
                        <td
                          key={`${row.name}-${key}`}
                          className="border-t border-slate-200 px-4 py-3 text-center text-slate-300 dark:border-slate-700 dark:text-slate-600"
                        >
                          —
                        </td>
                      )
                    }

                    return (
                      <td
                        key={`${row.name}-${key}`}
                        className="border-t border-slate-200 px-4 py-3 text-center dark:border-slate-700"
                      >
                        <input
                          type="checkbox"
                          checked={row.stats[key] === true}
                          onChange={(event) =>
                            onToggle(board.id, row.name, key, event.target.checked)
                          }
                          className="h-4 w-4 accent-sky-600"
                          aria-label={`${row.name} ${STAT_LABELS[key]}`}
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

function ChangelogPage() {
  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
        Changelog
      </h1>

      <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead className="bg-slate-100 dark:bg-slate-800">
              <tr>
                <th className="w-px whitespace-nowrap border-b border-slate-200 bg-slate-100 px-4 py-3 text-left font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  Date
                </th>
                <th className="w-full border-b border-slate-200 bg-slate-100 px-4 py-3 text-left font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  Changes
                </th>
              </tr>
            </thead>
            <tbody>
              {CHANGELOG_ENTRIES.length === 0 ? (
                <tr>
                  <td
                    colSpan={2}
                    className="border-t border-slate-200 px-4 py-3 text-slate-600 dark:border-slate-700 dark:text-slate-300"
                  >
                    No changelog entries.
                  </td>
                </tr>
              ) : (
                CHANGELOG_ENTRIES.map((entry) => (
                  <tr key={entry.id}>
                    <td className="whitespace-nowrap border-t border-slate-200 px-4 py-3 align-top font-medium text-slate-800 dark:border-slate-700 dark:text-slate-100">
                      {CHANGELOG_DATE_FORMATTER.format(entry.date)}
                    </td>
                    <td className="w-full border-t border-slate-200 px-4 py-3 dark:border-slate-700">
                      <ul className="list-disc space-y-1 pl-5 text-slate-800 dark:text-slate-200">
                        {entry.changeItems.map((change, index) => (
                          <li key={`${entry.id}-${index}`}>{change}</li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

function App() {
  const [plannerData, setPlannerData] = useState<PlannerData>(getInitialPlannerData)
  const [importError, setImportError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', plannerData.theme === 'dark')
  }, [plannerData.theme])

  useEffect(() => {
    savePlannerData(plannerData)
  }, [plannerData])

  const toggleTheme = () => {
    setPlannerData((prev) => ({
      ...prev,
      theme: (prev.theme === 'dark' ? 'light' : 'dark') as Theme,
    }))
  }

  const handleToggleStat = (
    boardId: string,
    characterName: string,
    statKey: StatKey,
    nextChecked: boolean,
  ) => {
    setPlannerData((prev) => ({
      ...prev,
      boards: prev.boards.map((board) => {
        if (board.id !== boardId) {
          return board
        }

        return {
          ...board,
          rows: board.rows.map((row) => {
            if (row.name !== characterName || !hasStat(row.stats, statKey)) {
              return row
            }

            return {
              ...row,
              stats: {
                ...row.stats,
                [statKey]: nextChecked,
              },
            }
          }),
        }
      }),
    }))
  }

  const handleSortChange = (boardId: string, nextSort: SortState) => {
    setPlannerData((prev) => ({
      ...prev,
      boards: prev.boards.map((board) =>
        board.id === boardId
          ? {
              ...board,
              sort: nextSort,
            }
          : board,
      ),
    }))
  }

  const handleHideCompletedChange = (
    boardId: string,
    nextHideCompletedCharacters: boolean,
  ) => {
    setPlannerData((prev) => ({
      ...prev,
      boards: prev.boards.map((board) =>
        board.id === boardId
          ? {
              ...board,
              hideCompletedCharacters: nextHideCompletedCharacters,
            }
          : board,
      ),
    }))
  }

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(plannerData, null, 2)], {
      type: 'application/json',
    })
    const downloadUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = downloadUrl
    anchor.download = 'trickcal-board-planner-data.json'
    anchor.click()
    URL.revokeObjectURL(downloadUrl)
  }

  const handleImportJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as unknown
      const normalized = normalizePlannerData(parsed, TEMPLATE_BOARDS)

      if (!normalized) {
        throw new Error(
          'Invalid JSON shape. Expected boards with board ids, row names, and stat values.',
        )
      }

      setPlannerData(normalized)
      setImportError(null)
    } catch (error) {
      setImportError(parseImportErrorMessage(error))
    } finally {
      event.target.value = ''
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header
        className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-700 dark:bg-slate-900/90"
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <nav className="flex flex-wrap items-center gap-2">
            {plannerData.boards.map((board) => (
              <NavLink
                key={board.id}
                to={`/${board.id}`}
                className={({ isActive }) =>
                  `rounded-md px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'bg-sky-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                  }`
                }
              >
                {board.name}
              </NavLink>
            ))}
            <NavLink
              to="/changelog"
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                }`
              }
            >
              Changelog
            </NavLink>
          </nav>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
            >
              {plannerData.theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
            </button>
            <button
              type="button"
              onClick={handleExportJson}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
            >
              Export JSON
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
            >
              Import JSON
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              onChange={handleImportJson}
              className="hidden"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {importError && (
          <div className="mb-4 rounded-md border border-red-300 bg-red-100 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {importError}
          </div>
        )}

        <Routes>
          <Route
            path="/"
            element={<Navigate to={`/${plannerData.boards[0].id}`} replace />}
          />
          {plannerData.boards.map((board) => (
            <Route
              key={board.id}
              path={`/${board.id}`}
              element={
                <BoardPage
                  board={board}
                  sortState={board.sort}
                  onSortChange={handleSortChange}
                  onHideCompletedChange={handleHideCompletedChange}
                  onToggle={handleToggleStat}
                />
              }
            />
          ))}
          <Route path="/changelog" element={<ChangelogPage />} />
          <Route
            path="*"
            element={<Navigate to={`/${plannerData.boards[0].id}`} replace />}
          />
        </Routes>
      </main>
    </div>
  )
}

export default App
