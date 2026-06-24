import React, { useState, useEffect } from "react";
import SectionTitle from "../ui/SectionTitle";
import { COLORS, SHADOWS } from "../constants/colors";
import { Upload, Trash2, FileText, AlertTriangle, Loader2 } from "lucide-react";

interface UploadedFileInfo {
    filename: string;
    size: number;
}

export default function FileUpload() {
    const [files, setFiles] = useState<UploadedFileInfo[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const API_BASE = "http://localhost:8000/api/upload";

    // Fetch initial list on mount
    useEffect(() => {
        fetchFileList();
    }, []);

    const fetchFileList = async () => {
        try {
            const res = await fetch(`${API_BASE}/list`);
            if (res.ok) {
                const data = await res.json();
                setFiles(data);
            }
        } catch (e) {
            console.error("Failed to fetch uploaded files list:", e);
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    // Helper to upload a single file
    const uploadFile = async (file: File) => {
        const lowerName = file.name.toLowerCase();
        // Strict local validation (NO images)
        if (!lowerName.endsWith(".pdf") && 
            !lowerName.endsWith(".docx") && 
            !lowerName.endsWith(".txt") && 
            !lowerName.endsWith(".md")) {
            setErrorMsg(`"${file.name}" rejected: Only PDF, DOCX, TXT, & MD files are allowed.`);
            return;
        }

        setErrorMsg(null);
        setIsLoading(true);

        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await fetch(API_BASE, {
                method: "POST",
                body: formData,
            });

            if (response.ok) {
                const updatedList = await response.json();
                setFiles(updatedList);
            } else {
                const errData = await response.json();
                setErrorMsg(errData.detail || "Upload failed.");
            }
        } catch (e) {
            console.error("Upload error:", e);
            setErrorMsg("Network error occurred during upload.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            uploadFile(e.target.files[0]);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            uploadFile(e.dataTransfer.files[0]);
        }
    };

    const handleDelete = async (filename: string) => {
        setErrorMsg(null);
        try {
            const res = await fetch(`${API_BASE}/${encodeURIComponent(filename)}`, {
                method: "DELETE",
            });
            if (res.ok) {
                const updatedList = await res.json();
                setFiles(updatedList);
            } else {
                setErrorMsg("Failed to delete document.");
            }
        } catch (e) {
            console.error("Error deleting file:", e);
            setErrorMsg("Network error occurred while deleting.");
        }
    };

    const handleClearAll = async () => {
        setErrorMsg(null);
        try {
            const res = await fetch(`${API_BASE}/clear`, {
                method: "POST",
            });
            if (res.ok) {
                const updatedList = await res.json();
                setFiles(updatedList);
            } else {
                setErrorMsg("Failed to clear documents.");
            }
        } catch (e) {
            console.error("Error clearing files:", e);
            setErrorMsg("Network error occurred while clearing.");
        }
    };

    return (
        <div className="flex flex-col h-full w-full justify-end select-none">
            <SectionTitle title="Context Uploads" />

            <div className="flex flex-col gap-3 mt-2">
                {/* Drag & Drop Zone */}
                <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`relative border border-dashed rounded-md p-4 flex flex-col items-center justify-center cursor-pointer transition-all ${
                        isDragging
                            ? "border-cyan-400 bg-cyan-950/20 shadow-[0_0_12px_rgba(0,229,255,0.2)]"
                            : "border-cyan-900/40 bg-black/40 hover:border-cyan-500/50 hover:bg-cyan-950/5"
                    }`}
                >
                    <input
                        type="file"
                        onChange={handleFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        accept=".pdf,.docx,.txt,.md"
                        disabled={isLoading}
                    />

                    {/* Sci-Fi Corners */}
                    <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-cyan-500" />
                    <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r border-cyan-500" />
                    <div className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b border-l border-cyan-500" />
                    <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-cyan-500" />

                    {isLoading ? (
                        <Loader2 className="text-cyan-400 w-6 h-6 animate-spin mb-1.5" />
                    ) : (
                        <Upload className="text-cyan-500 w-6 h-6 mb-1.5" />
                    )}

                    <span className="text-[10px] tracking-widest text-cyan-200 uppercase font-semibold text-center">
                        {isLoading ? "PARSING DOCUMENT..." : "DRAG & DROP DOCUMENT"}
                    </span>
                    <span className="text-[8px] text-slate-500 tracking-wide mt-1 text-center">
                        PDF, DOCX, TXT, or MD only (Images blocked)
                    </span>
                </div>

                {/* Validation Error Alerts */}
                {errorMsg && (
                    <div className="flex items-start gap-2 border border-red-500/30 bg-red-950/10 text-red-400 p-2.5 rounded text-[9px] tracking-wider leading-relaxed">
                        <AlertTriangle className="shrink-0 w-3.5 h-3.5 mt-0.5" />
                        <span>{errorMsg}</span>
                    </div>
                )}

                {/* Active Files List */}
                {files.length > 0 && (
                    <div className="border border-cyan-900/30 bg-black/35 rounded-md p-3 flex flex-col gap-2 shadow-inner">
                        <div className="flex items-center justify-between text-[8px] tracking-widest uppercase pb-1.5 border-b border-cyan-950 text-slate-500">
                            <span>ACTIVE SESSION DOCUMENTS</span>
                            <span>{files.length} FILE(S)</span>
                        </div>

                        <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                            {files.map((file, idx) => (
                                <div
                                    key={idx}
                                    className="flex items-center justify-between gap-3 bg-cyan-950/10 border border-cyan-900/20 px-2 py-1.5 rounded transition-all hover:bg-cyan-950/20"
                                >
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        <FileText className="text-cyan-400 shrink-0" size={12} />
                                        <span className="text-[10px] text-cyan-50 truncate tracking-wide">
                                            {file.filename}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-[8px] text-slate-500 font-mono">
                                            {formatSize(file.size)}
                                        </span>
                                        <button
                                            onClick={() => handleDelete(file.filename)}
                                            className="text-red-500 hover:text-red-400 p-1 hover:bg-red-950/40 rounded transition-colors"
                                            title="Delete document"
                                        >
                                            <Trash2 size={11} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Clear All Action Button */}
                        <button
                            onClick={handleClearAll}
                            className="mt-1.5 w-full text-center border border-red-500/40 bg-red-950/10 text-red-500 hover:bg-red-950/30 hover:border-red-500 transition-all rounded py-2 text-[9px] tracking-widest uppercase font-semibold"
                            style={{
                                boxShadow: `0 0 4px rgba(239,68,68,0.1)`,
                            }}
                        >
                            CLEAR ALL DOCUMENTS
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
