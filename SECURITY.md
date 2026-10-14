# Security policy

BloodLine is a prototype. Fixes go to the `main` branch only; there are no released versions to patch.

## Reporting a vulnerability

Please don't open a public issue. Report it privately instead: on the repo's **Security** tab, click **Report a vulnerability**. Only the team can see the report.

Include what you found, where (the web API, the console, the GP app or the website), and the steps to reproduce it. We'll confirm we've received it, keep you updated while we work on a fix, and credit you in the fix if you'd like.

## Patient data

This repo and its demo database contain invented patients only. Never include real patient information in a report, issue, pull request or screenshot. If you find real patient data anywhere in this project, report it privately as above.

## Scope

In scope: the code in this repo (`web/`, `mobile/` and `Website/`) and the published website.

Out of scope: the third-party services BloodLine calls (OpenRouter, Resend, Twilio, Cloudflare), and temporary demo tunnel addresses.

## Secrets

API keys live in `web/.env.local`, which is never committed. Only the template, `web/.env.example`, is in the repo, with every key left blank. If you spot a real key in the code or the git history, report it privately.
