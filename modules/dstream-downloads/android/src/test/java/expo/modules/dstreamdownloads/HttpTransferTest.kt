package expo.modules.dstreamdownloads

import com.sun.net.httpserver.HttpServer
import java.io.File
import java.io.IOException
import java.net.InetSocketAddress
import java.net.ServerSocket
import org.junit.Assert.*
import org.junit.Test

class HttpTransferTest {
  private val payload = ByteArray(600_000) { (it % 251).toByte() }

  private fun withServer(mode: String = "normal", test: (String, File) -> Unit) {
    val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
    server.createContext("/media") { exchange ->
      val range = exchange.requestHeaders.getFirst("Range")
      val offset = range?.removePrefix("bytes=")?.removeSuffix("-")?.toInt() ?: 0
      val resumed = offset > 0 && mode != "ignore-range"
      val start = if (resumed) offset else 0
      val status = if (mode == "error") 404 else if (resumed) 206 else 200
      if (resumed) exchange.responseHeaders.set("Content-Range",
        "bytes ${if (mode == "bad-range") 0 else offset}-${payload.size - 1}/${payload.size}")
      exchange.sendResponseHeaders(status, (payload.size - start).toLong())
      try {
        exchange.responseBody.use {
          val length = if (mode == "truncated") 100 else payload.size - start
          it.write(payload, start, length)
        }
      } catch (_: IOException) {
        // Tests deliberately close incomplete responses and reject bad ranges.
      } finally { exchange.close() }
    }
    server.start()
    val file = File.createTempFile("dstream-test", ".mp4")
    try { test("http://127.0.0.1:${server.address.port}/media", file) }
    finally { server.stop(0); file.delete() }
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

  @Test fun rejectsTruncatedTransfers() {
    // Close the TCP socket explicitly: HttpServer keeps incomplete fixed-length
    // responses open, which would make this test wait for the read timeout.
    ServerSocket(0).use { server ->
      val sender = Thread {
        server.accept().use { socket ->
          socket.soTimeout = 2_000
          val reader = socket.getInputStream().bufferedReader()
          while (!reader.readLine().isNullOrEmpty()) { }
          socket.getOutputStream().apply {
            write("HTTP/1.0 200 OK\r\nContent-Length: ${payload.size}\r\n\r\n".toByteArray())
            write(payload, 0, 100)
            flush()
          }
        }
      }.apply { start() }
      val file = File.createTempFile("dstream-truncated", ".mp4")
      try {
        assertThrows(IOException::class.java) {
          transferFile("http://127.0.0.1:${server.localPort}/media", file, { false }) { _, _ -> }
        }
        assertEquals(100L, file.length())
      } finally { file.delete(); sender.join(2_000) }
    }
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
