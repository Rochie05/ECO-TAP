package com.example.ecotap

import com.example.ecotap.data.model.WasteCategory
import com.example.ecotap.data.model.pointsForWeight
import org.junit.Assert.assertEquals
import org.junit.Test

/** The kiosk preview must match what the server awards (weight x rate, rounded half up). */
class PointsTest {
    private val pet = WasteCategory(id = "PET", name = "PET bottles", section = "b1", pointsPerKg = 10)
    private val hdpe = WasteCategory(id = "HDPE", name = "HDPE containers", section = "b2", pointsPerKg = 20)

    @Test fun wholeKilograms() {
        assertEquals(10, pointsForWeight(1.0, pet))
        assertEquals(100, pointsForWeight(5.0, hdpe))
    }

    @Test fun fractionsRoundHalfUp() {
        assertEquals(25, pointsForWeight(2.5, pet))
        assertEquals(24, pointsForWeight(1.2, hdpe))
        assertEquals(1, pointsForWeight(0.05, hdpe))
        assertEquals(1, pointsForWeight(0.05, pet)) // 0.5 rounds up
    }

    @Test fun zeroWeightEarnsNothing() {
        assertEquals(0, pointsForWeight(0.0, pet))
    }
}
