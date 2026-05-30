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

    const disk = parseDisk(data.disk);
    document.getElementById("disk-total").textContent = disk.total;
    document.getElementById("disk-used").textContent = disk.used;
    document.getElementById("disk-free").textContent = disk.free;
    document.getElementById("disk-percent").textContent = disk.percent;

    const usb = parseDisk(data.usb);
    document.getElementById("usb-total").textContent = usb.total;
    document.getElementById("usb-used").textContent = usb.used;
    document.getElementById("usb-free").textContent = usb.free;
    document.getElementById("usb-percent").textContent = usb.percent;

    document.getElementById("uptime").textContent = data.uptime;
}

update();
setInterval(update, 3000);
