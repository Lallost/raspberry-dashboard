function setStatus(id, value) {
    const el = document.getElementById(id);
    el.textContent = value;

    el.classList.remove("status-active", "status-inactive", "status-error");

    if (value === "active") el.classList.add("status-active");
    else if (value === "inactive") el.classList.add("status-inactive");
    else el.classList.add("status-error");
}

function setCpu(value) {
    const nums = value.match(/[0-9.]+/g);

    if (!nums || nums.length < 5) {
        document.getElementById("cpu-total").textContent = "N/A";
        return;
    }

    const user   = parseFloat(nums[0]);
    const system = parseFloat(nums[1]);
    const idle   = parseFloat(nums[3]);
    const wait   = parseFloat(nums[4]);

    const total = user + system;

    document.getElementById("cpu-user").textContent   = user.toFixed(1) + "%";
    document.getElementById("cpu-system").textContent = system.toFixed(1) + "%";
    document.getElementById("cpu-idle").textContent   = idle.toFixed(1) + "%";
    document.getElementById("cpu-wait").textContent   = wait.toFixed(1) + "%";

    const el = document.getElementById("cpu-total");
    el.textContent = total.toFixed(1) + "%";

    el.classList.remove("status-active", "status-inactive", "status-error");
    if (total < 40) el.classList.add("status-active");
    else if (total < 75) el.classList.add("status-inactive");
    else el.classList.add("status-error");
}

function setWifiQuality(data) {
    const el = document.getElementById("wifiQuality");

    if (!data.wifi_connected) {
        el.textContent = "non connesso (probabile Ethernet)";
        el.style.color = "#888";
        return;
    }

    const ssid = data.wifi_ssid ?? "?";
    const percent = data.wifi_signal_percent;

    el.textContent = `${ssid} — ${data.wifi_signal_dbm} dBm (${percent}%, ${data.wifi_signal_label})`;

    if (percent >= 70) el.style.color = "#28a745";
    else if (percent >= 40) el.style.color = "#e0a800";
    else el.style.color = "#dc3545";
}

function parseDisk(line) {
    const parts = line.split(/\s+/);
    return {
        total: parts[1],
        used: parts[2],
        free: parts[3],
        percent: parts[4]
    };
}

async function update() {
    const res = await fetch("/api/status");
    const data = await res.json();

    setCpu(data.cpu);

    document.getElementById("ramUsed").textContent = data.ram_used;
    document.getElementById("ramTotal").textContent = data.ram_total;
    document.getElementById("ramPercent").textContent = data.ram_percent;

    document.getElementById("ramRealUsed").textContent = data.ram_real_used;
    document.getElementById("ramRealPercent").textContent = data.ram_real_percent;
    document.getElementById("ramTotal2").textContent = data.ram_total;

    setStatus("dashboard", data.dashboard);
    setStatus("navidrome", data.navidrome);
    setStatus("syncthing", data.syncthing);
    setStatus("tailscale", data.tailscale);
    setStatus("wayvnc", data.wayvnc);
    setStatus("wayvnc_control", data.wayvnc_control);
    setStatus("vnc_x11", data.vnc_x11);

    setStatus("ssh", data.ssh);
    setStatus("cron", data.cron);
    setStatus("network", data.network);
    setStatus("wifi", data.wifi);

    document.getElementById("temp").textContent = data.temp;

    setWifiQuality(data);

    // SD
    const disk = parseDisk(data.disk);
    document.getElementById("disk-total").textContent = disk.total;
    document.getElementById("disk-used").textContent = disk.used;
    document.getElementById("disk-free").textContent = disk.free;
    document.getElementById("disk-percent").textContent = disk.percent;

    const sdUsed = parseFloat(disk.percent);
    const sdFree = 100 - sdUsed;
    updateSdPie(sdUsed, sdFree);

    // USB
    const usb = parseDisk(data.usb);
    document.getElementById("usb-total").textContent = usb.total;
    document.getElementById("usb-used").textContent = usb.used;
    document.getElementById("usb-free").textContent = usb.free;
    document.getElementById("usb-percent").textContent = usb.percent;

    const usbUsed = parseFloat(usb.percent);
    const usbFree = 100 - usbUsed;
    updateUsbPie(usbUsed, usbFree);


    document.getElementById("uptime").textContent = data.uptime;
}

let sdPieChart = null;
let usbPieChart = null;

function updateSdPie(used, free) {
    if (sdPieChart) sdPieChart.destroy();

    sdPieChart = new Chart(document.getElementById('sdPie'), {
        type: 'pie',
        data: {
            labels: ['Used', 'Free'],
            datasets: [{
                data: [used, free],
                backgroundColor: ['#ff4d4d', '#4dff4d']
            }]
        },
        options: {
            layout: { padding: 0 },
            plugins: {
                legend: { labels: { color: 'white' } }
            }
        }
    });
}


