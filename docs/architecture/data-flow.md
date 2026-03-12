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
    Worker->>Worker: Process run (LLM + tool loop)
    Worker->>Postgres: Update run (status, output)
```

The API receives requests synchronously and returns immediately after persisting the run and enqueuing the job. The Worker blocks on Redis (BullMQ) and picks up jobs as soon as they are available; it then processes them asynchronously.

## Tool Loop (inside Worker)

When the LLM model supports tool calling (e.g. OpenRouter with `gpt-4o-mini`), the Worker runs an inner loop:

```mermaid
%%{init: {"sequence": {"actorMargin": 60, "diagramMarginX": 60}}}%%
sequenceDiagram
    participant ExecuteRun
    participant LLM
    participant Registry
    participant Tool

    ExecuteRun->>LLM: generateText(messages) with tools
    LLM-->>ExecuteRun: text + tool_calls (or text only)

    alt Has tool_calls
        ExecuteRun->>Registry: executeTool(name, args)
        Registry->>Tool: web_search / read_webpage
        Tool-->>ExecuteRun: tool result
        ExecuteRun->>ExecuteRun: Append assistant + tool messages
        ExecuteRun->>LLM: generateText(messages) again
        Note over ExecuteRun,LLM: Loop until no tool_calls (max 5x)
    else No tool_calls
        ExecuteRun->>ExecuteRun: Use text as final reply
    end
```

- **First call:** User prompt + system prompt sent to LLM with `tools: TOOL_SCHEMAS`.
- **If `tool_calls`:** Each tool is executed via `registry.executeTool()`, results are appended as `role: tool` messages, then the LLM is called again with the extended conversation.
- **Loop:** Repeats until the LLM returns a text response without `tool_calls` or until max 5 iterations.
