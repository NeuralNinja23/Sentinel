import { COLORS } from "../constants/colors";

export default function CoreGrid() {
    return (
        <div
            className="
        absolute
        inset-0
        flex
        items-center
        justify-center
        pointer-events-none
      "
        >
            {/* Horizontal Axis */}
            <div
                className="absolute"
                style={{
                    width: "80%",
                    height: "1px",
                    background: COLORS.border,
                    opacity: 0.4,
                }}
            />

            {/* Vertical Axis */}
            <div
                className="absolute"
                style={{
                    width: "1px",
                    height: "80%",
                    background: COLORS.border,
                    opacity: 0.4,
                }}
            />

            {/* Outer Grid Ring */}
            <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{
                    width: "500px",
                    height: "500px",

                    border: `1px solid ${COLORS.border}`,
                    opacity: 0.25,
                }}
            />

            {/* Ring 2 */}
            <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{
                    width: "420px",
                    height: "420px",

                    border: `1px solid ${COLORS.border}`,
                    opacity: 0.2,
                }}
            />

            {/* Ring 3 */}
            <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{
                    width: "340px",
                    height: "340px",

                    border: `1px solid ${COLORS.border}`,
                    opacity: 0.15,
                }}
            />

            {/* Ring 4 */}
            <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{
                    width: "260px",
                    height: "260px",

                    border: `1px solid ${COLORS.border}`,
                    opacity: 0.12,
                }}
            />

            {/* Target Markers */}

            {[0, 90, 180, 270].map((rotation) => (
                <div
                    key={rotation}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                    style={{
                        width: "520px",
                        height: "520px",
                        transform: `rotate(${rotation}deg)`,
                    }}
                >
                    <div
                        className="absolute left-1/2 -translate-x-1/2"
                        style={{
                            top: "-8px",
                            width: "24px",
                            height: "2px",
                            background: COLORS.cyanDark,
                        }}
                    />

                    <div
                        className="absolute left-1/2 -translate-x-1/2"
                        style={{
                            top: "-18px",
                            width: "2px",
                            height: "14px",
                            background: COLORS.cyanDark,
                        }}
                    />
                </div>
            ))}
        </div>
    );
}