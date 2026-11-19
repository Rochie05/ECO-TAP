# ECO-TAP Kiosk (Android)

The resident-facing NFC kiosk app, rebuilt on the same server and database as the staff portal.

## What it does

1. **Tap card** – reads the NFC UID (`ECO-TAP-<UID>`). Unknown card → resident registration (name, address, 6-digit PIN, 50-point welcome bonus). Known card → PIN pad.
2. **PIN login** – the server checks the PIN (never the phone). 5 wrong PINs locks that card for a minute. A login lasts 15 minutes of inactivity.
3. **Rewards POS** – lists the rewards from the portal's *Rewards* desk and redeems one with the resident's points. The redemption appears in the portal as **pending**, so staff can hand over the item and mark it fulfilled.
4. **Deposit segregated waste** – pick a category (PET / HDPE), set the weight shown on the scale, confirm. The server calculates and awards the points (`POST /api/kiosk/deposit`).
5. **Reward point conversion** – points per kg for each category and what each reward is worth in kg.
6. **Card inquiry** – balance, total kg recycled, ledger of deposits (portal collection logs) and redemptions, and change PIN.

## Setup

1. In the server's `.env` add a key (and, for a real phone, the LAN setting), then restart the server:

   ```
   KIOSK_API_KEY=paste-a-long-random-value
   API_HOST=0.0.0.0
   ```

   Generate a key with `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`.
   On startup the server adds the card/PIN columns to the `residents` table by itself.

2. Edit `app/src/main/java/com/example/ecotap/data/remote/ApiConfig.kt`:
   - `KIOSK_API_KEY` = the same value as in `.env`
   - `BASE_URL` = `http://10.0.2.2:3000/` for the emulator, or `http://<your-PC-IP>:3000/` for a phone on the same Wi-Fi (allow port 3000 in the Windows firewall)

3. Open this folder in Android Studio, let Gradle sync, and run on a device with NFC. Cleartext `http` is enabled in the manifest for local testing; use `https` for a deployed server and remove that flag.

## Notes

- The key in `ApiConfig.kt` ships inside the APK, so treat it as a device key, not a user secret. Rotate it if an APK leaks.
- Rewards have only a name and point cost in the portal, so the old description/category fields are blank in the app.
- The weight is entered with +/- buttons because no scale hardware is wired up. To use a real scale, set the weight in `DepositScreen.kt` from the scale's reading.
- Each deposit carries a one-time key, so pressing Confirm twice after a dropped connection never awards points twice.
