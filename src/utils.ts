/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import UTIF from 'utif';
import { MicroscopeImage, GridCell } from './types';

/**
 * Reads an image file and returns its natural width and height, along with its original object URL.
 * Handles standard formats natively, and TIFF (.tif/.tiff) using UTIF.js library.
 */
export function loadImageDimensions(file: File): Promise<{ width: number; height: number; url: string }> {
  return new Promise(async (resolve, reject) => {
    const isTiff = file.name.toLowerCase().endsWith('.tif') || file.name.toLowerCase().endsWith('.tiff');

    if (isTiff) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const ifds = UTIF.decode(arrayBuffer);
        if (!ifds || ifds.length === 0) {
          throw new Error('TIFF IFD is empty or invalid.');
        }
        UTIF.decodeImage(arrayBuffer, ifds[0]);
        const rgba = UTIF.toRGBA8(ifds[0]);
        const width = ifds[0].width;
        const height = ifds[0].height;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Failed to create 2D canvas context for TIFF decoding');
        }

        const imgData = ctx.createImageData(width, height);
        imgData.data.set(rgba);
        ctx.putImageData(imgData, 0, 0);

        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            resolve({ width, height, url });
          } else {
            reject(new Error('Failed to create blob from TIFF canvas'));
          }
        }, 'image/png');
      } catch (err) {
        reject(err);
      }
      return;
    }

    // Standard formats (PNG, JPG, WEBP, etc.)
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
        url,
      });
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

/**
 * Crops the bottom cropPx pixels of an image.
 * Returns the cropped image URL, the scale bar image URL, and the new dimensions.
 */
export function cropImageBottom(
  originalUrl: string,
  originalWidth: number,
  originalHeight: number,
  cropPx: number
): Promise<{ croppedUrl: string; scaleUrl: string | null; croppedHeight: number }> {
  return new Promise((resolve) => {
    if (cropPx <= 0 || cropPx >= originalHeight) {
      resolve({
        croppedUrl: originalUrl,
        scaleUrl: null,
        croppedHeight: originalHeight,
      });
      return;
    }

    const img = new Image();
    img.onload = () => {
      const croppedHeight = originalHeight - cropPx;

      // Create cropped image canvas
      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = originalWidth;
      cropCanvas.height = croppedHeight;
      const cropCtx = cropCanvas.getContext('2d');
      if (cropCtx) {
        cropCtx.drawImage(img, 0, 0, originalWidth, croppedHeight, 0, 0, originalWidth, croppedHeight);
      }

      // Create scale bar canvas
      const scaleCanvas = document.createElement('canvas');
      scaleCanvas.width = originalWidth;
      scaleCanvas.height = cropPx;
      const scaleCtx = scaleCanvas.getContext('2d');
      if (scaleCtx) {
        scaleCtx.drawImage(img, 0, croppedHeight, originalWidth, cropPx, 0, 0, originalWidth, cropPx);
      }

      cropCanvas.toBlob((cropBlob) => {
        scaleCanvas.toBlob((scaleBlob) => {
          const croppedUrl = cropBlob ? URL.createObjectURL(cropBlob) : originalUrl;
          const scaleUrl = scaleBlob ? URL.createObjectURL(scaleBlob) : null;
          resolve({
            croppedUrl,
            scaleUrl,
            croppedHeight,
          });
        }, 'image/png');
      }, 'image/png');
    };
    img.src = originalUrl;
  });
}

/**
 * Generates a full resolution stitched image based on the grid cells and microscope images.
 */
