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

    setStatus("navidrome", data.navidrome);
    setStatus("syncthing", data.syncthing);
    setStatus("tailscale", data.tailscale);
    setStatus("ssh", data.ssh);
    setStatus("cron", data.cron);
    setStatus("network", data.network);
    setStatus("wifi", data.wifi);
    setStatus("dashboard", data.dashboard);

    document.getElementById("temp").textContent = data.temp;

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
            document.getElementById("maxTemp").textContent = data.max;
            document.getElementById("minTemp").textContent = data.min;
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

// Min/Max CPU
let cpuMin = null;
let cpuMax = null;

// Aggiorna ogni secondo
setInterval(() => {
    fetch("/api/cpu_percent")
        .then(r => r.json())
        .then(data => {
            const cpu = data.cpu; // percentuale 0-100

            cpuSeries.append(Date.now(), cpu);

            // Aggiorna min/max
            if (cpuMin === null || cpu < cpuMin) cpuMin = cpu;
            if (cpuMax === null || cpu > cpuMax) cpuMax = cpu;

            document.getElementById("cpuMin").textContent = cpuMin.toFixed(1);
            document.getElementById("cpuMax").textContent = cpuMax.toFixed(1);
        });
}, 1000);




