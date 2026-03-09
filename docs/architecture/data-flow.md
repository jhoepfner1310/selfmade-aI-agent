# Data Flow

## Request to Run Processing

```mermaid
%%{init: {"sequence": {"actorMargin": 80, "diagramMarginX": 80}}}%%
sequenceDiagram
    participant Client
    participant API
    participant Postgres
    participant Redis
    participant Worker

    Client->>API: POST /runs (JSON body)
    API->>Postgres: Write run (status: created)
    API->>Postgres: Update run (status: queued)
    API->>Redis: Add job (runId)
    API->>Client: 201 + run object

    Redis->>Worker: Job available
    Worker->>Postgres: Read run by id
    Worker->>Worker: Process run (LLM, tools)
    Worker->>Postgres: Update run (status, output)
```



The API receives requests synchronously and returns immediately after persisting the run and enqueuing the job. The Worker blocks on Redis (BullMQ) and picks up jobs as soon as they are available; it then processes them asynchronously.
