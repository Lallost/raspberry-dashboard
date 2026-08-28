from flask import Flask, render_template, jsonify, request
import subprocess
import json
import os
import re
import time
import psutil

with open("metadata.json") as f:
    METADATA = json.load(f)

STATS_FILES = {
    "temperature": "data/temperature_stats.json",
    "cpu": "data/cpu_stats.json",
    "ram": "data/ram_stats.json",
    "net_up": "data/net_up_stats.json",
    "net_down": "data/net_down_stats.json",
}

def load_stats(metric):
    # Se il file non esiste o è corrotto, torna ai valori di default
    path = STATS_FILES[metric]
    try:
        if not os.path.exists(path):
            return {"max": None, "min": None}
        with open(path, "r") as f:
            return json.load(f)
    except:
        return {"max": None, "min": None}

def save_stats(metric, stats):
    # Assicura che la cartella data/ esista
    path = STATS_FILES[metric]
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(stats, f)

def update_stats(metric, value):
    # Aggiorna max/min registrati per una metrica e li salva su disco
    stats = load_stats(metric)

    if stats["max"] is None or value > stats["max"]:
        stats["max"] = value

    if stats["min"] is None or value < stats["min"]:
        stats["min"] = value

    save_stats(metric, stats)
    return stats

app = Flask(__name__)

def run(cmd):
    return subprocess.check_output(cmd, shell=True).decode().strip()

@app.route("/")
def index():
    return render_template("index.html", metadata=METADATA)

def safe_run(cmd):
    try:
        return subprocess.check_output(cmd, shell=True).decode().strip()
    except subprocess.CalledProcessError as e:
        # systemctl is-active returns exit code 3 for inactive/disabled
        if e.returncode == 3:
            return "inactive"
        return "error"
    except:
        return "error"

def get_cpu_percent():
    # Ritorna la percentuale di utilizzo CPU senza bloccare il server
    return psutil.cpu_percent(interval=None)

# Ultima lettura dei contatori di rete, per calcolare la velocità (bytes/sec)
_net_last = {"time": None, "sent": None, "recv": None}

def get_network_bytes():
    # Somma i contatori di tutte le interfacce tranne il loopback
    counters = psutil.net_io_counters(pernic=True)
    sent = 0
    recv = 0
    for iface, c in counters.items():
        if iface == "lo":
            continue
        sent += c.bytes_sent
        recv += c.bytes_recv
    return sent, recv

def get_network_rates():
    # Calcola upload/download in KB/s dal delta rispetto all'ultima chiamata
    global _net_last
    sent, recv = get_network_bytes()
    now = time.time()

    if _net_last["time"] is None:
        _net_last = {"time": now, "sent": sent, "recv": recv}
        return {"upload_kbps": 0.0, "download_kbps": 0.0}

    dt = now - _net_last["time"]
    if dt <= 0:
        dt = 1

    upload_kbps = max(0.0, (sent - _net_last["sent"]) / dt / 1024)
    download_kbps = max(0.0, (recv - _net_last["recv"]) / dt / 1024)

    _net_last = {"time": now, "sent": sent, "recv": recv}

    return {
        "upload_kbps": round(upload_kbps, 2),
        "download_kbps": round(download_kbps, 2)
    }

