# BloodLine

A safety-net alerting demo for Australian GPs. BloodLine reads incoming blood test reports and alerts the GP when something may need review: the lab flagged it, the value is outside the range printed on the report, or it matches a rule the GP set for that patient.

It does not diagnose, decide urgency or replace the GP's usual review. **All data in this repo is synthetic. Not for clinical use.**

See [docs/PRD.md](docs/PRD.md) for the full product requirements.

## Structure

| Folder | What it is |
|---|---|
| `web/` | Next.js app: API, presenter simulator, practice dashboard, local SQLite database |
| `mobile/` | Expo (React Native) Android app for the GP |
| `docs/` | Product requirements |

## Getting started (web)

```bash
cd web
npm install
cp .env.example .env.local   # then fill in your own keys
npm run db:reset             # create the synthetic demo database
npm test
npm run dev
```

Any alert channel without keys (email, SMS, voice) is logged as "simulated" instead of sent.
