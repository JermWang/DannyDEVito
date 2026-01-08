"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

function IconChat(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
    </svg>
  );
}

function IconVault(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M3 7h18" />
      <path d="M6 7v13h12V7" />
      <path d="M9 11h6" />
      <path d="M9 15h6" />
    </svg>
  );
}

function IconStake(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M12 2l3 7H9l3-7z" />
      <path d="M7 10h10" />
      <path d="M7 10l-2 4 2 8h10l2-8-2-4" />
      <path d="M10 14h4" />
    </svg>
  );
}

function IconX(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M4 4l16 16" />
      <path d="M20 4L4 20" />
    </svg>
  );
}

function IconTelegram(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M22 3L2 11l8 2 2 8 10-18z" />
      <path d="M10 13l4 4" />
    </svg>
  );
}

function IconCopy(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M9 9h10v10H9z" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function SocialIconLink({ href, label, icon: Icon }) {
  const disabled = !href;

  return (
    <a
      href={disabled ? "#" : href}
      aria-label={label}
      title={label}
      target={disabled ? undefined : "_blank"}
      rel={disabled ? undefined : "noreferrer"}
      onClick={(e) => {
        if (disabled) e.preventDefault();
      }}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-md transition ${
        disabled
          ? "cursor-not-allowed bg-[var(--tw-surface-alt)] text-[var(--tw-text-dim)]"
          : "bg-[var(--tw-surface-alt)] text-[var(--tw-text-muted)] hover:bg-[var(--tw-accent)] hover:text-white"
      }`}
    >
      <Icon className="h-4 w-4" />
    </a>
  );
}

function CopyContractButton() {
  const contract = process.env.NEXT_PUBLIC_HOLDER_TOKEN_MINT || "";
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1200);
    return () => clearTimeout(t);
  }, [copied]);

  async function copy() {
    if (!contract) return;
    try {
      await navigator.clipboard.writeText(contract);
      setCopied(true);
    } catch {
      // no-op
    }
  }

  const label = useMemo(() => {
    if (!contract) return "Copy CA (set env)";
    return copied ? "Copied" : "Copy CA";
  }, [contract, copied]);

  return (
    <button
      type="button"
      onClick={copy}
      disabled={!contract}
      aria-label={label}
      title={contract ? "Copy contract address" : "Set NEXT_PUBLIC_HOLDER_TOKEN_MINT"}
      className={`inline-flex h-9 items-center gap-2 rounded-md px-3 text-xs font-semibold transition ${
        contract
          ? "bg-[var(--tw-surface-alt)] text-[var(--tw-text)] hover:bg-[var(--tw-accent)] hover:text-white"
          : "cursor-not-allowed bg-[var(--tw-surface-alt)] text-[var(--tw-text-dim)]"
      }`}
    >
      <IconCopy className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function NavLink({ href, label, icon: Icon }) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-md text-sm transition ${
        active
          ? "bg-[var(--tw-accent)] text-white"
          : "text-[var(--tw-text-muted)] hover:bg-[var(--tw-surface-alt)] hover:text-white"
      }`}
    >
      <Icon className="h-4 w-4" />
    </Link>
  );
}

export default function SiteHeader() {
  const twitterUrl = "https://x.com/dannydadevxyz";
  const telegramUrl = process.env.NEXT_PUBLIC_TELEGRAM_URL || "";

  return (
    <header className="sticky top-0 z-50 h-14 border-b border-[var(--tw-border)] bg-[var(--tw-surface)]">
      <div className="flex h-full w-full items-center justify-between px-4">
        <Link href="/" className="group flex items-center gap-2">
          <img src="/DEVito.png" alt="Danny DEVito" className="h-8" />
        </Link>

        <nav className="flex items-center gap-1">
          <NavLink href="/" label="Chat" icon={IconChat} />
          <NavLink href="/vault" label="Vault" icon={IconVault} />
          <NavLink href="/staking" label="Staking" icon={IconStake} />
        </nav>

        <div className="flex items-center gap-1.5">
          <CopyContractButton />
          <SocialIconLink href={telegramUrl} label="Telegram" icon={IconTelegram} />
          <SocialIconLink href={twitterUrl} label="X" icon={IconX} />
          <WalletMultiButton />
        </div>
      </div>
    </header>
  );
}
