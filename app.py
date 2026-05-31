from flask import Flask, render_template, jsonify
import subprocess

import json
with open("metadata.json") as f:
    METADATA = json.load(f)

app = Flask(__name__)

def run(cmd):
    return subprocess.check_output(cmd, shell=True).decode().strip()

@app.route("/")
def index():
    return render_template("index.html", metadata=METADATA)

def safe_run(cmd):
    try:
        return subprocess.check_output(cmd, shell=True).decode().strip()
    except:
        return "error"

@app.route("/api/status")
def status():
    data = {
        "cpu": safe_run("top -bn1 | grep 'Cpu(s)'"),
        "temp": safe_run("vcgencmd measure_temp"),
        "disk": safe_run("df -h / | grep '/'"),
	    "usb": safe_run("df -h /mnt/music | grep '/'"),
        "uptime": safe_run("uptime -p"),

        # SERVIZI IMPORTANTI
        "navidrome": safe_run("systemctl is-active navidrome"),
        "syncthing": safe_run("systemctl is-active syncthing@lallost"),
        "tailscale": safe_run("systemctl is-active tailscaled"),
        "ssh": safe_run("systemctl is-active ssh"),
        "cron": safe_run("systemctl is-active cron"),
        "network": safe_run("systemctl is-active NetworkManager"),
        "wifi": safe_run("systemctl is-active wpa_supplicant"),
        "dashboard": safe_run("systemctl is-active dashboard")
    }

    return jsonify(data)

@app.route("/api/temperature")
def api_temperature():
    raw = safe_run("vcgencmd measure_temp")
    # raw è tipo: "temp=52.3'C"
    try:
        value = raw.replace("temp=", "").replace("'C", "")
        return {"temperature": float(value)}
    except:
        return {"temperature": None}


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
