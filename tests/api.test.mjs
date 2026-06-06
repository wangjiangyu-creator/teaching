import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import { createApp } from "../server/app.mjs";
import { createMemoryStore } from "../server/store.mjs";

async function withServer(options, run) {
  const server = createApp(options);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    server.closeAllConnections?.();
    server.close();
  }
}

test("lists and reads sources", async () => {
  await withServer({ store: createMemoryStore() }, async (baseUrl) => {
    const listResponse = await fetch(`${baseUrl}/api/sources?query=legal%20education&teachingUse=legal-education-history`);
    const listBody = await listResponse.json();

    assert.equal(listResponse.status, 200);
    assert.ok(listBody.sources.length > 0);

    const detailResponse = await fetch(`${baseUrl}/api/sources/${listBody.sources[0].id}`);
    const detailBody = await detailResponse.json();

    assert.equal(detailResponse.status, 200);
    assert.equal(detailBody.source.id, listBody.sources[0].id);
  });
});

test("lists the NotebookLM project document through the API", async () => {
  await withServer({ store: createMemoryStore() }, async (baseUrl) => {
    const listResponse = await fetch(`${baseUrl}/api/sources?query=NotebookLM`);
    const listBody = await listResponse.json();
    const statusResponse = await fetch(`${baseUrl}/api/status`);
    const statusBody = await statusResponse.json();

    assert.equal(listResponse.status, 200);
    assert.equal(statusResponse.status, 200);
    assert.equal(statusBody.sourceCount, 64);
    assert.equal(statusBody.lastImport.sourceName, "Chinese journal search: research methods and method exemplars");
    assert.ok(listBody.sources.some((source) => source.id === "notebooklm-project-documents-f0c9fa9c"));
  });
});

test("saves curation edits through the API", async () => {
  await withServer({ store: createMemoryStore() }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/sources/legal-education-china-lun-kunlun/curation`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        researchArgument: "The article frames Chinese legal education around achievement, imbalance, and quality return.",
        teachingUses: ["comparative-law-seminar"],
        researchThemes: ["Legal education reform"],
        classroomPrompt: "What counts as professionalization in the author's account?",
        caution: "Use alongside more critical scholarship."
      })
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.match(body.source.curation.researchArgument, /quality return/);
  });
});

test("returns a clear missing-key error for AI drafts", async () => {
  await withServer({ store: createMemoryStore(), ai: { generateDraft: undefined } }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/sources/legal-education-china-lun-kunlun/ai-draft`, { method: "POST" });
    const body = await response.json();

    assert.equal(response.status, 503);
    assert.equal(body.error, "OPENAI_API_KEY is not configured.");
  });
});

test("reports private local status and avoids Drive write-back", async () => {
  await withServer({ store: createMemoryStore() }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/status`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.access, "local-private");
    assert.equal(body.driveWriteBack, false);
    assert.equal(body.importMode, "codex-assisted-manual");
  });
});
