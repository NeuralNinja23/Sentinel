"""Real system telemetry endpoint using psutil + nvidia-smi."""
import time
import psutil
import subprocess
import platform
from fastapi import APIRouter

router = APIRouter()

_boot_time = psutil.boot_time()
_last_net = psutil.net_io_counters()
_last_net_time = time.time()


def _get_gpu_stats() -> dict:
    """Get GPU utilization and temperature via nvidia-smi (Windows/Linux)."""
    try:
        result = subprocess.run(
            "nvidia-smi --query-gpu=utilization.gpu,temperature.gpu --format=csv,noheader,nounits",
            capture_output=True, text=True, shell=True, timeout=3
        )
        if result.returncode == 0 and result.stdout.strip():
            parts = result.stdout.strip().split(",")
            return {
                "gpu_percent": float(parts[0].strip()),
                "gpu_temp": float(parts[1].strip()),
            }
    except Exception:
        pass
    return {"gpu_percent": 0, "gpu_temp": 0}


def _get_net_speed() -> dict:
    """Calculate network speed in bytes/sec since last call."""
    global _last_net, _last_net_time
    now = time.time()
    current = psutil.net_io_counters()
    dt = now - _last_net_time
    if dt < 0.1:
        dt = 1  # Avoid division by zero on first call

    send_speed = (current.bytes_sent - _last_net.bytes_sent) / dt
    recv_speed = (current.bytes_recv - _last_net.bytes_recv) / dt

    _last_net = current
    _last_net_time = now

    return {
        "net_send_bps": round(send_speed),
        "net_recv_bps": round(recv_speed),
    }


@router.get("/api/system-stats")
def system_stats():
    cpu_percent = psutil.cpu_percent(interval=0)
    mem = psutil.virtual_memory()
    net = _get_net_speed()
    gpu = _get_gpu_stats()
    uptime_seconds = int(time.time() - _boot_time)

    # Try to get CPU temperature (Linux only via psutil; Windows uses nvidia-smi for GPU temp)
    cpu_temp = 0
    try:
        temps = psutil.sensors_temperatures()
        if temps:
            # Pick the first available sensor
            for name, entries in temps.items():
                if entries:
                    cpu_temp = entries[0].current
                    break
    except Exception:
        pass

    return {
        "cpu": round(cpu_percent, 1),
        "mem": round(mem.percent, 1),
        "net_send_bps": net["net_send_bps"],
        "net_recv_bps": net["net_recv_bps"],
        "gpu": round(gpu["gpu_percent"], 1),
        "gpu_temp": round(gpu["gpu_temp"], 1),
        "cpu_temp": round(cpu_temp, 1),
        "processes": len(psutil.pids()),
        "uptime_seconds": uptime_seconds,
        "os": platform.system(),
    }
