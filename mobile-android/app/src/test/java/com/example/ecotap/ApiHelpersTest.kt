package com.example.ecotap

import com.example.ecotap.data.repository.normalizeCardId
import com.example.ecotap.data.repository.parseErrorMessage
import org.junit.Assert.assertEquals
import org.junit.Test

class ApiHelpersTest {

    @Test
    fun cardIdGetsPrefixAndUppercase() {
        assertEquals("ECO-TAP-8A19B", normalizeCardId(" 8a19b "))
    }

    @Test
    fun cardIdWithPrefixIsKept() {
        assertEquals("ECO-TAP-3F72C", normalizeCardId("eco-tap-3f72c"))
    }

    @Test
    fun errorMessageIsReadFromServerBody() {
        assertEquals("Invalid 6-digit PIN. Please try again.", parseErrorMessage("""{"error":"Invalid 6-digit PIN. Please try again."}""", "fallback"))
    }

    @Test
    fun errorMessageFallsBackOnBadBody() {
        assertEquals("fallback", parseErrorMessage("<html>502</html>", "fallback"))
        assertEquals("fallback", parseErrorMessage(null, "fallback"))
        assertEquals("fallback", parseErrorMessage("{}", "fallback"))
    }
}
