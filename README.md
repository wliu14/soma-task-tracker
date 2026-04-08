# Soma Capital Technical Assessment

This is a technical assessment as part of the interview process for Soma Capital.

> [!IMPORTANT]  
> You will need a Pexels API key to complete the technical assessment portion of the application. You can sign up for a free API key at https://www.pexels.com/api/

To begin, clone this repository to your local machine.

## Development

This is a [Next.js](https://nextjs.org) app with a SQLite backend, intended to be run with the LTS version of Node.

```bash
npm install
npx prisma migrate dev   # applies migrations; creates prisma/dev.db on first run
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Quality checks:**

```bash
npm test          # vitest run
npm run lint      # ESLint (next/core-web-vitals)
npm run build     # production build + TypeScript check
```

Optional: add `PEXELS_API_KEY` to `.env.local` for image previews.

---

## Task

Modify the code to add support for **due dates**, **image previews**, and **task dependencies**.

### Part 1: Due dates

When a new task is created, users should be able to set a due date. The task list must show the due date; if the date is before today, show it in red.

### Part 2: Image generation

When a todo is created, search for and display a relevant image (Pexels API, task title as query). Show a loading state while the image loads.

### Part 3: Task dependencies

1. Allow tasks to have multiple dependencies  
2. Prevent circular dependencies  
3. Show the critical path  
4. Calculate the earliest possible start date for each task from its dependencies  
5. Visualize the dependency graph  

---

## Solution

### Quick start (clone → run → test)

```bash
git clone https://github.com/wliu14/soma-task-tracker
cd soma-task-tracker
npm install
npx prisma migrate dev
npm run dev          # app at http://localhost:3000
npm test             # automated tests
npm run lint         # ESLint
npm run build        # production build + typecheck
```

---

### Part 1 — Due dates

- **Create:** Optional due date on the add-task form (`TaskForm`).
- **Edit:** Each card has a date input and **Save due date**; `PATCH /api/todos/[id]` updates the stored date. API enforces ordering: a task’s due date cannot be before a dependency’s due date, and cannot be after a dependent’s due date when those dates exist.
- **Display:** Due date shown on the card; past dates use red styling and an “(OVERDUE)” label; future dates use green.

**Screenshot (placeholder):**

![Part 1 – Due dates and overdue styling](./docs/screenshots/part1-due-dates.png)

*Add your image at `docs/screenshots/part1-due-dates.png` or change the path above.*

**Primary files:** `app/components/TaskForm.tsx`, `app/components/TodoCard.tsx`, `app/api/todos/route.ts`, `app/api/todos/[id]/route.ts`, `lib/domain/todoRules.ts`

---

### Part 2 — Image previews

- On **POST /api/todos**, the server calls Pexels (if `PEXELS_API_KEY` is set), picks the first result, and stores `imageUrl` on the `Todo`.
- The key stays server-side; the client only sees the image URL.
- **TodoCard** uses `next/image` with a pulse overlay until `onLoadingComplete` fires.

**Screenshot (placeholder):**

![Part 2 – Image preview and loading](./docs/screenshots/part2-image-preview.png)

**Primary files:** `app/api/todos/route.ts`, `app/components/TodoCard.tsx`, `next.config.mjs` (remote image host)

---

### Part 3 — Dependencies

- **Multiple dependencies:** `TodoDependency` rows; add/remove via API and UI (details + buttons on each card).
- **Cycles:** Before creating an edge *dependent* → *dependency*, the API checks whether *dependency* can already reach *dependent* (BFS on the dependency graph). If yes, the request is rejected.
- **Earliest start & graph:** Centralized in `lib/scheduling.ts` and `DependencyGraph.tsx` (see **Definitions** and **Algorithms** below).

**Screenshot (placeholder):**

![Part 3 – Dependency graph and critical path](./docs/screenshots/part3-dependency-graph.png)

**Primary files:** `app/api/todos/[id]/dependencies/route.ts`, `app/components/DependencyGraph.tsx`, `lib/scheduling.ts`

---

### Database schema

**SQLite** via Prisma (`prisma/schema.prisma`). File DB: `prisma/dev.db` (gitignored).

| Model | Role |
|--------|------|
| **Todo** | Task: `title`, optional `dueDate`, optional `imageUrl`, `createdAt`. Relations: `dependsOn` (edges where this todo is the *dependent*), `dependedOnBy` (edges where this todo is the *dependency*). |
| **TodoDependency** | Directed edge: `dependentId` must wait on `dependencyId`. Unique on `(dependentId, dependencyId)`. Cascade delete when either todo is removed. |

```prisma
model Todo {
  id            Int              @id @default(autoincrement())
  title         String
  dueDate       DateTime?
  imageUrl      String?
  createdAt     DateTime         @default(now())
  dependsOn     TodoDependency[] @relation("DependentTodos")
  dependedOnBy  TodoDependency[] @relation("DependencyTodos")
}

model TodoDependency {
  id            Int   @id @default(autoincrement())
  dependentId   Int
  dependencyId  Int
  dependent     Todo  @relation("DependentTodos", fields: [dependentId], references: [id], onDelete: Cascade)
  dependency    Todo  @relation("DependencyTodos", fields: [dependencyId], references: [id], onDelete: Cascade)

  @@unique([dependentId, dependencyId], name: "TodoDependency_dependentId_dependencyId_key")
}
```

**Edge meaning:** “Task B depends on task A” ⇒ row with `dependentId = B`, `dependencyId = A`. Graph arrows in the UI follow that direction (A → B).

---

### API endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/todos` | List todos with `dependsOn` / `dependedOnBy` nested |
| `POST` | `/api/todos` | Create todo; body: `title`, optional `dueDate` (`YYYY-MM-DD`), optional `dependencyIds[]` |
| `PATCH` | `/api/todos/[id]` | Update todo; body: `dueDate` (`YYYY-MM-DD` or null) |
| `DELETE` | `/api/todos/[id]` | Delete todo (cascades dependencies) |
| `GET` | `/api/todos/[id]/dependencies` | List dependency rows for todo `[id]` |
| `POST` | `/api/todos/[id]/dependencies` | Add dependency; body: `{ "dependencyId": number }` |
| `DELETE` | `/api/todos/[id]/dependencies` | Remove dependency; body: `{ "dependencyId": number }`. **404** if that edge does not exist. |

Errors use JSON `{ "error": string }` with 4xx/5xx as appropriate. Request bodies are validated in `lib/api/validation.ts`.

---

### Algorithms

**1. Circular dependency check (Part 3)**  
When adding edge *D* → *C* (*C* depends on *D*), ask: is there already a path from *C* to *D*? BFS over edges (task → its dependencies). The adjacency list is built with **one** `findMany` on `TodoDependency` (all rows), then BFS is **O(V + E)** in memory with no per-node DB round-trips.

**2. Topological order**  
Kahn’s algorithm (in-degree count) produces an order for forward and backward scheduling passes.

**3. Earliest start date (precise definition)**  

All times are **whole-day offsets** from **today’s local calendar date** (`baseDate` = local midnight of “now”).

- Each task has an implicit **duration** of **1 day** unless `estimatedDurationDays` is passed into the scheduler only (not stored in the DB/UI yet).
- **Earliest start (ES):** 0 for tasks with no dependencies; otherwise **max** of **earliest finish (EF)** over all dependencies.
- **Earliest finish (EF):** max(ES + duration, **due-date offset**), where the due-date offset is days from `baseDate` to that due date (0 if no due date). The due date acts as a **minimum finish day** for that task.

The **earliest start date** shown in the UI is `baseDate + ES` days (local calendar).

**4. Critical path (what the orange graph means)**  

We use a **CPM-style** forward and backward pass:

- **Forward:** compute ES and EF for every task (as above).
- **Project end** *L* = max(EF) over all tasks.
- **Backward** (reverse topological order): for each task, **latest finish (LF)** = *L* if it has no successors, else **min** of successors’ **latest start (LS)**; **LS** = LF − duration.
- **Slack (total float)** = LF − EF. **`slackCriticalNodes`** = tasks with slack = 0 (strict “critical” in textbook terms).

The **graph** unions two sets so the highlighted path is **connected**:

- **`slackCriticalNodes`** — zero slack.
- **Driver spine** — walk backward from every task whose EF = *L*, following the dependency that **set** that task’s ES (the predecessor with maximum EF).

So **`criticalPathNodes`** (orange in the graph) = slack-critical ∪ driver spine. That way upstream tasks on the chain that finishes last are still highlighted even when strict slack is only zero on the last task (e.g. a late due date on a dependent).

**5. Graph layout**  
Nodes are grouped by **ES offset** (column). Columns are **compressed** to sequential indices so wide day gaps do not stretch the SVG. Edges are SVG lines with arrow markers; orange when both endpoints are in `criticalPathNodes`.

---

### Extra product features

| Feature | Behavior |
|---------|-----------|
| **Edit due date** | Per-task date field + **Save due date**; validated against dependency/dependent ordering on the server. |
| **Scroll dependency graph** | Graph lives in a scrollable container so large graphs stay usable. |
| **Node details** | Click a node to see **title**, **earliest possible start**, and **due date** when set. |


