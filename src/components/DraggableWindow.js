"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export default function DraggableWindow({
  title = "Window",
  icon = null,
  children,
  defaultPosition = { x: 100, y: 100 },
  defaultSize = { width: 400, height: 300 },
  minSize = { width: 200, height: 150 },
  isOpen = true,
  onClose,
  onMinimize,
  zIndex = 10,
  onFocus,
}) {
  const [position, setPosition] = useState(defaultPosition);
  const [size, setSize] = useState(defaultSize);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDir, setResizeDir] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const windowRef = useRef(null);

  const handleMouseDown = useCallback((e) => {
    if (e.target.closest(".window-controls")) return;
    setIsDragging(true);
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
    onFocus?.();
  }, [position, onFocus]);

  const handleResizeMouseDown = useCallback((e, direction = "se") => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeDir(direction);
    dragOffset.current = {
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
      posX: position.x,
      posY: position.y,
    };
    onFocus?.();
  }, [size, position, onFocus]);

  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const handleMouseMove = (e) => {
      if (isDragging) {
        setPosition({
          x: Math.max(0, e.clientX - dragOffset.current.x),
          y: Math.max(0, e.clientY - dragOffset.current.y),
        });
      } else if (isResizing && resizeDir) {
        const deltaX = e.clientX - dragOffset.current.x;
        const deltaY = e.clientY - dragOffset.current.y;
        
        let newWidth = dragOffset.current.width;
        let newHeight = dragOffset.current.height;
        let newX = dragOffset.current.posX;
        let newY = dragOffset.current.posY;
        
        // Handle horizontal resizing
        if (resizeDir.includes("e")) {
          newWidth = Math.max(minSize.width, dragOffset.current.width + deltaX);
        }
        if (resizeDir.includes("w")) {
          const maxDeltaX = dragOffset.current.width - minSize.width;
          const clampedDeltaX = Math.min(deltaX, maxDeltaX);
          newWidth = Math.max(minSize.width, dragOffset.current.width - clampedDeltaX);
          newX = dragOffset.current.posX + clampedDeltaX;
        }
        
        // Handle vertical resizing
        if (resizeDir.includes("s")) {
          newHeight = Math.max(minSize.height, dragOffset.current.height + deltaY);
        }
        if (resizeDir.includes("n")) {
          const maxDeltaY = dragOffset.current.height - minSize.height;
          const clampedDeltaY = Math.min(deltaY, maxDeltaY);
          newHeight = Math.max(minSize.height, dragOffset.current.height - clampedDeltaY);
          newY = dragOffset.current.posY + clampedDeltaY;
        }
        
        setSize({ width: newWidth, height: newHeight });
        setPosition({ x: newX, y: newY });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      setResizeDir(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, isResizing, resizeDir, minSize]);

  if (!isOpen) return null;

  return (
    <div
      ref={windowRef}
      className="win-window"
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        width: size.width,
        height: isMinimized ? "auto" : size.height,
        zIndex,
        userSelect: isDragging || isResizing ? "none" : "auto",
      }}
      onMouseDown={onFocus}
    >
      {/* Title bar */}
      <div
        className="win-titlebar"
        onMouseDown={handleMouseDown}
        style={{ cursor: isDragging ? "grabbing" : "grab" }}
      >
        <div className="win-titlebar-left">
          {icon && <span className="win-titlebar-icon">{icon}</span>}
          <span className="win-titlebar-title">{title}</span>
        </div>
        <div className="window-controls win-titlebar-buttons">
          <button
            type="button"
            className="win-btn win-btn-minimize"
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? "Restore" : "Minimize"}
          >
            {isMinimized ? "□" : "_"}
          </button>
          {onClose && (
            <button
              type="button"
              className="win-btn win-btn-close"
              onClick={onClose}
              title="Close"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {!isMinimized && (
        <div className="win-content">
          {children}
        </div>
      )}

      {/* Resize handles - all corners and edges */}
      {!isMinimized && (
        <>
          {/* Corner handles */}
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-10"
            onMouseDown={(e) => handleResizeMouseDown(e, "se")}
          />
          <div
            className="absolute bottom-0 left-0 w-4 h-4 cursor-sw-resize z-10"
            onMouseDown={(e) => handleResizeMouseDown(e, "sw")}
          />
          <div
            className="absolute top-6 right-0 w-4 h-4 cursor-ne-resize z-10"
            onMouseDown={(e) => handleResizeMouseDown(e, "ne")}
          />
          <div
            className="absolute top-6 left-0 w-4 h-4 cursor-nw-resize z-10"
            onMouseDown={(e) => handleResizeMouseDown(e, "nw")}
          />
          {/* Edge handles */}
          <div
            className="absolute bottom-0 left-4 right-4 h-2 cursor-s-resize z-10"
            onMouseDown={(e) => handleResizeMouseDown(e, "s")}
          />
          <div
            className="absolute top-6 left-4 right-4 h-2 cursor-n-resize z-10"
            onMouseDown={(e) => handleResizeMouseDown(e, "n")}
          />
          <div
            className="absolute left-0 top-10 bottom-4 w-2 cursor-w-resize z-10"
            onMouseDown={(e) => handleResizeMouseDown(e, "w")}
          />
          <div
            className="absolute right-0 top-10 bottom-4 w-2 cursor-e-resize z-10"
            onMouseDown={(e) => handleResizeMouseDown(e, "e")}
          />
        </>
      )}
    </div>
  );
}
