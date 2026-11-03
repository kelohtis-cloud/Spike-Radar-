# Spike Radar PWA — Prototype

## What this build does
- Connects to Deriv's public market-data WebSocket (no Deriv login/token).
- Requests active symbols and filters names containing Boom or Crash.
- Subscribes to live ticks for returned symbols.
- Calculates a simple per-symbol anomaly score against recent absolute tick changes.
- Shows WATCH/HIGH ALERT states and browser notifications while the page is active.

## Important limitations
- This is an experimental anomaly detector, NOT a reliable predictor of the next spike.
- A tick anomaly is detected when the move has already begun; it cannot know the future.
- This browser-only build is not an always-on background service. Android may suspend it when closed or in the background.
- The service worker caches the app shell only. It does NOT implement Web Push.
- Always-on monitoring and notifications while the app is closed require a hosted backend, push subscription storage, VAPID keys, and an Android browser push setup.
- The app does not place trades or access a Deriv account.

## Deploy
Host the contents of this folder on an HTTPS static host. Then open the HTTPS URL in Chrome on Android and choose Install app / Add to Home screen. PWA install and notifications require HTTPS (except localhost).

## Deriv API
Uses the public endpoint documented by Deriv:
wss://api.derivws.com/trading/v1/options/ws/public

Data calls:
- active_symbols: discover symbols available to the account/platform
- ticks: subscribe to public tick streams

## Files
- index.html: user interface
- app.js: WebSocket client and experimental detector
- manifest.webmanifest: PWA metadata
- sw.js: offline shell cache
- icon.svg: app icon
