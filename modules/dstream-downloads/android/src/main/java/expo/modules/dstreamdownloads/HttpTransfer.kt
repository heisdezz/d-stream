package expo.modules.dstreamdownloads

import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

/** Streaming IO stays in the app process, including its VPN/network routing. */
internal fun transferFile(url: String, file: File, cancelled: () -> Boolean,
                          progress: (Long, Long) -> Unit): Long {
  val offset = file.length()
  val connection = URL(url).openConnection() as HttpURLConnection
  connection.connectTimeout = 15_000
  connection.readTimeout = 30_000
  connection.setRequestProperty("Accept-Encoding", "identity")
  if (offset > 0) connection.setRequestProperty("Range", "bytes=$offset-")
  try {
    val status = connection.responseCode
    if (status != 200 && status != 206) throw IOException("Server returned HTTP $status")
    val append = status == 206 && offset > 0
    val start = if (append) offset else 0L
    if (status == 206) {
      val range = connection.getHeaderField("Content-Range") ?: ""
      if (!range.startsWith("bytes $start-")) throw IOException("Invalid resume response")
    }
    val length = connection.contentLengthLong
    val total = if (length >= 0) start + length else -1L
    var written = start
    progress(written, total)
    connection.inputStream.use { input ->
      java.io.FileOutputStream(file, append).use { output ->
        val buffer = ByteArray(256 * 1024)
        while (true) {
          if (cancelled()) throw IOException("Download interrupted; retry to resume")
          val count = input.read(buffer)
          if (count < 0) break
          output.write(buffer, 0, count)
          written += count
          progress(written, total)
        }
      }
    }
    if (written == 0L || (total > 0 && written != total)) throw IOException("Downloaded file is incomplete")
    return written
  } finally {
    connection.disconnect()
  }
}
