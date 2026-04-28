# Neuron Kanban — техническая документация (RU)

## Стек

- **Next.js 14** (App Router), React 18, Tailwind CSS  
- **Prisma** + **SQLite** (`DATABASE_URL`)  
- **@hello-pangea/dnd** — канбан  
- **frappe-gantt** — диаграмма Ганта (динамический импорт, только клиент)  
- **Yandex Cloud / OpenAI-совместимый API** — `/api/ai/parse`, `/api/ai/chat`, бот (`grammy`, `openai`)  
- **Telegram** — см. `src/bot/`

## Схема данных (Prisma)

Модели `User`, `Task`, `TaskHistory`. У `Task`:

- `neuronBlock: String @default("CHAT")` — идентификатор из `lib/neuronBlocks.ts`  
- `artifacts: String?` — JSON-массив `{ id, name, mimeType, dataUrl }` (см. `types/index.ts`: `parseArtifactsJson`)

После изменения схемы: `npx prisma db push` или миграция; `npx prisma generate`.

## API (основное)

| Метод | Путь | Назначение |
|--------|------|--------------|
| GET/POST | `/api/tasks` | Список / создание |
| PATCH/DELETE | `/api/tasks/[id]` | Обновление / удаление (**DELETE только admin**, заголовок `x-actor-id`) |
| GET | `/api/tasks/[id]/history` | История |
| POST | `/api/ai/parse` | JSON задач из текста |
| POST | `/api/ai/chat` | Ответ ассистента с контекстом задач (`locale`) |
| GET/PATCH | `/api/users` | Пользователи, роль `admin` |

Заголовок **`x-actor-id`** — текущий пользователь из шапки (см. `hooks/useCurrentUser.ts`).

## Локализация

- `lib/i18n/dictionaries.ts` — строки `ru` / `en`  
- `components/providers/LocaleProvider.tsx` — контекст, `useLocale()`, ключ `neuron-kanban-locale`

## Гант: сдвиг дат и превью

- `on_date_change` frappe-gantt: либо немедленный PATCH (если отключено предупреждение в `sessionStorage` ключ `gantt_date_confirm_dismiss_until`), либо показ модалки и PATCH после подтверждения.  
- Превью строк таблицы: `mousemove` на SVG, `gantt.get_bar(bar_being_dragged).compute_start_end_date()`.

## Известные ограничения

- Путь проекта с символом **`!`** ломает **production `next build`** (ограничение Webpack). Для CI/продакшена используйте каталог без `!`.  
- На Windows `prisma generate` может дать **EPERM** при переименовании `query_engine` — закройте процессы и повторите.

## Структура каталогов (фрагмент)

- `app/board`, `app/gantt` — страницы  
- `components/board`, `components/gantt`, `components/ai`, `components/layout`  
- `lib/constants.ts` — колонки, прогресс для Ганта, цвета команды  
- `lib/boardFilters.ts` — фильтры доски  
