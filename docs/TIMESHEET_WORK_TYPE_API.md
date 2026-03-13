# Timesheet Work Type — API & Architecture

## 1. Database schema (after migration)

**Table: `timesheets`**

| Column          | Type              | Nullable | Default   | Description |
|-----------------|-------------------|----------|-----------|-------------|
| id              | UUID              | NO       | gen_random_uuid() | PK |
| user_id         | UUID              | NO       | —         | FK → users(id) |
| work_type       | work_type_enum    | NO       | 'Project Work' | See enum below |
| project_id      | UUID              | YES      | NULL      | FK → projects(id); required when work_type = 'Project Work' |
| task_id         | UUID              | YES      | NULL      | FK → tasks(id); required when work_type = 'Project Work' |
| date            | DATE              | NO       | —         | Entry date |
| hours           | NUMERIC           | NO       | —         | 0.25–24 |
| activity_title  | TEXT              | YES      | NULL      | Required when work_type ≠ 'Project Work' |
| description     | TEXT              | YES      | NULL      | Optional notes |
| attachment_url  | TEXT              | YES      | NULL      | Optional |
| created_at      | TIMESTAMPTZ       | NO       | now()     | |
| updated_at      | TIMESTAMPTZ       | NO       | now()     | |

**Enum: `work_type_enum`**

- `Project Work`
- `Internal Meeting`
- `Learning / Training`
- `Support`
- `Leave`
- `Other`

**Constraints**

1. **timesheets_work_type_rules** (CHECK):  
   - If `work_type = 'Project Work'`: `project_id` and `task_id` NOT NULL, `activity_title` NULL.  
   - If `work_type != 'Project Work'`: `project_id` and `task_id` NULL, `activity_title` NOT NULL and non-empty (after trim).

2. **Task belongs to project:** Enforced in the application layer only (PostgreSQL CHECK cannot use subqueries). The backend validates via `repositories/timesheetRepository.taskBelongsToProject` and rejects with `TASK_PROJECT_MISMATCH` if the task’s project does not match.

3. **timesheets_hours_check**: `hours > 0 AND hours <= 24`.

**Indexes**

- `idx_timesheets_user_date (user_id, date)`
- `idx_timesheets_project_id (project_id)` WHERE project_id IS NOT NULL
- `idx_timesheets_work_type (work_type)`

---

## 2. Migration

Run after `01_schema.sql`:

```bash
psql "$DATABASE_URL" -f backend/scripts/04_timesheet_work_type.sql
```

Migration backfills existing rows: rows with both `project_id` and `task_id` become `Project Work` with `activity_title` NULL; others become `Other` with `activity_title = COALESCE(description, 'Legacy entry')`.

**Date / timezone migration (run after 04):**

```bash
psql "$DATABASE_URL" -f backend/scripts/05_timesheet_date_timezone.sql
```

This ensures `timesheets.date` is `DATE` and adds a column comment. See **Date handling (timezone)** below.

---

### Date handling (timezone)

Timesheet **date** is a **calendar date only** (no time, no timezone).

- **Database:** Column type is `DATE`. Do not use `TIMESTAMP` or `TIMESTAMPTZ` for the log date.
- **Frontend:** Send date as string **`YYYY-MM-DD`** (e.g. from `date-fns` `format(date, "yyyy-MM-dd")` in local time). **Do not** send `new Date().toISOString()` — that converts to UTC and can store the previous day (e.g. IST midnight → 2026-03-03 in UTC).
- **Backend:** Accept only `YYYY-MM-DD` string. Do not use `new Date(...)` or `.toISOString()` when validating or persisting the date; pass the string through to the DB.

**Best practice:** One source of truth for “the day the user worked” is the user’s local calendar date as `YYYY-MM-DD`. The API and DB store that string as-is.

---

## 3. API overview

Base path: **`/api/timesheets`** (authenticated).

| Method | Path           | Description        |
|--------|----------------|--------------------|
| POST   | /api/timesheets | Create entry      |
| PUT    | /api/timesheets/:id | Update entry  |
| GET    | /api/timesheets | List (query params) |
| GET    | /api/timesheets/:id | Get one entry  |

---

## 4. Request / response examples

### POST /api/timesheets — Project Work

**Request**

```json
{
  "work_type": "Project Work",
  "project_id": "uuid-of-project",
  "task_id": "uuid-of-task",
  "date": "2026-02-28",
  "hours": 4,
  "description": "Optional notes"
}
```

**Response (201)**

