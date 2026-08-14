package io.github.ninjin0802.openspotjp.data.local

import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.RoomDatabase
import kotlinx.coroutines.flow.Flow

@Entity(tableName = "favorites")
data class FavoriteEntity(
    @PrimaryKey val id: String,
    val source: String,
    val category: String,
    val name: String,
    val latitude: Double,
    val longitude: Double,
    val address: String?,
    val openingHours: String?,
    val fee: String?,
    val access: String?,
    val capacity: Int?,
    val sourceUrl: String?,
    val updatedAt: String?,
)

@Dao
interface FavoriteDao {
    @Query("SELECT * FROM favorites ORDER BY name COLLATE NOCASE")
    fun observeAll(): Flow<List<FavoriteEntity>>

    @Query("SELECT * FROM favorites WHERE id = :id LIMIT 1")
    suspend fun findById(id: String): FavoriteEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: FavoriteEntity)

    @Query("DELETE FROM favorites WHERE id = :id")
    suspend fun deleteById(id: String)
}

@Database(entities = [FavoriteEntity::class], version = 1, exportSchema = true)
abstract class FavoriteDatabase : RoomDatabase() {
    abstract fun favoriteDao(): FavoriteDao
}
