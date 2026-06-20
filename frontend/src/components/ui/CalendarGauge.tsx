import { COLORS } from "../constants/colors";

interface CalendarGaugeProps {
    month: string;
    day: string;
    weekday: string;
    size?: number;
    stroke?: number;
}

export default function CalendarGauge({
    month,
    day,
    weekday,
    size = 140,
    stroke = 2,
}: CalendarGaugeProps) {
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;

    // Creating 60 tick marks for the outer ring
    const ticks = Array.from({ length: 60 }).map((_, i) => i);

    return (
        <div className="relative flex flex-col items-center justify-center">
            <div
                className="relative flex items-center justify-center"
                style={{
                    width: size,
                    height: size,
                }}
            >
                {/* Ticks ring */}
                <div className="absolute inset-0">
                    {ticks.map((tick) => {
                        const angle = (tick * 360) / 60;
                        const isMajor = tick % 5 === 0;
                        return (
                            <div
                                key={tick}
                                className="absolute top-0 left-1/2 -ml-[1px]"
                                style={{
                                    height: "50%",
                                    transformOrigin: "bottom center",
                                    transform: `rotate(${angle}deg)`,
                                }}
                            >
                                <div
                                    style={{
                                        width: isMajor ? "2px" : "1px",
                                        height: isMajor ? "8px" : "4px",
                                        background: isMajor
                                            ? COLORS.cyanBright
                                            : COLORS.cyan,
                                        opacity: isMajor ? 1 : 0.5,
                                    }}
                                />
                            </div>
                        );
                    })}
                </div>

                {/* Inner circle background */}
                <svg
                    width={size - 24}
                    height={size - 24}
                    className="absolute"
                >
                    <circle
                        cx={(size - 24) / 2}
                        cy={(size - 24) / 2}
                        r={(size - 24 - 4) / 2}
                        fill="rgba(0, 229, 255, 0.05)"
                        stroke={COLORS.cyan}
                        strokeWidth="1"
                        strokeDasharray="4 4"
                    />
                </svg>

                {/* Solid inner border */}
                <div
                    className="absolute rounded-full border border-cyan-500/50"
                    style={{
                        width: size - 32,
                        height: size - 32,
                        boxShadow: `inset 0 0 10px rgba(0,229,255,0.2), 0 0 10px rgba(0,229,255,0.2)`,
                    }}
                />

                <div className="absolute flex flex-col items-center justify-center z-10">
                    <span
                        className="text-sm tracking-[0.2em]"
                        style={{ color: COLORS.textSecondary }}
                    >
                        {month}
                    </span>
                    <span
                        className="text-4xl font-bold leading-none my-1"
                        style={{ color: COLORS.cyanBright, textShadow: `0 0 10px ${COLORS.cyanBright}` }}
                    >
                        {day}
                    </span>
                    <span
                        className="text-[10px] tracking-[0.1em] uppercase"
                        style={{ color: COLORS.textSecondary }}
                    >
                        {weekday}
                    </span>
                </div>
            </div>
        </div>
    );
}
