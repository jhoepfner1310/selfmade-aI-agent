# Configuration

## Environment Variables

### API

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3080` | HTTP server port |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `REDIS_URL` | Yes | — | Redis connection string (for BullMQ) |

### Worker

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_URL` | Yes | — | Redis connection string |
| `LLM_PROVIDER` | No | `openai` | `openai` or `openrouter` |

### LLM – OpenAI

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | Yes* | — | OpenAI API key |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | Model ID (must support tool calling) |

\* Required when `LLM_PROVIDER=openai`

### LLM – OpenRouter

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENROUTER_API_KEY` | Yes* | — | OpenRouter API key |
| `OPENROUTER_MODEL` | Yes* | — | Model ID (e.g. `openai/gpt-4o-mini`; must support tools) |
| `OPENROUTER_BASE_URL` | No | `https://openrouter.ai/api/v1` | API base URL |

\* Required when `LLM_PROVIDER=openrouter`

### Tools

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SERPER_API_KEY` | Yes for `web_search` | — | Serper.dev API key for web search (https://serper.dev) |

**read_webpage:** Requires `cheerio` package (`pnpm add cheerio`). No env var.

## Example .env

```env
PORT=3080
DATABASE_URL=postgresql://user:pass@localhost:5432/selfmade_agent
REDIS_URL=redis://localhost:6379

LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=openai/gpt-4o-mini

SERPER_API_KEY=...  # For web_search tool
```
