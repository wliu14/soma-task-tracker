# Soma Capital Technical Assessment

This is a technical assessment as part of the interview process for Soma Capital.

> [!IMPORTANT]
> You will need a Pexels API key to complete the technical assessment portion of the application. You can sign up for a free API key at https://www.pexels.com/api/

---

## Project Overview

Welcome to the **Soma Capital Technical Assessment**! This project is a comprehensive task management application built with modern web technologies. The application implements three key features:

1. **Due Dates** - Tasks can have optional due dates with visual indicators for overdue items
2. **Image Previews** - Automatic image fetching from Pexels API based on task titles
3. **Task Dependencies** - Complex dependency relationships with circular dependency prevention and critical path visualization

The application is built using **Next.js 14** with **React 18**, **TypeScript**, **Tailwind CSS**, and **Prisma ORM** with SQLite. It features a clean, responsive UI and robust backend API routes.

---

## Quick Start (3 Commands)

If you want to get up and running immediately:

```bash
git clone <your-repo-url>
cd soma-task-tracker
npm install && npx prisma migrate dev --name add-features && npm run dev
```

Then visit `http://localhost:3000` and start creating tasks!

---

## Solution

This solution implements all three required features: **due dates**, **image previews**, and **task dependencies** with a circular dependency prevention system and critical path visualization.

### Architecture Overview

**Technology Stack:**
- **Frontend:** Next.js 14 (React) with Tailwind CSS
- **Backend:** Next.js API Routes
- **Database:** SQLite with Prisma ORM
- **Image Service:** Pexels API (server-side proxy for security)

