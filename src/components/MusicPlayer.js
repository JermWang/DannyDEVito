"use client";

import { useEffect, useRef, useState } from "react";

export default function MusicPlayer() {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = volume;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => {
      audio.currentTime = 0;
      audio.play();
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
    };
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

  const handleSeek = (e) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="win-window" style={{ width: 280 }}>
      <div className="win-titlebar">
        <div className="win-titlebar-left">
          <span className="win-titlebar-icon">🎵</span>
          <span className="win-titlebar-title">Media Player</span>
        </div>
        <div className="win-titlebar-buttons">
          <button type="button" className="win-btn win-btn-minimize">_</button>
          <button type="button" className="win-btn win-btn-maximize">□</button>
          <button type="button" className="win-btn win-btn-close">×</button>
        </div>
      </div>

      <div className="win-content" style={{ padding: 8, background: "#c0c0c0" }}>
        <audio ref={audioRef} src="/It's Always Sunny in Philadelphia Theme.mp3" preload="metadata" loop />

        <div
          style={{
            background: "#000",
            color: "#0f0",
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

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            marginBottom: 6,
          }}
        >
          <button
            type="button"
            onClick={togglePlay}
            className="win-btn"
            style={{ width: 50, fontSize: 11, padding: "2px 4px" }}
          >
            {isPlaying ? "⏸ Pause" : "▶ Play"}
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
          <span style={{ fontSize: 9, width: 28, textAlign: "right" }}>{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            style={{ flex: 1, height: 12 }}
          />
          <span style={{ fontSize: 9, width: 28 }}>{formatTime(duration)}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 9 }}>🔈</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={handleVolumeChange}
            style={{ flex: 1, height: 12 }}
          />
          <span style={{ fontSize: 9 }}>🔊</span>
        </div>

        <div
          style={{
            marginTop: 6,
            fontSize: 9,
            color: "#444",
            textAlign: "center",
            borderTop: "1px solid #808080",
            paddingTop: 4,
          }}
        >
          {isPlaying ? "Now Playing..." : "Ready"}
        </div>
      </div>
    </div>
  );
}
