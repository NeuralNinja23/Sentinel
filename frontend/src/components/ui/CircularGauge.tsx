
import { COLORS } from "../constants/colors";

interface CircularGaugeProps {
    value: number;
    size?: number;
    stroke?: number;
    label?: string;
    topLabel?: string;
    bottomLabel?: string;
    showPercent?: boolean;
}

export default function CircularGauge({
    value,
    size = 110,
    stroke = 8,
    label,
    topLabel,
    bottomLabel,
    showPercent = true,
}: CircularGaugeProps) {
    const radius = (size - stroke) / 2;

    const circumference = 2 * Math.PI * radius;

    const offset =
        circumference -
        (value / 100) * circumference;

    return (
        <div className="flex flex-col items-center">

            <div
                className="relative"
                style={{
                    width: size,
                    height: size,
                }}
            >
                <svg
                    width={size}
                    height={size}
                    className="-rotate-90"
                >
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="transparent"
                        stroke={COLORS.border}
                        strokeWidth={stroke}
                    />

                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="transparent"
                        stroke={COLORS.cyanBright}
                        strokeWidth={stroke}
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                        style={{
                            filter:
                                "drop-shadow(0 0 6px rgba(0,229,255,0.7))",
                        }}
                    />
                </svg>

                <div
                    className="
            absolute
            inset-0
            flex
            items-center
            justify-center
            flex-col
          "
                >
                    {topLabel && (
                        <span className="text-[10px] tracking-wider mb-1" style={{ color: COLORS.cyanBright }}>
                            {topLabel}
                        </span>
                    )}
                    <div className="flex items-baseline">
                        <span
                            className="text-xl font-bold"
                            style={{
                                color: COLORS.textPrimary || COLORS.cyanBright,
                            }}
                        >
                            {value}
                        </span>

                        {showPercent && (
                            <span
                                className="text-[10px] ml-[1px]"
                                style={{
                                    color: COLORS.textSecondary,
                                }}
                            >
                                %
                            </span>
                        )}
                    </div>
                    {bottomLabel && (
                        <span className="text-[9px] mt-1 tracking-wider" style={{ color: COLORS.textSecondary }}>
                            {bottomLabel}
                        </span>
                    )}
                </div>

            </div>

            {label && (
                <div
                    className="
              mt-2
              text-[10px]
              tracking-[0.2em]
            "
                    style={{
                        color: COLORS.textSecondary,
                    }}
                >
                    {label}
                </div>
            )}

        </div>
    );
}