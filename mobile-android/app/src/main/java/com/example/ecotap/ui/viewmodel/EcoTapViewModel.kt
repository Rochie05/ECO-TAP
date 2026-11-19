package com.example.ecotap.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.ecotap.data.model.AppMode
import com.example.ecotap.data.model.RedemptionTransaction
import com.example.ecotap.data.model.RewardItem
import com.example.ecotap.data.model.User
import com.example.ecotap.data.model.WasteCategory
import com.example.ecotap.data.model.WasteDepositTransaction
import com.example.ecotap.data.remote.DepositStatusResponse
import com.example.ecotap.data.repository.ApiResult
import com.example.ecotap.data.repository.EcoTapRepository
import com.example.ecotap.data.repository.normalizeCardId
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class EcoTapViewModel(val repository: EcoTapRepository = EcoTapRepository()) : ViewModel() {

    private val _currentMode = MutableStateFlow(AppMode.NFC_SCAN)
    val currentMode: StateFlow<AppMode> = _currentMode.asStateFlow()

    private val _unregisteredScannedNfcId = MutableStateFlow<String?>(null)
    val unregisteredScannedNfcId: StateFlow<String?> = _unregisteredScannedNfcId.asStateFlow()

    // While on the PIN screen this holds a stub (name + card only); after login it is the full resident.
    private val _authenticatedUser = MutableStateFlow<User?>(null)
    val authenticatedUser: StateFlow<User?> = _authenticatedUser.asStateFlow()

    private val _pinInput = MutableStateFlow("")
    val pinInput: StateFlow<String> = _pinInput.asStateFlow()

    private val _pinErrorMessage = MutableStateFlow<String?>(null)
    val pinErrorMessage: StateFlow<String?> = _pinErrorMessage.asStateFlow()

    private val _bannerMessage = MutableStateFlow<String?>(null)
    val bannerMessage: StateFlow<String?> = _bannerMessage.asStateFlow()

    private val _busy = MutableStateFlow(false)
    val busy: StateFlow<Boolean> = _busy.asStateFlow()

    private val _rewardsList = MutableStateFlow<List<RewardItem>>(emptyList())
    val rewardsList: StateFlow<List<RewardItem>> = _rewardsList.asStateFlow()

    private val _depositsList = MutableStateFlow<List<WasteDepositTransaction>>(emptyList())
    val depositsList: StateFlow<List<WasteDepositTransaction>> = _depositsList.asStateFlow()

    private val _redemptionsList = MutableStateFlow<List<RedemptionTransaction>>(emptyList())
    val redemptionsList: StateFlow<List<RedemptionTransaction>> = _redemptionsList.asStateFlow()

    private val _categoriesList = MutableStateFlow<List<WasteCategory>>(emptyList())
    val categoriesList: StateFlow<List<WasteCategory>> = _categoriesList.asStateFlow()

    private var loggedIn = false

    // --- NFC ---

    /** Called when a physical card is tapped. */
    fun onNfcCardTapped(nfcCardId: String) {
        if (_busy.value) return
        val tapped = normalizeCardId(nfcCardId)

        val currentUser = _authenticatedUser.value
        val activeModes = setOf(AppMode.MAIN_MENU, AppMode.CARD_INQUIRY, AppMode.REWARDS_POS, AppMode.DEPOSIT, AppMode.POINT_CONVERSION)
        if (loggedIn && currentUser != null && activeModes.contains(_currentMode.value)) {
            if (currentUser.nfcCardId.equals(tapped, ignoreCase = true)) {
                showBanner("Active Session Confirmed: ${currentUser.fullName}")
                return
            }
        }

        viewModelScope.launch {
            _busy.value = true
            when (val result = repository.lookupCard(tapped)) {
                is ApiResult.Success -> {
                    val card = result.value
                    if (card.registered) {
                        repository.clearSession()
                        loggedIn = false
                        _authenticatedUser.value = User(
                            id = "", nfcCardId = card.nfcCardId, fullName = card.fullName ?: "Resident",
                            address = "", barangay = card.barangay ?: "", ecoPoints = 0,
                            totalWasteKg = 0.0, registeredDate = ""
                        )
                        _pinInput.value = ""
                        _pinErrorMessage.value = null
                        _currentMode.value = AppMode.PIN_ENTRY
                        showBanner("NFC Card Recognized: ${card.fullName}")
                    } else {
                        // New / unregistered card -> resident account creation
                        _unregisteredScannedNfcId.value = card.nfcCardId
                        _currentMode.value = AppMode.REGISTRATION
                        showBanner("New NFC Card Detected (${card.nfcCardId}). Set up your resident account!")
                    }
                }
                is ApiResult.Failure -> showBanner(result.message)
            }
            _busy.value = false
        }
    }

    fun createAccountAndLinkCard(fullName: String, address: String, pinCode: String) {
        val nfcId = _unregisteredScannedNfcId.value ?: return
        if (_busy.value) return
        viewModelScope.launch {
            _busy.value = true
            when (val result = repository.register(nfcId, fullName.trim(), address.trim(), pinCode)) {
                is ApiResult.Success -> {
                    _unregisteredScannedNfcId.value = null
                    _currentMode.value = AppMode.NFC_SCAN
                    showBanner("Account created for ${result.value.fullName}! Tap your card again to log in.")
                }
                is ApiResult.Failure -> showBanner(result.message)
            }
            _busy.value = false
        }
    }

    // --- PIN pad ---

    fun onPinDigitEntered(digit: String) {
        if (_busy.value || _pinInput.value.length >= 6) return
        _pinInput.value += digit
        _pinErrorMessage.value = null
        if (_pinInput.value.length == 6) verifyPinAndProceed()
    }

    fun onPinBackspace() {
        if (_pinInput.value.isNotEmpty()) {
            _pinInput.value = _pinInput.value.dropLast(1)
            _pinErrorMessage.value = null
        }
    }

    fun onPinClear() {
        _pinInput.value = ""
        _pinErrorMessage.value = null
    }

    private fun verifyPinAndProceed() {
        val stub = _authenticatedUser.value ?: return
        val pin = _pinInput.value
        viewModelScope.launch {
            _busy.value = true
            when (val result = repository.login(stub.nfcCardId, pin)) {
                is ApiResult.Success -> {
                    loggedIn = true
                    _authenticatedUser.value = result.value
                    _pinErrorMessage.value = null
                    _pinInput.value = ""
                    _currentMode.value = AppMode.MAIN_MENU
                    showBanner("Welcome, ${result.value.fullName}!")
                    refreshAccount()
                    refreshRewards()
                    refreshCategories()
                }
                is ApiResult.Failure -> {
                    _pinErrorMessage.value = result.message
                    _pinInput.value = ""
                }
            }
            _busy.value = false
        }
    }

    // --- Navigation ---

    fun navigateTo(mode: AppMode) {
        _currentMode.value = mode
        if (loggedIn && (mode == AppMode.CARD_INQUIRY || mode == AppMode.REWARDS_POS)) {
            refreshAccount()
            if (mode == AppMode.REWARDS_POS) refreshRewards()
        }
        if (loggedIn && (mode == AppMode.DEPOSIT || mode == AppMode.POINT_CONVERSION)) {
            refreshCategories()
            if (mode == AppMode.POINT_CONVERSION) refreshRewards()
        }
    }

    fun logoutSession(message: String = "Session ended. Card ejected.") {
        if (loggedIn) viewModelScope.launch { repository.logout() } else repository.clearSession()
        loggedIn = false
        _authenticatedUser.value = null
        _unregisteredScannedNfcId.value = null
        _depositsList.value = emptyList()
        _redemptionsList.value = emptyList()
        _pinInput.value = ""
        _pinErrorMessage.value = null
        _currentMode.value = AppMode.NFC_SCAN
        showBanner(message)
    }

    // --- Server data ---

    private fun refreshRewards() {
        viewModelScope.launch {
            when (val result = repository.loadRewards()) {
                is ApiResult.Success -> _rewardsList.value = result.value
                is ApiResult.Failure -> showBanner(result.message)
            }
        }
    }

    private fun refreshCategories() {
        viewModelScope.launch {
            when (val result = repository.loadCategories()) {
                is ApiResult.Success -> _categoriesList.value = result.value
                is ApiResult.Failure -> showBanner(result.message)
            }
        }
    }

    private fun refreshAccount() {
        viewModelScope.launch {
            when (val result = repository.loadAccount()) {
                is ApiResult.Success -> {
                    _authenticatedUser.value = result.value.resident
                    _depositsList.value = result.value.deposits
                    _redemptionsList.value = result.value.redemptions
                }
                is ApiResult.Failure -> handleFailure(result)
            }
        }
    }

    private fun handleFailure(failure: ApiResult.Failure) {
        if (failure.code == 401) logoutSession("Session expired. Tap your card again.")
        else showBanner(failure.message)
    }

    // --- Rewards POS ---

    fun redeemRewardItem(rewardItem: RewardItem) {
        val user = _authenticatedUser.value ?: return
        if (_busy.value) return
        if (user.ecoPoints < rewardItem.pointsCost) {
            showBanner("Insufficient Eco-Points. Required: ${rewardItem.pointsCost}, Current: ${user.ecoPoints}")
            return
        }
        viewModelScope.launch {
            _busy.value = true
            when (val result = repository.redeem(rewardItem)) {
                is ApiResult.Success -> {
                    _authenticatedUser.value = result.value.resident
                    _redemptionsList.value = listOf(result.value.redemption) + _redemptionsList.value
                    showBanner("Redemption successful! ${rewardItem.pointsCost} points deducted. Show this to the staff to claim your item.")
                }
                is ApiResult.Failure -> handleFailure(result)
            }
            _busy.value = false
        }
    }

    // --- Deposit Segregated Waste (select category -> machine weighs -> server awards points) ---

    /** Opens a deposit session for [category]. [onDone] gets the session id, or null if it failed. */
    fun startDeposit(category: WasteCategory, onDone: (String?) -> Unit) {
        if (_busy.value) { onDone(null); return }
        viewModelScope.launch {
            _busy.value = true
            when (val result = repository.startDeposit(category)) {
                is ApiResult.Success -> onDone(result.value.sessionId)
                is ApiResult.Failure -> { handleFailure(result); onDone(null) }
            }
            _busy.value = false
        }
    }

    /**
     * Asks the server whether the machine has reported the measured weight yet. Once the status is
     * "completed" the balance and history come from the server's response.
     */
    fun checkDeposit(sessionId: String, onResult: (DepositStatusResponse?) -> Unit) {
        viewModelScope.launch {
            when (val result = repository.depositStatus(sessionId)) {
                is ApiResult.Success -> {
                    val status = result.value
                    val deposit = status.deposit
                    if (status.status == "completed" && deposit != null) {
                        status.resident?.let { _authenticatedUser.value = it }
                        _depositsList.value = listOf(deposit) + _depositsList.value.filter { it.id != deposit.id }
                        showBanner("Deposit recorded: +${deposit.pointsEarned} Eco-Points.")
                    }
                    onResult(status)
                }
                is ApiResult.Failure -> { if (result.code == 401) handleFailure(result); onResult(null) }
            }
        }
    }

    fun cancelDeposit(sessionId: String) {
        viewModelScope.launch { repository.cancelDeposit(sessionId) }
    }

    // --- Card inquiry ---

    fun updatePin(newPin: String, onDone: (Boolean) -> Unit) {
        if (_busy.value) { onDone(false); return }
        viewModelScope.launch {
            _busy.value = true
            when (val result = repository.changePin(newPin)) {
                is ApiResult.Success -> { showBanner("PIN updated."); onDone(true) }
                is ApiResult.Failure -> { handleFailure(result); onDone(false) }
            }
            _busy.value = false
        }
    }

    // --- Banner ---

    private var bannerJob: Job? = null

    fun showBanner(message: String) {
        _bannerMessage.value = message
        bannerJob?.cancel()
        bannerJob = viewModelScope.launch {
            delay(10000L)
            if (_bannerMessage.value == message) _bannerMessage.value = null
        }
    }

    fun clearBanner() {
        bannerJob?.cancel()
        _bannerMessage.value = null
    }

    // Declared last so every property above is initialised before the first request starts.
    init {
        refreshRewards()
    }
}
