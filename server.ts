import { $ } from "bun";

const PORT = 4100;

// Kill any existing process on port 4100
try {
  const result = await $`lsof -ti:${PORT}`.text();
  if (result.trim()) {
    const pids = result.trim().split('\n');
    for (const pid of pids) {
      await $`kill -9 ${pid}`.quiet();
    }
    console.log(`Killed existing process(es) on port ${PORT}`);
  }
} catch {
  // No process running on port
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    let path = url.pathname;

    if (path === "/") {
      path = "/index.html";
    }

    const filePath = `./docs${path}`;
    const file = Bun.file(filePath);

    if (await file.exists()) {
      const contentType = getContentType(path);
      return new Response(file, {
        headers: { "Content-Type": contentType }
      });
    }

    return new Response("Not Found", { status: 404 });
  },
});

function getContentType(path: string): string {
  if (path.endsWith(".html")) return "text/html";
  if (path.endsWith(".js")) return "application/javascript";
  if (path.endsWith(".css")) return "text/css";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

console.log(`Tile Slicer running at http://localhost:${PORT}`);
