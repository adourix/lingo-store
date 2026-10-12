"use client";

import { useEffect, useRef } from "react";

type Props = {
  src: string;
  alt?: string;
  className?: string;
};

function isBackgroundPixel(r: number, g: number, b: number): boolean {
  const neutral = Math.max(r, g, b) - Math.min(r, g, b) < 16;
  return neutral && r > 178 && g > 178 && b > 178;
}

function cleanBackground(source: HTMLImageElement, canvas: HTMLCanvasElement): boolean {
  const width = source.naturalWidth;
  const height = source.naturalHeight;
  if (!width || !height) return false;
  const max = 900;
  const scale = Math.min(1, max / Math.max(width, height));
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return false;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);

  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = image.data;
  const visited = new Uint8Array(canvas.width * canvas.height);
  const queue: number[] = [];

  const add = (x: number, y: number) => {
    const index = y * canvas.width + x;
    if (visited[index]) return;
    const p = index * 4;
    if (!isBackgroundPixel(pixels[p], pixels[p + 1], pixels[p + 2])) return;
    visited[index] = 1;
    queue.push(index);
  };

  for (let x = 0; x < canvas.width; x += 1) {
    add(x, 0);
    add(x, canvas.height - 1);
  }
  for (let y = 1; y < canvas.height - 1; y += 1) {
    add(0, y);
    add(canvas.width - 1, y);
  }

  let cursor = 0;
  while (cursor < queue.length) {
    const index = queue[cursor++];
    const x = index % canvas.width;
    const y = Math.floor(index / canvas.width);
    const p = index * 4;
    pixels[p + 3] = 0;
    if (x > 0) add(x - 1, y);
    if (x < canvas.width - 1) add(x + 1, y);
    if (y > 0) add(x, y - 1);
    if (y < canvas.height - 1) add(x, y + 1);
  }

  context.putImageData(image, 0, 0);
  return queue.length > Math.max(40, canvas.width * canvas.height * 0.04);
}

export default function CleanProductImage({ src, alt = "", className = "" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const image = imageRef.current;
    const canvas = canvasRef.current;
    if (!image || !canvas) return;

    const render = () => {
      try {
        if (cleanBackground(image, canvas)) {
          image.style.display = "none";
          canvas.style.display = "block";
        }
      } catch {
        // Keep the original image when the source does not allow canvas access.
      }
    };

    if (image.complete) render();
    else image.addEventListener("load", render, { once: true });
    return () => image.removeEventListener("load", render);
  }, [src]);

  return (
    <span className={`clean-product-image ${className}`}>
      <img ref={imageRef} src={src} alt={alt} />
      <canvas ref={canvasRef} aria-hidden="true" />
    </span>
  );
}
