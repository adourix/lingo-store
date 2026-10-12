"use client";

import { useEffect, useMemo, useRef } from "react";

type Props = {
  src: string;
  alt?: string;
  className?: string;
};

function isBlueBackground(r: number, g: number, b: number): boolean {
  return b > 105 && b > r * 1.65 && b > g * 1.35 && r < 100;
}

function isCheckerTone(r: number, g: number, b: number): boolean {
  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  const luminance = (r * 299 + g * 587 + b * 114) / 1000;
  return spread <= 18 && luminance >= 155;
}

function normalizeImageSource(src: string): string {
  try {
    const url = new URL(src, window.location.href);
    const host = url.hostname.toLowerCase();
    if (host === "lingostore.store" || host === "www.lingostore.store") {
      return `/api/product-image?url=${encodeURIComponent(url.pathname + url.search)}`;
    }
    return src;
  } catch {
    return src;
  }
}

function cleanBackground(source: HTMLImageElement, canvas: HTMLCanvasElement): boolean {
  const width = source.naturalWidth;
  const height = source.naturalHeight;
  if (!width || !height) return false;

  const max = 1200;
  const scale = Math.min(1, max / Math.max(width, height));
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return false;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);

  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = image.data;
  const w = canvas.width;
  const h = canvas.height;

  // The legacy catalog images contain a solid Lingo-blue frame around a
  // checkerboard transparency preview. Remove that blue globally first.
  for (let i = 0; i < pixels.length; i += 4) {
    if (isBlueBackground(pixels[i], pixels[i + 1], pixels[i + 2])) pixels[i + 3] = 0;
  }

  // Then flood-fill the now-exposed checkerboard from the outside. This keeps
  // the actual phone pixels intact while removing both checkerboard tones.
  const visited = new Uint8Array(w * h);
  const queue: number[] = [];
  const add = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const index = y * w + x;
    if (visited[index]) return;
    const p = index * 4;
    if (pixels[p + 3] !== 0 && !isCheckerTone(pixels[p], pixels[p + 1], pixels[p + 2])) return;
    visited[index] = 1;
    queue.push(index);
  };

  for (let x = 0; x < w; x += 1) {
    add(x, 0);
    add(x, h - 1);
  }
  for (let y = 1; y < h - 1; y += 1) {
    add(0, y);
    add(w - 1, y);
  }

  let cursor = 0;
  while (cursor < queue.length) {
    const index = queue[cursor++];
    const p = index * 4;
    pixels[p + 3] = 0;
    const x = index % w;
    const y = Math.floor(index / w);
    add(x - 1, y);
    add(x + 1, y);
    add(x, y - 1);
    add(x, y + 1);
  }

  const changed = queue.length / (w * h);
  if (changed < 0.05) return false;
  context.putImageData(image, 0, 0);
  return true;
}

export default function CleanProductImage({ src, alt = "", className = "" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const imageSrc = useMemo(() => normalizeImageSource(src), [src]);

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
        image.style.display = "block";
        canvas.style.display = "none";
      }
    };

    if (image.complete) render();
    else image.addEventListener("load", render, { once: true });
    return () => image.removeEventListener("load", render);
  }, [imageSrc]);

  return (
    <span className={`clean-product-image ${className}`} style={{ display: "block", width: "100%", height: "100%", minWidth: 0, minHeight: 0 }}>
      <img ref={imageRef} src={imageSrc} alt={alt} style={{ display: "block", width: "100%", height: "100%", objectFit: "contain", objectPosition: "center" }} />
      <canvas ref={canvasRef} aria-hidden="true" style={{ display: "none", width: "100%", height: "100%", objectFit: "contain", objectPosition: "center" }} />
    </span>
  );
}
