import { useState, useEffect, useRef } from "react";

export interface SystemStats {
  cpu: number;
  mem: number;
  mem_total_gb?: number;
  mem_used_gb?: number;
  net_send_bps: number;
  net_recv_bps: number;
  gpu: number;
  gpu_temp: number;
  cpu_temp: number;
  processes: number;
  uptime_seconds: number;
  os: string;
  disk_total?: number;
  disk_used?: number;
  disk_percent?: number;
}

const DEFAULT_STATS: SystemStats = {
  cpu: 0,
  mem: 0,
  mem_total_gb: 0,
  mem_used_gb: 0,
  net_send_bps: 0,
  net_recv_bps: 0,
  gpu: 0,
  gpu_temp: 0,
  cpu_temp: 0,
  processes: 0,
  uptime_seconds: 0,
  os: "—",
  disk_total: 0,
  disk_used: 0,
  disk_percent: 0,
};

export function useSystemStats(intervalMs = 2000) {
  const [stats, setStats] = useState<SystemStats>(DEFAULT_STATS);
  const [isLive, setIsLive] = useState(false);
  const failCountRef = useRef(0);

  useEffect(() => {
    let active = true;

    const fetchStats = async () => {
      try {
        const res = await fetch("http://localhost:8000/api/system-stats");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: SystemStats = await res.json();
        if (active) {
          setStats(data);
          setIsLive(true);
          failCountRef.current = 0;
        }
      } catch {
        failCountRef.current++;
        if (failCountRef.current > 3 && active) {
          setIsLive(false);
        }
      }
    };

    fetchStats();
    const id = setInterval(fetchStats, intervalMs);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [intervalMs]);

  return { stats, isLive };
}

/** Format bytes/sec into a human-readable string like "1.2M" or "340K" */
export function formatNetSpeed(bytesPerSec: number): string {
  if (bytesPerSec >= 1_000_000) return `${(bytesPerSec / 1_000_000).toFixed(1)}M`;
  if (bytesPerSec >= 1_000) return `${(bytesPerSec / 1_000).toFixed(0)}K`;
  return `${bytesPerSec}B`;
}

/** Format seconds into HH:MM:SS */
export function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
