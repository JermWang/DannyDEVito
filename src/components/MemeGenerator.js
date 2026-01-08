"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const STICKERS = [
  { id: "danny-decheeto", src: "/danny-decheeto.png", name: "Danny Decheeto" },
  { id: "danny-glocked", src: "/danny-glocked-up.png", name: "Danny Glocked Up" },
  { id: "devito-logo", src: "/1.png", name: "DEVito Logo" },
  { id: "devito-text", src: "/DEVito.png", name: "DEVito Text" },
];

const CANVAS_SIZES = [
  { label: "1000×1000", width: 1000, height: 1000 },
  { label: "500×500", width: 500, height: 500 },
];

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

export default function MemeGenerator() {
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const [canvasSize, setCanvasSize] = useState(CANVAS_SIZES[0]);
  const [backgroundImage, setBackgroundImage] = useState(null);
  const [stickers, setStickers] = useState([]);
  const [selectedSticker, setSelectedSticker] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [resizeCorner, setResizeCorner] = useState(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [cursorStyle, setCursorStyle] = useState("default");
  const [hoverState, setHoverState] = useState(null); // "move", "resize-nw", "resize-ne", "resize-sw", "resize-se", "rotate"
  const [uniformScale, setUniformScale] = useState(true); // Default to uniform scaling

  // Render canvas
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw checkerboard background (transparency indicator)
    const tileSize = 20;
    for (let y = 0; y < canvas.height; y += tileSize) {
      for (let x = 0; x < canvas.width; x += tileSize) {
        ctx.fillStyle = ((x + y) / tileSize) % 2 === 0 ? "#ffffff" : "#e0e0e0";
        ctx.fillRect(x, y, tileSize, tileSize);
      }
    }
    
    // Draw background image
    if (backgroundImage) {
      ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
    }
    
    // Draw stickers
    stickers.forEach((sticker) => {
      if (!sticker.img) return;
      
      ctx.save();
      ctx.translate(sticker.x + sticker.width / 2, sticker.y + sticker.height / 2);
      ctx.rotate((sticker.rotation * Math.PI) / 180);
      ctx.drawImage(
        sticker.img,
        -sticker.width / 2,
        -sticker.height / 2,
        sticker.width,
        sticker.height
      );
      ctx.restore();
      
      // Draw selection box if selected
      if (selectedSticker === sticker.id) {
        ctx.save();
        ctx.translate(sticker.x + sticker.width / 2, sticker.y + sticker.height / 2);
        ctx.rotate((sticker.rotation * Math.PI) / 180);
        
        // Selection border
        ctx.strokeStyle = "#00BFFF";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(-sticker.width / 2 - 2, -sticker.height / 2 - 2, sticker.width + 4, sticker.height + 4);
        
        // Corner handles
        ctx.setLineDash([]);
        ctx.fillStyle = "#00BFFF";
        const handleSize = 8;
        const corners = [
          [-sticker.width / 2, -sticker.height / 2],
          [sticker.width / 2, -sticker.height / 2],
          [-sticker.width / 2, sticker.height / 2],
          [sticker.width / 2, sticker.height / 2],
        ];
        corners.forEach(([cx, cy]) => {
          ctx.fillRect(cx - handleSize / 2, cy - handleSize / 2, handleSize, handleSize);
        });
        
        // Rotation handle
        ctx.beginPath();
        ctx.moveTo(0, -sticker.height / 2 - 2);
        ctx.lineTo(0, -sticker.height / 2 - 25);
        ctx.strokeStyle = "#00BFFF";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, -sticker.height / 2 - 25, 6, 0, Math.PI * 2);
        ctx.fillStyle = "#00BFFF";
        ctx.fill();
        
        ctx.restore();
      }
    });
  }, [backgroundImage, stickers, selectedSticker]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // Handle file upload
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Determine best canvas size
        const maxDim = Math.max(img.width, img.height);
        const bestSize = maxDim > 750 ? CANVAS_SIZES[0] : CANVAS_SIZES[1];
        setCanvasSize(bestSize);
        setBackgroundImage(img);
      };
      img.src = event.target?.result;
    };
    reader.readAsDataURL(file);
  };

  // Add sticker to canvas
  const addSticker = (stickerData) => {
    const img = new Image();
    img.onload = () => {
      const aspectRatio = img.width / img.height;
      const defaultHeight = 150;
      const defaultWidth = defaultHeight * aspectRatio;
      
      setStickers((prev) => [
        ...prev,
        {
          id: generateId(),
          src: stickerData.src,
          img,
          x: canvasSize.width / 2 - defaultWidth / 2,
          y: canvasSize.height / 2 - defaultHeight / 2,
          width: defaultWidth,
          height: defaultHeight,
          rotation: 0,
        },
      ]);
    };
    img.src = stickerData.src;
  };

  // Get mouse position relative to canvas
  const getMousePos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  // Check if point is in sticker
  const getStickerAtPoint = (x, y) => {
    for (let i = stickers.length - 1; i >= 0; i--) {
      const s = stickers[i];
      // Simple bounding box check (not accounting for rotation for simplicity)
      if (x >= s.x && x <= s.x + s.width && y >= s.y && y <= s.y + s.height) {
        return s;
      }
    }
    return null;
  };

  // Check which resize handle point is on (returns corner name or null)
  const getResizeHandle = (x, y, sticker) => {
    if (!sticker) return null;
    const handleSize = 18;
    const corners = [
      { name: "nw", x: sticker.x, y: sticker.y },
      { name: "ne", x: sticker.x + sticker.width, y: sticker.y },
      { name: "sw", x: sticker.x, y: sticker.y + sticker.height },
      { name: "se", x: sticker.x + sticker.width, y: sticker.y + sticker.height },
    ];
    for (const corner of corners) {
      if (Math.abs(x - corner.x) < handleSize && Math.abs(y - corner.y) < handleSize) {
        return corner.name;
      }
    }
    return null;
  };

  // Check if point is on rotation handle
  const isOnRotationHandle = (x, y, sticker) => {
    if (!sticker) return false;
    const handleX = sticker.x + sticker.width / 2;
    const handleY = sticker.y - 25;
    return Math.sqrt((x - handleX) ** 2 + (y - handleY) ** 2) < 18;
  };

  // Get cursor style based on position
  const getCursorForPosition = (x, y) => {
    const selected = stickers.find((s) => s.id === selectedSticker);
    
    if (selected) {
      if (isOnRotationHandle(x, y, selected)) {
        return "grab";
      }
      const corner = getResizeHandle(x, y, selected);
      if (corner === "nw" || corner === "se") return "nwse-resize";
      if (corner === "ne" || corner === "sw") return "nesw-resize";
    }
    
    const hoveredSticker = getStickerAtPoint(x, y);
    if (hoveredSticker) {
      return "move";
    }
    
    return "default";
  };

  // Mouse down handler
  const handleMouseDown = (e) => {
    const pos = getMousePos(e);
    
    // Check if clicking on selected sticker's handles
    const selected = stickers.find((s) => s.id === selectedSticker);
    
    if (selected && isOnRotationHandle(pos.x, pos.y, selected)) {
      setIsRotating(true);
      setCursorStyle("grabbing");
      setDragStart(pos);
      return;
    }
    
    const corner = selected ? getResizeHandle(pos.x, pos.y, selected) : null;
    if (corner) {
      setIsResizing(true);
      setResizeCorner(corner);
      setDragStart({ x: pos.x, y: pos.y, origX: selected.x, origY: selected.y, origW: selected.width, origH: selected.height });
      return;
    }
    
    // Check if clicking on a sticker
    const clickedSticker = getStickerAtPoint(pos.x, pos.y);
    if (clickedSticker) {
      setSelectedSticker(clickedSticker.id);
      setIsDragging(true);
      setCursorStyle("grabbing");
      setDragStart({
        x: pos.x - clickedSticker.x,
        y: pos.y - clickedSticker.y,
      });
    } else {
      setSelectedSticker(null);
    }
  };

  // Mouse move handler
  const handleMouseMove = (e) => {
    const pos = getMousePos(e);
    const selected = stickers.find((s) => s.id === selectedSticker);
    
    if (isDragging && selected) {
      setStickers((prev) =>
        prev.map((s) =>
          s.id === selectedSticker
            ? { ...s, x: pos.x - dragStart.x, y: pos.y - dragStart.y }
            : s
        )
      );
    } else if (isResizing && selected && resizeCorner) {
      // Calculate new dimensions based on which corner is being dragged
      const dx = pos.x - dragStart.x;
      const dy = pos.y - dragStart.y;
      const aspectRatio = dragStart.origW / dragStart.origH;
      
      let newX = dragStart.origX;
      let newY = dragStart.origY;
      let newW = dragStart.origW;
      let newH = dragStart.origH;
      
      if (resizeCorner === "se") {
        if (uniformScale) {
          // Use the larger delta to determine scale
          const scale = Math.max(dx / dragStart.origW, dy / dragStart.origH);
          newW = Math.max(30, dragStart.origW * (1 + scale));
          newH = Math.max(30, dragStart.origH * (1 + scale));
        } else {
          newW = Math.max(30, dragStart.origW + dx);
          newH = Math.max(30, dragStart.origH + dy);
        }
      } else if (resizeCorner === "sw") {
        if (uniformScale) {
          const scale = Math.max(-dx / dragStart.origW, dy / dragStart.origH);
          newW = Math.max(30, dragStart.origW * (1 + scale));
          newH = Math.max(30, dragStart.origH * (1 + scale));
          newX = dragStart.origX + dragStart.origW - newW;
        } else {
          newX = Math.min(dragStart.origX + dragStart.origW - 30, dragStart.origX + dx);
          newW = Math.max(30, dragStart.origW - dx);
          newH = Math.max(30, dragStart.origH + dy);
        }
      } else if (resizeCorner === "ne") {
        if (uniformScale) {
          const scale = Math.max(dx / dragStart.origW, -dy / dragStart.origH);
          newW = Math.max(30, dragStart.origW * (1 + scale));
          newH = Math.max(30, dragStart.origH * (1 + scale));
          newY = dragStart.origY + dragStart.origH - newH;
        } else {
          newY = Math.min(dragStart.origY + dragStart.origH - 30, dragStart.origY + dy);
          newW = Math.max(30, dragStart.origW + dx);
          newH = Math.max(30, dragStart.origH - dy);
        }
      } else if (resizeCorner === "nw") {
        if (uniformScale) {
          const scale = Math.max(-dx / dragStart.origW, -dy / dragStart.origH);
          newW = Math.max(30, dragStart.origW * (1 + scale));
          newH = Math.max(30, dragStart.origH * (1 + scale));
          newX = dragStart.origX + dragStart.origW - newW;
          newY = dragStart.origY + dragStart.origH - newH;
        } else {
          newX = Math.min(dragStart.origX + dragStart.origW - 30, dragStart.origX + dx);
          newY = Math.min(dragStart.origY + dragStart.origH - 30, dragStart.origY + dy);
          newW = Math.max(30, dragStart.origW - dx);
          newH = Math.max(30, dragStart.origH - dy);
        }
      }
      
      setStickers((prev) =>
        prev.map((s) =>
          s.id === selectedSticker
            ? { ...s, x: newX, y: newY, width: newW, height: newH }
            : s
        )
      );
    } else if (isRotating && selected) {
      const centerX = selected.x + selected.width / 2;
      const centerY = selected.y + selected.height / 2;
      const angle = Math.atan2(pos.y - centerY, pos.x - centerX) * (180 / Math.PI) + 90;
      
      setStickers((prev) =>
        prev.map((s) =>
          s.id === selectedSticker ? { ...s, rotation: angle } : s
        )
      );
    } else {
      // Update cursor based on hover position
      const newCursor = getCursorForPosition(pos.x, pos.y);
      if (newCursor !== cursorStyle) {
        setCursorStyle(newCursor);
      }
    }
  };

  // Mouse up handler
  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
    setIsRotating(false);
    setResizeCorner(null);
    setCursorStyle("default");
  };

  // Delete selected sticker
  const deleteSelected = () => {
    if (selectedSticker) {
      setStickers((prev) => prev.filter((s) => s.id !== selectedSticker));
      setSelectedSticker(null);
    }
  };

  // Duplicate selected sticker
  const duplicateSelected = () => {
    const selected = stickers.find((s) => s.id === selectedSticker);
    if (selected) {
      setStickers((prev) => [
        ...prev,
        {
          ...selected,
          id: generateId(),
          x: selected.x + 20,
          y: selected.y + 20,
        },
      ]);
    }
  };

  // Bring to front
  const bringToFront = () => {
    if (selectedSticker) {
      setStickers((prev) => {
        const selected = prev.find((s) => s.id === selectedSticker);
        const others = prev.filter((s) => s.id !== selectedSticker);
        return [...others, selected];
      });
    }
  };

  // Send to back
  const sendToBack = () => {
    if (selectedSticker) {
      setStickers((prev) => {
        const selected = prev.find((s) => s.id === selectedSticker);
        const others = prev.filter((s) => s.id !== selectedSticker);
        return [selected, ...others];
      });
    }
  };

  // Download image
  const downloadImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Create a temporary canvas without selection indicators
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const ctx = tempCanvas.getContext("2d");
    
    // Draw background if exists, otherwise leave transparent for PNG
    if (backgroundImage) {
      ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
    }
    // No background = transparent PNG (don't fill with white)
    
    // Draw stickers without selection
    stickers.forEach((sticker) => {
      if (!sticker.img) return;
      ctx.save();
      ctx.translate(sticker.x + sticker.width / 2, sticker.y + sticker.height / 2);
      ctx.rotate((sticker.rotation * Math.PI) / 180);
      ctx.drawImage(
        sticker.img,
        -sticker.width / 2,
        -sticker.height / 2,
        sticker.width,
        sticker.height
      );
      ctx.restore();
    });
    
    // Download as PNG (preserves transparency)
    const link = document.createElement("a");
    link.download = `devito-meme-${Date.now()}.png`;
    link.href = tempCanvas.toDataURL("image/png");
    link.click();
  };

  // Clear all
  const clearAll = () => {
    setStickers([]);
    setBackgroundImage(null);
    setSelectedSticker(null);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        deleteSelected();
      } else if (e.key === "d" && e.ctrlKey) {
        e.preventDefault();
        duplicateSelected();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedSticker, stickers]);

  return (
    <div className="flex flex-col h-full bg-[#c0c0c0]">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-1 bg-[#c0c0c0] border-b border-[#808080]">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-2 py-1 text-xs bg-[#c0c0c0] border-2 hover:bg-[#d0d0d0]"
          style={{ borderColor: "#ffffff #808080 #808080 #ffffff" }}
        >
          📁 Upload
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />
        
        <div className="w-px h-5 bg-[#808080] mx-1" />
        
        <select
          value={`${canvasSize.width}x${canvasSize.height}`}
          onChange={(e) => {
            const [w, h] = e.target.value.split("x").map(Number);
            setCanvasSize({ width: w, height: h, label: e.target.value });
          }}
          className="px-1 py-0.5 text-xs border border-[#808080] bg-white"
        >
          {CANVAS_SIZES.map((size) => (
            <option key={size.label} value={`${size.width}x${size.height}`}>
              {size.label}
            </option>
          ))}
        </select>
        
        <div className="w-px h-5 bg-[#808080] mx-1" />
        
        <label className="flex items-center gap-1 text-[10px] cursor-pointer select-none" title="Keep aspect ratio when resizing">
          <input
            type="checkbox"
            checked={uniformScale}
            onChange={(e) => setUniformScale(e.target.checked)}
            className="w-3 h-3"
          />
          <span>Uniform</span>
        </label>
        
        <div className="w-px h-5 bg-[#808080] mx-1" />
        
        <button
          onClick={deleteSelected}
          disabled={!selectedSticker}
          className="px-2 py-1 text-xs bg-[#c0c0c0] border-2 disabled:opacity-50"
          style={{ borderColor: "#ffffff #808080 #808080 #ffffff" }}
          title="Delete (Del)"
        >
          🗑️
        </button>
        <button
          onClick={duplicateSelected}
          disabled={!selectedSticker}
          className="px-2 py-1 text-xs bg-[#c0c0c0] border-2 disabled:opacity-50"
          style={{ borderColor: "#ffffff #808080 #808080 #ffffff" }}
          title="Duplicate (Ctrl+D)"
        >
          📋
        </button>
        <button
          onClick={bringToFront}
          disabled={!selectedSticker}
          className="px-2 py-1 text-xs bg-[#c0c0c0] border-2 disabled:opacity-50"
          style={{ borderColor: "#ffffff #808080 #808080 #ffffff" }}
          title="Bring to Front"
        >
          ⬆️
        </button>
        <button
          onClick={sendToBack}
          disabled={!selectedSticker}
          className="px-2 py-1 text-xs bg-[#c0c0c0] border-2 disabled:opacity-50"
          style={{ borderColor: "#ffffff #808080 #808080 #ffffff" }}
          title="Send to Back"
        >
          ⬇️
        </button>
        
        <div className="flex-1" />
        
        <button
          onClick={clearAll}
          className="px-2 py-1 text-xs bg-[#c0c0c0] border-2"
          style={{ borderColor: "#ffffff #808080 #808080 #ffffff" }}
        >
          🧹 Clear
        </button>
        <button
          onClick={downloadImage}
          className="px-2 py-1 text-xs bg-[#008000] text-white border-2 font-bold"
          style={{ borderColor: "#00FF00 #004000 #004000 #00FF00" }}
        >
          💾 Download
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sticker panel */}
        <div className="w-32 bg-[#c0c0c0] border-r border-[#808080] p-1 overflow-y-auto">
          <div className="text-[10px] font-bold text-center mb-1 bg-[#000080] text-white py-0.5">
            STICKERS
          </div>
          <div className="grid grid-cols-2 gap-1">
            {STICKERS.map((sticker) => (
              <button
                key={sticker.id}
                onClick={() => addSticker(sticker)}
                className="p-1 bg-white border border-[#808080] hover:bg-[#e0e0e0] aspect-square flex items-center justify-center"
                title={sticker.name}
              >
                <img
                  src={sticker.src}
                  alt={sticker.name}
                  className="max-w-full max-h-full object-contain"
                />
              </button>
            ))}
          </div>
          <div className="mt-2 text-[9px] text-[#808080] text-center">
            Click to add
          </div>
        </div>

        {/* Canvas area */}
        <div className="flex-1 overflow-auto p-2 bg-[#808080] flex items-center justify-center">
          <canvas
            ref={canvasRef}
            width={canvasSize.width}
            height={canvasSize.height}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="border-2 border-[#404040] shadow-lg"
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", cursor: cursorStyle }}
          />
        </div>

        {/* Properties panel */}
        {selectedSticker && (
          <div className="w-36 bg-[#c0c0c0] border-l border-[#808080] p-1 text-xs">
            <div className="text-[10px] font-bold text-center mb-1 bg-[#000080] text-white py-0.5">
              TRANSFORM
            </div>
            {(() => {
              const selected = stickers.find((s) => s.id === selectedSticker);
              if (!selected) return null;
              return (
                <div className="space-y-1">
                  <div>
                    <label className="text-[9px] text-[#808080]">X:</label>
                    <input
                      type="number"
                      value={Math.round(selected.x)}
                      onChange={(e) =>
                        setStickers((prev) =>
                          prev.map((s) =>
                            s.id === selectedSticker
                              ? { ...s, x: Number(e.target.value) }
                              : s
                          )
                        )
                      }
                      className="w-full px-1 py-0.5 border border-[#808080] text-[10px]"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-[#808080]">Y:</label>
                    <input
                      type="number"
                      value={Math.round(selected.y)}
                      onChange={(e) =>
                        setStickers((prev) =>
                          prev.map((s) =>
                            s.id === selectedSticker
                              ? { ...s, y: Number(e.target.value) }
                              : s
                          )
                        )
                      }
                      className="w-full px-1 py-0.5 border border-[#808080] text-[10px]"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-[#808080]">Width:</label>
                    <input
                      type="number"
                      value={Math.round(selected.width)}
                      onChange={(e) =>
                        setStickers((prev) =>
                          prev.map((s) =>
                            s.id === selectedSticker
                              ? { ...s, width: Number(e.target.value) }
                              : s
                          )
                        )
                      }
                      className="w-full px-1 py-0.5 border border-[#808080] text-[10px]"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-[#808080]">Height:</label>
                    <input
                      type="number"
                      value={Math.round(selected.height)}
                      onChange={(e) =>
                        setStickers((prev) =>
                          prev.map((s) =>
                            s.id === selectedSticker
                              ? { ...s, height: Number(e.target.value) }
                              : s
                          )
                        )
                      }
                      className="w-full px-1 py-0.5 border border-[#808080] text-[10px]"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-[#808080]">Rotation:</label>
                    <input
                      type="number"
                      value={Math.round(selected.rotation)}
                      onChange={(e) =>
                        setStickers((prev) =>
                          prev.map((s) =>
                            s.id === selectedSticker
                              ? { ...s, rotation: Number(e.target.value) }
                              : s
                          )
                        )
                      }
                      className="w-full px-1 py-0.5 border border-[#808080] text-[10px]"
                    />
                  </div>
                  <button
                    onClick={() => {
                      setStickers((prev) =>
                        prev.map((s) =>
                          s.id === selectedSticker ? { ...s, rotation: 0 } : s
                        )
                      );
                    }}
                    className="w-full px-1 py-0.5 text-[10px] bg-[#c0c0c0] border"
                    style={{ borderColor: "#ffffff #808080 #808080 #ffffff" }}
                  >
                    Reset Rotation
                  </button>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-2 py-0.5 bg-[#c0c0c0] border-t border-[#ffffff] text-[10px]">
        <span>
          Canvas: {canvasSize.width}×{canvasSize.height} | Stickers: {stickers.length}
        </span>
        <span>
          {selectedSticker ? "Selected: Drag to move, corners to resize, top handle to rotate" : "Click a sticker to select"}
        </span>
      </div>
    </div>
  );
}
