import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SOURCES_PATH = join(ROOT, "data", "sources.json");
const IMPORTS_PATH = join(ROOT, "data", "import-runs.json");
const LITERATURE_PATH = join(ROOT, "data", "literature.json");
const ARTICLE_PATH = join(ROOT, "docs", "drafts", "teaching-iel-ai-geopolitics-publishable.md");
const OUTPUT_PATH = join(ROOT, "public", "data", "site-data.json");

const teachingUseLabels = {
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

const contributions = [
  "Reframes generative AI as an epistemic challenge to legal assessment, not only an academic integrity problem.",
  "Develops a legal two-lane-plus model: controlled verification, open AI-integrated research, and live professional defense.",
  "Treats comparison as a core method for teaching International Economic Law in a geoeconomic world.",
  "Links responsible AI use to professional ethics, source literacy, confidentiality, disclosure, and legal judgment.",
  "Identifies source infrastructure as pedagogy: curated corpora teach students how legal knowledge is made and tested."
];

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function matchSection(markdown, heading, nextHeadingPattern) {
  const pattern = new RegExp(`${heading}\\n+([\\s\\S]*?)(?=\\n${nextHeadingPattern})`);
  return markdown.match(pattern)?.[1].trim() ?? "";
}

function cleanMarkdown(value) {
  return value
    .replace(/\[\^[^\]]+\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseArticle() {
  const markdown = readFileSync(ARTICLE_PATH, "utf8");
  const title = markdown.match(/^#\s+(.+)$/m)?.[1].trim() ?? "Teaching Law";
  const subtitle = markdown.match(/^##\s+(.+)$/m)?.[1].trim() ?? "";
  const abstract = cleanMarkdown(matchSection(markdown, "### Abstract", "### Keywords"));
  const keywordsText = matchSection(markdown, "### Keywords", "## 1\\.");
  const keywords = keywordsText
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
  const sectionCount = [...markdown.matchAll(/^##\s+\d+\./gm)].length;
  const footnoteCount = [...markdown.matchAll(/^\[\^\d+\]:/gm)].length;

  return {
    title,
    subtitle,
    abstract,
    keywords,
    sectionCount,
    footnoteCount,
    contributions
  };
}

function sourceType(mimeType) {
  if (mimeType === "application/x-notebooklm-notebook") return "NotebookLM notebook";
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType?.includes("document")) return "Document";
  return "Source";
}

function updatedAtLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Unknown";
  return date.toISOString().slice(0, 10);
}

function countBy(items, mapper) {
  const counts = new Map();
  for (const item of items) {
    for (const value of mapper(item)) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function buildOptions(sources) {
  return {
    teachingUses: Object.entries(teachingUseLabels).map(([id, label]) => ({ id, label })),
    jurisdictions: [...new Set(sources.flatMap((source) => source.jurisdictions))].sort(),
    languages: [...new Set(sources.map((source) => source.language))].sort(),
    researchThemes: [...new Set(sources.flatMap((source) => source.researchThemes))].sort()
  };
}

function publicSource(source) {
  return {
    id: source.id,
    title: source.title,
    language: source.language,
    jurisdictions: source.jurisdictions,
    teachingUses: source.teachingUses,
    researchThemes: source.researchThemes,
    textPreview: source.textPreview,
    sourceType: sourceType(source.mimeType),
    updatedAtLabel: updatedAtLabel(source.updatedAt)
  };
}

function publicLiterature(item) {
  return {
    id: item.id,
    title: item.title,
    authors: item.authors,
    year: item.year,
    type: item.type,
    source: item.source,
    scope: item.scope,
    themes: item.themes,
    url: item.url,
    note: item.note
  };
}

function buildLiteratureOptions(items) {
  return {
    types: [...new Set(items.map((item) => item.type))].sort(),
    themes: [...new Set(items.flatMap((item) => item.themes))].sort(),
    scopes: [...new Set(items.map((item) => item.scope))].sort(),
    years: [...new Set(items.map((item) => item.year))].sort((a, b) => b - a)
  };
}

function assertNoPrivateLinks(siteData) {
  const serialized = JSON.stringify(siteData);
  const blocked = ["drive.google.com", "notebooklm.google.com", "driveUrl", "curation", "aiDraft"];
  const found = blocked.filter((term) => serialized.includes(term));
  if (found.length > 0) {
    throw new Error(`Public site data contains private fields or links: ${found.join(", ")}`);
  }
}

function buildSiteData() {
  const sources = readJson(SOURCES_PATH).map(publicSource);
  const literature = readJson(LITERATURE_PATH)
    .map(publicLiterature)
    .sort((a, b) => b.year - a.year || a.title.localeCompare(b.title));
  const imports = readJson(IMPORTS_PATH).map((item) => ({
    id: item.id,
    sourceName: item.sourceName,
    importedAt: item.importedAt,
    sourceCount: item.sourceCount,
    mode: item.mode
  }));
  const options = buildOptions(sources);
  const literatureOptions = buildLiteratureOptions(literature);
  const stats = {
    sourceCount: sources.length,
    literatureCount: literature.length,
    jurisdictionCount: options.jurisdictions.length,
    themeCount: options.researchThemes.length,
    teachingUseCount: options.teachingUses.length,
    languageCount: options.languages.length,
    topThemes: countBy(sources, (source) => source.researchThemes).slice(0, 10),
    topLiteratureThemes: countBy(literature, (item) => item.themes).slice(0, 10),
    topJurisdictions: countBy(sources, (source) => source.jurisdictions).slice(0, 10),
    languageBreakdown: countBy(sources, (source) => [source.language])
  };

  return {
    generatedAt: new Date().toISOString(),
    repository: {
      name: "teaching",
      pagesPath: "/teaching/",
      deployFolder: "public/"
    },
    teachingUseLabels,
    article: parseArticle(),
    sources,
    literature,
    imports,
    options,
    literatureOptions,
    stats
  };
}

const siteData = buildSiteData();
assertNoPrivateLinks(siteData);
mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify(siteData, null, 2)}\n`, "utf8");
console.log(`Wrote ${OUTPUT_PATH}`);
