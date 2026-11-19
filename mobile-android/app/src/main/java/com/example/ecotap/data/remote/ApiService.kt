package com.example.ecotap.data.remote

import com.example.ecotap.data.model.RedemptionTransaction
import com.example.ecotap.data.model.RewardItem
import com.example.ecotap.data.model.User
import com.example.ecotap.data.model.WasteCategory
import com.example.ecotap.data.model.WasteDepositTransaction
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path

data class CardLookupRequest(val nfcCardId: String)
data class CardLookupResponse(val nfcCardId: String, val registered: Boolean, val fullName: String?, val barangay: String?)

data class RegisterRequest(val nfcCardId: String, val fullName: String, val address: String, val pin: String)
data class RegisterResponse(val resident: User)

data class LoginRequest(val nfcCardId: String, val pin: String)
data class LoginResponse(val token: String, val resident: User)

data class AccountResponse(
    val resident: User,
    val deposits: List<WasteDepositTransaction>,
    val redemptions: List<RedemptionTransaction>
)

data class RewardsResponse(val rewards: List<RewardItem>)
data class CategoriesResponse(val categories: List<WasteCategory>)
/** The resident only says which category they are depositing. Weight and material come from the machine. */
data class DepositStartRequest(val categoryId: String)
data class DepositSession(val sessionId: String, val status: String, val categoryId: String?, val categoryName: String?, val expiresAt: Long)
/** status: open | completed | expired | cancelled. [deposit] and [resident] are set once the machine has reported. */
data class DepositStatusResponse(
    val sessionId: String,
    val status: String,
    val categoryId: String?,
    val expiresAt: Long,
    val deposit: WasteDepositTransaction?,
    val resident: User?
)

data class PinRequest(val pin: String)
data class RedeemRequest(val itemId: String, val idempotencyKey: String)
data class RedeemResponse(val redemption: RedemptionTransaction, val resident: User, val duplicate: Boolean)
data class OkResponse(val ok: Boolean)

interface ApiService {

    @GET("api/kiosk/health")
    suspend fun checkHealth(): Response<OkResponse>

    @GET("api/kiosk/rewards")
    suspend fun getRewards(): Response<RewardsResponse>

    @GET("api/kiosk/categories")
    suspend fun getCategories(): Response<CategoriesResponse>

    @POST("api/kiosk/deposit/start")
    suspend fun startDeposit(@Body request: DepositStartRequest): Response<DepositSession>

    @GET("api/kiosk/deposit/{id}")
    suspend fun depositStatus(@Path("id") sessionId: String): Response<DepositStatusResponse>

    @POST("api/kiosk/deposit/{id}/cancel")
    suspend fun cancelDeposit(@Path("id") sessionId: String): Response<OkResponse>

    @POST("api/kiosk/card")
    suspend fun lookupCard(@Body request: CardLookupRequest): Response<CardLookupResponse>

    @POST("api/kiosk/register")
    suspend fun register(@Body request: RegisterRequest): Response<RegisterResponse>

    @POST("api/kiosk/login")
    suspend fun login(@Body request: LoginRequest): Response<LoginResponse>

    @POST("api/kiosk/logout")
    suspend fun logout(): Response<OkResponse>

    @GET("api/kiosk/me")
    suspend fun getAccount(): Response<AccountResponse>

    @PUT("api/kiosk/pin")
    suspend fun changePin(@Body request: PinRequest): Response<OkResponse>

    @POST("api/kiosk/redeem")
    suspend fun redeem(@Body request: RedeemRequest): Response<RedeemResponse>
}
