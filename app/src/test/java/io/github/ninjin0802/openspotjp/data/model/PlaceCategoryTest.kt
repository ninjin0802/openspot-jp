package io.github.ninjin0802.openspotjp.data.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PlaceCategoryTest {
    @Test
    fun apiValuesMatchContract() {
        val expected = listOf("free_wifi", "bicycle_parking", "motorcycle_parking", "cafe_open_now")
        assertEquals(expected, PlaceCategory.entries.map { it.apiValue })
    }

    @Test
    fun labelsAreNonBlankAndUnique() {
        val labels = PlaceCategory.entries.map { it.label }
        assertTrue(labels.all { it.isNotBlank() })
        assertEquals(labels.size, labels.toSet().size)
    }

    @Test
    fun apiValuesAreUnique() {
        val values = PlaceCategory.entries.map { it.apiValue }
        assertEquals(values.size, values.toSet().size)
    }
}
