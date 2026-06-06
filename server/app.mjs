import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { createAiService } from "./ai.mjs";
import { createFileStore } from "./store.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PUBLIC_DIR = join(ROOT, "public");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function apiError(response, error) {
  const statusCode = error.statusCode ?? 500;
  sendJson(response, statusCode, { error: error.message || "Unexpected server error." });
}

function serveStatic(request, response, pathname) {
  const normalizedPath = normalize(pathname === "/" ? "/index.html" : pathname);
  if (normalizedPath.includes("..")) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  let filePath = join(PUBLIC_DIR, normalizedPath);
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(PUBLIC_DIR, "index.html");
  }

  response.writeHead(200, {
    "Content-Type": mimeTypes[extname(filePath)] ?? "application/octet-stream"
  });
  createReadStream(filePath).pipe(response);
}

function filtersFromUrl(url) {
  return {
    query: url.searchParams.get("query") || "",
    teachingUse: url.searchParams.get("teachingUse") || "",
    jurisdiction: url.searchParams.get("jurisdiction") || "",
    language: url.searchParams.get("language") || "",
    theme: url.searchParams.get("theme") || "",
    status: url.searchParams.get("status") || ""
  };
}

export function createApp({ store = createFileStore(), ai = createAiService() } = {}) {
  return createServer(async (request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");

    try {
      if (url.pathname === "/api/status" && request.method === "GET") {
        sendJson(response, 200, store.getStatus({ aiConfigured: Boolean(ai.generateDraft) }));
        return;
      }

      if (url.pathname === "/api/options" && request.method === "GET") {
        sendJson(response, 200, { options: store.getOptions() });
        return;
      }

      if (url.pathname === "/api/import-runs" && request.method === "GET") {
        sendJson(response, 200, { importRuns: store.getImportRuns() });
        return;
      }

      if (url.pathname === "/api/sources" && request.method === "GET") {
        sendJson(response, 200, { sources: store.listSources(filtersFromUrl(url)) });
        return;
      }

      const sourceMatch = url.pathname.match(/^\/api\/sources\/([^/]+)$/);
      if (sourceMatch && request.method === "GET") {
        const source = store.getSource(decodeURIComponent(sourceMatch[1]));
        if (!source) sendJson(response, 404, { error: "Source not found." });
        else sendJson(response, 200, { source });
        return;
      }

      const curationMatch = url.pathname.match(/^\/api\/sources\/([^/]+)\/curation$/);
      if (curationMatch && request.method === "PUT") {
        const source = store.saveCuration(decodeURIComponent(curationMatch[1]), await readBody(request));
        sendJson(response, 200, { source });
        return;
      }

      const draftMatch = url.pathname.match(/^\/api\/sources\/([^/]+)\/ai-draft$/);
      if (draftMatch && request.method === "POST") {
        if (!ai.generateDraft) {
          sendJson(response, 503, { error: "OPENAI_API_KEY is not configured." });
          return;
        }
        const draft = await store.generateAiDraft(decodeURIComponent(draftMatch[1]), ai.generateDraft);
        sendJson(response, 200, { draft, source: store.getSource(decodeURIComponent(draftMatch[1])) });
        return;
      }

      if (url.pathname.startsWith("/api/")) {
        sendJson(response, 404, { error: "API route not found." });
        return;
      }

      serveStatic(request, response, url.pathname);
    } catch (error) {
      apiError(response, error);
    }
  });
}