def get_wifi_status():
    # Stato/qualità della connessione WiFi sull'interfaccia wlan0.
    # "iw dev wlan0 link" stampa "Not connected." (senza errore) se wlan0
    # non è associata (es. quando si usa il cavo Ethernet come principale).
    raw = safe_run("iw dev wlan0 link")

    signal_match = re.search(r"signal:\s*(-?\d+)\s*dBm", raw) if raw else None
    if not signal_match:
        return {"connected": False}

    ssid_match = re.search(r"SSID:\s*(.+)", raw)
    freq_match = re.search(r"freq:\s*(\d+)", raw)
    signal_dbm = int(signal_match.group(1))

    # Approssimazione standard dBm -> percentuale (-50dBm ~ 100%, -100dBm ~ 0%)
    signal_percent = max(0, min(100, 2 * (signal_dbm + 100)))

    if signal_percent >= 80:
        label = "Ottima"
    elif signal_percent >= 60:
        label = "Buona"
    elif signal_percent >= 40:
        label = "Discreta"
    elif signal_percent >= 20:
        label = "Debole"
    else:
        label = "Molto debole"

    # Banda dedotta dalla frequenza (2.4GHz: 2400-2500 MHz, 5GHz: 4900-5900 MHz)
    band = None
    if freq_match:
        freq = int(freq_match.group(1))
        if 2400 <= freq < 2500:
            band = "2.4GHz"
        elif 4900 <= freq < 5900:
            band = "5GHz"

    return {
        "connected": True,
        "ssid": ssid_match.group(1).strip() if ssid_match else None,
        "signal_dbm": signal_dbm,
        "signal_percent": signal_percent,
        "signal_label": label,
        "band": band
    }

@app.route("/api/status")
def status():
    ram_percent = psutil.virtual_memory().percent
    ram_stats = update_stats("ram", ram_percent)
    wifi_status = get_wifi_status()

    data = {
        "cpu": safe_run("top -bn1 | grep 'Cpu(s)'"),
        "temp": safe_run("vcgencmd measure_temp"),
        "disk": safe_run("df -h / | grep '/'"),
        "usb": safe_run("df -h /mnt/music | grep '/'"),

        # RAM
        "ram_total": round(psutil.virtual_memory().total / (1024**3), 2),
        "ram_used": round(psutil.virtual_memory().used / (1024**3), 2),
        "ram_percent": ram_percent,
        "ram_max": ram_stats["max"],
        "ram_min": ram_stats["min"],
        "ram_real_used": round((psutil.virtual_memory().total - psutil.virtual_memory().available) / (1024**3), 2),
        "ram_real_percent": round((1 - psutil.virtual_memory().available / psutil.virtual_memory().total) * 100, 2),


        "uptime": safe_run("uptime -p"),

        # WIFI
        "wifi_connected": wifi_status["connected"],
        "wifi_ssid": wifi_status.get("ssid"),
        "wifi_signal_dbm": wifi_status.get("signal_dbm"),
        "wifi_signal_percent": wifi_status.get("signal_percent"),
        "wifi_signal_label": wifi_status.get("signal_label"),
        "wifi_band": wifi_status.get("band"),

        # SERVIZI IMPORTANTI
        "dashboard": safe_run("systemctl is-active dashboard"),
        "navidrome": safe_run("systemctl is-active navidrome"),
        "syncthing": safe_run("systemctl is-active syncthing@lallost"),
        "tailscale": safe_run("systemctl is-active tailscaled"),
        "wayvnc": safe_run("systemctl is-active wayvnc"),
        "wayvnc_control": safe_run("systemctl is-active wayvnc-control"),
        "vnc_x11": safe_run("systemctl is-active vncserver-x11-serviced"),

        # SERVIZI DI SISTEMA IMPORTANTI
        "cron": safe_run("systemctl is-active cron"),
        "ssh": safe_run("systemctl is-active ssh"),
        "network": safe_run("systemctl is-active NetworkManager"),
        "wifi": safe_run("systemctl is-active wpa_supplicant")
    }

    return jsonify(data)

@app.route("/api/temperature")
def api_temperature():
    raw = safe_run("vcgencmd measure_temp")
    # raw è tipo: "temp=52.3'C"

    try:
        value = float(raw.replace("temp=", "").replace("'C", ""))
    except:
        # Se non riesco a parsare, non tocco i record
        stats = load_stats("temperature")
        return jsonify({
            "temperature": None,
            "max": stats["max"],
            "min": stats["min"]
        })

    stats = update_stats("temperature", value)

    return jsonify({
        "temperature": value,
        "max": stats["max"],
        "min": stats["min"]
    })

