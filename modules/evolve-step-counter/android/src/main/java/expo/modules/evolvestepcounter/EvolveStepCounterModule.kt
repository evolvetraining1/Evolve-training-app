package expo.modules.evolvestepcounter

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine

class EvolveStepCounterModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("EvolveStepCounter")

    AsyncFunction("getCurrentStepCountAsync") {
      readStepCounter()
    }
  }

  private suspend fun readStepCounter(): Double =
    suspendCoroutine { continuation ->
      val context = appContext.reactContext
        ?: run {
          continuation.resume(-1.0)
          return@suspendCoroutine
        }

      val sensorManager =
        context.getSystemService(Context.SENSOR_SERVICE) as SensorManager

      val sensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)

      if (sensor == null) {
        continuation.resume(-1.0)
        return@suspendCoroutine
      }

      lateinit var listener: SensorEventListener

      listener = object : SensorEventListener {
        override fun onSensorChanged(event: SensorEvent) {
          sensorManager.unregisterListener(listener)
          continuation.resume(event.values[0].toDouble())
        }

        override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
      }

      val registered = sensorManager.registerListener(
        listener,
        sensor,
        SensorManager.SENSOR_DELAY_NORMAL
      )

      if (!registered) {
        continuation.resume(-1.0)
      }
    }
}
