
import SectionTitle from "../ui/SectionTitle";
import { COLORS } from "../constants/colors";
import { Mic, Activity, User, Search, Loader2, CheckCircle2, RefreshCw, Volume2 } from "lucide-react";
import { useState, useEffect } from "react";

interface EventStreamProps {
    logs?: string[];
}

export default function EventStream({ logs = [] }: EventStreamProps) {
    const defaultEvents = [
        { time: "23:43:12", icon: Mic, title: "Voice session started", desc: "Listening for commands", color: COLORS.cyanBright },
        { time: "23:43:15", icon: Activity, title: "Wake word detected", desc: '"Sentinel"', color: COLORS.green },
        { time: "23:43:19", icon: Search, title: "Tool selected", desc: "list_directory", color: COLORS.cyanBright },
        { time: "23:43:19", icon: Loader2, title: "Tool executing", desc: "Scanning /backend", color: COLORS.cyanBright },
        { time: "23:43:22", icon: CheckCircle2, title: "Tool result", desc: "42 items found", color: COLORS.cyanBright },
        { time: "23:43:23", icon: RefreshCw, title: "Task updated", desc: "Progress: 72%", color: COLORS.cyanBright },
        { time: "23:43:24", icon: Volume2, title: "Response generated", desc: "Preparing reply", color: COLORS.cyanBright },
        { time: "23:43:25", icon: Volume2, title: "Speaking...", desc: "Delivering response", color: COLORS.cyanBright },
    ];

    const parseLogEntry = (logStr: string) => {
        const match = logStr.match(/^\[(\d{2}:\d{2}:\d{2})\]\s*(.*)$/);
        const timeVal = match ? match[1] : "00:00:00";
        const content = match ? match[2] : logStr;

        if (content.startsWith("SENTINEL Online")) {
            return { time: timeVal, icon: Activity, title: "Sentinel Online", desc: "AI Core connected via ADC", color: COLORS.green };
        }
        if (content.startsWith("USER COMMAND:")) {
            return { time: timeVal, icon: Search, title: "Command Executed", desc: content.replace("USER COMMAND:", "").trim(), color: COLORS.cyanBright };
        }
        if (content.startsWith("SENTINEL:")) {
            return { time: timeVal, icon: Volume2, title: "Sentinel Response", desc: content.replace("SENTINEL:", "").trim(), color: COLORS.cyanBright };
        }
        if (content.startsWith("USER:")) {
            return { time: timeVal, icon: Mic, title: "User Voice Input", desc: content.replace("USER:", "").trim(), color: COLORS.cyan };
        }
        if (content.startsWith("SYS:")) {
            return { time: timeVal, icon: Activity, title: "System Alert", desc: content.replace("SYS:", "").trim(), color: COLORS.orange };
        }
        return { time: timeVal, icon: Activity, title: "Event", desc: content, color: COLORS.cyan };
    };

    // Filter out user speech inputs (USER: ...) but keep tool commands (USER COMMAND: ...)
    const filteredLogs = logs.filter(log => {
        const match = log.match(/^\[\d{2}:\d{2}:\d{2}\]\s*(.*)$/);
        const content = match ? match[1] : log;
        return !content.startsWith("USER:");
    });

    const displayEvents = filteredLogs.length > 0 ? filteredLogs.map(parseLogEntry) : defaultEvents;

    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    };

    return (
        <div className="flex flex-col h-full">
            {/* Digital Clock */}
            <div className="flex flex-col items-end text-right w-full mb-6">
                <span className="text-3xl font-bold tracking-[0.1em] drop-shadow-[0_0_10px_rgba(0,229,255,0.5)]" style={{ color: COLORS.cyanBright }}>
                    {formatTime(time)}
                </span>
            </div>

            <div className="flex justify-start items-start">
                <SectionTitle title="Event Stream" />
            </div>

            {/* Inner Box for the stream */}
            <div className="flex-1 min-h-0 relative overflow-hidden border border-cyan-900/30 bg-black/30 rounded-md shadow-[inset_0_0_20px_rgba(0,229,255,0.04)] mt-2 p-4 flex flex-col">
                
                {/* Sci-Fi Corners */}
                <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan-400" />
                <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-cyan-400" />
                <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-cyan-400" />
                <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-cyan-400" />

            <div className="flex items-center justify-between mb-4 mt-2">
                <span className="text-[9px] tracking-[0.25em] uppercase" style={{ color: COLORS.textSecondary }}>Runtime Journal</span>
                <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                    <span className="text-[9px] tracking-[0.15em] text-red-500 uppercase">Live</span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 relative mt-2">
                {/* Vertical Timeline Line */}
                <div className="absolute left-[3px] top-2 bottom-2 w-px bg-cyan-900/30" />

                <div className="flex flex-col gap-4">
                    {displayEvents.map((event, idx) => {
                        const Icon = event.icon;
                        return (
                            <div key={idx} className="flex gap-4 relative">
                                {/* Timeline Dot */}
                                <div className="absolute left-[0px] top-1.5 w-2 h-2 rounded-full border border-cyan-900 bg-black flex items-center justify-center z-10">
                                    <div className="w-1 h-1 rounded-full" style={{ background: COLORS.cyanBright }} />
                                </div>

                                {/* Time */}
                                <span className="ml-5 text-[10px] tracking-widest pt-1 shrink-0 w-16" style={{ color: COLORS.textSecondary }}>{event.time}</span>

                                {/* Icon */}
                                <div className="shrink-0 mt-0.5">
                                    <Icon size={14} color={event.color} />
                                </div>

                                {/* Content */}
                                <div className="flex flex-col flex-1 pb-1">
                                    <span className="text-[11px] font-semibold text-cyan-50 tracking-wide">{event.title}</span>
                                    <span className="text-[10px] tracking-wide" style={{ color: COLORS.cyan }}>{event.desc}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            </div>
        </div>
    );
}