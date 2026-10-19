# History Entry 145: Fix Hazelcast Multicast setsockopt SocketException on Windows

## Problem Statement
During backend initialization on Windows environments (either via `pnpm dev:sandbox` or running `spring-boot:run`), Hazelcast logged the following warning and socket exception:
```
WARN [com.hazelcast.instance.impl.Node] : [192.168.1.226]:5701 [unipost-cluster] [5.5.0] Invalid argument: setsockopt
java.net.SocketException: Invalid argument: setsockopt
	at java.base/sun.nio.ch.Net.setInterface6(Native Method)
	at java.base/sun.nio.ch.DatagramChannelImpl.setOption(DatagramChannelImpl.java:364)
	at java.base/java.net.MulticastSocket.setInterface(MulticastSocket.java:405)
	at com.hazelcast.internal.cluster.impl.MulticastService.configureMulticastSocket(MulticastService.java:162)
```

## Root Cause Analysis
- Hazelcast 5.5 embedded node default configuration enables IPv6 multicast socket binding and auto-detection discovery on all network interfaces unless explicitly disabled.
- On Windows operating systems, binding a dual-stack IPv6 multicast socket on certain network adapters (`setsockopt`) triggers `java.net.SocketException: Invalid argument: setsockopt`.
- In dev and sandbox mode, clustering across remote machines is not needed; Hazelcast is used for in-process L2 metadata schema caching and near-cache invalidation on the local machine.

## Solution Applied
In `apps/backend/unipost-fw/src/main/java/com/unipost/boot/config/HazelcastConfiguration.java`:
1. Explicitly disabled auto-detection: `config.getNetworkConfig().getJoin().getAutoDetectionConfig().setEnabled(false)`.
2. Disabled multicast and TCP/IP cluster join:
   ```java
   config.getNetworkConfig().getJoin().getMulticastConfig().setEnabled(false);
   config.getNetworkConfig().getJoin().getTcpIpConfig().setEnabled(false);
   ```
3. Explicitly bound the interface to loopback (`127.0.0.1`) and disabled wildcard binding:
   ```java
   config.getNetworkConfig().getInterfaces().setEnabled(true).addInterface("127.0.0.1");
   config.setProperty("hazelcast.socket.bind.any", "false");
   ```

## Verification
- Recompiled and repackaged `unipost-fw` and `unipost-ms-aio`.
- Started backend via `mvnw spring-boot:run`.
- Hazelcast started standalone cleanly without `setsockopt` warning or `SocketException`:
  ```
  WARN [com.hazelcast.instance.impl.Node] : [127.0.0.1]:5701 [unipost-cluster] [5.5.0] No join method is enabled! Starting standalone.
  Started Application in 8.691 seconds
  ```
- Endpoint `http://localhost:8000/actuator/health` responded HTTP 200 OK `{"status":"UP"}`.
