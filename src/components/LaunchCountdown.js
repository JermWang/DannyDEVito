"use client";

import { useEffect, useState } from "react";

function formatTimeUnit(value) {
  return String(value).padStart(2, "0");
}

export default function LaunchCountdown({ compact = false }) {
  const [timeLeft, setTimeLeft] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let interval;

    async function fetchSchedule() {
      try {
        const res = await fetch("/api/launch-schedule", { cache: "no-store" });
        const data = await res.json();
        if (data?.ok && data.nextLaunchAt) {
          const targetTime = new Date(data.nextLaunchAt).getTime();
          updateCountdown(targetTime);
          interval = setInterval(() => updateCountdown(targetTime), 1000);
        }
      } catch (e) {
        console.error("Failed to fetch launch schedule:", e);
      } finally {
        setLoading(false);
      }
    }

    function updateCountdown(targetTime) {
      const now = Date.now();
      const diff = Math.max(0, targetTime - now);

      if (diff === 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: true });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds, expired: false });
    }

    fetchSchedule();

    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  if (loading) {
    return compact ? (
      <div className="text-xs text-gray-500 animate-pulse">Loading...</div>
    ) : (
      <div className="text-center py-4 text-gray-500 animate-pulse">Loading countdown...</div>
    );
  }

  if (!timeLeft) {
    return compact ? (
      <div className="text-xs text-[#D35400] font-bold">Soon™</div>
    ) : (
      <div className="text-center py-4 text-[#D35400] font-bold">Coming Soon™</div>
    );
  }

  if (timeLeft.expired) {
    return compact ? (
      <div className="text-xs text-green-600 font-bold animate-pulse">🚀 Launching!</div>
    ) : (
      <div className="text-center py-4 text-green-600 font-bold text-lg animate-pulse">
        🚀 Launching Any Moment Now! 🚀
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-1 text-xs font-mono">
        <span className="text-[#D35400] font-bold">
          {timeLeft.days > 0 && `${timeLeft.days}d `}
          {formatTimeUnit(timeLeft.hours)}:{formatTimeUnit(timeLeft.minutes)}:{formatTimeUnit(timeLeft.seconds)}
        </span>
      </div>
    );
  }

  return (
    <div className="bg-[#FFF3E8] border-2 border-[#D35400] p-4">
      <div className="text-center mb-2">
        <div className="text-xs text-[#808080] font-bold uppercase tracking-wide">Next Launch In</div>
      </div>
      <div className="flex justify-center gap-2">
        <div className="text-center">
          <div
            className="bg-[#c0c0c0] border-2 px-3 py-2 font-mono text-2xl font-bold text-black"
            style={{ borderColor: "#808080 #ffffff #ffffff #808080" }}
          >
            {formatTimeUnit(timeLeft.days)}
          </div>
          <div className="text-[10px] text-[#808080] mt-1 font-bold">DAYS</div>
        </div>
        <div className="text-2xl font-bold text-[#D35400] self-center pb-4">:</div>
        <div className="text-center">
          <div
            className="bg-[#c0c0c0] border-2 px-3 py-2 font-mono text-2xl font-bold text-black"
            style={{ borderColor: "#808080 #ffffff #ffffff #808080" }}
          >
            {formatTimeUnit(timeLeft.hours)}
          </div>
          <div className="text-[10px] text-[#808080] mt-1 font-bold">HRS</div>
        </div>
        <div className="text-2xl font-bold text-[#D35400] self-center pb-4">:</div>
        <div className="text-center">
          <div
            className="bg-[#c0c0c0] border-2 px-3 py-2 font-mono text-2xl font-bold text-black"
            style={{ borderColor: "#808080 #ffffff #ffffff #808080" }}
          >
            {formatTimeUnit(timeLeft.minutes)}
          </div>
          <div className="text-[10px] text-[#808080] mt-1 font-bold">MIN</div>
        </div>
        <div className="text-2xl font-bold text-[#D35400] self-center pb-4">:</div>
        <div className="text-center">
          <div
            className="bg-[#c0c0c0] border-2 px-3 py-2 font-mono text-2xl font-bold text-[#D35400]"
            style={{ borderColor: "#808080 #ffffff #ffffff #808080" }}
          >
            {formatTimeUnit(timeLeft.seconds)}
          </div>
          <div className="text-[10px] text-[#808080] mt-1 font-bold">SEC</div>
        </div>
      </div>
      <div className="text-center mt-3">
        <div className="text-xs text-[#D35400] font-bold">🔥 Stake $DEVITO for priority access! 🔥</div>
      </div>
    </div>
  );
}