**Key Design Decisions:**
1. **Image fetching is server-side**: Pexels API key is stored in `.env.local` and never exposed to the client. Images are fetched once at task creation time and cached in the database.
2. **Circular dependency prevention**: Uses depth-first search (DFS) algorithm on the server to detect cycles before creating any dependency edge.
3. **Critical path calculation**: Uses topological sorting (Kahn's algorithm) to determine earliest start dates and identify the longest chain of dependencies.
4. **No external graph libraries**: Dependency graph visualization is built with SVG and React, keeping bundle size minimal and maintaining code simplicity.

### Features Implemented

#### Part 1: Due Dates ✓
- **Create**: Date picker in the task creation form allows users to optionally set a due date
- **Display**: Due dates shown in green text for upcoming tasks, red text for overdue tasks
- **Smart UI**: Clearly indicates "(OVERDUE)" status for past-due tasks
- **File**: `app/page.tsx` (form and display logic)

#### Part 2: Image Previews ✓
- **Auto-fetch**: When a task is created, the title is used to search Pexels API for a relevant image
- **Caching**: Images are stored in the database, eliminating repeat API calls
- **Loading State**: Skeleton animation while images load with lazy loading support
- **Graceful Fallback**: If Pexels API key is missing or invalid, tasks display without images
- **Files**:
  - `app/api/todos/route.ts` (Pexels fetch logic)
  - `app/page.tsx` (Image display with loading state)
  - `next.config.mjs` (Image domain whitelist)

#### Part 3: Task Dependencies ✓
- **Multiple Dependencies**: Each task can depend on multiple other tasks
- **Circular Dependency Prevention**: Server validates that adding a dependency won't create a cycle before persisting
- **Critical Path Visualization**: SVG graph highlights the longest chain of dependencies in orange
- **Earliest Start Dates**: Each task shows its earliest possible start day based on dependency chain
- **Topological Layout**: Graph nodes are arranged by dependency depth for visual clarity
- **Interactive Management**: Add/remove dependencies via dropdown menus on each task card
- **Files**:
  - `prisma/schema.prisma` (TodoDependency model)
  - `app/api/todos/[id]/dependencies/route.ts` (Dependency CRUD with validation)
  - `app/components/DependencyGraph.tsx` (SVG visualization)
  - `app/page.tsx` (UI for managing dependencies)

---

## Setup & Running Instructions

### Prerequisites
- Node.js 18+ (LTS version recommended)
- npm or yarn
- A free Pexels API key (optional, but required for image feature)

### Step 1: Install Dependencies

```bash
cd soma-task-tracker
npm install
```

### Step 2: Configure Environment Variables

Create a `.env.local` file in the project root:

```bash
PEXELS_API_KEY=your_pexels_api_key_here
```

**To get a Pexels API key:**
1. Go to https://www.pexels.com/api/
2. Sign up for a free account
3. Create a new app to get your API key
4. Copy the API key and paste it into `.env.local`

**Note:** If you skip this step, the app will still work—images simply won't be fetched and tasks will display without images.

### Step 3: Set Up the Database

Run Prisma migrations to create the SQLite database with the new schema:

```bash
npx prisma migrate dev --name add-features
```

This will:
- Create the SQLite database file (`prisma/dev.db`)
- Run migrations to add `dueDate` and `imageUrl` columns to `Todo`
- Create the new `TodoDependency` join table for managing task dependencies

### Step 4: Start the Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

### Step 5: Verify Installation

1. Open `http://localhost:3000` in your browser
2. The page should load with a "Things To Do App" header and a task creation form
3. Try creating a task:
   - Enter a task title
   - Optionally set a due date
   - Click "Add Task"
4. Verify the image appears (if Pexels API key is configured)
5. Try creating a second task and adding the first as a dependency
6. Try creating a cycle (e.g., A → B → C → A) to verify circular dependency prevention
7. Scroll down to see the dependency graph visualization

### Additional Commands

```bash
# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint

# View/manage database (Prisma Studio)
npx prisma studio
```

---

## Database Schema

### Todo Model
```prisma
model Todo {
  id           Int              @id @default(autoincrement())
  title        String           // Task title
  dueDate      DateTime?        // Optional due date
  imageUrl     String?          // URL of preview image from Pexels
  createdAt    DateTime         // Creation timestamp
  dependsOn    TodoDependency[] @relation("dependent")
  dependedOnBy TodoDependency[] @relation("dependency")
}
```

### TodoDependency Model
```prisma
model TodoDependency {
  id           Int  @id @default(autoincrement())
  dependentId  Int  // Task that depends on another
  dependencyId Int  // Task that must be done first
  dependent    Todo @relation("dependent", ...)
  dependency   Todo @relation("dependency", ...)
  @@unique([dependentId, dependencyId])  // Prevent duplicate edges
}
```

---

## API Endpoints

### GET /api/todos
Returns all tasks with their dependencies and details.

**Response:**
```json
[
  {
    "id": 1,
    "title": "Complete project",
    "dueDate": "2024-04-15T00:00:00Z",
    "imageUrl": "https://images.pexels.com/...",
    "createdAt": "2024-04-04T10:00:00Z",
    "dependsOn": [],
    "dependedOnBy": [{ "dependentId": 2, "dependency": {...} }]
  }
]
```

### POST /api/todos
Create a new task.

**Request Body:**
```json
{
  "title": "Buy groceries",
  "dueDate": "2024-04-10T00:00:00Z",
  "dependencyIds": [1, 2]
}
```

### DELETE /api/todos/[id]
Delete a task (dependencies cascade delete automatically).

### POST /api/todos/[id]/dependencies
Add a dependency to a task.

**Request Body:**
```json
{
  "dependencyId": 5
}
```

**Error Response (Circular Dependency):**
```json
{
  "error": "Adding this dependency would create a circular reference"
}
```

### DELETE /api/todos/[id]/dependencies
Remove a specific dependency.

**Request Body:**
```json
{
  "dependencyId": 5
}
```

---

## Algorithms Used

### Circular Dependency Detection
**Algorithm:** Breadth-First Search (BFS)
- When adding a dependency from Task A → Task B, we check if Task B can already reach Task A through existing dependencies
- If a path exists, the operation is rejected with a 400 error
- **Time Complexity:** O(V + E) where V is tasks and E is dependencies

### Critical Path & Earliest Start Date Calculation
**Algorithm:** Topological Sort (Kahn's Algorithm) + DP
1. Build dependency graph from all tasks
2. Topologically sort tasks using in-degree counting
3. For each task in topo order: `earliestStart[task] = max(earliestStart[dependency] + 1)`
4. Critical path = the longest chain from start to any leaf node
5. **Time Complexity:** O(V + E)

### Dependency Graph Layout
**Algorithm:** Column-based topological layout
- Group nodes by their topological depth (earliest start date)
- Arrange horizontally by depth, vertically within each depth level
- Draw edges with SVG arrows, highlighting critical path in orange

---

## Project Structure

```
soma-task-tracker/
├── 00_READ_ME_FIRST.txt          # Project overview and quick start guide
├── DELIVERY_SUMMARY.md           # Project completion checklist
├── DESIGN.md                     # Architecture and algorithm details
├── INDEX.md                      # File structure guide
├── QUICK_START.txt               # 3-command setup guide
├── README.md                     # This comprehensive documentation
├── SETUP.md                      # Detailed installation instructions
├── next-env.d.ts                 # Next.js TypeScript declarations
├── next.config.mjs               # Next.js configuration
├── package.json                  # Dependencies and scripts
├── postcss.config.mjs            # PostCSS configuration
├── tailwind.config.ts            # Tailwind CSS configuration
├── tsconfig.json                 # TypeScript configuration
├── app/
│   ├── globals.css               # Global styles
│   ├── layout.tsx                # Root layout component
│   ├── page.tsx                  # Main application page (~450 lines)
│   ├── api/
│   │   └── todos/
│   │       ├── route.ts          # GET/POST todos with image fetching
│   │       └── [id]/
│   │           ├── route.ts      # DELETE todo
│   │           └── dependencies/
│   │               └── route.ts  # Dependency CRUD with validation
│   └── components/
│       └── DependencyGraph.tsx   # SVG graph visualization (~180 lines)
├── fonts/                        # Custom fonts directory
├── lib/
│   └── prisma.ts                 # Prisma client singleton
└── prisma/
    ├── schema.prisma             # Database schema
    └── migrations/               # Database migrations
        ├── migration_lock.toml
        ├── 20241008160928_init/
        │   └── migration.sql
        └── 20260406063456_add_features/
            └── migration.sql
```

---

## Troubleshooting

### "Pexels API error" or images not loading
- Verify your API key is correct in `.env.local`
- Check that the API key has not expired
- Verify internet connection
- Images will still work if no key is provided (just won't display)

### "Circular dependency" error when adding a valid dependency
- This should not happen in normal use
- If it occurs, refresh the page to ensure client state is in sync with database

### Database error or migration fails
```bash
# Reset database (deletes all data)
rm prisma/dev.db
npx prisma migrate dev --name add-features
```

### Port 3000 already in use
```bash
npm run dev -- -p 3001
```
(or use any other available port)

---

## Testing the Features

### Test Due Dates
1. Create a task with a due date in the past
2. Verify the due date appears in **red** text with "(OVERDUE)" label
3. Create a task with a future due date
4. Verify the due date appears in **green** text

### Test Image Previews
1. Ensure Pexels API key is configured
2. Create a task titled "nature"
3. Wait 1-2 seconds
4. Verify an image appears in the task card
5. Try different task titles and see different images

### Test Circular Dependency Prevention
1. Create tasks: "A" and "B"
2. Make B depend on A
3. Try to make A depend on B
4. Verify an error message appears: "Adding this dependency would create a circular reference"

### Test Critical Path Visualization
1. Create a chain of 4+ tasks with dependencies
2. Scroll to "Task Dependency Graph" section
3. Verify nodes are arranged in columns by depth
4. Verify the longest chain is highlighted in orange
5. Each node should show "Day X" indicating earliest start date

---

## Performance Considerations

- **Image Caching**: Images are fetched once and cached in the database
- **Database Indices**: Unique constraint on `(dependentId, dependencyId)` prevents duplicate edges
- **Cascade Deletes**: Deleting a task automatically removes all related dependencies
- **Lazy Image Loading**: Next.js Image component uses lazy loading with blur placeholder

---

## Code Quality & Reliability

- **Type Safety**: Full TypeScript implementation with proper types
- **Error Handling**: All API routes include try-catch and return appropriate HTTP status codes
- **Input Validation**: All user inputs validated server-side
- **Database Consistency**: Prisma schema prevents invalid state (unique constraints, foreign keys, cascades)
- **No External Graph Libraries**: Custom SVG rendering keeps dependencies minimal
- **Responsive Design**: Mobile-friendly Tailwind CSS layout

---

## Submission Checklist

- [x] Part 1: Due Dates - set on creation, display with red for overdue
- [x] Part 2: Image Previews - fetch from Pexels, cache in DB, show loading state
- [x] Part 3: Dependencies - multiple per task, circular prevention, critical path, earliest start dates, visualization
- [x] All features tested and working
- [x] Code is clean, well-organized, and well-commented
- [x] README includes solution description and setup instructions
- [x] Ready to push to public GitHub repository

Thanks for your time and effort. We'll be in touch soon!
