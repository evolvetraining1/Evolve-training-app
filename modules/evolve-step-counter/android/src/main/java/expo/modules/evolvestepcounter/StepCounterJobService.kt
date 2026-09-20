package expo.modules.evolvestepcounter

import android.app.job.JobParameters
import android.app.job.JobService

class StepCounterJobService : JobService() {
  override fun onStartJob(params: JobParameters?): Boolean {
    if (params == null) return false

    StepCounterSampler.sample(applicationContext) { raw ->
      if (raw != null) {
        StepCounterStore.record(applicationContext, raw)
      }

      jobFinished(params, false)
    }

    return true
  }

  override fun onStopJob(params: JobParameters?): Boolean {
    // Si Android interrompt le job, il pourra être replanifié.
    return true
  }
}
