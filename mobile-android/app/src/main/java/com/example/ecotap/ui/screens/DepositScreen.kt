package com.example.ecotap.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ecotap.data.model.User
import com.example.ecotap.data.model.WasteCategory
import com.example.ecotap.data.model.WasteDepositTransaction
import com.example.ecotap.data.remote.DepositStatusResponse
import com.example.ecotap.ui.theme.BrandDarkPine
import com.example.ecotap.ui.theme.BrandGoldAmber
import com.example.ecotap.ui.theme.BrandIceMint
import com.example.ecotap.ui.theme.BrandSageGreen
import com.example.ecotap.ui.theme.BrandWarmGray
import kotlinx.coroutines.delay

private enum class DepositStep { CATEGORY, WEIGHING, DONE }

private const val POLL_INTERVAL_MS = 1500L

/**
 * Deposit Segregated Waste: 1) select waste category, 2) the machine weighs the waste, 3) points are awarded.
 *
 * There is deliberately NO way to enter or adjust a weight here. The resident only chooses a category,
 * which opens a deposit session on the server. The machine's load cell and optical sensor then report the
 * measured weight and detected material, and the server calculates and awards the points. This screen
 * just waits for that result.
 */
@Composable
fun DepositScreen(
    user: User,
    categories: List<WasteCategory>,
    busy: Boolean,
    onStart: (WasteCategory, (String?) -> Unit) -> Unit,
    onPoll: (String, (DepositStatusResponse?) -> Unit) -> Unit,
    onCancel: (String) -> Unit,
    onBackToMenu: () -> Unit
) {
    var step by remember { mutableStateOf(DepositStep.CATEGORY) }
    var category by remember { mutableStateOf<WasteCategory?>(null) }
    var sessionId by remember { mutableStateOf<String?>(null) }
    var recorded by remember { mutableStateOf<WasteDepositTransaction?>(null) }
    var notice by remember { mutableStateOf<String?>(null) }

    fun startOver() {
        category = null
        sessionId = null
        recorded = null
        step = DepositStep.CATEGORY
    }

    // While waiting, ask the server whether the machine has reported a measured weight yet.
    LaunchedEffect(sessionId, step) {
        val id = sessionId
        if (step != DepositStep.WEIGHING || id == null) return@LaunchedEffect
        while (true) {
            delay(POLL_INTERVAL_MS)
            onPoll(id) { status ->
                if (step == DepositStep.WEIGHING && sessionId == id && status != null) {
                    when (status.status) {
                        "completed" -> { recorded = status.deposit; step = DepositStep.DONE }
                        "expired" -> { notice = "No deposit was detected. Please start again."; startOver() }
                        "cancelled" -> startOver()
                    }
                }
            }
        }
    }

    val chosen = category
    val title = when (step) {
        DepositStep.CATEGORY -> "1 of 2 · Select waste category"
        DepositStep.WEIGHING -> "2 of 2 · Machine is weighing"
        DepositStep.DONE -> "Deposit complete"
    }

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(
            modifier = Modifier.fillMaxSize().padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = BrandDarkPine)
            ) {
                Column(modifier = Modifier.fillMaxWidth().padding(18.dp)) {
                    Text("DEPOSIT SEGREGATED WASTE", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = BrandGoldAmber, letterSpacing = 0.5.sp)
                    Text(title, fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color.White)
                    Text("Resident: ${user.fullName} · ${user.ecoPoints} pts", fontSize = 12.sp, color = Color.White.copy(alpha = 0.85f))
                }
            }

            Column(
                modifier = Modifier.weight(1f).verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                when (step) {
                    DepositStep.CATEGORY -> {
                        notice?.let { Text(it, fontSize = 13.sp, fontWeight = FontWeight.Medium, color = BrandDarkPine) }
                        if (categories.isEmpty()) {
                            Text("Loading waste categories…", fontSize = 13.sp, color = BrandDarkPine)
                        }
                        categories.forEach { item ->
                            val selected = chosen?.id == item.id
                            Card(
                                modifier = Modifier.fillMaxWidth().clickable { category = item },
                                shape = RoundedCornerShape(14.dp),
                                colors = CardDefaults.cardColors(containerColor = if (selected) BrandSageGreen.copy(alpha = 0.25f) else BrandIceMint),
                                border = BorderStroke(if (selected) 2.dp else 1.dp, if (selected) BrandDarkPine else BrandWarmGray)
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Column {
                                        Text(item.name, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = BrandDarkPine)
                                        Text("Bin ${item.section.uppercase()}", fontSize = 12.sp, color = BrandDarkPine.copy(alpha = 0.75f))
                                    }
                                    Text("${item.pointsPerKg} pts / kg", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = BrandDarkPine)
                                }
                            }
                        }
                    }

                    DepositStep.WEIGHING -> {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(16.dp),
                            colors = CardDefaults.cardColors(containerColor = BrandIceMint),
                            border = BorderStroke(1.dp, BrandWarmGray)
                        ) {
                            Column(
                                modifier = Modifier.fillMaxWidth().padding(24.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                CircularProgressIndicator(color = BrandDarkPine)
                                Text("Insert your ${chosen?.name ?: "bottles"} into the machine", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = BrandDarkPine)
                                Text(
                                    "The machine weighs and sorts them for you. Your points appear here as soon as the scale reports the weight.",
                                    fontSize = 13.sp, color = BrandDarkPine.copy(alpha = 0.8f)
                                )
                            }
                        }
                    }

                    DepositStep.DONE -> {
                        val done = recorded
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(16.dp),
                            colors = CardDefaults.cardColors(containerColor = BrandIceMint),
                            border = BorderStroke(1.dp, BrandWarmGray)
                        ) {
                            Column(modifier = Modifier.fillMaxWidth().padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("♻️", fontSize = 36.sp)
                                Text("+${done?.pointsEarned ?: 0} Eco-Points", fontSize = 28.sp, fontWeight = FontWeight.Bold, color = BrandDarkPine)
                                Text(
                                    "${"%.2f".format(done?.weightKg ?: 0.0)} kg of ${done?.categoryName ?: ""} (weighed by the machine)",
                                    fontSize = 14.sp, color = BrandDarkPine.copy(alpha = 0.8f)
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                Text("New balance: ${user.ecoPoints} pts", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = BrandDarkPine)
                            }
                        }
                    }
                }
            }

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                when (step) {
                    DepositStep.CATEGORY -> {
                        OutlinedButton(modifier = Modifier.weight(1f), onClick = onBackToMenu) { Text("Back to menu") }
                        Button(
                            modifier = Modifier.weight(1f), enabled = chosen != null && !busy,
                            colors = ButtonDefaults.buttonColors(containerColor = BrandDarkPine),
                            onClick = {
                                if (chosen != null) {
                                    notice = null
                                    onStart(chosen) { id ->
                                        if (id != null) { sessionId = id; step = DepositStep.WEIGHING }
                                    }
                                }
                            }
                        ) { Text(if (busy) "Starting…" else "Start deposit") }
                    }
                    DepositStep.WEIGHING -> {
                        OutlinedButton(
                            modifier = Modifier.fillMaxWidth(),
                            onClick = { sessionId?.let(onCancel); startOver() }
                        ) { Text("Cancel deposit") }
                    }
                    DepositStep.DONE -> {
                        OutlinedButton(modifier = Modifier.weight(1f), onClick = onBackToMenu) { Text("Back to menu") }
                        Button(
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.buttonColors(containerColor = BrandDarkPine),
                            onClick = { startOver() }
                        ) { Text("Deposit more") }
                    }
                }
            }
        }
    }
}
