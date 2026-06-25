/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface MicroscopeImage {
  id: string;
  name: string;
  url: string;          // Object URL of original image
  width: number;
  height: number;
  croppedUrl: string;   // Object URL of cropped image (or same as url if no crop)
  scaleUrl: string | null; // Object URL of cropped bottom part (scale bar)
  croppedWidth: number;
  croppedHeight: number;
  file: File;
}

export interface GridCell {
  row: number;
  col: number;
  imageId: string | null; // ID of the MicroscopeImage assigned to this cell
  offsetX: number;       // Fine-tuning offset X in pixels
  offsetY: number;       // Fine-tuning offset Y in pixels
}

export interface StitcherSettings {
  rows: number;
  cols: number;
  overlapRate: number;   // 0.0 to 1.0 (e.g., 0.20 for 20%)
  cropBottomPx: number;  // Pixels to crop from the bottom of each image
  displayOpacity: number; // For overlay blending guidance
  blendMode: 'normal' | 'difference' | 'multiply' | 'screen';
  showGuides: boolean;
  gridCellWidth: number; // Display scale
  gridCellHeight: number;
}
