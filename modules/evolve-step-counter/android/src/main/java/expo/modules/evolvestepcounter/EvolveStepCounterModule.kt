package expo.modules.evolvestepcounter

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class EvolveStepCounterModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("EvolveStepCounter")

    AsyncFunction("getCurrentStepCountAsync") { promise: Promise ->
      val context = appContext.reactContext

      if (context == null) {
        promise.resolve(-1.0)
        return@AsyncFunction
      }

      StepCounterSampler.sample(context) { raw ->
        promise.resolve(raw?.toDouble() ?: -1.0)
      }
    }

    AsyncFunction("startTrackingAsync") { promise: Promise ->
      val context = appContext.reactContext

      if (context == null) {
        promise.resolve(-1.0)
        return@AsyncFunction
      }

      StepCounterScheduler.ensureScheduled(context)

      StepCounterSampler.sample(context) { raw ->
        if (raw == null) {
          promise.resolve(-1.0)
          return@sample
        }

        val today = StepCounterStore.record(context, raw)
        promise.resolve(today.toDouble())
      }
    }

    AsyncFunction("getTodayStepCountAsync") { promise: Promise ->
      val context = appContext.reactContext

      if (context == null) {
        promise.resolve(-1.0)
        return@AsyncFunction
      }

      StepCounterScheduler.ensureScheduled(context)

      StepCounterSampler.sample(context) { raw ->
        if (raw == null) {
          promise.resolve(StepCounterStore.getToday(context).toDouble())
          return@sample
        }

        val today = StepCounterStore.record(context, raw)
        promise.resolve(today.toDouble())
      }
    }

    AsyncFunction("getStoredTodayStepCountAsync") { promise: Promise ->
      val context = appContext.reactContext
      promise.resolve(
        context?.let { StepCounterStore.getToday(it).toDouble() } ?: -1.0
      )
    }

    AsyncFunction("getLastCapturedAtAsync") { promise: Promise ->
      val context = appContext.reactContext
      promise.resolve(
        context?.let { StepCounterStore.getLastCapturedAt(it).toDouble() } ?: 0.0
      )
    }

    AsyncFunction("getStoredDailyStepsAsync") { days: Int, promise: Promise ->
      val context = appContext.reactContext

      if (context == null) {
        promise.resolve(emptyList<Map<String, Any>>())
        return@AsyncFunction
      }

      val records = StepCounterStore.getRecent(context, days).map { record ->
        mapOf(
          "date" to record.date,
          "steps" to record.steps.toDouble(),
          "updatedAt" to record.updatedAt.toDouble()
        )
      }

      promise.resolve(records)
    }
  }
}
