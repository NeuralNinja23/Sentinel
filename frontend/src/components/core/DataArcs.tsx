import { COLORS } from "../constants/colors";

interface ArcProps {
    size: number;
    rotation: number;
}

function Arc({ size, rotation }: ArcProps) {
    return (
        <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
                width: size,
                height: size,

                borderTop: `3px solid ${COLORS.cyanBright}`,
                borderRight: `3px solid transparent`,
                borderBottom: `3px solid transparent`,
                borderLeft: `3px solid transparent`,

                transform: `rotate(${rotation}deg)`,

                boxShadow:
                    "0 0 12px rgba(0,229,255,0.5)",
            }}
        />
    );
}

export default function DataArcs() {
    return (
        <>
            <Arc size={420} rotation={15} />
            <Arc size={420} rotation={120} />
            <Arc size={420} rotation={235} />

            <Arc size={340} rotation={55} />
            <Arc size={340} rotation={190} />
            <Arc size={340} rotation={310} />

            <Arc size={260} rotation={90} />
            <Arc size={260} rotation={260} />
        </>
    );
}