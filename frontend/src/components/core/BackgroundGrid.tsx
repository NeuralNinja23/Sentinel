import { COLORS } from "../constants/colors";

export default function BackgroundGrid() {
    return (
        <div
            className="
        fixed
        inset-0
        pointer-events-none
        opacity-[0.03]
      "
        >
            {/* Very Subtle Spaced Horizontal Grid Lines (Spaced at 120px) */}
            <div
                className="absolute inset-0"
                style={{
                    backgroundImage: `
            linear-gradient(${COLORS.cyan} 1px, transparent 1px)
          `,
                    backgroundSize: "100% 120px",
                }}
            />

            {/* Very faint vertical line at 15% and 85% width */}
            <div
                className="absolute top-0 bottom-0 left-[15%] w-px bg-cyan-500 opacity-20"
            />
            <div
                className="absolute top-0 bottom-0 left-[85%] w-px bg-cyan-500 opacity-20"
            />

            {/* Center Axis */}
            <div
                className="absolute top-0 bottom-0 left-1/2"
                style={{
                    width: "1px",
                    background: COLORS.cyan,
                    opacity: 0.1,
                }}
            />

            <div
                className="absolute left-0 right-0 top-1/2"
                style={{
                    height: "1px",
                    background: COLORS.cyan,
                    opacity: 0.1,
                }}
            />
        </div>
    );
}