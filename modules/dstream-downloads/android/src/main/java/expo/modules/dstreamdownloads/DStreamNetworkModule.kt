package expo.modules.dstreamdownloads

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.net.Inet4Address
import java.net.NetworkInterface
import java.util.Collections

/** Enumerate active interfaces, including secondary Wi-Fi, Ethernet and VPNs. */
class DStreamNetworkModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("DStreamNetwork")

    AsyncFunction<List<Map<String, Any>>>("getInterfaces") {
      val interfaces = NetworkInterface.getNetworkInterfaces()
      if (interfaces == null) emptyList<Map<String, Any>>() else {
        Collections.list(interfaces).filter { it.isUp && !it.isLoopback }.flatMap { network ->
          network.interfaceAddresses.mapNotNull { address ->
            val ip = address.address
            val prefix = address.networkPrefixLength.toInt()
            if (ip is Inet4Address && !ip.isLoopbackAddress && !ip.isMulticastAddress && prefix in 1..32) {
              val host = ip.hostAddress ?: return@mapNotNull null
              mapOf("ip" to host, "prefixLength" to prefix, "name" to (network.name ?: "network"))
            } else null
          }
        }
      }
    }
  }
}