function updateUsbPie(used, free) {
    if (usbPieChart) usbPieChart.destroy();

    usbPieChart = new Chart(document.getElementById('usbPie'), {
        type: 'pie',
        data: {
            labels: ['Used', 'Free'],
            datasets: [{
                data: [used, free],
                backgroundColor: ['#ff4d4d', '#4dff4d']
            }]
        },
        options: {
            layout: { padding: 0 },
            plugins: {
                legend: { labels: { color: 'white' } }
            }
        }
    });
}


function serviceAction(name, action) {
    fetch(`/api/service/${action}?name=${name}`)
        .then(r => r.json())
        .then(data => {
            console.log(data);
            alert(`${name} → ${action} eseguito`);
        })
        .catch(err => alert("Errore: " + err));
}

// === RESET MAX/MIN ===
// metric: 'temperature' | 'cpu' | 'ram' | 'net_up' | 'net_down'
function resetStats(metric) {
    fetch(`/api/reset_stats/${metric}`)
        .then(r => r.json())
        .then(() => {
            if (metric === 'temperature') {
                tempChart.options.minValue = undefined;
                tempChart.options.maxValue = undefined;
                document.getElementById("maxTemp").textContent = '--';
                document.getElementById("minTemp").textContent = '--';
            } else if (metric === 'cpu') {
                cpuChart.options.minValue = undefined;
                cpuChart.options.maxValue = undefined;
                document.getElementById("cpuMax").textContent = '--';
                document.getElementById("cpuMin").textContent = '--';
            } else if (metric === 'ram') {
                ramChart.options.minValue = undefined;
                ramChart.options.maxValue = undefined;
                document.getElementById("ramMax").textContent = '--';
                document.getElementById("ramMin").textContent = '--';
            } else if (metric === 'net_up') {
                netUpChart.options.minValue = undefined;
                netUpChart.options.maxValue = undefined;
                document.getElementById("netUpMax").textContent = '--';
                document.getElementById("netUpMin").textContent = '--';
            } else if (metric === 'net_down') {
                netDownChart.options.minValue = undefined;
                netDownChart.options.maxValue = undefined;
                document.getElementById("netDownMax").textContent = '--';
                document.getElementById("netDownMin").textContent = '--';
            }
        })
        .catch(err => alert("Errore reset: " + err));
}


update();
setInterval(update, 3000);

// === TEMPERATURE LIVE CHART ===

// Serie dati
const tempSeries = new TimeSeries();

// Configurazione grafico
const tempChart = new SmoothieChart({
    millisPerPixel: 100,        // ~120 secondi visibili
    interpolation: 'linear',
    grid: {
        strokeStyle: 'rgba(255,255,255,0.08)',
        lineWidth: 1,
        millisPerLine: 5000,
        verticalSections: 4
    },
    labels: {
        fillStyle: '#ffffff',
        fontSize: 12,
        precision: 1
    }
});

// Collega la serie al grafico
tempChart.addTimeSeries(tempSeries, {
    strokeStyle: 'rgba(255, 80, 80, 1)',
    lineWidth: 2
});

// Avvia il grafico
tempChart.streamTo(document.getElementById("tempChart"), 1000);

// Aggiorna la temperatura ogni secondo
setInterval(() => {
    fetch("/api/temperature")
        .then(r => r.json())
        .then(data => {
            const temp = parseFloat(data.temperature);
            if (!isNaN(temp)) {
                tempSeries.append(Date.now(), temp);
            }

            // 🔥 AGGIUNGI QUESTE 2 RIGHE QUI
            document.getElementById("curTemp").textContent = data.temperature;
            document.getElementById("maxTemp").textContent = data.max;
            document.getElementById("minTemp").textContent = data.min;

            // Blocca la scala del grafico sul massimo e minimo registrati
            if (data.max !== null && data.max !== undefined) {
                tempChart.options.maxValue = parseFloat(data.max);
            }
            if (data.min !== null && data.min !== undefined) {
                tempChart.options.minValue = parseFloat(data.min);
            }
        })
        .catch(() => {
            tempSeries.append(Date.now(), null);
        });
}, 1000);

// === CPU LIVE CHART ===

// Serie dati CPU
const cpuSeries = new TimeSeries();

// Configura il grafico CPU (identico alla temperatura)
const cpuChart = new SmoothieChart({
    millisPerPixel: 100,   // ~2 minuti di finestra
    grid: {
        strokeStyle: 'rgba(255,255,255,0.1)',
        lineWidth: 1,
        millisPerLine: 5000,
        verticalSections: 4
    },
    labels: { fillStyle: '#ffffff' }
});

// Collega la serie al canvas
cpuChart.addTimeSeries(cpuSeries, {
    strokeStyle: 'rgba(80, 160, 255, 1)',
    lineWidth: 2
});

// Avvia il grafico
cpuChart.streamTo(document.getElementById("cpuChart"), 1000);

