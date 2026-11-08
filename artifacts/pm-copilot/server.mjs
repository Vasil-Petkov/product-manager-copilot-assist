import http from "node:http";
import { createReadStream } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { browserHeaders } from "../../lib/browser-security/headers.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "dist/public");
const types = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon",
  ".woff": "font/woff", ".woff2": "font/woff2",
};

// Native static serving cannot guarantee response headers in this application's
// Autoscale router. Serve the same Vite output with explicit, tested headers.
export function createFrontendServer(directory = root) {
  return http.createServer(async (req, res) => {
    for (const [key, value] of Object.entries(browserHeaders())) res.setHeader(key, value);
    res.setHeader("Cache-Control", "no-store");
    if (!["GET", "HEAD"].includes(req.method ?? "")) {
      res.setHeader("Allow", "GET, HEAD");
      res.writeHead(405).end();
      return;
    }
    try {
      const pathname = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
      if (pathname.startsWith("/api/") || pathname.includes("\\") || pathname.includes("\0")
        || pathname.split("/").some((part) => part.startsWith("."))) {
        res.writeHead(404).end();
        return;
      }
      const actualRoot = await realpath(directory);
      let candidate = resolve(actualRoot, `.${pathname}`);
      try {
        if (!(await stat(candidate)).isFile()) candidate = resolve(actualRoot, "index.html");
      } catch {
        if (extname(pathname)) { res.writeHead(404).end(); return; }
        candidate = resolve(actualRoot, "index.html");
      }
      const file = await realpath(candidate);
      if (!file.startsWith(`${actualRoot}${sep}`)) { res.writeHead(404).end(); return; }
      const size = (await stat(file)).size;
      res.setHeader("Content-Type", types[extname(file)] ?? "application/octet-stream");
      res.setHeader("Content-Length", size);
      if (file.includes(`${sep}assets${sep}`)) res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.writeHead(200);
      if (req.method === "HEAD") res.end();
      else {
        const stream = createReadStream(file);
        stream.on("error", () => res.destroy());
        res.on("close", () => stream.destroy());
        stream.pipe(res);
      }
    } catch {
      res.writeHead(404).end();
    }
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.env.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT is required");
  const server = createFrontendServer();
  server.requestTimeout = 30_000;
  server.listen(port, "0.0.0.0");
  process.on("SIGTERM", () => server.close());
}
