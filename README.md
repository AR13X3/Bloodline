# BloodLine

A safety-net alerting demo for Australian GPs. BloodLine reads incoming blood test reports and alerts the GP when something may need review:

- the **lab flagged** a result,
- a value is **outside the range printed on the report**, or
- it matches a **rule the GP set** for that patient.

The AI only copies what's printed on the report; deterministic code does every check. BloodLine doesn't diagnose, decide urgency or replace the GP's usual review, and labs still phone through critical results. **All data in this repo is synthetic. Not for clinical use.**

Full product requirements: [docs/PRD.md](docs/PRD.md).

## What's in here

| Folder | What it is |
|---|---|
| `web/` | Next.js app: the API, the presenter console (upload, live pipeline, AI reading, delivery, records) and a local SQLite database |
| `mobile/` | Expo (React Native) Android app for the GP: alerts, alert detail, patient rules, settings |
| `docs/` | Product requirements |

## One-time setup

1. **Web app**

   ```bash
   cd web
   npm install
   cp .env.example .env.local
   ```

   Fill in `web/.env.local`:

   | Variable | What for |
   |---|---|
   | `OPENROUTER_API_KEY` | AI reading of report PDFs (Claude Haiku 5.5, about $0.0003 per report) |
   | `RESEND_API_KEY`, `EMAIL_FROM` | Email alerts. `onboarding@resend.dev` only delivers to your Resend account's own email |
   | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | SMS and phone-call alerts. A trial account can only reach verified numbers and can't send custom SMS text |
   | `DEMO_GP_EMAIL`, `DEMO_GP_MOBILE` | Where Dr Amelia Chen's (the demo GP's) alerts go. Mobile in `+61…` format |
   | `VOICE_MESSAGE_URL` | Optional: a public MP3/WAV played on calls (e.g. from Twilio Assets). Without it, calls use a computer voice |

   Then create the synthetic database:

   ```bash
   npm run db:reset
   ```

2. **Mobile app**

   ```bash
   cd mobile
   npm install
   ```

   Install **Expo Go** from the Play Store on the demo Android phone (or use an Android emulator).

3. **Tunnel** (so the phone can reach the laptop from any network). Install Cloudflare's free tunnel tool:

   ```bash
   winget install --id Cloudflare.cloudflared
   ```

4. **Optional:** mirror the phone onto the laptop screen with [scrcpy](https://github.com/Genymobile/scrcpy) (`winget install --id Genymobile.scrcpy`), so the audience sees the phone and the console side by side.

## Running the demo

Open three terminals.

1. **Web app and console**

   ```bash
   cd web
   npm run dev
   ```

   Open http://localhost:3000. For the most reliable stage run, use `npm run demo` (production build) instead.

2. **Tunnel**

   ```bash
   cd web
   npm run tunnel
   ```

   Copy the `https://….trycloudflare.com` address it prints. It changes every time you start the tunnel.

3. **Phone app**

   ```bash
   cd mobile
   npx expo start
   ```

   Scan the QR code with Expo Go (or press `a` for the emulator). If the venue Wi-Fi blocks device-to-device traffic, use `npm run start:tunnel` instead. In the app, tap the server address on the sign-in screen, paste the tunnel address, then sign in as **Dr Amelia Chen**. Keep the app open on stage.

## Demo script (about 3 minutes)

1. **Set up:** console on the projector, phone mirrored beside it, signed in as Dr Chen. In the console's **Delivery** panel, switch on Email, SMS and Phone call. Then switch on **Live messages** in the header (it asks for confirmation).
2. **Upload:** drop a lab report PDF into "Send a lab report" (or use "Download a sample report" first), choose the patient, and click **Send to BloodLine**.
3. **Watch:** the live pipeline lights up (report → AI reading → checks → alert → app, email, SMS, call). The AI reading panel shows the PDF being read and each value popping in with BloodLine's verdict.
4. **The phone:** the in-app alert arrives with a buzz, the SMS lands, and the phone rings. Open the alert to show the reasons, the printed range bar and the trend, then **Mark as seen**. The console's activity feed shows it as seen.
5. **GP rules:** on the phone, open Patients → Tom Fletcher → New rule (or show the existing potassium rule), then send the **Matches a GP rule** quick scenario: potassium 5.1 is inside the printed range and unflagged, but still alerts because of the GP's own rule.
6. **Safety touches:** send **Can't be checked** ("<0.01" isn't a plain number, so BloodLine says so instead of staying silent), and **Send duplicate** (ignored). Point out the audit trail in Records.

Reset between rehearsals with **Reset demo**. Saved AI readings are kept, so repeat runs are instant and free.

## Development

```bash
cd web
npm test           # 73 tests: range parsing, validation, checks, routing, pipeline
npx tsc --noEmit
npm run lint

cd ../mobile
npx tsc --noEmit
npx expo-doctor
```

Nothing real is sent unless **Live messages** is switched on in the console and the provider keys are set. Otherwise every email, SMS and call is logged as "simulated".