export function stitchImages(
  cells: GridCell[],
  images: MicroscopeImage[],
  overlapRate: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Find placed images and their dimensions
    const placedCells = cells.filter(c => c.imageId !== null);
    if (placedCells.length === 0) {
      reject(new Error('No images have been placed in the grid.'));
      return;
    }

    // Map images for quick lookup
    const imgMap = new Map<string, MicroscopeImage>();
    images.forEach(img => imgMap.set(img.id, img));

    // We assume all placed images should have the same/similar dimensions,
    // but we will use the actual dimensions of the placed images.
    // If they differ, we use the first image's size as the reference base.
    const refCell = placedCells[0];
    const refImg = imgMap.get(refCell.imageId!);
    if (!refImg) {
      reject(new Error('Reference image not found.'));
      return;
    }

    const W = refImg.croppedWidth;
    const H = refImg.croppedHeight;

    // Calculate bounding box of the stitch
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    // For each cell, its coordinate is:
    // x = col * W * (1 - R) + offsetX
    // y = row * H * (1 - R) + offsetY
    // Boundary coordinates are [x, x + W] and [y, y + H]
    const R = overlapRate;
    const spacingX = W * (1 - R);
    const spacingY = H * (1 - R);

    const cellPositions = placedCells.map(cell => {
      const img = imgMap.get(cell.imageId!)!;
      const cellW = img.croppedWidth;
      const cellH = img.croppedHeight;

      const x = cell.col * spacingX + cell.offsetX;
      const y = cell.row * spacingY + cell.offsetY;

      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x + cellW > maxX) maxX = x + cellW;
      if (y + cellH > maxY) maxY = y + cellH;

      return { cell, img, x, y, w: cellW, h: cellH };
    });

    // Normalize coordinates so minX and minY start at 0
    const totalWidth = Math.ceil(maxX - minX);
    const totalHeight = Math.ceil(maxY - minY);

    if (totalWidth <= 0 || totalHeight <= 0 || totalWidth > 16000 || totalHeight > 16000) {
      reject(new Error(`Invalid stitch dimensions (${totalWidth}x${totalHeight}px). Ensure offsets are reasonable.`));
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = totalWidth;
    canvas.height = totalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Could not create 2D canvas context.'));
      return;
    }

    // Set black background or transparent
    ctx.fillStyle = '#141414';
    ctx.fillRect(0, 0, totalWidth, totalHeight);

    // Load all image elements
    const loadPromises = cellPositions.map(({ img, x, y, w, h }) => {
      return new Promise<void>((res) => {
        const imageElement = new Image();
        imageElement.onload = () => {
          // Draw image with normalized coordinates
          ctx.drawImage(imageElement, Math.round(x - minX), Math.round(y - minY), w, h);
          res();
        };
        imageElement.onerror = () => {
          res(); // skip failing images gracefully
        };
        imageElement.src = img.croppedUrl;
      });
    });

    Promise.all(loadPromises).then(() => {
      canvas.toBlob((blob) => {
        if (blob) {
          const resultUrl = URL.createObjectURL(blob);
          resolve(resultUrl);
        } else {
          reject(new Error('Canvas export to blob failed.'));
        }
      }, 'image/png');
    }).catch(reject);
  });
}

/**
 * Helper to fetch and convert image URL into Grayscale Uint8Array
 */
function getGrayscaleData(imgUrl: string, width: number, height: number): Promise<Uint8Array> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;
        const len = width * height;
        const gray = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          // Grayscale formula: (R + 2G + B) / 4
          gray[i] = (data[i * 4] + (data[i * 4 + 1] << 1) + data[i * 4 + 2]) >> 2;
        }
        resolve(gray);
      } else {
        resolve(new Uint8Array(0));
      }
    };
    img.onerror = () => {
      resolve(new Uint8Array(0));
    };
    img.src = imgUrl;
  });
}

/**
 * Find best relative offset (dx, dy) for horizontal neighboring images
 */
function findBestOffsetHorizontal(
  grayLeft: Uint8Array, wL: number, hL: number,
  grayRight: Uint8Array, wR: number, hR: number,
  overlapRate: number
): { dx: number; dy: number } {
  const overlapW = Math.round(wL * overlapRate);
  let bestSAD = Infinity;
  let bestDx = 0;
  let bestDy = 0;

  // Coarse Search (range: -50px to +50px, step: 2px)
  const searchRange = 50;
  const stepCoarse = 2;

  for (let dy = -searchRange; dy <= searchRange; dy += stepCoarse) {
    for (let dx = -searchRange; dx <= searchRange; dx += stepCoarse) {
      let sad = 0;
      let count = 0;

      // Sample pixels with coarse spacing to make it super fast
      for (let y = 0; y < hL; y += 4) {
        const yL = y + dy;
        const yR = y;
        if (yL < 0 || yL >= hL || yR < 0 || yR >= hR) continue;

        for (let x = 0; x < overlapW; x += 4) {
          const xL = (wL - overlapW) + dx + x;
          const xR = x;
          if (xL < 0 || xL >= wL || xR < 0 || xR >= wR) continue;

          const valL = grayLeft[yL * wL + xL];
          const valR = grayRight[yR * wR + xR];
          sad += Math.abs(valL - valR);
          count++;
        }
      }

      if (count > 50) {
        const score = sad / count;
        if (score < bestSAD) {
          bestSAD = score;
          bestDx = dx;
          bestDy = dy;
        }
      }
    }
  }

  // Fine Search around the best coarse result
  let fineSAD = bestSAD;
  let fineDx = bestDx;
  let fineDy = bestDy;

  for (let dy = bestDy - 2; dy <= bestDy + 2; dy++) {
    for (let dx = bestDx - 2; dx <= bestDx + 2; dx++) {
      if (dx === bestDx && dy === bestDy) continue;
      let sad = 0;
      let count = 0;

      for (let y = 0; y < hL; y += 2) {
        const yL = y + dy;
        const yR = y;
        if (yL < 0 || yL >= hL || yR < 0 || yR >= hR) continue;

        for (let x = 0; x < overlapW; x += 2) {
          const xL = (wL - overlapW) + dx + x;
          const xR = x;
          if (xL < 0 || xL >= wL || xR < 0 || xR >= wR) continue;

          const valL = grayLeft[yL * wL + xL];
          const valR = grayRight[yR * wR + xR];
          sad += Math.abs(valL - valR);
          count++;
        }
      }

      if (count > 50) {
        const score = sad / count;
        if (score < fineSAD) {
          fineSAD = score;
          fineDx = dx;
          fineDy = dy;
        }
      }
    }
  }

  return { dx: fineDx, dy: fineDy };
}

