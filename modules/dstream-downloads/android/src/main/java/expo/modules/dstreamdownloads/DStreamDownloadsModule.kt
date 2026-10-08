package expo.modules.dstreamdownloads

import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import android.os.Environment
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.util.UUID
import org.json.JSONObject

/** The OS owns the transfer and notification, even when React Native is stopped. */
class DStreamDownloadsModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()
  private val manager: DownloadManager
    get() = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
  private val jobs
    get() = context.getSharedPreferences("dstream_download_jobs", Context.MODE_PRIVATE)

  override fun definition() = ModuleDefinition {
    Name("DStreamDownloads")

    AsyncFunction("enqueue") { url: String, relativePath: String, recordJson: String ->
      val root = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
        ?: throw IllegalStateException("Download storage is unavailable")
      // Unique paths prevent duplicate filenames from overwriting another media item.
      val destination = File(root, "${UUID.randomUUID()}/$relativePath").canonicalFile
      require(destination.path.startsWith(root.canonicalPath + File.separator)) {
        "Invalid download path"
      }
      check(destination.parentFile?.mkdirs() == true || destination.parentFile?.isDirectory == true)
      val record = JSONObject(recordJson).put("localUri", Uri.fromFile(destination).toString())
      val request = DownloadManager.Request(Uri.parse(url))
        .setDestinationUri(Uri.fromFile(destination))
        .setTitle(record.getString("fileName"))
        .setDescription("D-Stream • ${record.getString("albumName")}")
        .setMimeType(record.getString("mimeType"))
        .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
        .setAllowedOverMetered(true)
        .setAllowedOverRoaming(false)
      val id = manager.enqueue(request)
      // Commit off the UI thread before resolving, so relaunch can recover the job.
      if (!jobs.edit().putString(id.toString(), record.toString()).commit()) {
        manager.remove(id)
        throw IllegalStateException("Could not save background download")
      }
      id.toString()
    }

    AsyncFunction("getJobs") {
      jobs.all.map { (key, value) ->
        var status = DownloadManager.STATUS_FAILED
        var reason = 0
        var written = 0L
        var total = -1L
        manager.query(DownloadManager.Query().setFilterById(key.toLong())).use { cursor ->
          if (cursor.moveToFirst()) {
            status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
            reason = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON))
            written = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR))
            total = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES))
          }
        }
        mapOf("id" to key, "recordJson" to value, "status" to status,
          "reason" to reason, "written" to written.toDouble(), "total" to total.toDouble())
      }
    }

    AsyncFunction("forget") { id: String, failed: Boolean ->
      if (failed) manager.remove(id.toLong())
      check(jobs.edit().remove(id).commit()) { "Could not finalize background download" }
    }
  }
}
