'use client';

import React, { useRef, useCallback, useState, useEffect } from 'react';
import { useEditorStore, selectTotalDuration } from '@/stores/editor.store';
import type { TimelineTrack, TimelineItem } from '@/types';

const PX_PER_SEC = 80; // pixels per second at default zoom
const TRACK_HEIGHT = 36;
const HEADER_WIDTH = 160;

interface TimelineProps {
  className?: string;
}

export function Timeline({ className }: TimelineProps) {
  const {
    timelineTracks, currentTime, isPlaying, project,
    play, pause, seek, updateScene, reorderScenes,
  } = useEditorStore();

  const totalDuration = useEditorStore(selectTotalDuration);
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<number | null>(null);

  const pxPerSec = PX_PER_SEC * timelineZoom;
  const totalWidth = totalDuration * pxPerSec;

  // ── Playhead dragging ─────────────────────────────────────────────────────

  const handleRulerClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left + (scrollRef.current?.scrollLeft ?? 0);
    const t = Math.max(0, Math.min(x / pxPerSec, totalDuration));
    seek(t);
  }, [pxPerSec, totalDuration, seek]);

  // ── Playback ticker ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!isPlaying) {
      if (playheadRef.current !== null) cancelAnimationFrame(playheadRef.current);
      return;
    }
    let lastTs: number | null = null;

    const tick = (ts: number) => {
      if (lastTs !== null) {
        const delta = (ts - lastTs) / 1000;
        const next = Math.min(currentTime + delta, totalDuration);
        seek(next);
        if (next >= totalDuration) { pause(); return; }
      }
      lastTs = ts;
      playheadRef.current = requestAnimationFrame(tick);
    };

    playheadRef.current = requestAnimationFrame(tick);
    return () => { if (playheadRef.current) cancelAnimationFrame(playheadRef.current); };
  }, [isPlaying]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Ruler ticks ───────────────────────────────────────────────────────────

  const renderRuler = () => {
    const ticks: React.ReactNode[] = [];
    const interval = pxPerSec >= 120 ? 1 : pxPerSec >= 60 ? 2 : 5;
    for (let t = 0; t <= totalDuration; t += interval) {
      const x = t * pxPerSec;
      const mins = Math.floor(t / 60);
      const secs = Math.floor(t % 60);
      const label = `${mins}:${secs.toString().padStart(2, '0')}`;
      ticks.push(
        <g key={t}>
          <line x1={x} y1={16} x2={x} y2={28} stroke="var(--muted-foreground)" strokeWidth="1"/>
          <text x={x + 3} y={13} fontSize="9" fill="var(--muted-foreground)">{label}</text>
        </g>
      );
    }
    return ticks;
  };

  // ── Track item coloring ───────────────────────────────────────────────────

  const typeColors: Record<string, string> = {
    element: '#6366f1',
    audio: '#22c55e',
    transition: '#f59e0b',
  };

  return (
    <div className={`flex flex-col bg-gray-950 border-t border-gray-800 select-none ${className ?? ''}`}>
      {/* Transport bar */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-b border-gray-800 bg-gray-900">
        <button
          onClick={isPlaying ? pause : play}
          className="flex items-center justify-center w-7 h-7 rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <rect x="2" y="1" width="3" height="10"/><rect x="7" y="1" width="3" height="10"/>
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <polygon points="2,1 10,6 2,11"/>
            </svg>
          )}
        </button>

        <span className="text-xs text-gray-400 font-mono w-24">
          {formatTime(currentTime)} / {formatTime(totalDuration)}
        </span>

        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-xs text-gray-500">Zoom</span>
          <input
            type="range" min={0.25} max={4} step={0.25} value={timelineZoom}
            onChange={(e) => setTimelineZoom(Number(e.target.value))}
            className="w-24 accent-indigo-500"
          />
        </div>
      </div>

      {/* Timeline content */}
      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 180 }}>
        {/* Track headers */}
        <div className="flex flex-col border-r border-gray-800 flex-shrink-0" style={{ width: HEADER_WIDTH }}>
          {/* Ruler placeholder */}
          <div className="h-8 border-b border-gray-800 bg-gray-900"/>

          {timelineTracks.map((track) => (
            <div
              key={track.id}
              className="flex items-center px-3 border-b border-gray-800 bg-gray-900 text-xs text-gray-300"
              style={{ height: TRACK_HEIGHT }}
            >
              <span className="truncate max-w-[120px]">{track.label}</span>
              {track.isMuted !== undefined && (
                <button
                  className="ml-auto text-gray-500 hover:text-gray-300"
                  title="Mute/Unmute"
                  onClick={() => {/* toggle mute */}}
                >M</button>
              )}
            </div>
          ))}
        </div>

        {/* Scrollable track area */}
        <div className="flex-1 overflow-auto" ref={scrollRef}>
          <div style={{ width: totalWidth || 800, position: 'relative' }}>
            {/* Ruler */}
            <svg
              width={totalWidth || 800}
              height={32}
              className="border-b border-gray-800 bg-gray-900 cursor-pointer sticky top-0 z-10"
              onClick={handleRulerClick}
            >
              {renderRuler()}
            </svg>

            {/* Tracks */}
            {timelineTracks.map((track) => (
              <div
                key={track.id}
                className="relative border-b border-gray-800"
                style={{ height: TRACK_HEIGHT }}
              >
                {track.items.map((item) => (
                  <TimelineItemBlock
                    key={item.id}
                    item={item}
                    pxPerSec={pxPerSec}
                    color={typeColors[track.type] ?? '#6366f1'}
                  />
                ))}
              </div>
            ))}

            {/* Playhead */}
            <div
              className="absolute top-0 bottom-0 w-px bg-red-500 pointer-events-none z-20"
              style={{ left: currentTime * pxPerSec, transform: 'translateX(-0.5px)' }}
            >
              <div className="w-3 h-3 bg-red-500 rounded-full -ml-1.5 -mt-1"/>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Timeline Item Block ──────────────────────────────────────────────────────

interface ItemBlockProps {
  item: TimelineItem;
  pxPerSec: number;
  color: string;
}

function TimelineItemBlock({ item, pxPerSec, color }: ItemBlockProps) {
  const left = item.startTime * pxPerSec;
  const itemWidth = Math.max(item.duration * pxPerSec, 8);

  return (
    <div
      className="absolute top-1 bottom-1 rounded flex items-center px-1.5 cursor-pointer overflow-hidden"
      style={{ left, width: itemWidth, backgroundColor: color + '33', border: `1px solid ${color}99` }}
      title={`${item.label} — ${item.startTime.toFixed(1)}s for ${item.duration.toFixed(1)}s`}
    >
      <span className="text-[10px] font-medium truncate" style={{ color }}>
        {item.label}
      </span>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${m}:${s.toString().padStart(2, '0')}.${ms}`;
}
