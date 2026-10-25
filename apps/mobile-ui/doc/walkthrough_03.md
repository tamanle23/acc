# Walkthrough 03: Automated Dynamic Physical IP Detection in Metro

## Problem Addressed
Users on Windows frequently experience issues where Expo binds to virtual network adapters (Hyper-V, WSL, Docker, Cloudflare WARP) instead of their physical Wi-Fi or Ethernet adapter. Previously, this required manually setting `$env:REACT_NATIVE_PACKAGER_HOSTNAME="192.168.1.148"`, which is static and breaks across different networks or DHCP renewals.

## Solution Implemented
Added an automatic LAN IP resolver directly inside `metro.config.js`:
1. Inspects `os.networkInterfaces()`.
2. Filters out virtual interfaces (`vethernet`, `wsl`, `hyper-v`, `cloudflare`, `warp`, `pseudo`, `loopback`).
3. Automatically identifies the active physical IPv4 Wi-Fi / Ethernet adapter.
4. Dynamically assigns `process.env.REACT_NATIVE_PACKAGER_HOSTNAME` before Expo bundler generates the QR code and deep links.

## Verification Results
- Tested by running `pnpm expo start`:
  ```
  Starting project at C:\Users\Admin\workspace\git\acc\apps\mobile-ui
  [Metro] Automatically detected LAN IP: 192.168.1.148
  Starting Metro Bundler
  ```
- No manual environment variable setup is required anymore. The server adapts to any network change dynamically.
