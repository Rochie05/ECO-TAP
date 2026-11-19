package com.example.ecotap.data.repository

import com.example.ecotap.data.model.RewardItem
import com.example.ecotap.data.model.User
import com.example.ecotap.data.model.WasteCategory
import com.example.ecotap.data.remote.AccountResponse
import com.example.ecotap.data.remote.ApiClient
import com.example.ecotap.data.remote.ApiService
import com.example.ecotap.data.remote.CardLookupRequest
import com.example.ecotap.data.remote.CardLookupResponse
import com.example.ecotap.data.remote.DepositSession
import com.example.ecotap.data.remote.DepositStartRequest
import com.example.ecotap.data.remote.DepositStatusResponse
import com.example.ecotap.data.remote.LoginRequest
import com.example.ecotap.data.remote.OkResponse
import com.example.ecotap.data.remote.PinRequest
import com.example.ecotap.data.remote.RedeemRequest
import com.example.ecotap.data.remote.RedeemResponse
import com.example.ecotap.data.remote.RegisterRequest
import com.example.ecotap.data.remote.SessionStore
import com.google.gson.Gson
import com.google.gson.JsonSyntaxException
import retrofit2.Response
import java.io.IOException
import java.util.UUID

sealed class ApiResult<out T> {
    data class Success<T>(val value: T) : ApiResult<T>()
    data class Failure(val message: String, val code: Int = 0) : ApiResult<Nothing>()
}

private data class ErrorBody(val error: String?)

/** Pulls the server's {"error": "..."} text out of an error body. */
fun parseErrorMessage(body: String?, fallback: String): String {
    if (body.isNullOrBlank()) return fallback
    return try {
        Gson().fromJson(body, ErrorBody::class.java)?.error?.takeIf { it.isNotBlank() } ?: fallback
    } catch (e: JsonSyntaxException) {
        fallback
    }
}

/** "8a19b" -> "ECO-TAP-8A19B". Matches the server's normalisation. */
fun normalizeCardId(raw: String): String {
    val id = raw.trim().uppercase()
    return if (id.startsWith("ECO-TAP-")) id else "ECO-TAP-$id"
}

/**
 * All data comes from the ECO-TAP server (the same Postgres database as the staff portal).
 * Nothing is cached or faked locally, and PINs are only ever checked by the server.
 */
class EcoTapRepository(private val api: ApiService = ApiClient.service) {

    private suspend fun <T> call(block: suspend () -> Response<T>): ApiResult<T> {
        return try {
            val response = block()
            val body = response.body()
            if (response.isSuccessful && body != null) {
                ApiResult.Success(body)
            } else {
                ApiResult.Failure(
                    parseErrorMessage(response.errorBody()?.string(), "Server error (${response.code()})."),
                    response.code()
                )
            }
        } catch (e: IOException) {
            ApiResult.Failure("Cannot reach the ECO-TAP server. Check the connection and try again.")
        }
    }

    suspend fun loadRewards(): ApiResult<List<RewardItem>> =
        when (val r = call { api.getRewards() }) {
            is ApiResult.Success -> ApiResult.Success(r.value.rewards)
            is ApiResult.Failure -> r
        }

    suspend fun loadCategories(): ApiResult<List<WasteCategory>> =
        when (val r = call { api.getCategories() }) {
            is ApiResult.Success -> ApiResult.Success(r.value.categories)
            is ApiResult.Failure -> r
        }

    /** Opens a deposit session. There is no weight to send: the machine's scale reports it. */
    suspend fun startDeposit(category: WasteCategory): ApiResult<DepositSession> =
        call { api.startDeposit(DepositStartRequest(category.id)) }

    suspend fun depositStatus(sessionId: String): ApiResult<DepositStatusResponse> =
        call { api.depositStatus(sessionId) }

    suspend fun cancelDeposit(sessionId: String): ApiResult<OkResponse> =
        call { api.cancelDeposit(sessionId) }

    suspend fun lookupCard(nfcCardId: String): ApiResult<CardLookupResponse> =
        call { api.lookupCard(CardLookupRequest(normalizeCardId(nfcCardId))) }

    suspend fun login(nfcCardId: String, pin: String): ApiResult<User> =
        when (val r = call { api.login(LoginRequest(normalizeCardId(nfcCardId), pin)) }) {
            is ApiResult.Success -> {
                SessionStore.token = r.value.token
                ApiResult.Success(r.value.resident)
            }
            is ApiResult.Failure -> r
        }

    suspend fun register(nfcCardId: String, fullName: String, address: String, pin: String): ApiResult<User> =
        when (val r = call { api.register(RegisterRequest(normalizeCardId(nfcCardId), fullName, address, pin)) }) {
            is ApiResult.Success -> ApiResult.Success(r.value.resident)
            is ApiResult.Failure -> r
        }

    suspend fun loadAccount(): ApiResult<AccountResponse> = call { api.getAccount() }

    suspend fun redeem(item: RewardItem): ApiResult<RedeemResponse> =
        call { api.redeem(RedeemRequest(item.id, UUID.randomUUID().toString())) }

    suspend fun changePin(newPin: String): ApiResult<Boolean> {
        if (newPin.length != 6 || !newPin.all { it.isDigit() }) return ApiResult.Failure("PIN must be 6 digits.")
        return when (val r = call { api.changePin(PinRequest(newPin)) }) {
            is ApiResult.Success -> ApiResult.Success(true)
            is ApiResult.Failure -> r
        }
    }

    suspend fun logout() {
        try { api.logout() } catch (e: IOException) { /* token is dropped locally either way */ }
        SessionStore.token = null
    }

    fun clearSession() { SessionStore.token = null }
}
