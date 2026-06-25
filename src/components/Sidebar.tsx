/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { Upload, Scissors, Trash2, Eye, FileImage, AlertTriangle } from 'lucide-react';
import { MicroscopeImage } from '../types';
import { loadImageDimensions, cropImageBottom } from '../utils';

interface SidebarProps {
  images: MicroscopeImage[];
  setImages: React.Dispatch<React.SetStateAction<MicroscopeImage[]>>;
  cropBottomPx: number;
  setCropBottomPx: (px: number) => void;
  onCropComplete: (newImages: MicroscopeImage[]) => void;
  selectedImageId: string | null;
  onSelectImage: (id: string | null) => void;
}

export default function Sidebar({
  images,
  setImages,
  cropBottomPx,
  setCropBottomPx,
  onCropComplete,
  selectedImageId,
  onSelectImage,
}: SidebarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'images' | 'crop'>('images');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsProcessing(true);
    setErrorMsg(null);

    const filesArray = Array.from(e.target.files) as File[];
    const newImages: MicroscopeImage[] = [];

    for (const file of filesArray) {
      // Check if duplicate filename
      if (images.some((img) => img.name === file.name)) {
        continue;
      }

      try {
        const { width, height, url } = await loadImageDimensions(file);

        // Perform initial crop (or no crop if cropBottomPx = 0)
        const { croppedUrl, scaleUrl, croppedHeight } = await cropImageBottom(
          url,
          width,
          height,
          cropBottomPx
        );

        newImages.push({
          id: Math.random().toString(36).substr(2, 9),
          name: file.name,
          url,
          width,
          height,
          croppedUrl,
          scaleUrl,
          croppedWidth: width,
          croppedHeight,
          file,
        });
      } catch (err) {
        console.error('Failed to read image:', file.name, err);
        setErrorMsg(`"${file.name}" の読み込みに失敗しました。対応外のフォーマットかファイルが破損しています。`);
      }
    }

    setImages((prev) => {
      const updated = [...prev, ...newImages];
      return updated;
    });
    setIsProcessing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCropAll = async () => {
    setIsProcessing(true);
    const updatedImages = await Promise.all(
      images.map(async (img) => {
        // Revoke old cropped and scale URLs if they are different from original URL
        if (img.croppedUrl !== img.url) {
          URL.revokeObjectURL(img.croppedUrl);
        }
        if (img.scaleUrl) {
          URL.revokeObjectURL(img.scaleUrl);
        }

        const { croppedUrl, scaleUrl, croppedHeight } = await cropImageBottom(
          img.url,
          img.width,
          img.height,
          cropBottomPx
        );

        return {
          ...img,
          croppedUrl,
          scaleUrl,
          croppedHeight,
        };
      })
    );

    setImages(updatedImages);
    onCropComplete(updatedImages);
    setIsProcessing(false);
  };

  const removeImage = (id: string) => {
    const imgToRemove = images.find((img) => img.id === id);
    if (imgToRemove) {
      URL.revokeObjectURL(imgToRemove.url);
      if (imgToRemove.croppedUrl !== imgToRemove.url) {
        URL.revokeObjectURL(imgToRemove.croppedUrl);
      }
      if (imgToRemove.scaleUrl) {
        URL.revokeObjectURL(imgToRemove.scaleUrl);
      }
    }
    setImages((prev) => prev.filter((img) => img.id !== id));
    if (selectedImageId === id) {
      onSelectImage(null);
    }
  };

  const clearAllImages = () => {
    images.forEach((img) => {
      URL.revokeObjectURL(img.url);
      if (img.croppedUrl !== img.url) {
        URL.revokeObjectURL(img.croppedUrl);
      }
      if (img.scaleUrl) {
        URL.revokeObjectURL(img.scaleUrl);
      }
    });
    setImages([]);
    onSelectImage(null);
  };

  const selectedImage = images.find((img) => img.id === selectedImageId);

  return (
    <div id="sidebar-container" className="flex flex-col h-full bg-[#1e1e1e] border-r border-[#2d2d2d] text-gray-200">
      {/* File Loader Header */}
      <div className="p-4 border-b border-[#2d2d2d]">
        <h2 className="text-sm font-semibold tracking-wider text-gray-400 uppercase mb-3">=== 画像読み込み ===</h2>
        
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('images')}
            className={`flex-1 py-1.5 text-xs font-medium rounded transition ${
              activeTab === 'images' ? 'bg-[#ff6400] text-white' : 'bg-[#2d2d2d] text-gray-400 hover:text-white'
            }`}
          >
            画像一覧
          </button>
          <button
            onClick={() => setActiveTab('crop')}
            className={`flex-1 py-1.5 text-xs font-medium rounded transition ${
              activeTab === 'crop' ? 'bg-[#ff6400] text-white' : 'bg-[#2d2d2d] text-gray-400 hover:text-white'
            }`}
          >
            下部帯カット
          </button>
        </div>

        {activeTab === 'images' && (
          <div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              multiple
              accept="image/*,.tif,.tiff"
              className="hidden"
            />
            <button
              id="upload-button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="w-full flex items-center justify-center gap-2 bg-[#2d2d2d] hover:bg-[#3d3d3d] border border-[#444] hover:border-[#555] text-white py-2 px-3 rounded text-sm font-medium transition cursor-pointer disabled:opacity-50"
            >
              <Upload size={16} className="text-[#ff6400]" />
              画像フォルダ・ファイル読込
            </button>
          </div>
        )}

        {activeTab === 'crop' && (
          <div className="space-y-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-gray-400">下部カット高さ (ピクセル)</label>
              <div className="flex gap-2">
                <input
                  id="crop-px-input"
                  type="number"
                  min="0"
                  max="2000"
                  value={cropBottomPx}
                  onChange={(e) => setCropBottomPx(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full bg-[#141414] border border-[#3d3d3d] rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-[#ff6400]"
                />
              </div>
            </div>
            <button
              id="crop-apply-button"
              onClick={handleCropAll}
              disabled={isProcessing || images.length === 0}
              className="w-full flex items-center justify-center gap-2 bg-[#ff6400] hover:bg-[#e05800] text-white py-2 px-3 rounded text-sm font-medium transition disabled:opacity-50"
            >
              <Scissors size={15} />
              下部帯カット実行 ({images.length}枚)
            </button>
            <p className="text-[10px] text-gray-500 leading-normal">
              ※顕微鏡画像の底にある縮尺スケールや測定情報等の余白帯を切り離します。
            </p>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="m-3 p-3 bg-red-950/40 border border-red-800 text-red-200 rounded text-xs flex gap-2 items-start">
          <AlertTriangle size={16} className="shrink-0 text-red-500 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'images' ? (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-gray-400">読込画像一覧 ({images.length})</span>
              {images.length > 0 && (
                <button
                  onClick={clearAllImages}
                  className="text-[11px] text-red-400 hover:text-red-300 transition"
                >
                  すべてクリア
                </button>
              )}
            </div>

            {images.length === 0 ? (
              <div className="border border-dashed border-[#2d2d2d] rounded-lg p-8 text-center text-gray-500">
                <FileImage size={28} className="mx-auto mb-2 opacity-30 text-[#ff6400]" />
                <p className="text-xs">画像が読み込まれていません</p>
                <p className="text-[10px] text-gray-600 mt-1">上のボタンから画像を読み込んでください</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {images.map((img) => (
                  <div
                    key={img.id}
                    id={`image-item-${img.id}`}
                    onClick={() => onSelectImage(img.id)}
                    className={`flex items-center gap-2 p-2 rounded border cursor-pointer group transition ${
                      selectedImageId === img.id
                        ? 'bg-[#2a211b] border-[#ff6400]'
                        : 'bg-[#141414] border-[#2a2a2a] hover:border-[#3d3d3d]'
                    }`}
                  >
                    <div className="w-10 h-10 shrink-0 bg-[#252525] rounded overflow-hidden flex items-center justify-center border border-[#2d2d2d]">
                      <img
                        src={img.croppedUrl}
                        alt={img.name}
                        className="max-w-full max-h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-200 truncate" title={img.name}>
                        {img.name}
                      </p>
                      <p className="text-[10px] text-gray-500 font-mono">
                        {img.width} × {img.croppedHeight} px
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeImage(img.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition"
                      title="削除"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Previews for Crops */
          <div className="space-y-4">
            <span className="text-xs font-semibold text-gray-400 block mb-2">カットプレビュー (選択画像)</span>
            
            {!selectedImage ? (
              <div className="text-center text-gray-500 py-8 border border-dashed border-[#2d2d2d] rounded-lg">
                <p className="text-xs">左の一覧から画像を選択してプレビューします</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-[#ff6400] mb-1">■ クロップ後画像 ({selectedImage.width}×{selectedImage.croppedHeight}px)</p>
                  <div className="border border-[#2a2a2a] bg-[#141414] rounded overflow-hidden aspect-video flex items-center justify-center p-2">
                    <img
                      src={selectedImage.croppedUrl}
                      alt="Cropped Preview"
                      className="max-w-full max-h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </div>

                {selectedImage.scaleUrl ? (
                  <div>
                    <p className="text-xs font-semibold text-orange-400 mb-1">■ カットされた帯 (下部{cropBottomPx}px)</p>
                    <div className="border border-[#2a2a2a] bg-[#141414] rounded overflow-hidden py-2 px-1 flex items-center justify-center">
                      <img
                        src={selectedImage.scaleUrl}
                        alt="Scale Bar Preview"
                        className="max-h-16 object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-gray-500">
                    ※下部カットピクセルが 0 のため、帯はありません。
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Guide/Instructions Section */}
      <div className="p-4 border-t border-[#2d2d2d] bg-[#171717] text-xs space-y-1.5 leading-relaxed text-gray-400">
        <p className="font-semibold text-gray-300">💡 画像の配置方法:</p>
        <ol className="list-decimal pl-4 space-y-1">
          <li>右側のグリッドのセルをクリックして選択。</li>
          <li>画像一覧から配置したい画像をクリック。</li>
          <li>選択したセルに画像が配置されます。</li>
        </ol>
      </div>
    </div>
  );
}
