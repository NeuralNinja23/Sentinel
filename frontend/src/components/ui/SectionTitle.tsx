import { ReactNode } from "react";
import { COLORS } from "../constants/colors";
import GlowText from "./GlowText";

interface SectionTitleProps {
    title: string;
    rightContent?: ReactNode;
}

export default function SectionTitle({
    title,
    rightContent,
}: SectionTitleProps) {
    return (
        <div className="mb-3">

            <div className="flex items-center gap-3">

                {/* Triangle Marker */}
                <div
                    className="w-0 h-0"
                    style={{
                        borderTop: "5px solid transparent",
                        borderBottom: "5px solid transparent",
                        borderLeft: `8px solid ${COLORS.cyan}`,
                        filter: "drop-shadow(0 0 4px rgba(0,229,255,0.8))",
                    }}
                />

                <GlowText
                  size="text-[15px]"
                  className="
                    font-semibold
                    tracking-[0.12em]
                    uppercase
                  "
                >
                  {title}
                </GlowText>

                {/* Divider */}
                <div
                    className="flex-1 h-px"
                    style={{
                        background: `linear-gradient(
              90deg,
              ${COLORS.cyan},
              ${COLORS.border}
            )`,
                    }}
                />

                {/* Optional Right Content */}
                {rightContent && (
                    <div className="shrink-0">
                        {rightContent}
                    </div>
                )}
            </div>
        </div>
    );
}