/**
 * Find best relative offset (dx, dy) for vertical neighboring images
 */
function findBestOffsetVertical(
  grayTop: Uint8Array, wT: number, hT: number,
  grayBottom: Uint8Array, wB: number, hB: number,
  overlapRate: number
): { dx: number; dy: number } {
  const overlapH = Math.round(hT * overlapRate);
  let bestSAD = Infinity;
  let bestDx = 0;
  let bestDy = 0;

  const searchRange = 50;
  const stepCoarse = 2;

  // Coarse Search
  for (let dy = -searchRange; dy <= searchRange; dy += stepCoarse) {
    for (let dx = -searchRange; dx <= searchRange; dx += stepCoarse) {
      let sad = 0;
      let count = 0;

      for (let y = 0; y < overlapH; y += 4) {
        const yT = (hT - overlapH) + dy + y;
        const yB = y;
        if (yT < 0 || yT >= hT || yB < 0 || yB >= hB) continue;

        for (let x = 0; x < wT; x += 4) {
          const xT = dx + x;
          const xB = x;
          if (xT < 0 || xT >= wT || xB < 0 || xB >= wB) continue;

          const valT = grayTop[yT * wT + xT];
          const valB = grayBottom[yB * wB + xB];
          sad += Math.abs(valT - valB);
          count++;
        }
      }

      if (count > 50) {
        const score = sad / count;
        if (score < bestSAD) {
          bestSAD = score;
          bestDx = dx;
          bestDy = dy;
        }
      }
    }
  }

  // Fine Search
  let fineSAD = bestSAD;
  let fineDx = bestDx;
  let fineDy = bestDy;

  for (let dy = bestDy - 2; dy <= bestDy + 2; dy++) {
    for (let dx = bestDx - 2; dx <= bestDx + 2; dx++) {
      if (dx === bestDx && dy === bestDy) continue;
      let sad = 0;
      let count = 0;

      for (let y = 0; y < overlapH; y += 2) {
        const yT = (hT - overlapH) + dy + y;
        const yB = y;
        if (yT < 0 || yT >= hT || yB < 0 || yB >= hB) continue;

        for (let x = 0; x < wT; x += 2) {
          const xT = dx + x;
          const xB = x;
          if (xT < 0 || xT >= wT || xB < 0 || xB >= wB) continue;

          const valT = grayTop[yT * wT + xT];
          const valB = grayBottom[yB * wB + xB];
          sad += Math.abs(valT - valB);
          count++;
        }
      }

      if (count > 50) {
        const score = sad / count;
        if (score < fineSAD) {
          fineSAD = score;
          fineDx = dx;
          fineDy = dy;
        }
      }
    }
  }

  return { dx: fineDx, dy: fineDy };
}

/**
 * Solves the global auto-alignment of placed cells based on overlapping area SAD template matching
 */
