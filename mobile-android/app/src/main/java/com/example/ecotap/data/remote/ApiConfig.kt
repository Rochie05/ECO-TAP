package com.example.ecotap.data.remote

/**
 * Where the app finds the ECO-TAP server. Edit these two values for your setup.
 *
 *  - Android emulator, server on the same PC:  http://10.0.2.2:3000/
 *  - Real phone on the same Wi-Fi:             http://<your-PC-LAN-IP>:3000/
 *      (and set API_HOST=0.0.0.0 in the server's .env so it accepts LAN connections)
 *  - Deployed server:                          https://your-domain/
 *
 * KIOSK_API_KEY must be identical to KIOSK_API_KEY in the server's .env.
 * The base URL must end with a slash.
 */
object ApiConfig {
    const val BASE_URL = "http://10.0.2.2:3000/"
    const val KIOSK_API_KEY = "change-me"
}
