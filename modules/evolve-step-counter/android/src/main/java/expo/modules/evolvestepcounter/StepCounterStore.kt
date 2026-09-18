package expo.modules.evolvestepcounter

import android.content.Context
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

internal data class DailyStepRecord(
  val date: String,
  val steps: Long,
  val updatedAt: Long
)

internal object StepCounterStore {
  private const val PREFS_NAME = "evolve_step_counter_v3"
  private const val KEY_LAST_RAW = "last_raw"
  private const val KEY_LAST_DATE = "last_date"
  private const val KEY_LAST_CAPTURED_AT = "last_captured_at"
  private const val DAY_PREFIX = "day_"
  private const val UPDATED_PREFIX = "updated_"

  private fun dateKey(timestamp: Long): String =
    SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date(timestamp))

  private fun dayKey(date: String) = "$DAY_PREFIX$date"
  private fun updatedKey(date: String) = "$UPDATED_PREFIX$date"

  @Synchronized
  fun record(
    context: Context,
    rawSteps: Long,
    capturedAt: Long = System.currentTimeMillis()
  ): Long {
    val safeRaw = rawSteps.coerceAtLeast(0L)
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val currentDate = dateKey(capturedAt)
    var todaySteps = prefs.getLong(dayKey(currentDate), 0L)

    if (!prefs.contains(KEY_LAST_RAW)) {
      prefs.edit()
        .putLong(KEY_LAST_RAW, safeRaw)
        .putString(KEY_LAST_DATE, currentDate)
        .putLong(KEY_LAST_CAPTURED_AT, capturedAt)
        .putLong(updatedKey(currentDate), capturedAt)
        .apply()
      return todaySteps
    }

    val previousRaw = prefs.getLong(KEY_LAST_RAW, safeRaw)
    val previousDate = prefs.getString(KEY_LAST_DATE, currentDate) ?: currentDate

    // TYPE_STEP_COUNTER repart à zéro après un redémarrage du téléphone.
    // Dans ce cas, la valeur courante correspond aux pas effectués depuis le reboot.
    val delta = if (safeRaw >= previousRaw) {
      safeRaw - previousRaw
    } else {
      safeRaw
    }

    if (delta > 0L) {
      // Le JobScheduler échantillonne régulièrement. Si un échantillon traverse minuit,
      // le petit delta entre les deux mesures est attribué au nouveau jour.
      todaySteps += delta
    }

    prefs.edit()
      .putLong(dayKey(currentDate), todaySteps)
      .putLong(updatedKey(currentDate), capturedAt)
      .putLong(KEY_LAST_RAW, safeRaw)
      .putString(KEY_LAST_DATE, currentDate)
      .putLong(KEY_LAST_CAPTURED_AT, capturedAt)
      .apply()

    // previousDate est volontairement conservé dans la logique ci-dessus pour rendre
    // explicite le changement de jour et faciliter les diagnostics futurs.
    @Suppress("UNUSED_VARIABLE")
    val dayChanged = previousDate != currentDate

    return todaySteps
  }

  fun getToday(context: Context): Long {
    val now = System.currentTimeMillis()
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    return prefs.getLong(dayKey(dateKey(now)), 0L)
  }

  fun getLastCapturedAt(context: Context): Long {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    return prefs.getLong(KEY_LAST_CAPTURED_AT, 0L)
  }

  fun getRecent(context: Context, days: Int): List<DailyStepRecord> {
    val safeDays = days.coerceIn(1, 400)
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val calendar = Calendar.getInstance()
    val records = mutableListOf<DailyStepRecord>()

    repeat(safeDays) { offset ->
      val timestamp = calendar.timeInMillis
      val date = dateKey(timestamp)
      val key = dayKey(date)

      if (prefs.contains(key)) {
        records.add(
          DailyStepRecord(
            date = date,
            steps = prefs.getLong(key, 0L),
            updatedAt = prefs.getLong(updatedKey(date), 0L)
          )
        )
      }

      calendar.add(Calendar.DAY_OF_YEAR, -1)
    }

    return records.sortedBy { it.date }
  }
}
