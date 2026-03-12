# API

## Overview

The API is a Node.js HTTP server (port configurable via `PORT` env) that accepts run requests, persists them to PostgreSQL, and enqueues jobs in Redis for the Worker.

## Structure

```mermaid
flowchart TD
    Server[server.js] --> App[app.js]
    App --> Routes[runsRoutes.js]
    Routes --> Controller[runsController.js]
    Controller --> Service[runService.js]
    Service --> Repo[runRepository]
    Service --> Queue[runQueue]
```

- **server.js** – Bootstrap, HTTP server, `ensureRunsTable`
- **app.js** – Request handler, error mapping (404, 400, 500)
- **runsRoutes.js** – Route dispatch by method + path
- **runsController.js** – Parse body, call service, return JSON
- **runService.js** – Create run, enqueue job

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/runs` | Create run, enqueue job |
| GET | `/runs` | List all runs |
| GET | `/runs/:id` | Get run by id |
| GET | `/runs/:id/stream` | Stream run output (stub, returns 501) |
| GET | `/auth/gmail` | Gmail OAuth start (stub, returns 501) |
| GET | `/auth/gmail/callback` | Gmail OAuth callback (stub, returns 501) |
| GET | `/auth/gmail/status` | Gmail auth status (stub, returns 501) |
| GET | `/conversations` | List conversations (stub, returns 501) |
| POST | `/conversations` | Create conversation (stub, returns 501) |
| POST | `/conversations/:id/messages` | Add message to conversation (stub, returns 501) |
| GET | `/conversations/:id` | Get conversation by id (stub, returns 501) |

## Request Format (POST /runs)

JSON body, `Content-Type: application/json`:

```json
{
  "userText": "Your message or question for the agent"
}
```

- `userText` (string, required) – Validated by the Worker; invalid input causes run failure.
