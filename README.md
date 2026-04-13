# Soma Capital Technical Assessment

This is a technical assessment as part of the interview process for Soma Capital.

> [!IMPORTANT]  
> You will need a Pexels API key to complete the technical assessment portion of the application. You can sign up for a free API key at [https://www.pexels.com/api/](https://www.pexels.com/api/)

To begin, clone this repository to your local machine.

## Development

This is a [Next.js](https://nextjs.org) app with a SQLite backend, intended to be run with the LTS version of Node.

```bash
npm install
npx prisma migrate dev   # applies migrations; creates prisma/dev.db on first run
npm run dev

# Open [http://localhost:3000](http://localhost:3000).
```

**Quality checks:**

```bash
npm test          # vitest run
npm run lint      # ESLint (next/core-web-vitals)
npm run build     # production build + TypeScript check

# Optional: add `PEXELS_API_KEY` to `.env.local` for image previews.
```

---

## Task

Modify the code to add support for **due dates**, **image previews**, and **task dependencies**.

### Part 1: Due dates

When a new task is created, users should be able to set a due date. 

When showing the task list is shown, it must display the due date, and if the date is past the current time, the due date should be in red.

### Part 2: Image generation

When a todo is created, search for and display a relevant image to visualize the task to be done.

To do this, make a request to the Pexels API using the task description as a search query. Display the returned image to the user within the appropriate todo item. While the image is being loaded, indicate a loading state.

You will need to sign up for a free Pexels API key to make the fetch request.

### Part 3: Task dependencies

Implement a task dependency system that allows tasks to depend on other tasks. The system must:

1. Allow tasks to have multiple dependencies
2. Prevent circular dependencies
3. Show the critical path
4. Calculate the earliest possible start date for each task based on its dependencies
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

### Demo walkthrough

Screen recording (no soundtrack): **[Demo-NoAudio.mov](./Demo-NoAudio.mov)**

There is **no audio** on purpose. The clip is a straight walkthrough of the running app so you can see the project as a working concept: creating tasks, due dates and images, dependencies, invalid edges, and the dependency graph. This includes how the schedule and critical-path styling behave in the UI. Open or download the file from the repo root (GitHub shows a download link on the file page).

---

### Part 1 — Due Dates

- **Create:** The add-task form requires a title and supports an optional due date.
- **Enforce:** A task due date cannot be earlier than any dependency due date, and cannot be later than any dependent due date (when those dates exist).
- **Display:** The due date is shown on each card; overdue dates are red with an “(OVERDUE)” label, and upcoming dates are green.
- **Edit:** Users can update due dates from each task card.

![Part 1 – Due Dates and Overdue](docs/part1-due-dates.png)

**Primary files:** `app/components/TaskForm.tsx`, `app/components/TodoCard.tsx`, `app/api/todos/route.ts`, `app/api/todos/[id]/route.ts`, `lib/domain/todoRules.ts`

---

### Part 2 — Image Previews

- On `POST /api/todos`, the server calls Pexels (when `PEXELS_API_KEY` is present) using the **task title** as the search query (the UI’s primary text field for the task).
- The first result is stored as `imageUrl` on the `Todo`.
- **Loading:** Creating a task waits on the server until the Pexels call finishes (or is skipped if there is no key). Each card keeps a fixed-size image area; while the browser loads the remote image, you see that area fill in (gray behind the image until it paints). There is no separate spinner overlay on the card.
- Each task card always shows a consistent image area:
  - Shows the fetched image when available
  - Shows **No image available** when no URL exists
  - Shows **Couldn't load image** when the URL fails to load

![Part 2 – Image Preview](docs/part2-image-preview.png)

![Part 2 – Image Failure](docs/part2-image-failure-template.png)

**Primary files:** `app/api/todos/route.ts`, `app/components/TodoCard.tsx`, `next.config.mjs` (remote image host)

---

### Part 3 — Dependencies

- Tasks can have multiple dependencies. You can pick dependencies when **creating** a task (checkboxes) and **add or remove** them later from each card.
- Cycle creation is blocked using a BFS reachability check before insertion.
- Due-date ordering is enforced against both dependencies and dependents.
- The directed graph is interactive and shows earliest start and due date details on node click.

(See **Algorithms** for implementation details.)

![Part 3 – Dependency Interface](docs/part3-dependency-interface.png)

![Part 3 – Invalid end date](docs/part3-invalid-end-date.png)

![Part 3 – Circular dependency](docs/part3-circular-dependency.png)

![Part 3 – Dependency graph](docs/part3-dependency-graph.png)

**Primary files:** `app/api/todos/[id]/dependencies/route.ts`, `app/components/DependencyGraph.tsx`, `lib/scheduling.ts`, `app/hooks/useTodos.ts` (earliest-start labels on cards)

---

### Database schema

**SQLite** via Prisma (`prisma/schema.prisma`). File DB: `prisma/dev.db` (gitignored).


| Model              | Role                                                                                                                                                                                                |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Todo**           | Task: `title`, optional `dueDate`, optional `imageUrl`, `createdAt`. Relations: `dependsOn` (edges where this todo is the *dependent*), `dependedOnBy` (edges where this todo is the *dependency*). |
| **TodoDependency** | Directed edge: `dependentId` must wait on `dependencyId`. Unique on `(dependentId, dependencyId)`. Cascade delete when either todo is removed.                                                      |


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

Dependency direction in this project:

- If task **B** depends on task **A**, then `dependentId = B` and `dependencyId = A`.
- In the graph, this is rendered as **A -> B**.

---

### API endpoints


| Method   | Path                           | Purpose                                                                                     |
| -------- | ------------------------------ | ------------------------------------------------------------------------------------------- |
| `GET`    | `/api/todos`                   | List todos with `dependsOn` / `dependedOnBy` nested                                         |
| `POST`   | `/api/todos`                   | Create todo; body: `title`, optional `dueDate` (`YYYY-MM-DD`), optional `dependencyIds[]`   |
| `PATCH`  | `/api/todos/[id]`              | Update todo; body: `dueDate` (`YYYY-MM-DD` or null)                                         |
| `DELETE` | `/api/todos/[id]`              | Delete todo (cascades dependencies)                                                         |
| `GET`    | `/api/todos/[id]/dependencies` | List dependency rows for todo `[id]`                                                        |
| `POST`   | `/api/todos/[id]/dependencies` | Add dependency; body: `{ "dependencyId": number }`                                          |
| `DELETE` | `/api/todos/[id]/dependencies` | Remove dependency; body: `{ "dependencyId": number }`. **404** if that edge does not exist. |


Errors use JSON `{ "error": string }` with 4xx/5xx as appropriate. Request bodies are validated in `lib/api/validation.ts`.

---

### Algorithms

**1) Circular dependency check (edge insertion)**  
When adding edge `dependent -> dependency`, we test whether `dependency` can already reach `dependent`.

- Build adjacency lists once with one `findMany` on `TodoDependency`.
- Run BFS over edges (task -> its dependencies).
- If reachable, reject the insert (it would create a cycle).

**2) Task order**  
Before we calculate dates, we need an order where prerequisites come first.

