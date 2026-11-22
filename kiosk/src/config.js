// Where the app finds the ECO-TAP server (the Kotlin ApiConfig.kt). Set both in kiosk/.env:
//   EXPO_PUBLIC_API_URL    emulator: http://10.0.2.2:3000   phone on Wi-Fi: http://<PC-IP>:3000   deployed: https://...
//   EXPO_PUBLIC_KIOSK_KEY  must equal KIOSK_API_KEY in the server's .env
export const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3000';
export const KIOSK_API_KEY = process.env.EXPO_PUBLIC_KIOSK_KEY || 'change-me';