export async function autoAlignGrid(
  cells: GridCell[],
  images: MicroscopeImage[],
  overlapRate: number
): Promise<GridCell[]> {
  const placedCells = cells.filter((c) => c.imageId !== null);
  if (placedCells.length <= 1) {
    // Cannot align with 0 or 1 image
    return cells;
  }

  const imgMap = new Map<string, MicroscopeImage>();
  images.forEach((img) => imgMap.set(img.id, img));

  // 1. Fetch grayscale data for all unique placed images
  const uniqueImageIds = Array.from(new Set(placedCells.map((c) => c.imageId!)));
  const grayscales = new Map<string, Uint8Array>();

  for (const id of uniqueImageIds) {
    const img = imgMap.get(id)!;
    const gray = await getGrayscaleData(img.croppedUrl, img.croppedWidth, img.croppedHeight);
    grayscales.set(id, gray);
  }

  // 2. We determine expected spacing
  const firstImg = imgMap.get(placedCells[0].imageId!)!;
  const W = firstImg.croppedWidth;
  const H = firstImg.croppedHeight;
  const spacingX = W * (1 - overlapRate);
  const spacingY = H * (1 - overlapRate);

  // 3. Build adjacency graph of placed cells
  // Key: "row-col" -> Cell
  const cellGrid = new Map<string, GridCell>();
  placedCells.forEach((c) => cellGrid.set(`${c.row}-${c.col}`, c));

  // Determine a root cell to start spreading positions
  // Let's choose the cell closest to (0,0) that is filled
  placedCells.sort((a, b) => (a.row + a.col) - (b.row + b.col));
  const root = placedCells[0];

  // We will compute absolute coordinates (worldX, worldY) in pixels relative to root
  const worldPos = new Map<string, { x: number; y: number }>();
  worldPos.set(`${root.row}-${root.col}`, { x: root.col * spacingX, y: root.row * spacingY });

  // Queue for Breadth-First Search: [row, col]
  const queue: [number, number][] = [[root.row, root.col]];
  const visited = new Set<string>();
  visited.add(`${root.row}-${root.col}`);

  while (queue.length > 0) {
    const [r, c] = queue.shift()!;
    const key = `${r}-${c}`;
    const currCell = cellGrid.get(key)!;
    const currPos = worldPos.get(key)!;
    const imgA = imgMap.get(currCell.imageId!)!;
    const grayA = grayscales.get(currCell.imageId!)!;

    // Neighbors: Right, Left, Down, Up
    const neighbors = [
      { dr: 0, dc: 1, dir: 'H_RIGHT' },
      { dr: 0, dc: -1, dir: 'H_LEFT' },
      { dr: 1, dc: 0, dir: 'V_DOWN' },
      { dr: -1, dc: 0, dir: 'V_UP' },
    ];

    for (const { dr, dc, dir } of neighbors) {
      const nr = r + dr;
      const nc = c + dc;
      const nKey = `${nr}-${nc}`;
      const neighborCell = cellGrid.get(nKey);

      if (neighborCell && !visited.has(nKey)) {
        const imgB = imgMap.get(neighborCell.imageId!)!;
        const grayB = grayscales.get(neighborCell.imageId!)!;

        let nextX = nc * spacingX;
        let nextY = nr * spacingY;

        if (dir === 'H_RIGHT') {
          // Current cell on left, neighbor on right
          const { dx, dy } = findBestOffsetHorizontal(grayA, imgA.croppedWidth, imgA.croppedHeight, grayB, imgB.croppedWidth, imgB.croppedHeight, overlapRate);
          nextX = currPos.x + imgA.croppedWidth - Math.round(imgA.croppedWidth * overlapRate) + dx;
          nextY = currPos.y + dy;
        } else if (dir === 'H_LEFT') {
          // Neighbor on left, current cell on right
          const { dx, dy } = findBestOffsetHorizontal(grayB, imgB.croppedWidth, imgB.croppedHeight, grayA, imgA.croppedWidth, imgA.croppedHeight, overlapRate);
          nextX = currPos.x - (imgB.croppedWidth - Math.round(imgB.croppedWidth * overlapRate) + dx);
          nextY = currPos.y - dy;
        } else if (dir === 'V_DOWN') {
          // Current cell on top, neighbor on bottom
          const { dx, dy } = findBestOffsetVertical(grayA, imgA.croppedWidth, imgA.croppedHeight, grayB, imgB.croppedWidth, imgB.croppedHeight, overlapRate);
          nextX = currPos.x + dx;
          nextY = currPos.y + imgA.croppedHeight - Math.round(imgA.croppedHeight * overlapRate) + dy;
        } else if (dir === 'V_UP') {
          // Neighbor on top, current cell on bottom
          const { dx, dy } = findBestOffsetVertical(grayB, imgB.croppedWidth, imgB.croppedHeight, grayA, imgA.croppedWidth, imgA.croppedHeight, overlapRate);
          nextX = currPos.x - dx;
          nextY = currPos.y - (imgB.croppedHeight - Math.round(imgB.croppedHeight * overlapRate) + dy);
        }

        worldPos.set(nKey, { x: nextX, y: nextY });
        visited.add(nKey);
        queue.push([nr, nc]);
      }
    }
  }

  // 4. Calculate offsets back from calculated absolute positions
  return cells.map((cell) => {
    if (cell.imageId === null) {
      return { ...cell, offsetX: 0, offsetY: 0 };
    }
    const pos = worldPos.get(`${cell.row}-${cell.col}`);
    if (!pos) {
      // Not connected to the root component, keep zero
      return { ...cell, offsetX: 0, offsetY: 0 };
    }

    const expectedX = cell.col * spacingX;
    const expectedY = cell.row * spacingY;

    return {
      ...cell,
      offsetX: Math.round(pos.x - expectedX),
      offsetY: Math.round(pos.y - expectedY),
    };
  });
}
