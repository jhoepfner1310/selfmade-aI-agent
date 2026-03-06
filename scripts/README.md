# Manueller Agent-Test

## Voraussetzungen

- **Postgres** und **Redis** laufen (z.B. lokal oder Docker)
- `.env` konfiguriert: `DATABASE_URL`, `REDIS_URL`, `LLM_PROVIDER`, API-Keys

## Ablauf

**Terminal 1 – API starten:**
```bash
npm run dev
```

**Terminal 2 – Worker starten:**
```bash
npm run dev:worker
```

**Terminal 3 – Test ausführen:**
```bash
npm run test:agent
# oder mit eigener Anfrage:
node scripts/test-agent.js "Wie spaet ist es?"
```

## Erwartetes Verhalten

Bei "Wie spaet ist es?" sollte das LLM `needsTool: true` und `suggestedTool: "get_current_time"` liefern. Der Worker fuehrt das Tool aus und haengt die Systemzeit an die Reply.
