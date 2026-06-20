import { useState, useEffect } from "react";
import Panel from "../ui/Panel";
import SectionTitle from "../ui/SectionTitle";
import { COLORS } from "../constants/colors";
import CircularGauge from "../ui/CircularGauge";
import CalendarGauge from "../ui/CalendarGauge";
import { useSystemStats, formatNetSpeed, formatUptime } from "../../hooks/useSystemStats";
import {
    Activity,
    Cpu,
    Eye,
    HardDrive,
    Mic,
    Shield,
    Box,
    Clock,
    Wifi
} from "lucide-react";

export default function StatusPanel() {
    const { stats, isLive } = useSystemStats();
    const [currentDate, setCurrentDate] = useState({ month: "JUN", day: "21", weekday: "THURSDAY" });

    useEffect(() => {
        const updateDate = () => {
            const now = new Date();
            const monthStr = now.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
            const dayStr = String(now.getDate());
            const weekdayStr = now.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
            setCurrentDate({ month: monthStr, day: dayStr, weekday: weekdayStr });
        };
        updateDate();
        const id = setInterval(updateDate, 3600000);
        return () => clearInterval(id);
    }, []);

    return (
        <Panel className="p-5 flex flex-col h-full">
            <div className="flex items-center justify-between">
                <SectionTitle title="System Status" />
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-cyan-900/30 bg-cyan-950/10">
                    <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-green-500 shadow-[0_0_6px_#22c55e]' : 'bg-red-500 shadow-[0_0_6px_#ef4444]'}`} />
                    <span className="text-[9px] tracking-widest uppercase font-semibold" style={{ color: isLive ? COLORS.green : COLORS.red }}>
                        {isLive ? 'Live' : 'Offline'}
                    </span>
                </div>
            </div>

            {/* Top Section: Calendar & 2x2 Grid */}
            <div className="flex items-center gap-6 pb-6 border-b border-cyan-900/40">
                {/* Left: Calendar Gauge */}
                <div className="flex-1 flex justify-center">
                    <CalendarGauge month={currentDate.month} day={currentDate.day} weekday={currentDate.weekday} size={160} />
                </div>

                {/* Right: 2x2 Grid */}
                <div className="flex-[1.2] grid grid-cols-2 gap-y-6 gap-x-2 place-items-center">
                    <CircularGauge
                        value={Math.round(stats.cpu)}
                        size={85}
                        stroke={4}
                        topLabel="CPU"
                        showPercent={true}
                    />
                    <CircularGauge
                        value={Math.round(stats.mem)}
                        size={85}
                        stroke={4}
                        topLabel="RAM"
                        bottomLabel={stats.mem_total_gb ? `${stats.mem_used_gb} GB` : "0.0 GB"}
                        showPercent={true}
                    />
                    <CircularGauge
                        value={stats.net_send_bps > 0 || stats.net_recv_bps > 0 ? Math.min(100, Math.round((stats.net_send_bps + stats.net_recv_bps) / 125000)) : 0}
                        size={85}
                        stroke={4}
                        topLabel="NET"
                        bottomLabel={`↑${formatNetSpeed(stats.net_send_bps)} ↓${formatNetSpeed(stats.net_recv_bps)}`}
                        showPercent={true}
                    />
                    <CircularGauge
                        value={Math.round(stats.gpu)}
                        size={85}
                        stroke={4}
                        topLabel="GPU"
                        bottomLabel={`${Math.round(stats.gpu_temp)}°C`}
                        showPercent={true}
                    />
                </div>
            </div>

            {/* Bottom Section: Status List, Energy Core, Storage */}
            <div className="flex pt-6 flex-1">
                {/* Left: Status List */}
                <div className="w-[35%] flex flex-col justify-between py-1 pr-6 border-r border-cyan-900/40 text-[10px] uppercase tracking-wider space-y-3">
                    <div className="flex items-center gap-3">
                        <Mic size={16} color={COLORS.cyanBright} />
                        <div className="flex flex-col">
                            <span style={{ color: COLORS.cyanBright }} className="font-bold">Voice Engine</span>
                            <span style={{ color: COLORS.green }}>Active</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Eye size={16} color={COLORS.cyanBright} />
                        <div className="flex flex-col">
                            <span style={{ color: COLORS.cyanBright }} className="font-bold">Vision Engine</span>
                            <span style={{ color: COLORS.green }}>Active</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Activity size={16} color={COLORS.cyanBright} />
                        <div className="flex flex-col">
                            <span style={{ color: COLORS.cyanBright }} className="font-bold">Runtime</span>
                            <span style={{ color: COLORS.cyanBright }}>Healthy</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Box size={16} color={COLORS.cyanBright} />
                        <div className="flex flex-col">
                            <span style={{ color: COLORS.cyanBright }} className="font-bold">Tasks</span>
                            <span style={{ color: COLORS.cyanBright }}>{stats.processes > 0 ? `${stats.processes} Process` : "2 Running"}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Clock size={16} color={COLORS.cyanBright} />
                        <div className="flex flex-col">
                            <span style={{ color: COLORS.cyanBright }} className="font-bold">Uptime</span>
                            <span style={{ color: COLORS.cyanBright }}>{stats.uptime_seconds > 0 ? formatUptime(stats.uptime_seconds) : "01:06:39"}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Wifi size={16} color={COLORS.cyanBright} />
                        <div className="flex flex-col">
                            <span style={{ color: COLORS.cyanBright }} className="font-bold">Latency</span>
                            <span style={{ color: COLORS.cyanBright }}>132ms</span>
                        </div>
                    </div>
                </div>



                {/* Right: Storage */}
                <div className="flex-[1.2] flex flex-col justify-center gap-5 pl-6 text-[10px] tracking-wider uppercase whitespace-nowrap">
                    <span style={{ color: COLORS.cyanBright }} className="font-bold text-xs mb-1">System Storage</span>

                    <div className="flex flex-col gap-2">
                        <span style={{ color: COLORS.cyanBright }}>Local Disk (C:)</span>
                        <div className="h-1 bg-cyan-900/30 overflow-hidden w-full">
                            <div className="h-full bg-green-500 shadow-[0_0_8px_#22c55e]" style={{ width: stats.disk_percent ? `${stats.disk_percent}%` : '54%' }} />
                        </div>
                        <div className="flex justify-between" style={{ color: COLORS.textSecondary }}>
                            <span>{stats.disk_total ? `${stats.disk_used} GB / ${stats.disk_total} GB` : "128 GB / 237 GB"}</span>
                            <span>{stats.disk_percent ? `${stats.disk_percent}%` : "54%"}</span>
                        </div>
                    </div>
                </div>
            </div>




        </Panel>
    );
}