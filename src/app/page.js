"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

import ChatPanel from "@/components/ChatPanel";
import DraggableWindow from "@/components/DraggableWindow";
import LiveChat from "@/components/LiveChat";
import MemeGenerator from "@/components/MemeGenerator";
import MusicPlayer from "@/components/MusicPlayer";

function PhantomIcon({ className = "w-7 h-7" }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="phantomGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#AB9FF2" />
          <stop offset="1" stopColor="#7C66FF" />
        </linearGradient>
      </defs>
      <path
        d="M32 6c-12.7 0-23 10.3-23 23v22c0 4.4 3.6 8 8 8 3.3 0 6.2-2 7.4-4.9L26 50c1.1-2.8 3.8-4.7 6.9-4.7h.2c3.1 0 5.8 1.9 6.9 4.7l1.6 4.1c1.1 2.9 4 4.9 7.4 4.9 4.4 0 8-3.6 8-8V29C55 16.3 44.7 6 32 6z"
        fill="url(#phantomGrad)"
      />
      <path
        d="M24 33c0 2.2-1.8 4-4 4s-4-1.8-4-4 1.8-4 4-4 4 1.8 4 4zm24 0c0 2.2-1.8 4-4 4s-4-1.8-4-4 1.8-4 4-4 4 1.8 4 4z"
        fill="#0B0B12"
        opacity="0.9"
      />
    </svg>
  );
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

