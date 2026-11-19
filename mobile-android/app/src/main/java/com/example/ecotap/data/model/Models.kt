package com.example.ecotap.data.model

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

enum class AppMode {
    NFC_SCAN,
    REGISTRATION,
    PIN_ENTRY,
    MAIN_MENU,
    CARD_INQUIRY,
    REWARDS_POS,
    DEPOSIT,
    POINT_CONVERSION
}

/** A resident as returned by the ECO-TAP server. The PIN never leaves the server. */
data class User(
    val id: String,
    val nfcCardId: String,
    val fullName: String,
    val address: String,
    val barangay: String,
    val ecoPoints: Int,
    val totalWasteKg: Double,
    val registeredDate: String
)

/** A deposit shown in the resident's ledger (comes from the portal's collection logs). */
data class WasteDepositTransaction(
    val id: String,
    val userId: String,
    val userName: String,
    val nfcCardId: String,
    val categoryId: String,
    val categoryName: String,
    val weightKg: Double,
    val pointsEarned: Int,
    val timestamp: Long
) {
    fun formattedDate(): String {
        val sdf = SimpleDateFormat("MMM dd, yyyy - hh:mm a", Locale.getDefault())
        return sdf.format(Date(timestamp))
    }
}

/** A waste category from the server: which bin it goes in and how many points one kg earns. */
data class WasteCategory(
    val id: String,
    val name: String,
    val section: String,
    val pointsPerKg: Int
)

/** Points for a weight, rounded the same way the server does (so the preview matches the award). */
fun pointsForWeight(weightKg: Double, category: WasteCategory): Int =
    Math.round(weightKg * category.pointsPerKg).toInt()

/** A reward from the portal's rewards desk (name + point cost). */
data class RewardItem(
    val id: String,
    val title: String,
    val description: String,
    val pointsCost: Int,
    val category: String,
    val iconName: String
)

data class RedemptionTransaction(
    val id: String,
    val userId: String,
    val userName: String,
    val nfcCardId: String,
    val itemId: String,
    val itemTitle: String,
    val pointsDeducted: Int,
    val timestamp: Long
) {
    fun formattedDate(): String {
        val sdf = SimpleDateFormat("MMM dd, yyyy - hh:mm a", Locale.getDefault())
        return sdf.format(Date(timestamp))
    }
}
