import { ReactNode } from "react";
import { COLORS } from "../constants/colors";

interface GlowTextProps {
    children: ReactNode;
    size?: string;
    color?: string;
    className?: string;
}

export default function GlowText({
    children,
    size = "text-sm",
    color = COLORS.cyanBright,
    className = "",
}: GlowTextProps) {
    return (
        <span
            className={`
        ${size}
        ${className}
      `}
            style={{
                color,
                textShadow: `
          0 0 4px ${color},
          0 0 10px ${color}55
        `,
            }}
        >
            {children}
        </span>
    );
}