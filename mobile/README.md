# ECO-TAP Resident App (React Native / Expo, Android)

The resident-facing Android app. It talks to the same server and database as the staff portal and the kiosk app, through the `/api/kiosk/*` routes. Nothing is simulated.

| Screen | What it does | API |
|---|---|---|
| Sign in | Card ID (typed or tapped via NFC) + 6-digit PIN. New cards register with a zero point balance. | `POST card`, `register`, `login` |
| Home | Real points, total kg, recent deposits, kiosk status | `GET me`, `stations` |
| Deposit | Pick PET or HDPE, open a session, wait for the machine's weight, see the points awarded | `POST deposit/start`, `GET deposit/:id`, `POST deposit/:id/cancel` |
| Rewards | Rewards from the portal's rewards desk; redeem with points (shows as *pending* for staff) | `GET rewards`, `POST redeem` |
| Activity | Deposits and redemptions, newest first | `GET me` |
| Profile | Account details, change PIN, sign out | `PUT pin`, `POST logout` |

Weights are never typed in. The machine's load cell and optical sensor report them, and the server awards the points (see the main README, *Machine-measured deposits*).

## Setup

1. **Server** `.env` (project root), then restart the server:

   ```
   KIOSK_API_KEY=<long random value>
   API_HOST=0.0.0.0          # only for a real phone on your Wi-Fi
   ```

   The server needs at least one station in the database (`stations` table) before deposits can start. This update also adds `GET /api/kiosk/stations`, so **restart the server with the new `server/index.mjs`**.

2. **App** config:

   ```sh
   cd mobile
   cp .env.example .env      # set EXPO_PUBLIC_API_URL and EXPO_PUBLIC_KIOSK_KEY
   npm install
   ```

   - Emulator: `http://10.0.2.2:3000`
   - Phone on the same Wi-Fi: `http://<your-PC-IP>:3000` (allow port 3000 in your firewall)

   The app connects automatically using the address and key from the build configuration. Set `EXPO_PUBLIC_API_URL` to the deployed HTTPS endpoint for builds used outside your development network.

3. **Run it** (NFC and secure storage are native code, so use a development build, not plain Expo Go):

   ```sh
   npx expo run:android          # builds and installs on a connected phone or emulator (needs Android Studio / SDK)
   ```

   Or build an installable APK in the cloud:

   ```sh
   npx eas-cli login
   npx eas-cli build --platform android --profile preview
   ```

   In Expo Go the app should still work, except tapping a card (NFC); type the card ID instead.

## Try a deposit end to end

1. Sign in on the phone, open **Deposit**, choose PET, tap **Start deposit**.
2. Within 3 minutes, act as the machine:

   ```sh
   node scripts/simulate-machine.mjs --station K-001 --key <device key> --material PET --kg 1.25
   ```

3. The app shows the points awarded and the balance updates.

## Notes

- The session token lives in memory only. The server ends a resident session after 15 minutes of inactivity; the app then returns to sign-in. Only the last card ID is remembered (in the device's secure storage). PINs are never stored.
- `EXPO_PUBLIC_KIOSK_KEY` ships inside the APK. Treat it as a device key and rotate it if an APK leaks.
- Cleartext `http` is enabled (via `expo-build-properties` in `app.json`) for local testing. For a deployed server use `https` and remove that setting.
- The Android package is `com.ecotap.resident` (the kiosk app is `com.example.ecotap`).