export default function Home() {
  const isMobile = useIsMobile();
  const [windows, setWindows] = useState({
    wallet: { open: false, minimized: false, zIndex: 8 },
    agentChat: { open: false, minimized: false, zIndex: 10 },
    liveChat: { open: false, minimized: false, zIndex: 11 },
    contract: { open: false, minimized: false, zIndex: 12 },
    memeGen: { open: false, minimized: false, zIndex: 9 },
  });
  const [musicPlayerOpen, setMusicPlayerOpen] = useState(true);
  const [time, setTime] = useState("");
  const [topZ, setTopZ] = useState(12);

  const [desktopLayout, setDesktopLayout] = useState({
    contract: { x: 780, y: 60, width: 280, height: 120 },
    agentChat: { x: 680, y: 200, width: 380, height: 320 },
    liveChat: { x: 60, y: 60, width: 300, height: 380 },
  });

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isMobile) {
      setWindows((prev) => ({
        ...prev,
        wallet: { ...prev.wallet, open: false },
        agentChat: { ...prev.agentChat, open: false },
        liveChat: { ...prev.liveChat, open: false },
        contract: { ...prev.contract, open: false },
        memeGen: { ...prev.memeGen, open: false },
      }));
      return;
    }

    const width = typeof window !== "undefined" ? window.innerWidth : 1200;
    const margin = 24;
    const gap = 16;

    const contractW = 320;
    const contractH = 150;
    const agentW = 450;
    const agentH = 420;
    const liveW = 340;
    const liveH = 450;

    const contractX = Math.max(margin, width - contractW - margin);
    const contractY = 60;

    const rowY = contractY + contractH + gap;
    const twoColFits = width >= margin + liveW + gap + agentW + margin;

    const agentX = Math.max(margin, width - agentW - margin);
    const liveX = twoColFits
      ? Math.max(margin, width - margin - agentW - gap - liveW)
      : agentX;

    const agentY = rowY;
    const liveY = twoColFits ? rowY : rowY + agentH + gap;

    setDesktopLayout({
      contract: { x: contractX, y: contractY, width: contractW, height: contractH },
      agentChat: { x: agentX, y: agentY, width: agentW, height: agentH },
      liveChat: { x: liveX, y: liveY, width: liveW, height: liveH },
    });

    setWindows((prev) => ({
      ...prev,
      wallet: { ...prev.wallet, open: false, zIndex: 8 },
      memeGen: { ...prev.memeGen, open: false, zIndex: 9 },
      liveChat: { ...prev.liveChat, open: true, zIndex: 10 },
      agentChat: { ...prev.agentChat, open: true, zIndex: 11 },
      contract: { ...prev.contract, open: true, zIndex: 12 },
    }));
  }, [isMobile]);

  const bringToFront = useCallback((key) => {
    setTopZ((z) => z + 1);
    setWindows((prev) => ({
      ...prev,
      [key]: { ...prev[key], zIndex: topZ + 1 },
    }));
  }, [topZ]);

  const toggleWindow = useCallback((key) => {
    setWindows((prev) => ({
      ...prev,
      [key]: { ...prev[key], open: !prev[key].open },
    }));
    if (!windows[key].open) {
      bringToFront(key);
    }
  }, [windows, bringToFront]);

  const closeWindow = useCallback((key) => {
    setWindows((prev) => ({
      ...prev,
      [key]: { ...prev[key], open: false },
    }));
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {/* Full-screen background video */}
      <video
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
      >
        <source src="/background.mp4" type="video/mp4" />
      </video>

      {/* Desktop area */}
      <div className="absolute inset-0 pb-7 md:pb-7 pb-9">
        {/* Desktop icons - grid on mobile, column on desktop */}
        <div className="flex flex-col gap-2 p-4 md:flex-col md:gap-2 max-md:grid max-md:grid-cols-4 max-md:gap-1 max-md:p-2">
          <button
            type="button"
            className="desktop-icon"
            onClick={isMobile ? () => toggleWindow("wallet") : undefined}
            onDoubleClick={!isMobile ? () => toggleWindow("wallet") : undefined}
          >
            <div className="desktop-icon-img">
              <PhantomIcon />
            </div>
            <span className="desktop-icon-label">Wallet</span>
          </button>

          <button
            type="button"
            className="desktop-icon"
            onClick={isMobile ? () => toggleWindow("agentChat") : undefined}
            onDoubleClick={!isMobile ? () => toggleWindow("agentChat") : undefined}
          >
            <div className="desktop-icon-img">💬</div>
            <span className="desktop-icon-label">Agent Chat</span>
          </button>

          <button
            type="button"
            className="desktop-icon"
            onClick={isMobile ? () => toggleWindow("liveChat") : undefined}
            onDoubleClick={!isMobile ? () => toggleWindow("liveChat") : undefined}
          >
            <div className="desktop-icon-img">🌐</div>
            <span className="desktop-icon-label">Live Chat</span>
          </button>

          <a
            href={process.env.NEXT_PUBLIC_TWITTER_URL || "#"}
            target="_blank"
            rel="noreferrer"
            className="desktop-icon"
            onDoubleClick={(e) => {
              if (!process.env.NEXT_PUBLIC_TWITTER_URL) e.preventDefault();
            }}
          >
            <div className="desktop-icon-img">
              <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </div>
            <span className="desktop-icon-label">X</span>
          </a>

          <Link href="/vault" className="desktop-icon">
            <div className="desktop-icon-img">
              <svg viewBox="0 0 24 24" className="w-6 h-6 fill-[#FFD700]">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H10.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.39-2.1 1.39-1.6 0-2.23-.72-2.32-1.64H8.04c.1 1.7 1.36 2.66 2.86 2.97V19h2.34v-1.67c1.52-.29 2.72-1.16 2.73-2.77-.01-2.2-1.9-2.96-3.66-3.42z"/>
              </svg>
            </div>
            <span className="desktop-icon-label">Vault</span>
          </Link>

          <Link href="/staking" className="desktop-icon">
            <div className="desktop-icon-img">🥩</div>
            <span className="desktop-icon-label">Staking</span>
          </Link>

          <Link href="/docs" className="desktop-icon">
            <div className="desktop-icon-img">
              <img src="/docs-icon.svg" alt="" className="w-7 h-7 object-contain" />
            </div>
            <span className="desktop-icon-label">Docs</span>
          </Link>

          <button
            type="button"
            className="desktop-icon"
            onClick={isMobile ? () => toggleWindow("contract") : undefined}
            onDoubleClick={!isMobile ? () => toggleWindow("contract") : undefined}
          >
            <div className="desktop-icon-img">🪙</div>
            <span className="desktop-icon-label">CA</span>
          </button>

          <Link href="/chat-logs" className="desktop-icon">
            <div className="desktop-icon-img">🗃️</div>
            <span className="desktop-icon-label">Chat Logs</span>
          </Link>

          <button
            type="button"
            className="desktop-icon"
            onClick={isMobile ? () => toggleWindow("memeGen") : undefined}
            onDoubleClick={!isMobile ? () => toggleWindow("memeGen") : undefined}
          >
            <div className="desktop-icon-img">
              <img src="/danny-glocked-up.png" alt="" className="w-8 h-8 object-contain" />
            </div>
            <span className="desktop-icon-label">Meme Generator</span>
          </button>

          <button
            type="button"
            className="desktop-icon"
            onClick={isMobile ? () => setMusicPlayerOpen(true) : undefined}
            onDoubleClick={!isMobile ? () => setMusicPlayerOpen(true) : undefined}
          >
            <div className="desktop-icon-img">🎵</div>
            <span className="desktop-icon-label">Music</span>
          </button>
        </div>

        {/* Music Player Widget */}
        <div className="absolute bottom-14 right-4 z-50">
          <MusicPlayer isOpen={musicPlayerOpen} onClose={() => setMusicPlayerOpen(false)} />
        </div>

        <DraggableWindow
          title="Wallet Connect"
          icon={<PhantomIcon className="w-4 h-4" />}
          isOpen={windows.wallet.open}
          onClose={() => closeWindow("wallet")}
          onFocus={() => bringToFront("wallet")}
          zIndex={windows.wallet.zIndex}
          defaultPosition={{ x: 140, y: 120 }}
          defaultSize={{ width: 360, height: 220 }}
          minSize={{ width: 300, height: 200 }}
        >
          <div className="win-content-inner p-4 flex flex-col gap-3">
            <div className="text-sm font-semibold">Solana Wallet</div>
            <div>
              <WalletMultiButton />
            </div>
            <div className="text-xs text-[var(--tw-text-dim)]">
              Connect a wallet to enable holder-gated features.
            </div>
          </div>
        </DraggableWindow>

        {/* Agent Chat Window */}
        <DraggableWindow
          title="Agent Chat - Danny DEVito"
          icon="💬"
          isOpen={windows.agentChat.open}
          onClose={() => closeWindow("agentChat")}
          onFocus={() => bringToFront("agentChat")}
          zIndex={windows.agentChat.zIndex}
          defaultPosition={{ x: desktopLayout.agentChat.x, y: desktopLayout.agentChat.y }}
          defaultSize={{ width: desktopLayout.agentChat.width, height: desktopLayout.agentChat.height }}
          minSize={{ width: 320, height: 250 }}
        >
          <div className="win-content-inner p-0 flex flex-col h-full">
            <ChatPanel compact windowMode />
          </div>
        </DraggableWindow>

        {/* Live Chat Window */}
        <DraggableWindow
          title="Stream Chat - LIVE"
          icon="🌐"
          isOpen={windows.liveChat.open}
          onClose={() => closeWindow("liveChat")}
          onFocus={() => bringToFront("liveChat")}
          zIndex={windows.liveChat.zIndex}
          defaultPosition={{ x: desktopLayout.liveChat.x, y: desktopLayout.liveChat.y }}
          defaultSize={{ width: 340, height: 450 }}
          minSize={{ width: 280, height: 300 }}
        >
          <div className="win-content-inner p-0 flex flex-col h-full">
            <LiveChat windowMode />
          </div>
        </DraggableWindow>

        <DraggableWindow
          title="Contract Address"
          icon="🪙"
          isOpen={windows.contract.open}
          onClose={() => closeWindow("contract")}
          onFocus={() => bringToFront("contract")}
          zIndex={windows.contract.zIndex}
          defaultPosition={{ x: desktopLayout.contract.x, y: desktopLayout.contract.y }}
          defaultSize={{ width: desktopLayout.contract.width, height: desktopLayout.contract.height }}
          minSize={{ width: 260, height: 120 }}
        >
          <div
            className="win-content-inner p-4 flex flex-col gap-2 cursor-pointer select-all"
            onClick={() => {
              const ca = process.env.NEXT_PUBLIC_TOKEN_CONTRACT || "";
              if (!ca) return;
              navigator.clipboard.writeText(ca);
            }}
            title="Click to copy"
          >
            <div className="text-xs font-semibold text-black">$DEVITO Contract</div>
            <div className="text-xs font-mono break-all text-black">
              {process.env.NEXT_PUBLIC_TOKEN_CONTRACT || "Set NEXT_PUBLIC_TOKEN_CONTRACT"}
            </div>
            <div className="text-[10px] text-black mt-1">Click anywhere to copy</div>
          </div>
        </DraggableWindow>

        {/* Meme Generator Window */}
        <DraggableWindow
          title="Meme Generator - Danny DEVito"
          icon="🎨"
          isOpen={windows.memeGen.open}
          onClose={() => closeWindow("memeGen")}
          onFocus={() => bringToFront("memeGen")}
          zIndex={windows.memeGen.zIndex}
          defaultPosition={{ x: 100, y: 40 }}
          defaultSize={{ width: 700, height: 550 }}
          minSize={{ width: 500, height: 400 }}
        >
          <MemeGenerator />
        </DraggableWindow>
      </div>

      {/* Logo overlay */}
      <div className="absolute top-4 right-4 z-50">
        <img src="/DEVito.png" alt="Danny DEVito" className="h-12 drop-shadow-lg" />
      </div>

      {/* Windows Taskbar */}
      <div className="win-taskbar">
        <button type="button" className="win-start-btn">
          <img src="/1.png" alt="" className="h-4" />
          <span>Start</span>
        </button>

        <div className="win-taskbar-items">
          <button
            type="button"
            className={`win-taskbar-item ${windows.wallet.open ? "active" : ""}`}
            onClick={() => toggleWindow("wallet")}
          >
            <span>
              <PhantomIcon className="w-4 h-4" />
            </span>
            <span>Wallet</span>
          </button>
          <button
            type="button"
            className={`win-taskbar-item ${windows.agentChat.open ? "active" : ""}`}
            onClick={() => toggleWindow("agentChat")}
          >
            <span>💬</span>
            <span>Agent Chat</span>
          </button>
          <button
            type="button"
            className={`win-taskbar-item ${windows.liveChat.open ? "active" : ""}`}
            onClick={() => toggleWindow("liveChat")}
          >
            <span>🌐</span>
            <span>Live Chat</span>
          </button>
          <button
            type="button"
            className={`win-taskbar-item ${windows.contract.open ? "active" : ""}`}
            onClick={() => toggleWindow("contract")}
          >
            <span>🪙</span>
            <span>CA</span>
          </button>
          <button
            type="button"
            className={`win-taskbar-item ${windows.memeGen.open ? "active" : ""}`}
            onClick={() => toggleWindow("memeGen")}
          >
            <span>🎨</span>
            <span>Meme Gen</span>
          </button>
        </div>

        <div className="win-taskbar-clock">{time}</div>
      </div>

      {/* CRT Screen Effect Overlays */}
      <div className="crt-chromatic" />
      <div className="crt-reflection" />
      <div className="crt-glow" />
      <div className="crt-screen" />
      <div className="crt-overlay" />
    </div>
  );
}
