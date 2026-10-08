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

/** App-owned native transfers preserve the app's LAN/VPN route. */
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
      val id = UUID.randomUUID().toString()
      val job = JSONObject().put("url", url).put("recordJson", record.toString())
        .put("status", 1).put("reason", 0).put("written", 0).put("total", -1)
      check(transferJobs(context).edit().putString(id, job.toString()).commit()) {
        "Could not save background download"
      }
      try {
        DownloadService.start(context)
      } catch (error: Exception) {
        transferJobs(context).edit().remove(id).commit()
        destination.delete()
        throw error
      }
      id
    }

    AsyncFunction("getJobs") {
      val transfers = transferJobs(context).all.map { (id, value) ->
        val job = JSONObject(value as String)
        mutableMapOf<String, Any>("id" to id, "recordJson" to job.getString("recordJson"),
          "status" to job.getInt("status"), "reason" to job.optInt("reason"),
          "written" to job.getLong("written").toDouble(), "total" to job.getLong("total").toDouble(),
          "error" to job.optString("error"))
      }
      if (!DownloadService.running && transfers.any { it["status"] in listOf(1, 2) }) {
        try {
          DownloadService.start(context)
        } catch (error: Exception) {
          transfers.filter { it["status"] in listOf(1, 2) }.forEach { transfer ->
            val id = transfer["id"] as String
            val job = JSONObject(transferJobs(context).getString(id, null)!!)
            val message = error.message ?: "Could not resume background download"
            job.put("status", 16).put("error", message)
            check(transferJobs(context).edit().putString(id, job.toString()).commit())
            transfer["status"] = 16
            transfer["error"] = message
          }
        }
      }
      // Finish old successful DownloadManager jobs; stalled jobs can be retried
      // with the app-owned transport instead of remaining at zero forever.
      transfers + jobs.all.map { (key, value) ->
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
        mapOf("id" to key, "recordJson" to value,
          "status" to if (status == DownloadManager.STATUS_SUCCESSFUL) status else DownloadManager.STATUS_FAILED,
          "reason" to reason, "written" to written.toDouble(), "total" to total.toDouble(),
          "error" to "Retry this download to use the app's network connection")
      }
    }

    AsyncFunction("forget") { id: String, failed: Boolean ->
      if (id.toLongOrNull() != null) {
        if (failed) manager.remove(id.toLong())
        check(jobs.edit().remove(id).commit()) { "Could not finalize background download" }
      } else {
        val job = transferJobs(context).getString(id, null)
        if (failed && job != null) {
          val record = JSONObject(JSONObject(job).getString("recordJson"))
          File(Uri.parse(record.getString("localUri")).path!!).delete()
        }
        check(transferJobs(context).edit().remove(id).commit()) { "Could not finalize background download" }
      }
    }
  }
}
