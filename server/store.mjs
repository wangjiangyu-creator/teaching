import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DATA_DIR = join(ROOT, "data");
const SOURCES_PATH = join(DATA_DIR, "sources.json");
const IMPORTS_PATH = join(DATA_DIR, "import-runs.json");
const CURATIONS_PATH = join(DATA_DIR, "curations.json");
const AI_DRAFTS_PATH = join(DATA_DIR, "ai-drafts.json");

export const teachingUseLabels = {
  "legal-education-history": "Legal education history",
  "comparative-law-seminar": "Comparative law seminar",
  "ai-and-law-pedagogy": "AI and law pedagogy",
  "geopolitics-rule-of-law": "Geopolitics and rule of law",
  "international-law-context": "International law context",
  "curriculum-design": "Curriculum design",
  "professional-ethics-skills": "Professional ethics and skills",
  "taiwan-hong-kong-comparison": "Taiwan/Hong Kong comparison",
  "china-law-theory": "Chinese legal theory",
  "research-methods": "Research methods",
  "method-exemplars": "Method exemplars"
};

function readJson(path, fallback) {
  if (!existsSync(path)) return structuredClone(fallback);
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalized(value) {
  return String(value ?? "").toLowerCase();
}

function deriveStatus(source, curation, aiDraft) {
  if (curation?.researchArgument?.trim()) return "curated";
  if (aiDraft?.researchArgument?.trim()) return "draft";
  return "uncurated";
}

function combineSource(source, curation, aiDraft) {
  const combined = {
    ...source,
    curation: curation ?? null,
    aiDraft: aiDraft ?? null
  };
  combined.curationStatus = deriveStatus(source, combined.curation, combined.aiDraft);
  return combined;
}

function matchesQuery(source, query) {
  const terms = normalized(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = normalized([
    source.title,
    source.language,
    source.jurisdictions?.join(" "),
    source.teachingUses?.map((id) => teachingUseLabels[id] ?? id).join(" "),
    source.researchThemes?.join(" "),
    source.textPreview,
    source.curation?.researchArgument,
    source.aiDraft?.researchArgument
  ].filter(Boolean).join(" "));
  return terms.every((term) => haystack.includes(term));
}

function validateNote(note) {
  return {
    researchArgument: String(note?.researchArgument ?? "").trim(),
    teachingUses: asArray(note?.teachingUses).map(String),
    researchThemes: asArray(note?.researchThemes).map(String),
    classroomPrompt: String(note?.classroomPrompt ?? "").trim(),
    caution: String(note?.caution ?? "").trim()
  };
}

export function createStore({
  sources = readJson(SOURCES_PATH, []),
  imports = readJson(IMPORTS_PATH, []),
  curations = readJson(CURATIONS_PATH, {}),
  aiDrafts = readJson(AI_DRAFTS_PATH, {}),
  persist = true
} = {}) {
  const state = {
    sources: structuredClone(sources),
    imports: structuredClone(imports),
    curations: structuredClone(curations),
    aiDrafts: structuredClone(aiDrafts)
  };

  function persistCurations() {
    if (persist) writeJson(CURATIONS_PATH, state.curations);
  }

  function persistAiDrafts() {
    if (persist) writeJson(AI_DRAFTS_PATH, state.aiDrafts);
  }

  function getCombined(id) {
    const source = state.sources.find((item) => item.id === id);
    if (!source) return null;
    return combineSource(source, state.curations[id], state.aiDrafts[id]);
  }

  return {
    listSources(filters = {}) {
      return state.sources
        .map((source) => combineSource(source, state.curations[source.id], state.aiDrafts[source.id]))
        .filter((source) => matchesQuery(source, filters.query))
        .filter((source) => !filters.teachingUse || source.teachingUses.includes(filters.teachingUse) || source.curation?.teachingUses?.includes(filters.teachingUse))
        .filter((source) => !filters.jurisdiction || source.jurisdictions.includes(filters.jurisdiction))
        .filter((source) => !filters.language || source.language === filters.language)
        .filter((source) => !filters.theme || source.researchThemes.includes(filters.theme) || source.curation?.researchThemes?.includes(filters.theme))
        .filter((source) => !filters.status || source.curationStatus === filters.status)
        .sort((a, b) => {
          if (a.curationStatus !== b.curationStatus) {
            const rank = { draft: 0, uncurated: 1, curated: 2 };
            return rank[a.curationStatus] - rank[b.curationStatus];
          }
          return a.title.localeCompare(b.title);
        });
    },
    getSource(id) {
      return getCombined(id);
    },
    getImportRuns() {
      return structuredClone(state.imports);
    },
    getOptions() {
      const sources = state.sources;
      return {
        teachingUses: Object.entries(teachingUseLabels).map(([id, label]) => ({ id, label })),
        jurisdictions: [...new Set(sources.flatMap((source) => source.jurisdictions))].sort(),
        languages: [...new Set(sources.map((source) => source.language))].sort(),
        researchThemes: [...new Set(sources.flatMap((source) => source.researchThemes))].sort(),
        statuses: ["uncurated", "draft", "curated"]
      };
    },
    getStatus({ aiConfigured = Boolean(process.env.OPENAI_API_KEY) } = {}) {
      const combined = state.sources.map((source) => combineSource(source, state.curations[source.id], state.aiDrafts[source.id]));
      return {
        access: "local-private",
        driveWriteBack: false,
        importMode: "codex-assisted-manual",
        sourceCount: state.sources.length,
        curatedCount: combined.filter((source) => source.curationStatus === "curated").length,
        draftCount: combined.filter((source) => source.curationStatus === "draft").length,
        aiConfigured,
        lastImport: state.imports[0] ?? null
      };
    },
    saveCuration(id, note) {
      if (!getCombined(id)) {
        const error = new Error("Source not found.");
        error.statusCode = 404;
        throw error;
      }
      state.curations[id] = {
        ...validateNote(note),
        updatedAt: new Date().toISOString(),
        author: "local"
      };
      persistCurations();
      return getCombined(id);
    },
    async generateAiDraft(id, generator) {
      const source = getCombined(id);
      if (!source) {
        const error = new Error("Source not found.");
        error.statusCode = 404;
        throw error;
      }
      const note = validateNote(await generator(source));
      state.aiDrafts[id] = {
        ...note,
        status: "draft",
        generatedAt: new Date().toISOString()
      };
      persistAiDrafts();
      return state.aiDrafts[id];
    }
  };
}

export function createMemoryStore() {
  return createStore({
    sources: readJson(SOURCES_PATH, []),
    imports: readJson(IMPORTS_PATH, []),
    curations: {},
    aiDrafts: {},
    persist: false
  });
}

export function createFileStore() {
  return createStore();
}
