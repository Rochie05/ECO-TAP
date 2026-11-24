# ECO-TAP Kiosk (React Native / Expo, Android)

The resident-facing NFC kiosk, converted from the Kotlin / Jetpack Compose app in `../mobile-android`. It talks to the same server and `/api/kiosk/*` routes, with the same behaviour:

1. **Tap card** – reads the NFC UID (`ECO-TAP-<UID>`). Unknown card → registration (name, address, 6-digit PIN). Known card → PIN pad.
2. **PIN login** – checked by the server only. A login lasts 15 minutes of inactivity; a 401 sends the kiosk back to the tap screen.
3. **Deposit** – pick PET / HDPE, the machine weighs, the server awards points. There is no weight entry.
4. **Reward point conversion**, **Rewards POS** (redemptions show as *pending* in the portal), **Card inquiry** (ledger, change PIN).

## Where things moved

| Kotlin | React Native |
|---|---|
| `MainActivity.kt` | `App.js` (NFC lifecycle, header, banner, screen switch) |
| `EcoTapViewModel.kt` | `src/controller.js` (`KioskController`) + `src/useKiosk.js` |
| `EcoTapRepository.kt`, `ApiService.kt`, `ApiClient.kt`, `ApiConfig.kt` | `src/api.js`, `src/config.js` |
| `NfcManager.kt` | `src/nfc.js` |
| `Models.kt` (`pointsForWeight`, dates) | `src/format.js` |
| `ui/theme/*` | `src/theme.js` |
| `ui/components/CommonComponents.kt` | `src/components.js` |
| `ui/screens/*Screen.kt` | `src/screens/*Screen.js` |
| `ApiHelpersTest.kt`, `PointsTest.kt` | `__tests__/helpers.test.mjs` (+ `controller` and `api` tests) |

## Setup

1. Server `.env` (project root), then restart the server:

   ```
   KIOSK_API_KEY=<long random value>
   API_HOST=0.0.0.0          # only for a real phone on your Wi-Fi
   ```

2. App config:

   ```sh
   cd kiosk
   cp .env.example .env      # EXPO_PUBLIC_API_URL and EXPO_PUBLIC_KIOSK_KEY (same value as KIOSK_API_KEY)
   npm install
   ```

   Emulator: `http://10.0.2.2:3000`. Phone on the same Wi-Fi: `http://<your-PC-IP>:3000` (allow port 3000 in the firewall).

3. Run on a phone or tablet **with NFC** (NFC is native code, so use a development build, not Expo Go):

   ```sh
   npx expo run:android
   # or an installable APK in the cloud:
   npx eas-cli build --platform android --profile preview
   ```

4. Tests (pure logic, no device needed; Node 22.7 or newer): `npm test`

## Notes

- The package id is `com.example.ecotap`, same as the Kotlin kiosk, so an APK from this project installs over the old one. The resident app (`../mobile`) is `com.ecotap.resident`.
- `EXPO_PUBLIC_KIOSK_KEY` ships inside the APK. Treat it as a device key and rotate it if an APK leaks.
- Cleartext `http` is enabled through `expo-build-properties` for local testing. Use `https` for a deployed server and remove that setting.
- Differences from the Kotlin app: the screen is locked to portrait; the Android back button returns to the menu from a service screen; the registration form scrolls so the keyboard cannot cover it; the Kotlin gradients are solid colours (add `expo-linear-gradient` with `npx expo install expo-linear-gradient` if you want them back).
