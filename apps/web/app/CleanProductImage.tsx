"use client";

import { useEffect, useMemo, useRef } from "react";

type Props = {
  src: string;
  alt?: string;
  className?: string;
};

type Rgb = [number, number, number];

function colorDistance(a: Rgb, b: Rgb): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

function edgeSamples(data: Uint8ClampedArray, width: number, height: number): Rgb[] {
  const samples: Rgb[] = [];
  const points = [
    [0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1],
    [Math.floor(width / 2), 0], [Math.floor(width / 2), height - 1],
    [0, Math.floor(height / 2)], [width - 1, Math.floor(height / 2)],
  ];
  for (const [x, y] of points) {
    const p = (y * width + x) * 4;
    samples.push([data[p], data[p + 1], data[p + 2]]);
  }
  return samples;
}

function cleanBackground(source: HTMLImageElement, canvas: HTMLCanvasElement): boolean {
  const width = source.naturalWidth;
  const height = source.naturalHeight;
  if (!width || !height) return false;

  const max = 1100;
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
  const visited = new Uint8Array(w * h);
  const queue: number[] = [];
  const backgrounds = edgeSamples(pixels, w, h);
  const tolerance = 32;

  const isBackground = (index: number) => {
    const p = index * 4;
    if (pixels[p + 3] === 0) return true;
    const color: Rgb = [pixels[p], pixels[p + 1], pixels[p + 2]];
    return backgrounds.some((background) => colorDistance(color, background) <= tolerance);
  };

  const add = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const index = y * w + x;
    if (visited[index] || !isBackground(index)) return;
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
    const x = index % w;
    const y = Math.floor(index / w);
    const p = index * 4;
    pixels[p + 3] = 0;
    add(x - 1, y);
    add(x + 1, y);
    add(x, y - 1);
    add(x, y + 1);
  }

  const ratio = queue.length / (w * h);
  if (ratio < 0.08) return false;
  context.putImageData(image, 0, 0);
  return true;
}

function normalizeImageSource(src: string): string {
  try {
    const url = new URL(src, window.location.href);
    const host = url.hostname.toLowerCase();
    if (host === "lingostore.store" || host === "www.lingostore.store") {
      return `${url.pathname}${url.search}${url.hash}`;
    }
    return url.toString();
  } catch {
    return src;
  }
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
        // Keep the original image when the source cannot be read by canvas.
      }
    };

    if (image.complete) render();
    else image.addEventListener("load", render, { once: true });
    return () => image.removeEventListener("load", render);
  }, [imageSrc]);

  return (
    <span
      className={`clean-product-image ${className}`}
      style={{ display: "block", width: "100%", height: "100%", minWidth: 0, minHeight: 0 }}
    >
      <img
        ref={imageRef}
        src={imageSrc}
        alt={alt}
        style={{ display: "block", width: "100%", height: "100%", objectFit: "contain", objectPosition: "center" }}
      />
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{ display: "none", width: "100%", height: "100%", objectFit: "contain", objectPosition: "center" }}
      />
    </span>
  );
}
