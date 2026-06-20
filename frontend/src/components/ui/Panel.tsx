
import { ReactNode } from "react";
import { COLORS } from "../constants/colors";

interface PanelProps {
    children: ReactNode;
    className?: string;
}

export default function Panel({
    children,
    className = "",
}: PanelProps) {
    return (
        <div
            className={`
        relative
        h-full
        w-full
        ${className}
      `}
        >
            <div className="relative z-10 h-full">
                {children}
            </div>
        </div>
    );
}