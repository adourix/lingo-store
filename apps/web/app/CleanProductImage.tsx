"use client";

import { useEffect, useMemo, useRef } from "react";

type Props = { src: string; alt?: string; className?: string };
type Rgb = [number, number, number];

function distance(a: Rgb, b: Rgb): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

function luminance(r: number, g: number, b: number): number {
  return (r * 299 + g * 587 + b * 114) / 1000;
}

function saturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

function isBlue(r: number, g: number, b: number): boolean {
  return distance([r, g, b], [35, 53, 173]) <= 125 || (b > 110 && b > r * 1.35 && b > g * 1.12 && r < 125);
}

function isNeutralBackground(r: number, g: number, b: number): boolean {
  const l = luminance(r, g, b);
  const s = saturation(r, g, b);
  // Legacy uploads contain white/light-gray checkerboard pixels. JPEG
  // compression changes the exact values, so classify the neutral range
  // rather than matching only #fff and #ddd.
  return s <= 0.18 && l >= 110;
}

function normalizeImageSource(src: string): string {
  try {
    const url = new URL(src, window.location.href);
    const host = url.hostname.toLowerCase();
    if (host === "lingostore.store" || host === "www.lingostore.store") {
      return `/api/product-image?url=${encodeURIComponent(url.pathname + url.search)}`;
    }
    return url.toString();
  } catch {
    return src;
  }
}

function cleanBackground(source: HTMLImageElement, canvas: HTMLCanvasElement): boolean {
  const width = source.naturalWidth;
  const height = source.naturalHeight;
  if (!width || !height) return false;

  const scale = Math.min(1, 1400 / Math.max(width, height));
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
  const total = w * h;
  let removed = 0;

  // Legacy catalog assets can have the Lingo-blue presentation frame baked
  // into the JPG. Remove it globally because it is never product content.
  for (let i = 0; i < pixels.length; i += 4) {
    if (isBlue(pixels[i], pixels[i + 1], pixels[i + 2])) {
      pixels[i + 3] = 0;
      removed += 1;
    }
  }

  // Remove the checkerboard from the outside inward. The key difference from
  // the old implementation is that both checkerboard colors are considered
  // background candidates, including JPEG-compressed variants. Product pixels
  // are preserved when they are enclosed by the silhouette.
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  const canRemove = (index: number) => {
    const p = index * 4;
    return pixels[p + 3] === 0 || isNeutralBackground(pixels[p], pixels[p + 1], pixels[p + 2]);
  };

  const add = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const index = y * w + x;
    if (visited[index] || !canRemove(index)) return;
    visited[index] = 1;
    queue[tail++] = index;
  };

  for (let x = 0; x < w; x += 1) {
    add(x, 0);
    add(x, h - 1);
  }
  for (let y = 1; y < h - 1; y += 1) {
    add(0, y);
    add(w - 1, y);
  }

  while (head < tail) {
    const index = queue[head++];
    const p = index * 4;
    if (pixels[p + 3] !== 0) {
      pixels[p + 3] = 0;
      removed += 1;
    }
    const x = index % w;
    const y = Math.floor(index / w);
    add(x - 1, y);
    add(x + 1, y);
    add(x, y - 1);
    add(x, y + 1);
  }

  if (removed === 0) return false;
  context.putImageData(image, 0, 0);
  return removed / total >= 0.001;
}

export default function CleanProductImage({ src, alt = "", className = "" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const imageSrc = useMemo(() => normalizeImageSource(src), [src]);

  useEffect(() => {
    const image = imageRef.current;
    const canvas = canvasRef.current;
    if (!image || !canvas) return;

    let cancelled = false;
    const render = () => {
      if (cancelled) return;
      try {
        const cleaned = cleanBackground(image, canvas);
        image.style.display = cleaned ? "none" : "block";
        canvas.style.display = cleaned ? "block" : "none";
      } catch {
        image.style.display = "block";
        canvas.style.display = "none";
      }
    };

    if (image.complete && image.naturalWidth > 0) render();
    else image.addEventListener("load", render, { once: true });
    return () => {
      cancelled = true;
      image.removeEventListener("load", render);
    };
  }, [imageSrc]);

  return (
    <span className={`clean-product-image ${className}`} style={{ display: "block", width: "100%", height: "100%", minWidth: 0, minHeight: 0, background: "transparent" }}>
      <img ref={imageRef} src={imageSrc} alt={alt} style={{ display: "block", width: "100%", height: "100%", objectFit: "contain", objectPosition: "center" }} />
      <canvas ref={canvasRef} aria-hidden="true" style={{ display: "none", width: "100%", height: "100%", objectFit: "contain", objectPosition: "center" }} />
    </span>
  );
}
