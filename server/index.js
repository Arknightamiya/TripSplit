import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleApiRequest } from "./router.js";
import { seedStore } from "./store.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || 3000);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

seedStore();

const server = createServer(async (req, res) => {
  try {
    const handled = await handleApiRequest(req, res);
    if (handled) {
      return;
    }

    await serveStatic(req, res);
  } catch (error) {
    console.error(error);
    res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "Internal server error" }));
  }
});

server.listen(port, () => {
  console.log(`TripSplit running at http://localhost:${port}`);
});

async function serveStatic(req, res) {
  const url = new URL(req.url, "http://localhost");
  const requestPath = url.pathname === "/" ? "/web/index.html" : url.pathname;
  const filePath = path.normalize(path.join(rootDir, requestPath));

  if (!filePath.startsWith(rootDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const file = await readFile(filePath);
    const contentType = contentTypes[path.extname(filePath)] || "text/plain; charset=utf-8";
    res.writeHead(200, { "Content-Type": contentType });
    res.end(file);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}
