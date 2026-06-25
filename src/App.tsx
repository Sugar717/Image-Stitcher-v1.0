/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { MicroscopeImage, GridCell, StitcherSettings } from './types';
import Sidebar from './components/Sidebar';
import ControlPanel from './components/ControlPanel';
import StitchingCanvas from './components/StitchingCanvas';
import { stitchImages, autoAlignGrid } from './utils';
import { Image as ImageIcon, Sparkles, CheckCircle, Info, Loader2 } from 'lucide-react';

export default function App() {
  // 1. Initial settings
  const [settings, setSettings] = useState<StitcherSettings>({
    rows: 2,
    cols: 2,
    overlapRate: 0.20, // Default 20%
    cropBottomPx: 100, // Default 100px bottom strip cut
    displayOpacity: 0.85,
    blendMode: 'normal',
    showGuides: true,
    gridCellWidth: 220,
    gridCellHeight: 165,
  });

  // 2. Images and layout states
  const [images, setImages] = useState<MicroscopeImage[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [cells, setCells] = useState<GridCell[]>([]);
  const [selectedCell, setSelectedCell] = useState<GridCell | null>(null);
  const [isStitching, setIsStitching] = useState(false);
  const [isAligning, setIsAligning] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<boolean>(false);

  // 3. Grid cell generator (preserves existing cells on rows/cols resizing)
  useEffect(() => {
    setCells((prev) => {
      const newCells: GridCell[] = [];
      for (let r = 0; r < settings.rows; r++) {
        for (let c = 0; c < settings.cols; c++) {
          const existing = prev.find((item) => item.row === r && item.col === c);
          newCells.push(
            existing || {
              row: r,
              col: c,
              imageId: null,
              offsetX: 0,
              offsetY: 0,
            }
          );
        }
      }
      return newCells;
    });
  }, [settings.rows, settings.cols]);

  // Sync selectedCell with updated cells state if offset changes
  const activeSelectedCell = cells.find(
    (c) => selectedCell && c.row === selectedCell.row && c.col === selectedCell.col
  ) || null;

  // 4. Sidebar clicked image handler
  const handleSelectImage = (imgId: string | null) => {
    setSelectedImageId(imgId);
    
    // Auto-place if a cell is selected
    if (imgId && activeSelectedCell) {
      setCells((prev) =>
        prev.map((c) =>
          c.row === activeSelectedCell.row && c.col === activeSelectedCell.col
            ? { ...c, imageId: imgId }
            : c
        )
      );
    }
  };

  // 5. Unassign image from cell
  const handleUnassignCell = (row: number, col: number) => {
    setCells((prev) =>
      prev.map((c) =>
        c.row === row && c.col === col ? { ...c, imageId: null, offsetX: 0, offsetY: 0 } : c
      )
    );
  };

  // 6. Reset offsets
  const handleResetOffsets = () => {
    setCells((prev) => prev.map((c) => ({ ...c, offsetX: 0, offsetY: 0 })));
  };

  // 7. Clear Grid
  const handleClearGrid = () => {
    setCells((prev) => prev.map((c) => ({ ...c, imageId: null, offsetX: 0, offsetY: 0 })));
    setSelectedCell(null);
  };

  // 8. Crop completion callback
  const handleCropComplete = (updatedImages: MicroscopeImage[]) => {
    // If any placed image had changed URLs, they are updated implicitly by rendering croppedUrl.
    // However, if we need to adjust cells, we can do it here. For now standard render handles it automatically.
  };

  // 9. Auto alignment trigger
  const handleAutoAlign = async () => {
    setIsAligning(true);
    setExportError(null);
    try {
      const alignedCells = await autoAlignGrid(cells, images, settings.overlapRate);
      setCells(alignedCells);
    } catch (err: any) {
      console.error('Auto alignment failed:', err);
      setExportError('自動アライメント調整に失敗しました。画像のオーバーラップ部分が十分に特徴的かご確認ください。');
    } finally {
      setIsAligning(false);
    }
  };

  // 10. Full-resolution Export/Stitching
  const handleExport = async () => {
    setIsStitching(true);
    setExportError(null);
    setExportSuccess(false);

    try {
      const resultUrl = await stitchImages(cells, images, settings.overlapRate);
      
      // Trigger download
      const link = document.createElement('a');
      link.href = resultUrl;
      link.download = `stitched_microscope_image_${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Show success
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 5000);
    } catch (err: any) {
      console.error('Stitching failed:', err);
      setExportError(err?.message || 'スティッチング合成の出力に失敗しました。画像のサイズやメモリ容量をご確認ください。');
    } finally {
      setIsStitching(false);
    }
  };

  const placedCount = cells.filter((c) => c.imageId !== null).length;

  return (
    <div className="flex flex-col h-screen bg-[#141414] text-gray-200 font-sans overflow-hidden">
      
      {/* Top Application Header Bar */}
      <header className="bg-[#1e1e1e] border-b border-[#2d2d2d] px-5 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-[#ff6400] text-white p-1.5 rounded-lg">
            <ImageIcon size={20} />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-wider text-white">MICROSCOPE IMAGE STITCHER</h1>
            <p className="text-[10px] text-gray-500 font-medium">顕微鏡写真グリッドスティッチング & アライメント精密調整ツール v1.0</p>
          </div>
        </div>

        {/* Status / Quick Stats */}
        <div className="flex items-center gap-4 text-xs">
          {isAligning && (
            <div className="flex items-center gap-2 text-orange-400 bg-orange-950/40 border border-[#e05800]/50 px-2.5 py-1 rounded">
              <Loader2 size={14} className="animate-spin" />
              <span>隣接オーバーラップ領域を自動解析中...</span>
            </div>
          )}

          {exportSuccess && (
            <div className="flex items-center gap-1 text-emerald-400 bg-emerald-950/40 border border-emerald-800/80 px-2.5 py-1 rounded">
              <CheckCircle size={14} />
              <span>合成画像を出力しました！</span>
            </div>
          )}

          {exportError && (
            <div className="flex items-center gap-1.5 text-red-400 bg-red-950/40 border border-red-900 px-2.5 py-1 rounded">
              <span>エラー: {exportError}</span>
            </div>
          )}

          <div className="bg-[#141414] border border-[#2d2d2d] px-3 py-1.5 rounded-md flex items-center gap-3 text-gray-400">
            <div>読込: <span className="text-white font-mono font-semibold">{images.length}</span> 枚</div>
            <div className="w-px h-3 bg-[#2d2d2d]" />
            <div>配置: <span className="text-[#ff6400] font-mono font-semibold">{placedCount}</span> / {cells.length}</div>
          </div>
        </div>
      </header>

      {/* Main Workspace split */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Control Sidebar */}
        <div className="w-80 shrink-0 h-full flex flex-col">
          <Sidebar
            images={images}
            setImages={setImages}
            cropBottomPx={settings.cropBottomPx}
            setCropBottomPx={(px) => setSettings((s) => ({ ...s, cropBottomPx: px }))}
            onCropComplete={handleCropComplete}
            selectedImageId={selectedImageId}
            onSelectImage={handleSelectImage}
          />
        </div>

        {/* Center Canvas & Control Row Panel */}
        <div className="flex-1 h-full flex flex-col overflow-hidden">
          
          {/* Top Control Bar */}
          <ControlPanel
            settings={settings}
            setSettings={setSettings}
            onResetOffsets={handleResetOffsets}
            onClearGrid={handleClearGrid}
            onExport={handleExport}
            onAutoAlign={handleAutoAlign}
            isStitching={isStitching}
            isAligning={isAligning}
            placedCount={placedCount}
          />

          {/* Interactive Stitching Canvas workspace */}
          <StitchingCanvas
            cells={cells}
            setCells={setCells}
            images={images}
            settings={settings}
            selectedCell={activeSelectedCell}
            onSelectCell={setSelectedCell}
            onUnassignCell={handleUnassignCell}
          />

        </div>

      </div>

    </div>
  );
}
