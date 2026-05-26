import React, { useState, useEffect } from 'react';

interface TransparentLogoProps {
  src: string;
  tolerance?: number; // 0 to 255, threshold to consider a pixel "white"
  className?: string;
  alt?: string;
  referrerPolicy?: React.HTMLAttributeReferrerPolicy | undefined;
}

export default function TransparentLogo({ src, tolerance = 35, className, ...props }: TransparentLogoProps) {
  const [processedSrc, setProcessedSrc] = useState(src);

  useEffect(() => {
    let active = true;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    img.onload = () => {
      if (!active) return;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const width = canvas.width;
        const height = canvas.height;

        const visited = new Uint8Array(width * height);
        const queue: [number, number][] = [];

        // Helper to check if a pixel is near-white (all channels above 255 - tolerance)
        const limit = 255 - tolerance;
        const isWhite = (x: number, y: number) => {
          const idx = (y * width + x) * 4;
          return data[idx] > limit && data[idx + 1] > limit && data[idx + 2] > limit;
        };

        // Add corners as seeding points for the background flood fill
        const corners = [
          [0, 0],
          [width - 1, 0],
          [0, height - 1],
          [width - 1, height - 1]
        ];

        for (const [cx, cy] of corners) {
          const roundedCx = Math.round(cx);
          const roundedCy = Math.round(cy);
          if (roundedCx >= 0 && roundedCx < width && roundedCy >= 0 && roundedCy < height) {
            const idx = roundedCy * width + roundedCx;
            if (isWhite(roundedCx, roundedCy) && !visited[idx]) {
              visited[idx] = 1;
              queue.push([roundedCx, roundedCy]);
            }
          }
        }

        // BFS flood fill to find and make external white backgrounds transparent
        let head = 0;
        while (head < queue.length) {
          const [x, y] = queue[head++];
          
          const idx = (y * width + x) * 4;
          data[idx + 3] = 0; // Set alpha to 0 (make transparent)

          // Check standard 4-way neighbors
          const neighbors = [
            [x + 1, y],
            [x - 1, y],
            [x, y + 1],
            [x, y - 1]
          ];

          for (const [nx, ny] of neighbors) {
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const nIdx = ny * width + nx;
              if (visited[nIdx] === 0 && isWhite(nx, ny)) {
                visited[nIdx] = 1;
                queue.push([nx, ny]);
              }
            }
          }
        }

        ctx.putImageData(imageData, 0, 0);
        setProcessedSrc(canvas.toDataURL());
      } catch (err) {
        console.error("Error processing transparent background:", err);
        // Fallback to original src if drawing/processing fails (e.g. CORS)
        setProcessedSrc(src);
      }
    };

    return () => {
      active = false;
    };
  }, [src, tolerance]);

  return (
    <img 
      src={processedSrc} 
      className={className} 
      {...props} 
    />
  );
}
