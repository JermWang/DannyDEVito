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
    <div className="win-window" style={{ width: 260 }}>
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
        <div className="win-content" style={{ padding: 8, background: "#c0c0c0" }}>
          <div
            style={{
              background: "#fff",
              color: "#000",
              fontFamily: "monospace",
              fontSize: 10,
              padding: "4px 6px",
              marginBottom: 6,
              border: "2px inset #808080",
              textAlign: "center",
              overflow: "hidden",
              whiteSpace: "nowrap",
            }}
          >
            ♪ It&apos;s Always Sunny Theme ♪
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 6 }}>
            <button type="button" onClick={togglePlay} className="win-btn" style={{ fontSize: 11, padding: "2px 6px" }}>
              {isPlaying ? "⏸ Pause" : "▶ Play"}
            </button>
            <button
              type="button"
              className="win-btn"
              style={{ fontSize: 11, padding: "2px 6px" }}
              onClick={() => {
                const a = audioRef.current;
                if (!a) return;
                a.pause();
                a.currentTime = 0;
                setIsPlaying(false);
              }}
            >
              ⏹ Stop
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10, color: "#000" }}>🔈</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={handleVolumeChange}
              style={{ flex: 1, height: 12 }}
            />
            <span style={{ fontSize: 10, color: "#000" }}>🔊</span>
          </div>
        </div>
      )}
    </div>
  );
}
