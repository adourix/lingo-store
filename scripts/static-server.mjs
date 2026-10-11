import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(process.cwd(), process.argv[2] ?? "out");
const port = Number(process.argv[3] ?? 3000);
const mime = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function safePath(urlPath) {
  const pathname = decodeURIComponent(urlPath.split("?")[0]);
  const relative = pathname.replace(/^\/+/, "");
  const candidate = normalize(join(root, relative));
  return candidate === root || candidate.startsWith(`${root}/`) ? candidate : null;
}

async function findFile(urlPath) {
  const direct = safePath(urlPath);
  if (!direct) return null;
  const candidates = [direct];
  if (urlPath.endsWith("/")) candidates.push(join(direct, "index.html"));
  else if (!extname(direct)) candidates.push(join(direct, "index.html"));
  for (const candidate of candidates) {
    try {
      const stat = await fs.stat(candidate);
      if (stat.isFile()) return candidate;
    } catch {
      // Continue to the SPA fallback.
    }
  }
  return null;
}

const server = createServer(async (req, res) => {
  if (!req.url || req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" });
    res.end();
    return;
  }

  let file = await findFile(req.url);
  if (!file) file = join(root, "index.html");

  try {
    const stat = await fs.stat(file);
    const isHtml = extname(file) === ".html";
    const isHashedAsset = /\/[a-f0-9]{8,}\.(?:css|js|woff2?|png|jpe?g|webp|svg)$/.test(file);
    const headers = {
      "Content-Type": mime[extname(file)] ?? "application/octet-stream",
      "Cache-Control": isHtml
        ? "no-cache, no-store, must-revalidate"
        : isHashedAsset
          ? "public, max-age=31536000, immutable"
          : "public, max-age=3600",
      "Content-Length": stat.size,
    };
    res.writeHead(200, headers);
    if (req.method === "HEAD") res.end();
    else createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Static server listening on :${port}, root=${root}`);
});
