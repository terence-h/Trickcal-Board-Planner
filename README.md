# Trickcal Board Planner

React web app for tracking Trickcal Apostles Board (Global).

Hosted in Cloudflare Pages: [https://trickcal-board-planner.pages.dev/](https://trickcal-board-planner.pages.dev/)

## Features

- No account needed
- Your board data, sorting choices, board preferences, and theme setting are saved in your browser. You can easily export or import them as a JSON file.
- Includes a Changelog page populated from `/src/data/changelog.csv`, sorted latest-to-oldest by date (`DD MMM YYYY`), with `[*]` markers rendered as unordered list items.

## Data behavior

- On first run, data is initialized from the 3 bundled CSV files as a template only:
  - Character list and stat eligibility are preserved
  - All eligible checkboxes are initialized to `false`
- If localStorage already contains valid planner data, that data is used instead
- Summaries recalculate automatically whenever checkboxes are toggled
- Table rows are populated using CSV templates located in `/src/data/board_x.csv`
- A single JSON payload in localStorage stores all board data, theme setting, sorting preferences, and filters per board, with support for JSON import and export.

## Development

```bash
npm install
npm run dev
```

## Production

```bash
npm run lint
npm run build
```
