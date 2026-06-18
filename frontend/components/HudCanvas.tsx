"use client";

import React, { useEffect, useRef } from "react";

export default function HudCanvas({ state, muted }: { state: string, muted: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let tick = 0;
    let isCanceled = false;

    let scale = 1.0;
    let tgtScale = 1.0;
    let halo = 55.0;
    let tgtHalo = 55.0;
    let lastT = Date.now() / 1000;
    let scan = 0;
    let scan2 = 180;
    let rings = [0, 120, 240];
    let pulses = [0, 50, 100];
    let blink = true;
    let blinkTick = 0;

    const isSpeaking = state === "SPEAKING";

    const draw = () => {
      if (isCanceled) return;
      animId = requestAnimationFrame(draw);
      tick++;
      const now = Date.now() / 1000;

      const spk = state === "SPEAKING";

      if (now - lastT > (spk ? 0.12 : 0.5)) {
        if (spk) {
          tgtScale = 1.06 + Math.random() * 0.08;
          tgtHalo = 145 + Math.random() * 45;
        } else if (muted) {
          tgtScale = 0.998 + Math.random() * 0.004;
          tgtHalo = 15 + Math.random() * 13;
        } else {
          tgtScale = 1.001 + Math.random() * 0.007;
          tgtHalo = 48 + Math.random() * 20;
        }
        lastT = now;
      }

      const sp = spk ? 0.38 : 0.15;
      scale += (tgtScale - scale) * sp;
      halo += (tgtHalo - halo) * sp;

      const speeds = spk ? [1.3, -0.9, 2.0] : [0.55, -0.35, 0.9];
      for (let i = 0; i < 3; i++) rings[i] = (rings[i] + speeds[i]) % 360;

      scan = (scan + (spk ? 3.0 : 1.3)) % 360;
      scan2 = (scan2 + (spk ? -2.0 : -0.75)) % 360;

      const W = canvas.width;
      const H = canvas.height;
      const fw = Math.min(W, H);
      const cx = W / 2;
      const cy = H / 2;

      ctx.clearRect(0, 0, W, H);

      // Grid dots - very faint
      ctx.fillStyle = "rgba(0, 31, 46, 0.15)";
      for (let x = 0; x < W; x += 48) {
        for (let y = 0; y < H; y += 48) {
          ctx.fillRect(x, y, 2, 2);
        }
      }

      const r_face = fw * 0.31;
      const mainColRgb = muted ? "255, 51, 102" : "0, 212, 255";

      // Halo
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 10; i++) {
        const r = r_face * (1.8 - i * 0.08);
        const frc = 1.0 - i / 10;
        const a = Math.max(0, Math.min(1, (halo * 0.085 * frc) / 255));
        ctx.strokeStyle = `rgba(${mainColRgb}, ${a})`;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Pulses
      const lim = fw * 0.74;
      const pulSpd = spk ? 4.2 : 2.0;
      pulses = pulses.map(p => p + pulSpd).filter(p => p < lim);
      if (pulses.length < 3 && Math.random() < (spk ? 0.07 : 0.025)) pulses.push(0);

      for (let pr of pulses) {
        const a = Math.max(0, (230 * (1.0 - pr / lim)) / 255);
        ctx.strokeStyle = `rgba(${mainColRgb}, ${a})`;
        ctx.beginPath();
        ctx.arc(cx, cy, pr, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Arc Rings
      const ringConfigs = [
        { r: 0.48, w: 3, arc: 115, gap: 78 },
        { r: 0.40, w: 2, arc: 78, gap: 55 },
        { r: 0.32, w: 1, arc: 56, gap: 40 }
      ];
      ringConfigs.forEach((rc, idx) => {
        const rr = fw * rc.r;
        const base = rings[idx];
        const aVal = Math.max(0, Math.min(1, (halo * (1.0 - idx * 0.18)) / 255));
        ctx.strokeStyle = `rgba(${mainColRgb}, ${aVal})`;
        ctx.lineWidth = rc.w;
        let angle = base;
        while (angle < base + 360) {
          ctx.beginPath();
          ctx.arc(cx, cy, rr, (angle * Math.PI) / 180, ((angle + rc.arc) * Math.PI) / 180);
          ctx.stroke();
          angle += rc.arc + rc.gap;
        }
      });

      // Scanners
      const sr = fw * 0.50;
      const sa = Math.min(1, (halo * 1.5) / 255);
      const ex = spk ? 75 : 44;
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = `rgba(${mainColRgb}, ${sa})`;
      ctx.beginPath();
      ctx.arc(cx, cy, sr, (scan * Math.PI) / 180, ((scan + ex) * Math.PI) / 180);
      ctx.stroke();

      ctx.lineWidth = 1.5;
      ctx.strokeStyle = `rgba(255, 107, 0, ${sa / 2})`;
      ctx.beginPath();
      ctx.arc(cx, cy, sr, (scan2 * Math.PI) / 180, ((scan2 + ex) * Math.PI) / 180);
      ctx.stroke();

      // Tick marks
      const t_out = fw * 0.497;
      const t_in = fw * 0.474;
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(0, 212, 255, 0.55)`;
      for (let deg = 0; deg < 360; deg += 10) {
        const rad = (deg * Math.PI) / 180;
        const inn = deg % 30 === 0 ? t_in : t_in + 6;
        ctx.beginPath();
        ctx.moveTo(cx + t_out * Math.cos(rad), cy - t_out * Math.sin(rad));
        ctx.lineTo(cx + inn * Math.cos(rad), cy - inn * Math.sin(rad));
        ctx.stroke();
      }

      // Crosshair
      const ch_r = fw * 0.51;
      const gap_h = fw * 0.16;
      ctx.strokeStyle = `rgba(0, 212, 255, ${halo * 0.5 / 255})`;
      ctx.beginPath();
      ctx.moveTo(cx - ch_r, cy); ctx.lineTo(cx - gap_h, cy);
      ctx.moveTo(cx + gap_h, cy); ctx.lineTo(cx + ch_r, cy);
      ctx.moveTo(cx, cy - ch_r); ctx.lineTo(cx, cy - gap_h);
      ctx.moveTo(cx, cy + gap_h); ctx.lineTo(cx, cy + ch_r);
      ctx.stroke();

      // Orb Center - Highly transparent so 3D core glows through!
      const orb_r = fw * 0.27 * scale;
      const oc = muted ? [200, 0, 50] : [0, 60, 110];
      for (let i = 8; i > 0; i--) {
        const r2 = orb_r * (i / 8);
        const frc = i / 8;
        const maxAlpha = 0.25;
        const a = Math.max(0, Math.min(maxAlpha, (halo * 1.1 * frc) / 255)) * 0.3;
        ctx.fillStyle = `rgba(${oc[0] * frc}, ${oc[1] * frc}, ${oc[2] * frc}, ${a})`;
        ctx.beginPath();
        ctx.arc(cx, cy, r2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = `rgba(0, 212, 255, ${Math.min(0.4, (halo * 2) / 255)})`;
      ctx.stroke();

      // Status text
      blinkTick++;
      if (blinkTick >= 38) { blink = !blink; blinkTick = 0; }
      const sy = cy + fw * 0.40;
      let txt = "", col = "";
      if (muted) { txt = "STANDBY"; col = "#ff3366"; }
      else if (spk) { txt = "SPEAKING"; col = "#ff6b00"; }
      else if (state === "THINKING") { txt = "THINKING"; col = "#ffcc00"; }
      else if (state === "PROCESSING") { txt = "PROCESSING"; col = "#ffcc00"; }
      else if (state === "LISTENING") { txt = "LISTENING"; col = "#00ff88"; }
      else { txt = state; col = "#00d4ff"; }

      ctx.fillStyle = col;
      ctx.font = "bold 11px Courier New";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(txt, cx, sy);

      // Waveform
      const wy = sy + 30;
      const N = 36;
      const bw = 8;
      const wx0 = cx - (N * bw) / 2;
      for (let i = 0; i < N; i++) {
        let hgt = 0;
        let wCol = "";
        if (muted) { hgt = 2; wCol = "#ff3366"; }
        else if (spk) {
          hgt = 3 + Math.random() * 17;
          wCol = hgt > 12 ? "#00d4ff" : "#007a99";
        } else {
          hgt = Math.floor(3 + 2 * Math.sin(tick * 0.09 + i * 0.6));
          wCol = "#1a5c7a";
        }
        ctx.fillStyle = wCol;
        ctx.fillRect(wx0 + i * bw, wy + 20 - hgt, bw - 1, hgt);
      }

    };

    draw();

    return () => {
      isCanceled = true;
      cancelAnimationFrame(animId);
    };

  }, [state, muted]);

  return <canvas id="hud-canvas" ref={canvasRef} width={600} height={600} className="w-[600px] h-[600px]"></canvas>;
}
