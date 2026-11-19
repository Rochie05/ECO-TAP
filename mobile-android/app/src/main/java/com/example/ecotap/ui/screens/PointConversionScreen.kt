package com.example.ecotap.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ecotap.data.model.RewardItem
import com.example.ecotap.data.model.User
import com.example.ecotap.data.model.WasteCategory
import com.example.ecotap.ui.theme.BrandDarkPine
import com.example.ecotap.ui.theme.BrandGoldAmber
import com.example.ecotap.ui.theme.BrandIceMint
import com.example.ecotap.ui.theme.BrandWarmGray
import kotlin.math.ceil

/** View Reward Point Conversion: points earned per kg, and how much waste each reward is worth. */
@Composable
fun PointConversionScreen(
    user: User,
    categories: List<WasteCategory>,
    rewardItems: List<RewardItem>,
    onBackToMenu: () -> Unit
) {
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
                    Text("REWARD POINT CONVERSION", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = BrandGoldAmber, letterSpacing = 0.5.sp)
                    Text("How points work", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color.White)
                    Text("Your balance: ${user.ecoPoints} pts", fontSize = 12.sp, color = Color.White.copy(alpha = 0.85f))
                }
            }

            Column(
                modifier = Modifier.weight(1f).verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text("POINTS YOU EARN", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = BrandDarkPine, letterSpacing = 0.8.sp)
                if (categories.isEmpty()) Text("No waste categories available.", fontSize = 13.sp, color = BrandDarkPine)
                categories.forEach { item ->
                    InfoCard {
                        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                            Column {
                                Text(item.name, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = BrandDarkPine)
                                Text("1 kg = ${item.pointsPerKg} pts · 5 kg = ${item.pointsPerKg * 5} pts", fontSize = 12.sp, color = BrandDarkPine.copy(alpha = 0.75f))
                            }
                            Text("${item.pointsPerKg} pts/kg", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = BrandDarkPine)
                        }
                    }
                }

                Text("WHAT POINTS GET YOU", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = BrandDarkPine, letterSpacing = 0.8.sp)
                if (rewardItems.isEmpty()) Text("No rewards listed yet.", fontSize = 13.sp, color = BrandDarkPine)
                rewardItems.forEach { reward ->
                    InfoCard {
                        Text(reward.title, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = BrandDarkPine)
                        Text("${reward.pointsCost} pts", fontSize = 13.sp, fontWeight = FontWeight.Medium, color = BrandDarkPine)
                        if (categories.isNotEmpty()) {
                            val worth = categories.joinToString(" or ") { c ->
                                val kg = ceil(reward.pointsCost.toDouble() / c.pointsPerKg * 10) / 10
                                "$kg kg ${c.name}"
                            }
                            Text("Equal to about $worth", fontSize = 12.sp, color = BrandDarkPine.copy(alpha = 0.75f))
                        }
                    }
                }
            }

            Button(
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = BrandDarkPine),
                onClick = onBackToMenu
            ) { Text("Back to menu") }
        }
    }
}

@Composable
private fun InfoCard(content: @Composable () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = BrandIceMint),
        border = BorderStroke(1.dp, BrandWarmGray)
    ) {
        Column(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) { content() }
    }
}
