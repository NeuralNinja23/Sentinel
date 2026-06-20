import { useState } from "react";
import SectionTitle from "../ui/SectionTitle";
import { COLORS } from "../constants/colors";
import { Send, Mic, Eye } from "lucide-react";

interface CommandInputProps {
    onSendCommand?: (text: string) => void;
    isRecording?: boolean;
    onToggleRecording?: () => void;
}

export default function CommandInput({ onSendCommand, isRecording = false, onToggleRecording }: CommandInputProps) {
    const [inputValue, setInputValue] = useState("");

    const handleSend = () => {
        if (inputValue.trim() && onSendCommand) {
            onSendCommand(inputValue.trim());
            setInputValue("");
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            handleSend();
        }
    };

    return (
        <div className="flex flex-col justify-end h-full">
            <SectionTitle title="Command Input" />

            <div className="flex flex-col gap-3 mt-2">
                
                {/* Input Box with Sci-Fi Borders */}
                <div className="relative border border-cyan-900/50 bg-black/40 rounded flex items-center shadow-[inset_0_0_10px_rgba(0,229,255,0.05)] p-1">
                    {/* Sci-Fi Corners */}
                    <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan-500" />
                    <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-cyan-500" />
                    <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-cyan-500" />
                    <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-cyan-500" />

                    <input
                        placeholder="Type a command..."
                        className="w-full bg-transparent outline-none text-[11px] px-3 py-2.5 tracking-wider"
                        style={{ color: COLORS.cyanBright }}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                    <button 
                        onClick={handleSend}
                        className="absolute right-1 p-2 text-orange-500 border border-orange-500/50 rounded hover:bg-orange-950/40 hover:text-orange-400 transition-colors"
                    >
                        <Send size={14} />
                    </button>
                </div>

                {/* Mic Standby / Active Button */}
                <button 
                    onClick={onToggleRecording}
                    className={`w-full border flex items-center justify-center gap-2 py-3 rounded-md transition-all ${
                        isRecording 
                            ? "border-green-500 bg-green-950/30 text-green-400 shadow-[0_0_10px_rgba(34,197,94,0.3)] animate-pulse"
                            : "border-red-500/50 bg-red-950/20 text-red-500 hover:bg-red-900/40 hover:border-red-500"
                    }`}
                >
                    <Mic size={16} />
                    <span className="text-[10px] tracking-widest uppercase">
                        {isRecording ? "Microphone Active" : "Microphone Standby"}
                    </span>
                </button>

                {/* Vision Active Button */}
                <button 
                    className="w-full border border-cyan-900/50 bg-cyan-950/10 text-cyan-500 flex items-center justify-center gap-2 py-3 rounded-md hover:bg-cyan-900/20 hover:text-cyan-400 transition-all"
                >
                    <Eye size={16} />
                    <span className="text-[10px] tracking-widest uppercase">Vision Active</span>
                </button>

            </div>
        </div>
    );
}