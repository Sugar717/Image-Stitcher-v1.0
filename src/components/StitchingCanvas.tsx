/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { MicroscopeImage, GridCell, StitcherSettings } from '../types';
import { ZoomIn, ZoomOut, Maximize2, Move, HelpCircle, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';

interface StitchingCanvasProps {
  cells: GridCell[];
  setCells: React.Dispatch<React.SetStateAction<GridCell[]>>;
  images: MicroscopeImage[];
  settings: StitcherSettings;
  selectedCell: GridCell | null;
  onSelectCell: (cell: GridCell | null) => void;
  onUnassignCell: (row: number, col: number) => void;
}

export default function StitchingCanvas({
  cells,
  setCells,
  images,
  settings,
  selectedCell,
  onSelectCell,
  onUnassignCell,
}: StitchingCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Pan & Zoom state for workspace
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 50, y: 50 }); // Center-ish start offset in % or px
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Dragging individual cell offsets state
  const [isDraggingCell, setIsDraggingCell] = useState(false);
  const [dragStartMouse, setDragStartMouse] = useState({ x: 0, y: 0 });
  const [dragStartOffset, setDragStartOffset] = useState({ x: 0, y: 0 });

  // Tool status message
  const [toolMode, setToolMode] = useState<'select' | 'pan'>('select');

  // Find aspect ratio from loaded images, default to a clean 4:3 style square (e.g. 240x180)
  const imageMap = new Map<string, MicroscopeImage>();
  images.forEach((img) => imageMap.set(img.id, img));

  // Determine standard cell width and height
  const baseWidth = 220;
  let baseHeight = 165; // Default 4:3
  
  // Adjust baseHeight to match first placed image's aspect ratio
  const placedCells = cells.filter((c) => c.imageId !== null);
  if (placedCells.length > 0) {
    const firstPlacedImg = imageMap.get(placedCells[0].imageId!);
    if (firstPlacedImg && firstPlacedImg.croppedHeight > 0) {
      baseHeight = Math.round(baseWidth * (firstPlacedImg.croppedHeight / firstPlacedImg.croppedWidth));
    }
  } else if (images.length > 0) {
    // If no cell placed yet, but images are loaded
    baseHeight = Math.round(baseWidth * (images[0].croppedHeight / images[0].croppedWidth));
  }

  // Calculate grid layout sizes
  const R = settings.overlapRate;
  const spacingX = baseWidth * (1 - R);
  const spacingY = baseHeight * (1 - R);

  // Focus effect for arrow key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedCell) return;
      
      const step = e.shiftKey ? 10 : 1; // Step in full-resolution pixels
      let dx = 0;
      let dy = 0;

      if (e.key === 'ArrowUp') {
        dy = -step;
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        dy = step;
        e.preventDefault();
      } else if (e.key === 'ArrowLeft') {
        dx = -step;
        e.preventDefault();
      } else if (e.key === 'ArrowRight') {
        dx = step;
        e.preventDefault();
      }

      if (dx !== 0 || dy !== 0) {
        setCells((prev) =>
          prev.map((c) =>
            c.row === selectedCell.row && c.col === selectedCell.col
              ? { ...c, offsetX: c.offsetX + dx, offsetY: c.offsetY + dy }
              : c
          )
        );
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedCell, setCells]);

  // Handle overall workspace panning
  const handleMouseDown = (e: React.MouseEvent) => {
    // If right-click or middle-click or pan mode or clicking empty space
    const target = e.target as HTMLElement;
    const isCellClick = target.closest('[data-cell]');
    
    if (toolMode === 'pan' || !isCellClick || e.button === 1 || e.button === 2) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      e.preventDefault();
      return;
    }

    // Cell Dragging Alignment Action
    if (selectedCell && isCellClick) {
      const cellRow = parseInt(target.closest('[data-cell]')?.getAttribute('data-row') || '-1');
      const cellCol = parseInt(target.closest('[data-cell]')?.getAttribute('data-col') || '-1');

      if (cellRow === selectedCell.row && cellCol === selectedCell.col && selectedCell.imageId) {
        setIsDraggingCell(true);
        setDragStartMouse({ x: e.clientX, y: e.clientY });
        setDragStartOffset({ x: selectedCell.offsetX, y: selectedCell.offsetY });
        e.preventDefault();
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    } else if (isDraggingCell && selectedCell && selectedCell.imageId) {
      // Scale factor to convert display drag to full-resolution image pixels
      const img = imageMap.get(selectedCell.imageId);
      if (img) {
        const displayToOrigRatio = img.croppedWidth / baseWidth;
        const deltaX = (e.clientX - dragStartMouse.x) * displayToOrigRatio / zoom;
        const deltaY = (e.clientY - dragStartMouse.y) * displayToOrigRatio / zoom;

        setCells((prev) =>
          prev.map((c) =>
            c.row === selectedCell.row && c.col === selectedCell.col
              ? {
                  ...c,
                  offsetX: Math.round(dragStartOffset.x + deltaX),
                  offsetY: Math.round(dragStartOffset.y + deltaY),
                }
              : c
          )
        );
      }
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setIsDraggingCell(false);
  };

  const handleCellClick = (cell: GridCell, e: React.MouseEvent) => {
    e.stopPropagation();
    if (toolMode === 'pan') return;
    onSelectCell(cell);
  };

  const adjustOffsetManual = (dx: number, dy: number) => {
    if (!selectedCell) return;
    setCells((prev) =>
      prev.map((c) =>
        c.row === selectedCell.row && c.col === selectedCell.col
          ? { ...c, offsetX: c.offsetX + dx, offsetY: c.offsetY + dy }
          : c
      )
    );
  };

  const resetCellOffset = () => {
    if (!selectedCell) return;
    setCells((prev) =>
      prev.map((c) =>
        c.row === selectedCell.row && c.col === selectedCell.col
          ? { ...c, offsetX: 0, offsetY: 0 }
          : c
      )
    );
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 50, y: 50 });
  };

  return (
    <div id="stitching-canvas-panel" className="flex-1 bg-[#141414] relative overflow-hidden flex flex-col select-none">
      
      {/* Workspace Toolbar */}
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <div className="bg-[#1e1e1e]/95 backdrop-blur border border-[#2d2d2d] rounded-lg p-1 shadow-md flex items-center gap-1">
          <button
            onClick={() => setToolMode('select')}
            className={`p-1.5 rounded transition text-xs font-semibold flex items-center gap-1 cursor-pointer ${
              toolMode === 'select' ? 'bg-[#ff6400] text-white' : 'text-gray-400 hover:text-white'
            }`}
            title="選択 & アライメントドラッグ"
          >
            選択
          </button>
          <button
            onClick={() => setToolMode('pan')}
            className={`p-1.5 rounded transition text-xs font-semibold flex items-center gap-1 cursor-pointer ${
              toolMode === 'pan' ? 'bg-[#ff6400] text-white' : 'text-gray-400 hover:text-white'
            }`}
            title="キャンバスの並行移動"
          >
            <Move size={14} />
            画面移動
          </button>
        </div>

        <div className="bg-[#1e1e1e]/95 backdrop-blur border border-[#2d2d2d] rounded-lg p-1 shadow-md flex items-center gap-1">
          <button
            onClick={() => setZoom((z) => Math.max(0.2, z - 0.1))}
            className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-[#2d2d2d] transition cursor-pointer"
            title="ズームアウト"
          >
            <ZoomOut size={15} />
          </button>
          <span className="text-[10px] font-mono font-medium text-gray-400 px-1 w-12 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(3.0, z + 0.1))}
            className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-[#2d2d2d] transition cursor-pointer"
            title="ズームイン"
          >
            <ZoomIn size={15} />
          </button>
          <button
            onClick={resetView}
            className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-[#2d2d2d] transition cursor-pointer border-l border-[#2d2d2d] pl-2"
            title="表示をリセット"
          >
            <Maximize2 size={13} />
          </button>
        </div>
      </div>

      {/* Manual Fine Tuning Guide Card (Float in workspace) */}
      {selectedCell && (
        <div className="absolute top-4 right-4 z-10 bg-[#1e1e1e]/95 backdrop-blur border border-[#2d2d2d] rounded-lg p-3.5 shadow-lg w-64 space-y-3">
          <div className="flex justify-between items-center border-b border-[#2d2d2d] pb-2">
            <span className="text-xs font-bold text-gray-300">
              セル選択中: 行 {selectedCell.row + 1} × 列 {selectedCell.col + 1}
            </span>
            <button
              onClick={() => onSelectCell(null)}
              className="text-[10px] text-gray-500 hover:text-gray-300 transition"
            >
              閉じる
            </button>
          </div>

          {selectedCell.imageId ? (
            <div className="space-y-3">
              <div className="text-[11px] text-gray-400">
                <p className="font-medium text-gray-200 truncate">{imageMap.get(selectedCell.imageId)?.name}</p>
                <div className="flex gap-4 mt-1 font-mono text-xs">
                  <div>Xオフセット: <span className="text-[#ff6400] font-semibold">{selectedCell.offsetX} px</span></div>
                  <div>Yオフセット: <span className="text-[#ff6400] font-semibold">{selectedCell.offsetY} px</span></div>
                </div>
              </div>

              {/* D-Pad Arrows for Micro adjustment */}
              <div className="flex flex-col items-center gap-1 py-1">
                <button
                  onClick={() => adjustOffsetManual(0, -1)}
                  className="p-1 bg-[#2d2d2d] hover:bg-[#3d3d3d] border border-[#444] rounded text-white cursor-pointer transition"
                  title="上に1px移動 (Shiftキーで10px)"
                >
                  <ArrowUp size={14} />
                </button>
                <div className="flex items-center gap-5">
                  <button
                    onClick={() => adjustOffsetManual(-1, 0)}
                    className="p-1 bg-[#2d2d2d] hover:bg-[#3d3d3d] border border-[#444] rounded text-white cursor-pointer transition"
                    title="左に1px移動"
                  >
                    <ArrowLeft size={14} />
                  </button>
                  <button
                    onClick={resetCellOffset}
                    className="text-[10px] bg-[#252525] hover:bg-[#333] border border-[#444] px-1.5 py-1 text-gray-300 rounded cursor-pointer transition"
                    title="このセルのオフセットを0にリセット"
                  >
                    リセット
                  </button>
                  <button
                    onClick={() => adjustOffsetManual(1, 0)}
                    className="p-1 bg-[#2d2d2d] hover:bg-[#3d3d3d] border border-[#444] rounded text-white cursor-pointer transition"
                    title="右に1px移動"
                  >
                    <ArrowRight size={14} />
                  </button>
                </div>
                <button
                  onClick={() => adjustOffsetManual(0, 1)}
                  className="p-1 bg-[#2d2d2d] hover:bg-[#3d3d3d] border border-[#444] rounded text-white cursor-pointer transition"
                  title="下に1px移動"
                >
                  <ArrowDown size={14} />
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => onUnassignCell(selectedCell.row, selectedCell.col)}
                  className="w-full py-1.5 bg-red-950/65 hover:bg-red-900 border border-red-800 text-red-200 hover:text-white rounded text-[11px] font-medium transition cursor-pointer"
                >
                  セルから画像を解除
                </button>
              </div>

              <div className="text-[10px] text-gray-500 text-center leading-normal">
                ※キーボードの矢印キーでも微調整できます。<br />
                ※Shift + 矢印キーで 10px 移動します。<br />
                ※画像の上をマウスドラッグしても直感的に移動できます。
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-gray-500 py-2 text-center leading-relaxed">
              画像が割り当てられていません。<br />
              左側の読み込み画像一覧から画像をクリックして配置してください。
            </div>
          )}
        </div>
      )}

      {/* Main Canvas Area */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`flex-1 w-full h-full relative cursor-grab ${
          isPanning ? 'cursor-grabbing' : toolMode === 'pan' ? 'cursor-grab' : 'cursor-default'
        }`}
      >
        <div
          id="canvas-grid-container"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            transition: isPanning ? 'none' : 'transform 0.1s ease-out',
          }}
          className="absolute"
        >
          {/* Base Grid Background representation */}
          <div
            style={{
              width: `${settings.cols * spacingX + baseWidth * R + 60}px`,
              height: `${settings.rows * spacingY + baseHeight * R + 60}px`,
            }}
            className="border-2 border-dashed border-[#222] bg-[#0c0c0c] rounded-xl p-6 shadow-2xl relative"
          >
            
            {/* Rows / Cols rendering */}
            {Array.from({ length: settings.rows }).map((_, r) =>
              Array.from({ length: settings.cols }).map((_, c) => {
                const cell = cells.find((cell) => cell.row === r && cell.col === c);
                if (!cell) return null;

                const isSelected = selectedCell?.row === r && selectedCell?.col === c;
                const img = cell.imageId ? imageMap.get(cell.imageId) : null;

                // Scale factor for display offset rendering
                let renderOffsetX = 0;
                let renderOffsetY = 0;
                if (img) {
                  const scale = baseWidth / img.croppedWidth;
                  renderOffsetX = cell.offsetX * scale;
                  renderOffsetY = cell.offsetY * scale;
                }

                // Coordinates for drawing
                const x = c * spacingX + renderOffsetX;
                const y = r * spacingY + renderOffsetY;

                return (
                  <div
                    key={`${r}-${c}`}
                    data-cell
                    data-row={r}
                    data-col={c}
                    onClick={(e) => handleCellClick(cell, e)}
                    style={{
                      position: 'absolute',
                      left: `${x + 24}px`, // Adjusted for outer padding
                      top: `${y + 24}px`,
                      width: `${baseWidth}px`,
                      height: `${baseHeight}px`,
                      zIndex: isSelected ? 30 : img ? 10 : 5,
                    }}
                    className={`rounded border transition-all relative select-none flex items-center justify-center overflow-hidden ${
                      isSelected
                        ? 'border-[#ff6400] ring-2 ring-[#ff6400]/40 shadow-lg'
                        : 'border-[#2d2d2d] hover:border-gray-600'
                    } ${img ? 'bg-black/40' : 'bg-[#181818]'}`}
                  >
                    {img ? (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          opacity: settings.displayOpacity,
                          mixBlendMode: settings.blendMode as any,
                        }}
                        className="pointer-events-none"
                      >
                        <img
                          src={img.croppedUrl}
                          alt={img.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ) : (
                      <div className="text-center p-3 pointer-events-none select-none">
                        <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-1">
                          CELL {r + 1}-{c + 1}
                        </p>
                        <p className="text-[9px] text-gray-500 leading-tight">未配置</p>
                      </div>
                    )}

                    {/* Miniature label */}
                    <div className="absolute bottom-1 right-1.5 px-1 py-0.5 rounded bg-black/70 text-[8px] text-gray-400 font-mono pointer-events-none z-10 border border-[#2d2d2d]">
                      {r + 1}, {c + 1}
                    </div>

                    {/* Overlap Guidelines overlaid on top of cell */}
                    {settings.showGuides && (
                      <div className="absolute inset-0 pointer-events-none z-20">
                        {/* Right Overlap Guide */}
                        {c < settings.cols - 1 && (
                          <div
                            style={{
                              position: 'absolute',
                              right: 0,
                              top: 0,
                              width: `${baseWidth * R}px`,
                              height: '100%',
                            }}
                            className="border-l border-dashed border-[#ff6400]/80 bg-[#ff6400]/5"
                          />
                        )}

                        {/* Bottom Overlap Guide */}
                        {r < settings.rows - 1 && (
                          <div
                            style={{
                              position: 'absolute',
                              bottom: 0,
                              left: 0,
                              width: '100%',
                              height: `${baseHeight * R}px`,
                            }}
                            className="border-t border-dashed border-[#ff6400]/80 bg-[#ff6400]/5"
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
