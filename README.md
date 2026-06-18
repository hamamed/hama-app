# 📱 HAMA WC 2026 — Android App (Cordova)

A native-feeling Android app that talks to the **same server & Firestore database**
as the website via a JSON API (`https://koydam.com/api`). Users can use the site
**or** the app — same accounts, same predictions, same leaderboard.

It's a custom SPA (not a WebView of the site): native-style screens, bottom tab
bar, smooth prediction saving, live scores, groups/standings, champion pick, and
EN/FR/AR with RTL.

---

## What's inside
```
worldcup-app/
├── config.xml            Cordova app config (id, name, icon, permissions)
├── package.json
└── www/
    ├── index.html        app shell
    ├── css/app.css       theme (matches the website)
    ├── img/logo.png      <-- ADD your logo here (see below)
    └── js/
        ├── i18n.js       EN / FR / AR translations
        ├── api.js        API wrapper (set BASE here)
        └── app.js        screens + navigation
```

## Prerequisites (one-time)
1. **Node.js** 18+.
2. **Java JDK 17** (required by cordova-android 13).
3. **Android SDK** — easiest via **Android Studio** (install an SDK Platform +
   Build-Tools, and set `ANDROID_HOME`/`ANDROID_SDK_ROOT`).
4. Cordova CLI:
   ```bash
   npm install -g cordova
   ```

## Set up the project
```bash
cd worldcup-app
npm install
cordova platform add android
```

## Add your icon & logo
- Put your logo at **`www/img/logo.png`** (shown on the login/top bar).
- Put an app icon at **`res/icon.png`** (square PNG, 432×432 recommended) — referenced by `config.xml`.

## Point the app at your server
Already set to your live server in **`www/js/api.js`**:
```js
const BASE = "https://koydam.com/api";
```
Change it if your domain differs. (The server already sends CORS headers for `/api`.)

## Run / build
```bash
# Run on a connected device or emulator
cordova run android

# Build a debug APK
cordova build android
#   -> platforms/android/app/build/outputs/apk/debug/app-debug.apk
```

### Release build (for Google Play)
```bash
cordova build android --release -- --keystore=my.keystore --alias=myalias \
  --storePassword=*** --password=***
```
Then upload the generated `.aab`/`.apk` to the Play Console.

---

## How it connects to the backend
- **Auth:** `POST /api/login` with a username returns a **token**; the app stores
  it (localStorage) and sends `Authorization: Bearer <token>` on every request.
- **Data:** `/api/matches`, `/api/predict`, `/api/leaderboard`, `/api/standings`,
  `/api/profile`, `/api/champion` — all reading/writing the same Firestore the
  website uses.
- **Language:** the app sends `?lang=en|fr|ar`; the server returns localized
  team/country names so Arabic shows native names.

> Make sure the website server is deployed with the new `/api` routes and is
> reachable over **HTTPS** (Android blocks plain HTTP by default).
