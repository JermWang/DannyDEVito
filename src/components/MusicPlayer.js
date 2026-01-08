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
      audio.play();
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
    <div
      style={{
        background: "linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)",
        borderRadius: 8,
        boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
        overflow: "hidden",
        width: collapsed ? 48 : 200,
        transition: "width 0.2s ease",
      }}
    >
      <audio ref={audioRef} src="/It's Always Sunny in Philadelphia Theme.mp3" preload="metadata" loop />

      {/* Header */}
      <div
        style={{
          background: "linear-gradient(90deg, #0f3460 0%, #533483 100%)",
          padding: "6px 10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
        }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 14 }}>🎵</span>
          {!collapsed && (
            <span style={{ fontSize: 11, color: "#fff", fontWeight: 500 }}>Music</span>
          )}
        </div>
        {!collapsed && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose?.();
            }}
            style={{
              background: "none",
              border: "none",
              color: "#fff",
              cursor: "pointer",
              fontSize: 14,
              padding: 0,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* Controls */}
      {!collapsed && (
        <div style={{ padding: 10 }}>
          <div
            style={{
              fontSize: 9,
              color: "#e94560",
              textAlign: "center",
              marginBottom: 8,
              fontWeight: 500,
            }}
          >
            ♪ Always Sunny Theme
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 8 }}>
            <button
              type="button"
              onClick={togglePlay}
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: isPlaying ? "#e94560" : "#533483",
                border: "none",
                color: "#fff",
                cursor: "pointer",
                fontSize: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {isPlaying ? "⏸" : "▶"}
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10, color: "#888" }}>🔈</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={handleVolumeChange}
              style={{
                flex: 1,
                height: 4,
                accentColor: "#e94560",
              }}
            />
            <span style={{ fontSize: 10, color: "#888" }}>🔊</span>
          </div>
        </div>
      )}
    </div>
  );
}
