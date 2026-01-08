"use client";

import { useEffect, useRef, useState } from "react";

export default function MusicPlayer({ isOpen = true, onClose }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = volume;

    const handleEnded = () => {
      audio.currentTime = 0;
      audio.play();
    };

    audio.addEventListener("ended", handleEnded);
    return () => audio.removeEventListener("ended", handleEnded);
  }, [volume]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
    setIsPlaying(!isPlaying);
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  if (!isOpen) return <audio ref={audioRef} src="/It's Always Sunny in Philadelphia Theme.mp3" preload="metadata" loop />;

  return (
    <div className="win-window" style={{ width: 280, overflow: "hidden" }}>
      <audio ref={audioRef} src="/It's Always Sunny in Philadelphia Theme.mp3" preload="metadata" loop />

      {/* Header */}
      <div className="win-titlebar">
        <button
          type="button"
          className="win-titlebar-left"
          onClick={() => setCollapsed((v) => !v)}
          style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer" }}
        >
          <span className="win-titlebar-icon">🎵</span>
          <span className="win-titlebar-title">Media Player</span>
        </button>

        <div className="win-titlebar-buttons">
          <button
            type="button"
            className="win-btn win-btn-minimize"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Restore" : "Minimize"}
            title={collapsed ? "Restore" : "Minimize"}
          >
            _
          </button>
          <button
            type="button"
            className="win-btn win-btn-close"
            onClick={() => {
              const a = audioRef.current;
              if (a) {
                a.pause();
                a.currentTime = 0;
              }
              setIsPlaying(false);
              onClose?.();
            }}
            aria-label="Close"
            title="Close"
          >
            ×
          </button>
        </div>
      </div>

      {/* Controls */}
      {!collapsed && (
        <div className="win-content" style={{ padding: 6, background: "#c0c0c0", overflow: "hidden" }}>
          <div
            className="win-content-inner"
            style={{ padding: 6, overflow: "hidden", color: "#000", display: "flex", flexDirection: "column", gap: 6 }}
          >
            <div
              style={{
                background: "#fff",
                color: "#000",
                fontFamily: "monospace",
                fontSize: 10,
                padding: "4px 6px",
                border: "2px inset #808080",
                textAlign: "center",
                overflow: "hidden",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
              }}
            >
              ♪ It&apos;s Always Sunny Theme ♪
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, flexWrap: "wrap" }}>
              <button type="button" onClick={togglePlay} className="win-btn-action">
                {isPlaying ? "Pause" : "Play"}
              </button>
              <button
                type="button"
                className="win-btn-action"
                onClick={() => {
                  const a = audioRef.current;
                  if (!a) return;
                  a.pause();
                  a.currentTime = 0;
                  setIsPlaying(false);
                }}
              >
                Stop
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 10, color: "#000", flex: "0 0 auto" }}>🔈</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={handleVolumeChange}
                style={{ flex: "1 1 0%", minWidth: 0, height: 14, accentColor: "#000080" }}
              />
              <span style={{ fontSize: 10, color: "#000", flex: "0 0 auto" }}>🔊</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