@app.route("/api/cpu_percent")
def api_cpu_percent():
    try:
        cpu = get_cpu_percent()
        stats = update_stats("cpu", cpu)
        return jsonify({"cpu": cpu, "max": stats["max"], "min": stats["min"]})
    except Exception as e:
        print("CPU ERROR:", e)
        return jsonify({"cpu": None}), 500

@app.route("/api/network")
def api_network():
    rates = get_network_rates()
    up_stats = update_stats("net_up", rates["upload_kbps"])
    down_stats = update_stats("net_down", rates["download_kbps"])

    return jsonify({
        "upload_kbps": rates["upload_kbps"],
        "download_kbps": rates["download_kbps"],
        "up_max": up_stats["max"],
        "up_min": up_stats["min"],
        "down_max": down_stats["max"],
        "down_min": down_stats["min"]
    })

# Valori richiesti da "nmcli connection modify ... 802-11-wireless.band"
WIFI_BAND_VALUES = {"2.4": "bg", "5": "a"}

@app.route("/api/wifi_band/<band>")
def api_wifi_band(band):
    # Forza il profilo WiFi attualmente connesso su una banda specifica (2.4GHz o 5GHz).
    # Richiede una regola sudoers NOPASSWD per nmcli (vedi README/setup) perché
    # il servizio dashboard gira come utente non privilegiato.
    if band not in WIFI_BAND_VALUES:
        return jsonify({"error": "Banda non valida, usare '2.4' o '5'"}), 400

    wifi_status = get_wifi_status()
    if not wifi_status["connected"] or not wifi_status.get("ssid"):
        return jsonify({"error": "WiFi non connesso, impossibile cambiare banda"}), 400

    # I profili WiFi su questo Raspberry sono generati con questo naming (vedi wifi-sync.service)
    conn_name = f"wifi-sync-{wifi_status['ssid']}"
    band_value = WIFI_BAND_VALUES[band]

    try:
        subprocess.check_output(
            ["sudo", "nmcli", "connection", "modify", conn_name, "802-11-wireless.band", band_value],
            stderr=subprocess.STDOUT
        )
        output = subprocess.check_output(
            ["sudo", "nmcli", "connection", "up", conn_name],
            stderr=subprocess.STDOUT
        ).decode().strip()

        return jsonify({"status": "ok", "connection": conn_name, "band": band, "output": output})

    except subprocess.CalledProcessError as e:
        print("NMCLI BAND ERROR:", e.output.decode())
        return jsonify({
            "status": "failed",
            "connection": conn_name,
            "output": e.output.decode()
        }), 500

    except Exception as e:
        print("UNEXPECTED ERROR:", str(e))
        return jsonify({"error": "Unexpected error"}), 500

@app.route("/api/reset_stats/<metric>")
def api_reset_stats(metric):
    if metric not in STATS_FILES:
        return jsonify({"error": "Invalid metric"}), 400

    stats = {"max": None, "min": None}
    save_stats(metric, stats)

    return jsonify({"status": "ok", "metric": metric, "max": stats["max"], "min": stats["min"]})

@app.route("/api/service/<action>")
def api_service_action(action):
    name = request.args.get("name")

    if not name:
        print("ERROR: Missing service name")
        return jsonify({"error": "Missing service name"}), 400

    if action not in ["start", "stop", "restart"]:
        print("ERROR: Invalid action:", action)
        return jsonify({"error": "Invalid action"}), 400

    try:
        output = subprocess.check_output(
            ["sudo", "systemctl", action, name],
            stderr=subprocess.STDOUT
        ).decode().strip()

        return jsonify({
            "service": name,
            "action": action,
            "status": "ok",
            "output": output
        })

    except subprocess.CalledProcessError as e:
        print("SYSTEMCTL ERROR:", e.output.decode())
        return jsonify({
            "service": name,
            "action": action,
            "status": "failed",
            "output": e.output.decode()
        }), 500

    except Exception as e:
        print("UNEXPECTED ERROR:", str(e))
        return jsonify({"error": "Unexpected error"}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
