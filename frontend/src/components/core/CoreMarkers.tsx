import { COLORS } from "../constants/colors";

export default function CoreMarkers() {
    return (
        <>
            {/* Top */}
            <Marker
                top="8%"
                left="50%"
                rotation={0}
            />

            {/* Bottom */}
            <Marker
                top="92%"
                left="50%"
                rotation={180}
            />

            {/* Left */}
            <Marker
                top="50%"
                left="10%"
                rotation={270}
            />

            {/* Right */}
            <Marker
                top="50%"
                left="90%"
                rotation={90}
            />

            {/* Diagonals */}
            <Marker
                top="20%"
                left="20%"
                rotation={315}
            />

            <Marker
                top="20%"
                left="80%"
                rotation={45}
            />

            <Marker
                top="80%"
                left="20%"
                rotation={225}
            />

            <Marker
                top="80%"
                left="80%"
                rotation={135}
            />
        </>
    );
}

interface MarkerProps {
    top: string;
    left: string;
    rotation: number;
}

function Marker({
    top,
    left,
    rotation,
}: MarkerProps) {
    return (
        <div
            className="absolute"
            style={{
                top,
                left,
                transform: `
          translate(-50%, -50%)
          rotate(${rotation}deg)
        `,
            }}
        >
            <div
                style={{
                    width: "24px",
                    height: "2px",
                    background: COLORS.cyanBright,

                    boxShadow:
                        "0 0 8px rgba(0,229,255,0.5)",
                }}
            />

            <div
                style={{
                    width: "2px",
                    height: "12px",
                    background: COLORS.cyanBright,

                    marginLeft: "11px",

                    boxShadow:
                        "0 0 8px rgba(0,229,255,0.5)",
                }}
            />
        </div>
    );
}