// Aggiorna ogni secondo
setInterval(() => {
    fetch("/api/cpu_percent")
        .then(r => r.json())
        .then(data => {
            const cpu = data.cpu; // percentuale 0-100

            cpuSeries.append(Date.now(), cpu);

            // Max/min registrati (persistiti lato server) - bloccano la scala del grafico
            if (data.max !== null && data.max !== undefined) {
                cpuChart.options.maxValue = data.max;
            }
            if (data.min !== null && data.min !== undefined) {
                cpuChart.options.minValue = data.min;
            }

            document.getElementById("cpuNow").textContent = cpu.toFixed(1);
            document.getElementById("cpuMin").textContent = (data.min ?? cpu).toFixed(1);
            document.getElementById("cpuMax").textContent = (data.max ?? cpu).toFixed(1);
        });
}, 1000);



// === RAM LIVE CHART ===

// Serie dati RAM
const ramSeries = new TimeSeries();

// Configura il grafico RAM
const ramChart = new SmoothieChart({
    millisPerPixel: 100,
    grid: {
        strokeStyle: 'rgba(255,255,255,0.1)',
        lineWidth: 1,
        millisPerLine: 5000,
        verticalSections: 4
    },
    labels: { fillStyle: '#ffffff' }
});

// Collega la serie al canvas
ramChart.addTimeSeries(ramSeries, {
    strokeStyle: 'rgba(0, 255, 150, 1)',
    lineWidth: 2
});

// Avvia il grafico
ramChart.streamTo(document.getElementById("ramChart"), 1000);

setInterval(() => {
    fetch("/api/status")
        .then(r => r.json())
        .then(data => {
            const ram = data.ram_percent;

            // Aggiorna grafico
            ramSeries.append(Date.now(), ram);

            // Max/min registrati (persistiti lato server) - bloccano la scala del grafico
            if (data.ram_max !== null && data.ram_max !== undefined) {
                ramChart.options.maxValue = data.ram_max;
            }
            if (data.ram_min !== null && data.ram_min !== undefined) {
                ramChart.options.minValue = data.ram_min;
            }

            document.getElementById("ramNow").textContent = ram.toFixed(1);
            document.getElementById("ramMin").textContent = (data.ram_min ?? ram).toFixed(1);
            document.getElementById("ramMax").textContent = (data.ram_max ?? ram).toFixed(1);
        });
}, 1000);


// === NETWORK LIVE CHARTS (Upload/Download) ===

// Serie dati Upload
const netUpSeries = new TimeSeries();

const netUpChart = new SmoothieChart({
    millisPerPixel: 100,
    grid: {
        strokeStyle: 'rgba(255,255,255,0.1)',
        lineWidth: 1,
        millisPerLine: 5000,
        verticalSections: 4
    },
    labels: { fillStyle: '#ffffff' }
});

netUpChart.addTimeSeries(netUpSeries, {
    strokeStyle: 'rgba(255, 180, 0, 1)',
    lineWidth: 2
});

netUpChart.streamTo(document.getElementById("netUpChart"), 1000);

// Serie dati Download
const netDownSeries = new TimeSeries();

const netDownChart = new SmoothieChart({
    millisPerPixel: 100,
    grid: {
        strokeStyle: 'rgba(255,255,255,0.1)',
        lineWidth: 1,
        millisPerLine: 5000,
        verticalSections: 4
    },
    labels: { fillStyle: '#ffffff' }
});

netDownChart.addTimeSeries(netDownSeries, {
    strokeStyle: 'rgba(120, 170, 255, 1)',
    lineWidth: 2
});

netDownChart.streamTo(document.getElementById("netDownChart"), 1000);

// Aggiorna ogni secondo
setInterval(() => {
    fetch("/api/network")
        .then(r => r.json())
        .then(data => {
            const up = data.upload_kbps;
            const down = data.download_kbps;

            netUpSeries.append(Date.now(), up);
            netDownSeries.append(Date.now(), down);

            // Max/min registrati (persistiti lato server) - bloccano la scala del grafico
            if (data.up_max !== null && data.up_max !== undefined) {
                netUpChart.options.maxValue = data.up_max;
            }
            if (data.up_min !== null && data.up_min !== undefined) {
                netUpChart.options.minValue = data.up_min;
            }
            if (data.down_max !== null && data.down_max !== undefined) {
                netDownChart.options.maxValue = data.down_max;
            }
            if (data.down_min !== null && data.down_min !== undefined) {
                netDownChart.options.minValue = data.down_min;
            }

            document.getElementById("netUpNow").textContent = up.toFixed(1);
            document.getElementById("netUpMax").textContent = (data.up_max ?? up).toFixed(1);
            document.getElementById("netUpMin").textContent = (data.up_min ?? up).toFixed(1);

            document.getElementById("netDownNow").textContent = down.toFixed(1);
            document.getElementById("netDownMax").textContent = (data.down_max ?? down).toFixed(1);
            document.getElementById("netDownMin").textContent = (data.down_min ?? down).toFixed(1);
        })
        .catch(() => {
            netUpSeries.append(Date.now(), null);
            netDownSeries.append(Date.now(), null);
        });
}, 1000);

