# Neuron Kanban — Product overview (EN)

## Purpose

A web app for team task management: **Neuron Kanban** board, Gantt chart, AI assistant (text → tasks and contextual chat), and a Telegram bot.

## User flows

### Board

- Columns: **global backlog** (thin strip at the top), sprint backlog, product & technical development, testing, done in sprint; **done long ago** as a horizontal archive strip at the bottom.
- Drag via the **grip** on the left; clicking the card body opens the editor.
- **History** — circular “?” control; dragging does not start from the history control (handle is separate).
- **Filters** (assignee, Neuron block, priority): non-matching cards are **faded**; order and drag-and-drop stay consistent for all tasks.
- **Delete** is **admin-only** (in the edit modal). No delete on the card hover.

### Task fields

- Title, description, column, assignee, priority, difficulty, dates, dependencies.
- **Neuron block** — which part of the platform the task belongs to (chat, agent system, functions, documents; plus service categories).
- **Artifacts** — attachments (name, MIME, data URL), up to 3 × 400 KB in the UI.

### Gantt

- Week / day / month; table under the chart reflects dates and dependencies.
- While **dragging** a bar, the **table updates live** as a preview.
- On **mouse up**, a **confirmation** dialog appears; optional “don’t show for 5 minutes” (`sessionStorage`).
- **CSV export (UTF-8 BOM)** for Excel.
- Calm **flat** styling for bars and grid rows; day view avoids harsh alternating row stripes.

### AI

- **Board tasks** — parse text into a batch preview (P/D not shown in the simplified preview); confirm creates tasks.
- **Chat** — ask about backlog and tasks with model context; **no automatic card creation**.

### i18n

- **Russian / English** switch in the header; persisted in `localStorage`.

## Roles

- **User** — edit tasks and columns (date rules enforced by API).
- **Admin** — change dates on existing tasks, delete tasks.

## Value

Single place for backlog, sprint, and archive; tasks aligned with Neuron subsystems; fast capture via AI; Gantt with guardrails against accidental date moves.