```json
{
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "work_type": "Project Work",
    "project_id": "uuid-of-project",
    "task_id": "uuid-of-task",
    "date": "2026-02-28",
    "hours": 4,
    "activity_title": null,
    "description": "Optional notes",
    "attachment_url": null,
    "created_at": "...",
    "updated_at": "..."
  },
  "error": null
}
```

### POST /api/timesheets — Non‑project (e.g. Internal Meeting)

**Request**

```json
{
  "work_type": "Internal Meeting",
  "activity_title": "Sprint planning",
  "date": "2026-02-28",
  "hours": 2,
  "description": "Optional"
}
```

**Response (201)** — same shape; `project_id` and `task_id` will be null, `activity_title` set.

### PUT /api/timesheets/:id

**Request (partial)**

```json
{
  "hours": 5,
  "activity_title": "Updated title"
}
```

Only provided fields are updated. Merged row must still satisfy work type rules (e.g. for non‑project, `activity_title` required; for Project Work, `project_id` and `task_id` required).

**Response (200)** — `{ "data": { ...updated row... }, "error": null }`.

### GET /api/timesheets

**Query params:** `user_id`, `order`, `ascending`, `limit`, `month`, `year` (month/year for filtering by date).

**Response (200)**

```json
{
  "data": [
    {
      "id": "...",
      "user_id": "...",
      "work_type": "Project Work",
      "project_id": "...",
      "task_id": "...",
      "date": "2026-02-28",
      "hours": 4,
      "activity_title": null,
      "description": "...",
      "projects": { "name": "Project A" },
      "tasks": { "title": "Task 1" }
    }
  ],
  "error": null
}
```

---

## 5. Error response examples

All errors use `{ "data": null, "error": { "message": "...", "code": "..." } }`.

| HTTP | code                 | message (example) |
|------|----------------------|--------------------|
| 422  | VALIDATION_ERROR     | Request body is required. |
| 422  | INVALID_WORK_TYPE    | work_type must be one of: Project Work, ... |
| 422  | MISSING_DATE         | date is required. |
| 422  | INVALID_DATE         | date must be YYYY-MM-DD. |
| 422  | INVALID_HOURS        | hours must be a number between 0.25 and 24. |
| 422  | MISSING_PROJECT_OR_TASK | For Project Work, project_id and task_id are required. |
| 422  | MISSING_ACTIVITY_TITLE | For this work type, activity_title is required. |
| 422  | TASK_PROJECT_MISMATCH | Selected task does not belong to the selected project. |
| 422  | DAILY_HOURS_EXCEEDED | Total hours for this day would exceed 24h. ... |
| 422  | INVALID_ACTIVITY_TITLE | For Project Work, activity_title must be empty or null. |
| 404  | NOT_FOUND            | Timesheet entry not found. |
| 403  | FORBIDDEN            | You can only update your own timesheet entries. |

---

## 6. Backend folder structure

```
backend/src/
├── config/
│   └── database.js
├── controllers/
│   └── timesheetController.js   # HTTP only; calls service
├── middleware/
│   ├── auth.js
│   └── errorHandler.js
├── repositories/
│   └── timesheetRepository.js   # DB access only
├── routes/
│   ├── index.js
│   └── timesheetRoutes.js       # POST / PUT / GET
├── services/
│   ├── dataService.js           # generic table access (used by GET list)
│   └── timesheetService.js      # create/update/getById business logic
├── validators/
│   └── timesheetValidator.js    # DTO + validation (create/update payloads)
└── ...
```

- **Controller:** no business logic; calls service and sets status/JSON.
- **Service:** validation result + repository; enforces 24h/day and task–project match.
- **Repository:** queries only (insert, update, findById, getTotalHoursForUserDate, taskBelongsToProject).
- **Validator:** request body validation and normalized DTO (work_type rules, hours, date, activity_title).

---

## 7. Edge cases covered

- **Existing timesheets:** Migration backfills `work_type` and `activity_title` so all rows satisfy the new CHECK.
- **Null safety:** Validator and service normalize null/empty; DB CHECK enforces rules.
- **Task–project mapping:** Repository `taskBelongsToProject`; DB CHECK `timesheets_task_belongs_to_project`.
- **Daily 24h:** Service sums hours for `(user_id, date)` and rejects create/update if new total > 24; on update the current entry is excluded from the sum.
- **Tampering:** All rules enforced server-side (validator + service + DB); client cannot bypass.
- **Concurrent submissions:** DB CHECK and unique constraints; daily cap enforced in service with current sum (no row-level lock; acceptable for typical usage).

Frontend can keep using `POST /api/data/timesheets` (existing validation in dataRoutes) or switch to `POST /api/timesheets` and `PUT /api/timesheets/:id` for the same rules with a cleaner API and error codes.
