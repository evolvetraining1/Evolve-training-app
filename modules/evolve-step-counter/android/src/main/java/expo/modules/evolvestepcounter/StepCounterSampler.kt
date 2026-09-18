package expo.modules.evolvestepcounter

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Handler
import android.os.Looper

internal object StepCounterSampler {
  private const val TIMEOUT_MS = 15_000L

  fun sample(context: Context, callback: (Long?) -> Unit) {
    val appContext = context.applicationContext
    val handler = Handler(Looper.getMainLooper())

    handler.post {
      val sensorManager =
        appContext.getSystemService(Context.SENSOR_SERVICE) as? SensorManager

      val sensor = sensorManager?.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)

      if (sensorManager == null || sensor == null) {
        callback(null)
        return@post
      }

      var finished = false
      var listener: SensorEventListener? = null
      var timeout: Runnable? = null

      fun finish(value: Long?) {
        if (finished) return
        finished = true

        listener?.let { sensorManager.unregisterListener(it) }
        timeout?.let { handler.removeCallbacks(it) }
        callback(value)
      }

      listener = object : SensorEventListener {
        override fun onSensorChanged(event: SensorEvent) {
          finish(event.values.firstOrNull()?.toLong())
        }

        override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
      }

      timeout = Runnable { finish(null) }

      try {
        val registered = sensorManager.registerListener(
          listener,
          sensor,
          SensorManager.SENSOR_DELAY_NORMAL
        )

        if (!registered) {
          finish(null)
          return@post
        }

        handler.postDelayed(timeout!!, TIMEOUT_MS)
      } catch (_: SecurityException) {
        finish(null)
      } catch (_: Throwable) {
        finish(null)
      }
    }
  }
}
