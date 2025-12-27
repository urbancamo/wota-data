Access to the WOTA databases must be via WireGuard

```bash
sudo apt update
sudo apt install wireguard
sudo cp /path/to/your-config.conf /etc/wireguard/wg0.conf
sudo chmod 600 /etc/wireguard/wg0.conf
sudo wg-quick up wg0
sudo wg show
sudo wg-quick down wg0

```

Enable wireguard at boot:
```bash
sudo systemctl enable wg-quick@wg0
```