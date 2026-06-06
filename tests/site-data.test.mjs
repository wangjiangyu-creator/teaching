import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

test("builds sanitized public site data for GitHub Pages", () => {
  execFileSync(process.execPath, ["scripts/build_site_data.mjs"], { stdio: "pipe" });
  const data = JSON.parse(readFileSync("public/data/site-data.json", "utf8"));
  const serialized = JSON.stringify(data);

  assert.equal(data.repository.name, "teaching");
  assert.equal(data.repository.deployFolder, "public/");
  assert.equal(data.sources.length, 64);
  assert.match(data.article.title, /Teaching International Economic Law/);
  assert.ok(data.article.abstract.length > 200);
  assert.equal(serialized.includes("drive.google.com"), false);
  assert.equal(serialized.includes("notebooklm.google.com"), false);
  assert.equal(serialized.includes("driveUrl"), false);
  assert.equal(serialized.includes("aiDraft"), false);
  assert.equal(serialized.includes("curation"), false);
});
