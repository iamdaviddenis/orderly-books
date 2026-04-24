# Orderly Books Mobile Release Guide

This project is now prepared to be wrapped as a native mobile app using Capacitor.

## What Is Already Added

- `Capacitor` config at `capacitor.config.ts`
- mobile scripts in `package.json`
- mobile-safe viewport and safe-area support
- web app manifest for installability
- starter app icon at `public/orderly-icon.svg`

## Install Mobile Dependencies

```bash
npm install
```

## Build The Web App

```bash
npm run build:web
```

## Add Native Platforms

Run these once on a machine with the proper SDKs installed:

```bash
npx cap add android
npx cap add ios
```

Notes:

- `iOS` platform creation requires macOS with Xcode
- `Android` platform creation requires Android Studio and the Android SDK

## Sync Web Changes Into Native Projects

```bash
npm run mobile:build
```

or:

```bash
npm run mobile:sync
```

## Open Native Projects

```bash
npm run mobile:android
npm run mobile:ios
```

## Before Publishing

You still need to complete the normal store-release items:

- replace placeholder app icons and splash assets with final production artwork
- update `appId` in `capacitor.config.ts` if you want a different production bundle identifier
- create signed Android and iOS release builds
- create a privacy policy URL
- prepare store listing copy, screenshots, and promotional assets
- test sign-in, Supabase sync, offline behavior, and PDF export on real devices
- verify keyboard behavior on small screens
- review safe-area layout on iPhone models with notches and Android gesture navigation

## Android Release Checklist

1. Open the Android project in Android Studio
2. Set final app icon, splash, and app name if needed
3. Configure release signing
4. Build an `.aab` for Google Play
5. Complete Play Console listing
6. Upload screenshots, privacy policy, and data safety form

## iOS Release Checklist

1. Open the iOS project in Xcode
2. Set signing team and bundle identifier
3. Replace app icons and launch assets
4. Archive the app
5. Upload through Xcode Organizer or Transporter
6. Complete App Store Connect metadata and privacy disclosures

## Current Recommendation

Use Capacitor for store publishing, not a browser-only PWA flow.

Why:

- better App Store / Play Store path
- native splash, icons, signing, and packaging
- easier future access to device APIs
- keeps the existing React app mostly unchanged
