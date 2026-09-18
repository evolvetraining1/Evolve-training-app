package expo.modules.evolvestepcounter

import android.app.job.JobInfo
import android.app.job.JobScheduler
import android.content.ComponentName
import android.content.Context

internal object StepCounterScheduler {
  private const val JOB_ID = 27411
  private const val PERIOD_MS = 15L * 60L * 1000L

  fun ensureScheduled(context: Context): Boolean {
    val appContext = context.applicationContext
    val scheduler = appContext.getSystemService(Context.JOB_SCHEDULER_SERVICE) as? JobScheduler
      ?: return false

    val alreadyScheduled = scheduler.allPendingJobs.any { it.id == JOB_ID }
    if (alreadyScheduled) return true

    val component = ComponentName(appContext, StepCounterJobService::class.java)
    val job = JobInfo.Builder(JOB_ID, component)
      .setPersisted(true)
      .setPeriodic(PERIOD_MS)
      .build()

    return scheduler.schedule(job) == JobScheduler.RESULT_SUCCESS
  }
}
