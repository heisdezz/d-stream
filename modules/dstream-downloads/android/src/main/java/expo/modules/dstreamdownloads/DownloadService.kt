package expo.modules.dstreamdownloads

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.util.Log
import java.io.File
import java.util.concurrent.Executors
import org.json.JSONObject

internal fun transferJobs(context: Context) =
  context.getSharedPreferences("dstream_http_download_jobs", Context.MODE_PRIVATE)

/** Two native IO workers and one foreground notification; no JS data buffering. */
class DownloadService : Service() {
  companion object {
    @Volatile var running = false
      private set
    private const val CHANNEL = "dstream-transfers"
    private const val NOTIFICATION = 47001
    fun start(context: Context) {
      val intent = Intent(context, DownloadService::class.java)
      if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(intent)
      else context.startService(intent)
    }
  }

  private val workers = Executors.newFixedThreadPool(2)
  private val main = Handler(Looper.getMainLooper())
  private val scheduled = mutableSetOf<String>() // Accessed only on main thread.
  @Volatile private var stopped = false
  private var wakeLock: PowerManager.WakeLock? = null

  override fun onCreate() {
    super.onCreate()
    running = true
    val notifications = getSystemService(NotificationManager::class.java)
    if (Build.VERSION.SDK_INT >= 26) {
      notifications.createNotificationChannel(NotificationChannel(CHANNEL, "Media downloads", NotificationManager.IMPORTANCE_LOW))
    }
    startForeground(NOTIFICATION, notification("Starting downloads", 0, -1))
    wakeLock = (getSystemService(POWER_SERVICE) as PowerManager)
      .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "DStream:downloads")
      .apply { acquire(6 * 60 * 60 * 1000L) }
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    transferJobs(this).all.forEach { (id, value) ->
      val job = JSONObject(value as String)
      if (job.getInt("status") in listOf(1, 2) && scheduled.add(id)) {
        workers.execute { download(id, job) }
      }
    }
    if (scheduled.isEmpty()) stopSelf(startId)
    return START_NOT_STICKY
  }

  private fun download(id: String, job: JSONObject) {
    val record = JSONObject(job.getString("recordJson"))
    val file = File(android.net.Uri.parse(record.getString("localUri")).path!!)
    var lastUpdate = 0L
    try {
      val size = transferFile(job.getString("url"), file, { stopped }) { written, total ->
        val now = android.os.SystemClock.elapsedRealtime()
        if (now - lastUpdate >= 500) {
          lastUpdate = now
          job.put("status", 2).put("written", written).put("total", total)
          save(id, job)
          getSystemService(NotificationManager::class.java).notify(NOTIFICATION,
            notification(record.getString("fileName"), written, total))
        }
      }
      job.put("status", 8).put("written", size).put("total", size)
      Log.i("DStreamDownloads", "Completed media ${record.getInt("mediaId")}: $size bytes")
    } catch (error: Exception) {
      job.put("status", 16).put("error", error.message ?: "Download failed")
      Log.w("DStreamDownloads", "Failed media ${record.getInt("mediaId")}", error)
    } finally {
      try {
        save(id, job)
        // Keep a completion notification when the foreground notification is removed.
        getSystemService(NotificationManager::class.java).notify(id.hashCode(),
          notification(record.getString("fileName"), 0, -1,
            if (job.getInt("status") == 8) "Download complete" else "Download failed"))
      } catch (error: Exception) {
        Log.e("DStreamDownloads", "Could not finalize $id", error)
      }
      main.post {
        scheduled.remove(id)
        val pending = transferJobs(this).all.any { (key, value) ->
          key != id && JSONObject(value as String).getInt("status") in listOf(1, 2)
        }
        if (scheduled.isEmpty() && !pending) {
          stopForeground(STOP_FOREGROUND_REMOVE)
          stopSelf()
        }
      }
    }
  }

  private fun save(id: String, job: JSONObject) {
    if (!transferJobs(this).contains(id)) return // JS may have acknowledged a timeout.
    check(transferJobs(this).edit().putString(id, job.toString()).commit()) { "Could not save download progress" }
  }

  private fun notification(name: String, written: Long, total: Long, title: String = "Downloading media"): Notification {
    val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, CHANNEL) else Notification.Builder(this)
    builder.setSmallIcon(android.R.drawable.stat_sys_download)
      .setContentTitle(title).setContentText(name).setOnlyAlertOnce(true)
      .setOngoing(title == "Downloading media")
    if (title == "Downloading media") {
      builder.setProgress(100, if (total > 0) (written.toDouble() / total * 100).toInt() else 0, total <= 0)
    }
    packageManager.getLaunchIntentForPackage(packageName)?.let {
      builder.setContentIntent(PendingIntent.getActivity(this, 0, it,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
    }
    return builder.build()
  }

  override fun onTimeout(startId: Int, fgsType: Int) {
    // Android 15+ limits dataSync services. Stop promptly rather than crashing.
    stopped = true
    transferJobs(this).all.forEach { (id, value) ->
      val job = JSONObject(value as String)
      if (job.getInt("status") in listOf(1, 2)) {
        job.put("status", 16).put("error", "Android download time limit reached; retry the download")
        save(id, job)
      }
    }
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  override fun onDestroy() {
    stopped = true
    running = false
    workers.shutdownNow()
    wakeLock?.let { if (it.isHeld) it.release() }
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null
}
