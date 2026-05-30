#!/bin/bash

services=(
  "navidrome"
  "syncthing@lallost"
  "tailscaled"
  "ssh"
  "cron"
  "NetworkManager"
  "wpa_supplicant"
  "dashboard"
)

echo "{"
echo "\"services\": {"

for svc in "${services[@]}"; do
    status=$(systemctl is-active "$svc")
    echo "\"$svc\": \"$status\","
done

echo "\"_end\": \"ok\""
echo "}"
