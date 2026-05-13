# Agentica Live Chat

Generated live models now include an embedded Agentica chat panel.

## What Is Live

- `POST /api/live-chat`
- Generated `live-preview.html` includes an `Ask Agentica` chat panel
- Generated React source includes the same chat panel for production builds
- The panel sends the current app metadata and cart/selection context to Agentica
- Agentica answers without Codex

## Endpoint

```http
POST /api/live-chat
Content-Type: application/json
```

```json
{
  "message": "Help me fix my food business",
  "app": {
    "title": "Food Business App",
    "appType": "restaurant"
  }
}
```

Response:

```json
{
  "kind": "agentica-live-chat",
  "owner": "Agentica",
  "codexRequired": false,
  "reply": "..."
}
```

## What Is Still Missing To Behave Like A Full Assistant

- Streaming token-by-token response
- Durable per-user memory with consent/delete controls
- User login and private profiles
- Tool execution from the live app with approval gates
- Voice input/output
- Notifications and follow-up reminders
- Knowledge search over uploaded files and business data
- Human handoff and stronger safety escalation
- Analytics showing whether answers helped

## Safety Note

The first live-chat layer can give supportive planning and next-step guidance. It is not a therapist, doctor, lawyer, or emergency service. For crisis prompts it should direct the user to immediate local emergency support and a trusted person nearby.
