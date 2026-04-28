# Neuron Kanban — Technical documentation (EN)

## Stack

- **Next.js 14** (App Router), React 18, Tailwind CSS  
- **Prisma** + **SQLite** (`DATABASE_URL`)  
- **@hello-pangea/dnd** — Kanban  
- **frappe-gantt** — Gantt (dynamic import, client-only)  
- **Yandex Cloud–compatible chat API** — `/api/ai/parse`, `/api/ai/chat`, bot (`grammy`, `openai`)  
- **Telegram** — see `src/bot/`

## Data model (Prisma)

`User`, `Task`, `TaskHistory`. `Task` includes:

- `neuronBlock: String @default("CHAT")` — id from `lib/neuronBlocks.ts`  
- `artifacts: String?` — JSON array `{ id, name, mimeType, dataUrl }` (`parseArtifactsJson` in `types/index.ts`)

After schema changes: `npx prisma db push` or migrate; `npx prisma generate`.

## HTTP API (core)

| Method | Path | Role |
|--------|------|------|
| GET/POST | `/api/tasks` | List / create |
| PATCH/DELETE | `/api/tasks/[id]` | Update / delete (**DELETE admin-only**, `x-actor-id` header) |
| GET | `/api/tasks/[id]/history` | Audit trail |
| POST | `/api/ai/parse` | Extract structured tasks from text |
| POST | `/api/ai/chat` | Assistant reply with task snapshot (`locale` body field) |
| GET/PATCH | `/api/users` | Users; `role: admin` |

Header **`x-actor-id`** — selected user from the header (`useCurrentUser`).

## i18n

- `lib/i18n/dictionaries.ts` — `ru` / `en` strings  
- `LocaleProvider` + `useLocale()` — storage key `neuron-kanban-locale`

## Gantt: date moves & preview

- frappe-gantt `on_date_change`: immediate PATCH if warning dismissed (`sessionStorage` `gantt_date_confirm_dismiss_until`), else modal then PATCH on confirm; cancel triggers parent refetch to revert SVG.  
- Table live preview: SVG `mousemove`, `gantt.get_bar(bar_being_dragged).compute_start_end_date()`.

## Known limitations

- A project path containing **`!`** breaks **`next build`** (Webpack reserved character). Use a path without `!` for production builds/CI.  
- On Windows, **`prisma generate`** may hit **EPERM** when replacing `query_engine` — close locking processes and retry.

## Directory layout (partial)

- `app/board`, `app/gantt`  
- `components/board`, `components/gantt`, `components/ai`, `components/layout`  
- `lib/constants.ts` — columns, Gantt progress, team palette  
- `lib/boardFilters.ts` — board filter helpers  
