"use client";

import Link from "next/link";

export default function IEBrowser({ 
  title = "Internet Explorer", 
  url = "http://localhost/",
  iconSrc = "/3.png",
  faviconSrc = "/3.png",
  children,
  onBack,
  onForward,
  onRefresh,
  onHome,
}) {
  return (
    <div className="ie-browser">
      {/* Title bar */}
      <div className="ie-titlebar">
        <div className="ie-titlebar-left">
          <img src={iconSrc} alt="" className="ie-titlebar-icon" />
          <span className="ie-titlebar-title">{title} - Microsoft Internet Explorer</span>
        </div>
        <div className="ie-titlebar-buttons">
          <button className="ie-btn ie-btn-minimize">_</button>
          <button className="ie-btn ie-btn-maximize">□</button>
          <Link href="/" className="ie-btn ie-btn-close">×</Link>
        </div>
      </div>

      {/* Menu bar */}
      <div className="ie-menubar">
        <span className="ie-menu-item">File</span>
        <span className="ie-menu-item">Edit</span>
        <span className="ie-menu-item">View</span>
        <span className="ie-menu-item">Favorites</span>
        <span className="ie-menu-item">Tools</span>
        <span className="ie-menu-item">Help</span>
      </div>

      {/* Toolbar */}
      <div className="ie-toolbar">
        <div className="ie-toolbar-buttons">
          <Link href="/" className="ie-toolbar-btn" title="Back">
            <svg viewBox="0 0 24 24" className="ie-toolbar-icon">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
            </svg>
            <span>Back</span>
          </Link>
          <button className="ie-toolbar-btn" title="Forward" disabled>
            <svg viewBox="0 0 24 24" className="ie-toolbar-icon">
              <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/>
            </svg>
            <span>Forward</span>
          </button>
          <button className="ie-toolbar-btn" onClick={onRefresh} title="Refresh">
            <svg viewBox="0 0 24 24" className="ie-toolbar-icon">
              <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
            </svg>
            <span>Refresh</span>
          </button>
          <Link href="/" className="ie-toolbar-btn" title="Home">
            <svg viewBox="0 0 24 24" className="ie-toolbar-icon">
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
            </svg>
            <span>Home</span>
          </Link>
        </div>
        <div className="ie-toolbar-separator" />
        <div className="ie-toolbar-buttons">
          <button className="ie-toolbar-btn" title="Search">
            <svg viewBox="0 0 24 24" className="ie-toolbar-icon">
              <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
            <span>Search</span>
          </button>
          <button className="ie-toolbar-btn" title="Favorites">
            <svg viewBox="0 0 24 24" className="ie-toolbar-icon">
              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
            </svg>
            <span>Favorites</span>
          </button>
        </div>
      </div>

      {/* Address bar */}
      <div className="ie-addressbar">
        <span className="ie-addressbar-label">Address</span>
        <div className="ie-addressbar-input">
          <img src={faviconSrc} alt="" className="ie-addressbar-favicon" />
          <span className="ie-addressbar-url">{url}</span>
        </div>
        <button className="ie-addressbar-go">Go</button>
        <div className="ie-addressbar-links">Links</div>
      </div>

      {/* Content area */}
      <div className="ie-content">
        {children}
      </div>

      {/* Status bar */}
      <div className="ie-statusbar">
        <div className="ie-statusbar-left">
          <span className="ie-statusbar-icon">✓</span>
          <span>Done</span>
        </div>
        <div className="ie-statusbar-right">
          <span className="ie-statusbar-zone">Internet</span>
        </div>
      </div>
    </div>
  );
}
