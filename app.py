from flask import Flask, render_template, jsonify
import subprocess
import json
import os
import psutil

with open("metadata.json") as f:
    METADATA = json.load(f)

STATS_FILE = "data/temperature_stats.json"

def load_temp_stats():
    # Se il file non esiste o è corrotto, torna ai valori di default
    try:
        if not os.path.exists(STATS_FILE):
            return {"max": None, "min": None}
        with open(STATS_FILE, "r") as f:
            return json.load(f)
    except:
        return {"max": None, "min": None}

def save_temp_stats(stats):
    # Assicura che la cartella data/ esista
    os.makedirs(os.path.dirname(STATS_FILE), exist_ok=True)
    with open(STATS_FILE, "w") as f:
        json.dump(stats, f)

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

@app.route("/api/status")
def status():
    data = {
        "cpu": safe_run("top -bn1 | grep 'Cpu(s)'"),
        "temp": safe_run("vcgencmd measure_temp"),
        "disk": safe_run("df -h / | grep '/'"),
        "usb": safe_run("df -h /mnt/music | grep '/'"),
        "uptime": safe_run("uptime -p"),

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
        stats = load_temp_stats()
        return jsonify({
            "temperature": None,
            "max": stats["max"],
            "min": stats["min"]
        })

    stats = load_temp_stats()

    # Aggiorna max
    if stats["max"] is None or value > stats["max"]:
        stats["max"] = value

    # Aggiorna min
    if stats["min"] is None or value < stats["min"]:
        stats["min"] = value

    save_temp_stats(stats)

    return jsonify({
        "temperature": value,
        "max": stats["max"],
        "min": stats["min"]
    })

@app.route("/api/cpu_percent")
def api_cpu_percent():
    try:
        cpu = get_cpu_percent()
        return jsonify({"cpu": cpu})
    except Exception as e:
        print("CPU ERROR:", e)
        return jsonify({"cpu": None}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
