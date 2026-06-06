import assert from "node:assert/strict";
import test from "node:test";
import { createMemoryStore } from "../server/store.mjs";

test("imports a Drive fixture into searchable source records", () => {
  const store = createMemoryStore();

  const sources = store.listSources({ query: "comparative China" });

  assert.ok(sources.length > 0);
  assert.ok(sources[0].title);
  assert.ok(sources[0].driveUrl.includes("drive.google.com"));
  assert.ok(sources.some((source) => source.researchThemes.includes("Comparative law")));
});

test("includes the NotebookLM project documents source", () => {
  const store = createMemoryStore();

  const source = store.getSource("notebooklm-project-documents-f0c9fa9c");
  const results = store.listSources({ query: "NotebookLM project documents" });

  assert.equal(source.title, "NotebookLM Project Documents");
  assert.equal(source.driveUrl, "https://notebooklm.google.com/notebook/f0c9fa9c-6a5b-41c3-87c3-7830729909ce");
  assert.equal(source.mimeType, "application/x-notebooklm-notebook");
  assert.ok(source.researchThemes.includes("Project documents"));
  assert.ok(results.some((result) => result.id === source.id));
});

test("filters by teaching use, jurisdiction, language, theme, and curation status", () => {
  const store = createMemoryStore();

  const results = store.listSources({
    teachingUse: "comparative-law-seminar",
    jurisdiction: "China",
    language: "English",
    theme: "Legal education reform",
    status: "uncurated"
  });

  assert.ok(results.some((source) => source.id === "legal-education-china-lun-kunlun"));
  assert.equal(results.every((source) => source.language === "English"), true);
});

test("includes Chinese research-method literature and method exemplars", () => {
  const store = createMemoryStore();

  const methods = store.listSources({ teachingUse: "research-methods", language: "Chinese" });
  const exemplars = store.listSources({ teachingUse: "method-exemplars", theme: "Judicial data and big data" });
  const options = store.getOptions();

  assert.ok(options.teachingUses.some((item) => item.id === "research-methods"));
  assert.ok(options.teachingUses.some((item) => item.id === "method-exemplars"));
  assert.ok(methods.some((source) => source.id === "zhang-cheng-method-coordinate-2018"));
  assert.ok(exemplars.some((source) => source.id === "xiong-bingwan-wang-junle-judgment-data-method-2023"));
});

test("saves human curation without being overwritten by an AI draft", async () => {
  const store = createMemoryStore();

  store.saveCuration("legal-education-china-lun-kunlun", {
    researchArgument: "Human note: professional legal education is the central benchmark.",
    teachingUses: ["comparative-law-seminar"],
    researchThemes: ["Legal education reform"],
    classroomPrompt: "How does the article define quality return?",
    caution: "Treat the reform prescription as historically situated."
  });

  const draft = await store.generateAiDraft("legal-education-china-lun-kunlun", async () => ({
    researchArgument: "AI note that should remain separate.",
    teachingUses: ["legal-education-history"],
    researchThemes: ["Professionalization"],
    classroomPrompt: "AI prompt",
    caution: "AI caution"
  }));

  const source = store.getSource("legal-education-china-lun-kunlun");

  assert.equal(draft.status, "draft");
  assert.equal(source.curation.researchArgument, "Human note: professional legal education is the central benchmark.");
  assert.equal(source.aiDraft.researchArgument, "AI note that should remain separate.");
});
