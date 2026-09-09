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

      val sensorManager =
        context.getSystemService(Context.SENSOR_SERVICE) as SensorManager

      val sensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)

      if (sensor == null) {
        promise.resolve(-1.0)
        return@AsyncFunction
      }

      lateinit var listener: SensorEventListener

      listener = object : SensorEventListener {
        override fun onSensorChanged(event: SensorEvent) {
          sensorManager.unregisterListener(listener)
          promise.resolve(event.values[0].toDouble())
        }

        override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
      }

      val registered = sensorManager.registerListener(
        listener,
        sensor,
        SensorManager.SENSOR_DELAY_NORMAL
      )

      if (!registered) {
        promise.resolve(-1.0)
      }
    }
  }
}
