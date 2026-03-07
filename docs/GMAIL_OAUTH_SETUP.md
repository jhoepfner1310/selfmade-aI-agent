# Gmail OAuth2 Setup

Das `read_emails`-Tool nutzt die Gmail API mit OAuth2. So richtest du es ein:

## 1. Google Cloud Projekt erstellen

1. Gehe zu [Google Cloud Console](https://console.cloud.google.com/)
2. Erstelle ein neues Projekt oder wähle ein bestehendes
3. Aktiviere die **Gmail API**: APIs & Services → Library → suche "Gmail API" → Enable

## 2. OAuth Credentials erstellen

1. APIs & Services → Credentials → Create Credentials → OAuth client ID
2. Falls nötig: Zuerst "Configure consent screen" ausführen
   - User Type: External (oder Internal für Workspace)
   - App name, Support email ausfüllen
   - Scopes: `https://www.googleapis.com/auth/gmail.readonly` hinzufügen
   - Test users: deine Gmail-Adresse hinzufügen (bei External)
3. Application type: **Web application**
4. Name: z.B. "Selfmade Agent"
5. Authorized redirect URIs: `http://localhost:3080/auth/gmail/callback`
6. Create → kopiere **Client ID** und **Client Secret**

## 3. .env konfigurieren

Füge zu deiner `.env` hinzu:

```
GMAIL_CLIENT_ID=dein-client-id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=dein-client-secret
GMAIL_REDIRECT_URI=http://localhost:3080/auth/gmail/callback
```

`GMAIL_REDIRECT_URI` ist optional (Standard: localhost:3080).

## 4. OAuth-Flow einmalig ausführen

1. API starten: `npm run dev`
2. Im Browser öffnen: **http://localhost:3080/auth/gmail**
3. Bei Google anmelden und Zugriff gewähren
4. Nach Redirect: "Gmail erfolgreich verbunden" – Tokens werden in `data/gmail-tokens.json` gespeichert

## 5. Testen

```
curl -X POST http://localhost:3080/runs -H "Content-Type: application/json" -d '{"userText":"Lies meine letzten 3 E-Mails"}'
```

## Hinweise

- `data/gmail-tokens.json` ist in `.gitignore` – niemals committen
- Der Refresh Token bleibt gültig, bis du den Zugriff in [Google Account → Sicherheit → Drittanbieter-Apps](https://myaccount.google.com/permissions) entfernst
- Scope `gmail.readonly` = nur Lesen, keine Änderungen an Mails