Example:

- If `B` depends on `A`, we must process `A` before `B`.
- If `C` depends on `B`, we process `A -> B -> C`.

Kahn’s topological sort (a dependency-safe ordering) gives us this valid order automatically.

Why this matters:

- We never compute a task before its dependencies are known.
- This makes earliest-start calculations correct and stable.

**3) Earliest start date**  
All schedule values are day numbers counted from `baseDate` (today at local midnight).

Definitions:

- **ES (Earliest Start):** the first day a task is allowed to start.
- **EF (Earliest Finish):** the first day a task can be finished after considering duration and due-date floor.

For each task `v` in topological order:

- If `v` has no dependencies: `ES(v) = 0`.
- Else: `ES(v) = max(EF(u))` across all dependencies `u`.
- If a task has a due date, it cannot finish before that date.

The UI shows earliest start as a real date: `baseDate + ES` days.

**4) Critical path**  
After earliest times are known, we run a **backward pass** from the project’s latest finish: for each task we compute how late it could start or finish without pushing the **overall** end date. The gap between “earliest” and “latest” is **slack**. Tasks with **slack = 0** are **critical**: delaying them delays the whole schedule.

In the UI, **orange** highlights those zero-slack tasks **and** adds a **driver chain** (orange arrows along key dependencies) so the path toward the latest-finishing work is easy to follow—not only isolated slack-zero nodes. See `slackCriticalNodes` vs `criticalPathNodes` in `lib/scheduling.ts`.

**Note:** Each task is modeled as **one day** of work and due dates still act as a finish “floor” as described above.