# Contributing to BloodLine

Thanks for helping. BloodLine is a safety net for blood test results in Australian general practice, built by a small team, and contributions of any size are welcome: bug reports, fixes, docs and ideas.

By taking part you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Never use real patient data

Use the demo database and sample reports only. Never put real patient information in code, tests, fixtures, screenshots, issues or pull requests. The demo patients are invented, and they need to stay that way.

## Getting set up

Follow [One-time setup](README.md#one-time-setup) and [Running the demo](README.md#running-the-demo) in the README. Every API key is optional: without them, OCR falls back to the simulator's printed values, and every email, SMS and call is logged as "simulated".

| Folder | What it is |
|---|---|
| `web/` | Next.js API, presenter console and SQLite database |
| `mobile/` | Expo (React Native) app for the GP |
| `Website/` | Marketing site (Vite and GSAP). See [Website/README.md](Website/README.md) |
| `docs/` | PRD, pitch numbers, system design and screenshots |

## Before you open a pull request

Run the checks for the folders you changed.

**`web/`**

```bash
npm test
npx tsc --noEmit
npm run lint
```

**`mobile/`**

```bash
npx tsc --noEmit
npx expo-doctor
```

**`Website/`**

```bash
npm run build
```

## How BloodLine is built

- **OCR only reads; code decides.** OCR copies the values printed on a report. Whether a result needs review is decided by plain, deterministic code, which is what the tests in `web/` cover. Keep it that way.
- **Calm motion in the app and console.** Short fades, with no springs, bounces or looping animation. The website can be bolder, but it follows the motion rules in [Website/README.md](Website/README.md#motion-rules).
- **Titles stand alone.** In the app and console, don't add taglines or explainer lines under titles.
- **The GP app never says "synthetic".** The presenter console keeps its "Synthetic data · not for clinical use" badge, but the GP app reads like the real product.
- **Expo changes quickly.** Before touching an Expo or React Native API, read [mobile/AGENTS.md](mobile/AGENTS.md) and the docs for the SDK version in `mobile/package.json`.

## Pull requests

1. Branch from `main`.
2. Keep each pull request to one change, and explain what it does and why.
3. Add screenshots for anything visible in the console, the app or the website.
4. Fill in the pull request template's checklist.

## Reporting bugs and ideas

Open an [issue](https://github.com/AR13X3/Bloodline/issues/new/choose) using one of the templates. For security problems, follow the [security policy](SECURITY.md) instead of opening a public issue.

## License

By contributing, you agree that your contributions are licensed under the [Apache License 2.0](LICENSE), the same as the rest of the project.
