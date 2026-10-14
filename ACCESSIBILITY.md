# Accessibility

GPs and practice staff read BloodLine's alerts in the middle of a busy day, so they need to be easy to read and use, including with assistive technology. We're aiming for WCAG 2.2 level AA before any pilot.

BloodLine is a prototype and hasn't been through a formal accessibility audit yet.

## Where it runs

| Part | Supported |
|---|---|
| Website | Current desktop and mobile browsers |
| Presenter console (`web/`) | Current desktop Chrome, Edge and Firefox |
| GP app (`mobile/`) | Android, through Expo Go or an Android build |

## What's in place

- **Reduced motion.** With the system's reduce-motion setting on, the website drops smooth scrolling and pinned sections, shows everything in its final state and starts the background video paused. The console's live pipeline and OCR reading, and the GP app's shared animations, also follow the setting.
- **A pause button** for the website's background video.
- **A skip-to-content link** on the website.
- **Visible keyboard focus** on the console's buttons, inputs and menus.
- **More than one way to hear about an alert.** The same alert can arrive in the app, by email, by SMS and as a phone call, so no single channel has to work for everyone.

## Known gaps

- **Few screen reader labels in the GP app.** Only a handful of controls have explicit labels so far.
- **No full screen reader pass.** The app, console and website haven't been fully tested with TalkBack, NVDA, JAWS or VoiceOver.
- **Colour contrast hasn't been fully checked** against AA, especially secondary text on the dark website.

## Reporting a barrier

If something in BloodLine is hard or impossible to use, please [open an issue](https://github.com/AR13X3/Bloodline/issues/new/choose) with the bug report template. Tell us which part (website, console or GP app), what you were trying to do, and your device, browser and any assistive technology you use.
