package expo.modules.dstreamdownloads

import java.io.File
import java.io.IOException
import java.net.InetAddress
import java.net.ServerSocket
import org.junit.Assert.*
import org.junit.Test

class HttpTransferTest {
  private val payload = ByteArray(600_000) { (it % 251).toByte() }

  private fun withServer(mode: String = "normal", test: (String, File) -> Unit) {
    ServerSocket(0, 1, InetAddress.getByName("127.0.0.1")).use { server ->
      server.soTimeout = 2_000
      val sender = Thread {
        try {
          server.accept().use { socket ->
            socket.soTimeout = 2_000
            val reader = socket.getInputStream().bufferedReader()
            val headers = mutableMapOf<String, String>()
            reader.readLine() // Request line.
            while (true) {
              val line = reader.readLine()
              if (line.isNullOrEmpty()) break
              val parts = line.split(":", limit = 2)
              if (parts.size == 2) headers[parts[0].lowercase()] = parts[1].trim()
            }
            val offset = headers["range"]?.removePrefix("bytes=")?.removeSuffix("-")?.toInt() ?: 0
            val resumed = offset > 0 && mode != "ignore-range"
            val start = if (resumed) offset else 0
            val status = if (mode == "error") "404 Not Found" else if (resumed) "206 Partial Content" else "200 OK"
            val range = if (resumed) "Content-Range: bytes ${if (mode == "bad-range") 0 else offset}-${payload.size - 1}/${payload.size}\r\n" else ""
            socket.getOutputStream().apply {
              write("HTTP/1.0 $status\r\nContent-Length: ${payload.size - start}\r\n${range}Connection: close\r\n\r\n".toByteArray())
              write(payload, start, if (mode == "truncated") 100 else payload.size - start)
              flush()
            }
          }
        } catch (_: IOException) {
          // The client deliberately disconnects on cancellation or bad headers.
        }
      }.apply { isDaemon = true; start() }
      val file = File.createTempFile("dstream-test", ".mp4")
      try { test("http://127.0.0.1:${server.localPort}/media", file) }
      finally { file.delete(); server.close(); sender.join(2_000) }
    }
  }

  @Test fun streamsCompleteMediaAndReportsProgress() = withServer { url, file ->
    var progress = 0L
    val size = transferFile(url, file, { false }) { written, total ->
      assertEquals(payload.size.toLong(), total)
      progress = written
    }
    assertEquals(payload.size.toLong(), size)
    assertEquals(size, progress)
    assertArrayEquals(payload, file.readBytes())
  }

  @Test fun resumesInterruptedMediaWithRange() = withServer { url, file ->
    file.writeBytes(payload.copyOf(100_000))
    transferFile(url, file, { false }) { _, _ -> }
    assertArrayEquals(payload, file.readBytes())
  }

  @Test fun restartsWhenServerIgnoresRange() = withServer("ignore-range") { url, file ->
    file.writeBytes(payload.copyOf(100_000))
    transferFile(url, file, { false }) { _, _ -> }
    assertArrayEquals(payload, file.readBytes())
  }

  @Test fun rejectsWrongRangeWithoutAppending() = withServer("bad-range") { url, file ->
    file.writeBytes(payload.copyOf(100_000))
    assertThrows(IOException::class.java) { transferFile(url, file, { false }) { _, _ -> } }
    assertEquals(100_000L, file.length())
  }

  @Test fun rejectsTruncatedTransfers() = withServer("truncated") { url, file ->
    assertThrows(IOException::class.java) { transferFile(url, file, { false }) { _, _ -> } }
    assertEquals(100L, file.length())
  }

  @Test fun reportsHttpFailures() = withServer("error") { url, file ->
    val error = assertThrows(IOException::class.java) { transferFile(url, file, { false }) { _, _ -> } }
    assertTrue(error.message!!.contains("HTTP 404"))
  }

  @Test fun cancellationStopsTransfer() = withServer { url, file ->
    assertThrows(IOException::class.java) { transferFile(url, file, { true }) { _, _ -> } }
    assertEquals(0L, file.length())
  }
}
