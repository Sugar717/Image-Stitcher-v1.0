/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Settings, RefreshCw, Layers, ShieldAlert, Sliders, LayoutGrid, Sparkles } from 'lucide-react';
import { StitcherSettings } from '../types';

interface ControlPanelProps {
  settings: StitcherSettings;
  setSettings: React.Dispatch<React.SetStateAction<StitcherSettings>>;
  onResetOffsets: () => void;
  onClearGrid: () => void;
  onExport: () => void;
  onAutoAlign: () => void;
  isStitching: boolean;
  isAligning: boolean;
  placedCount: number;
}

export default function ControlPanel({
  settings,
  setSettings,
  onResetOffsets,
  onClearGrid,
  onExport,
  onAutoAlign,
  isStitching,
  isAligning,
  placedCount,
}: ControlPanelProps) {
  const handleNumChange = (key: keyof StitcherSettings, val: number) => {
    setSettings((prev) => ({
      ...prev,
      [key]: val,
    }));
  };

  const handleToggle = (key: keyof StitcherSettings) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <div id="control-panel" className="bg-[#1e1e1e] border-b border-[#2d2d2d] text-gray-200 p-4">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        
        {/* Title and Settings Branding */}
        <div className="flex items-center gap-2">
          <Settings size={18} className="text-[#ff6400]" />
          <h1 className="text-sm font-bold tracking-wide uppercase text-white">=== グリッド・アライメント設定 ===</h1>
        </div>

        {/* Inputs row */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
          
          {/* Rows / Cols */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400 font-medium">縦枚数:</span>
              <input
                id="rows-input"
                type="number"
                min="1"
                max="10"
                value={settings.rows}
                onChange={(e) => handleNumChange('rows', Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                className="w-14 bg-[#141414] border border-[#3d3d3d] rounded px-1.5 py-1 text-center text-white font-mono"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-gray-400 font-medium">横枚数:</span>
              <input
                id="cols-input"
                type="number"
                min="1"
                max="10"
                value={settings.cols}
                onChange={(e) => handleNumChange('cols', Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                className="w-14 bg-[#141414] border border-[#3d3d3d] rounded px-1.5 py-1 text-center text-white font-mono"
              />
            </div>
          </div>

          {/* Overlap */}
          <div className="flex items-center gap-2">
            <span className="text-gray-400 font-medium">重複率:</span>
            <input
              id="overlap-input"
              type="number"
              min="0"
              max="1"
              step="0.05"
              value={settings.overlapRate}
              onChange={(e) => handleNumChange('overlapRate', Math.max(0, Math.min(1, parseFloat(e.target.value) || 0)))}
              className="w-16 bg-[#141414] border border-[#3d3d3d] rounded px-1.5 py-1 text-center text-white font-mono"
            />
            <span className="text-[10px] text-gray-500 font-mono">({Math.round(settings.overlapRate * 100)}%)</span>
          </div>

          {/* Opacity for Layer Assistance */}
          <div className="flex items-center gap-2">
            <span className="text-gray-400 font-medium">ブレンド不透明度:</span>
            <input
              id="opacity-slider"
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              value={settings.displayOpacity}
              onChange={(e) => handleNumChange('displayOpacity', parseFloat(e.target.value))}
              className="w-20 accent-[#ff6400]"
            />
            <span className="text-[10px] text-gray-500 font-mono w-8">{Math.round(settings.displayOpacity * 100)}%</span>
          </div>

          {/* Blending Mode */}
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 font-medium">重なり描画:</span>
            <select
              id="blend-mode-select"
              value={settings.blendMode}
              onChange={(e) => setSettings((prev) => ({ ...prev, blendMode: e.target.value as any }))}
              className="bg-[#141414] border border-[#3d3d3d] rounded px-1.5 py-1 text-xs text-white"
            >
              <option value="normal">通常 (半透明)</option>
              <option value="difference">差分 (Difference)</option>
              <option value="multiply">乗算 (Multiply)</option>
              <option value="screen">スクリーン (Screen)</option>
            </select>
          </div>

          {/* Show Overlap Guide checkbox */}
          <label className="flex items-center gap-1.5 select-none text-gray-400 hover:text-gray-200 cursor-pointer">
            <input
              id="show-guides-checkbox"
              type="checkbox"
              checked={settings.showGuides}
              onChange={() => handleToggle('showGuides')}
              className="accent-[#ff6400]"
            />
            <span>重複ガイド線</span>
          </label>

        </div>

        {/* Global Utility Operations */}
        <div className="flex items-center gap-2">
          <button
            id="auto-align-button"
            onClick={onAutoAlign}
            disabled={isAligning || placedCount <= 1}
            className="flex items-center gap-1 px-3 py-1.5 bg-[#2a211b] hover:bg-[#3d2f25] border border-[#e05800]/50 text-orange-400 hover:text-white rounded text-xs font-semibold transition cursor-pointer disabled:opacity-40"
            title="隣り合う画像の重なり具合を自動アライメントで調整します"
          >
            <Sparkles size={13} className="text-[#ff6400]" />
            {isAligning ? '自動調整中...' : 'オートアライメント (自動調整)'}
          </button>

          <button
            id="reset-offsets-button"
            onClick={onResetOffsets}
            disabled={placedCount === 0}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-[#252525] hover:bg-[#333] border border-[#3d3d3d] rounded text-xs text-gray-300 hover:text-white transition cursor-pointer disabled:opacity-40"
            title="すべての微調整オフセットをリセットします"
          >
            <RefreshCw size={13} />
            位置リセット
          </button>
          
          <button
            id="clear-grid-button"
            onClick={onClearGrid}
            disabled={placedCount === 0}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-[#252525] hover:bg-red-950/40 hover:text-red-300 border border-[#3d3d3d] rounded text-xs text-gray-300 transition cursor-pointer disabled:opacity-40"
            title="グリッドに配置された画像をすべて取り除きます"
          >
            グリッドクリア
          </button>

          <button
            id="stitch-export-button"
            onClick={onExport}
            disabled={isStitching || placedCount === 0}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-[#ff6400] hover:bg-[#e05800] text-white rounded text-xs font-semibold tracking-wider uppercase transition cursor-pointer shadow disabled:opacity-50"
          >
            {isStitching ? '処理中...' : 'スティッチング出力'}
          </button>
        </div>

      </div>
    </div>
  );
}
