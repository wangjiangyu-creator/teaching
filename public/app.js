const state = {
  data: null,
  sources: [],
  filtered: [],
  selectedId: null
};

const els = {
  metrics: document.querySelector("#metrics"),
  articleSubtitle: document.querySelector("#articleSubtitle"),
  articleAbstract: document.querySelector("#articleAbstract"),
  keywords: document.querySelector("#keywords"),
  contributions: document.querySelector("#contributions"),
  query: document.querySelector("#query"),
  teachingUse: document.querySelector("#teachingUse"),
  jurisdiction: document.querySelector("#jurisdiction"),
  theme: document.querySelector("#theme"),
  language: document.querySelector("#language"),
  sources: document.querySelector("#sources"),
  resultCount: document.querySelector("#resultCount"),
  sourceDetail: document.querySelector("#sourceDetail"),
  heroMap: document.querySelector("#heroMap"),
  heroCaption: document.querySelector("#heroCaption"),
  themeBars: document.querySelector("#themeBars"),
  publishFacts: document.querySelector("#publishFacts")
};

const palette = ["#0f766e", "#315c91", "#b45309", "#9f1239", "#52796f", "#6f4e7c", "#64748b"];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function countLabel(count, noun) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function setSelect(select, items, allLabel, mapper = (item) => ({ value: item, label: item })) {
  select.innerHTML = `<option value="">${escapeHtml(allLabel)}</option>`;
  for (const item of items) {
    const option = mapper(item);
    select.innerHTML += `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`;
  }
}

function tokenList(items, className = "chip") {
  return items.map((item) => `<span class="${className}">${escapeHtml(item)}</span>`).join("");
}

function normalize(value) {
  return String(value ?? "").toLowerCase();
}

function matchesTerms(haystack, terms) {
  const latinWords = haystack.match(/[a-z0-9]+/g) ?? [];
  return terms.every((term) => {
    if (/^[a-z0-9]{1,2}$/.test(term)) return latinWords.includes(term);
    return haystack.includes(term);
  });
}

function applyFilters() {
  const queryTerms = normalize(els.query.value).split(/\s+/).filter(Boolean);
  const teachingUse = els.teachingUse.value;
  const jurisdiction = els.jurisdiction.value;
  const theme = els.theme.value;
  const language = els.language.value;

  state.filtered = state.sources.filter((source) => {
    const haystack = normalize([
      source.title,
      source.language,
      source.jurisdictions.join(" "),
      source.teachingUses.map((id) => state.data.teachingUseLabels[id] ?? id).join(" "),
      source.researchThemes.join(" "),
      source.textPreview
    ].join(" "));

    return matchesTerms(haystack, queryTerms)
      && (!teachingUse || source.teachingUses.includes(teachingUse))
      && (!jurisdiction || source.jurisdictions.includes(jurisdiction))
      && (!theme || source.researchThemes.includes(theme))
      && (!language || source.language === language);
  });

  if (!state.filtered.some((source) => source.id === state.selectedId)) {
    state.selectedId = state.filtered[0]?.id ?? null;
  }

  renderSources();
  renderDetail();
  renderThemeBars();
}

function renderMetrics() {
  const stats = state.data.stats;
  const metrics = [
    { label: "Sources", value: stats.sourceCount, detail: "sanitized public records" },
    { label: "Jurisdictions", value: stats.jurisdictionCount, detail: "comparative settings" },
    { label: "Research themes", value: stats.themeCount, detail: "across doctrine and method" },
    { label: "Teaching uses", value: stats.teachingUseCount, detail: "for seminar design" }
  ];

  els.metrics.innerHTML = metrics.map((metric) => `
    <article class="metric">
      <span>${escapeHtml(metric.label)}</span>
      <strong>${escapeHtml(metric.value)}</strong>
      <p>${escapeHtml(metric.detail)}</p>
    </article>
  `).join("");
}

function renderArticle() {
  const article = state.data.article;
  els.articleSubtitle.textContent = article.subtitle;
  els.articleAbstract.textContent = article.abstract;
  els.keywords.innerHTML = tokenList(article.keywords, "keyword");
  els.contributions.innerHTML = article.contributions.map((item, index) => `
    <article class="contribution">
      <span>${String(index + 1).padStart(2, "0")}</span>
      <p>${escapeHtml(item)}</p>
    </article>
  `).join("");
}

function renderPublishFacts() {
  const repo = state.data.repository;
  els.publishFacts.innerHTML = `
    <dt>Repository</dt><dd>${escapeHtml(repo.name)}</dd>
    <dt>Pages path</dt><dd>${escapeHtml(repo.pagesPath)}</dd>
    <dt>Public artifact</dt><dd>${escapeHtml(repo.deployFolder)}</dd>
    <dt>Generated</dt><dd>${escapeHtml(new Date(state.data.generatedAt).toLocaleString())}</dd>
  `;
}

function renderOptions() {
  const options = state.data.options;
  setSelect(els.teachingUse, options.teachingUses, "All teaching uses", (item) => ({
    value: item.id,
    label: item.label
  }));
  setSelect(els.jurisdiction, options.jurisdictions, "All jurisdictions");
  setSelect(els.theme, options.researchThemes, "All themes");
  setSelect(els.language, options.languages, "All languages");
}

function renderSources() {
  els.resultCount.textContent = countLabel(state.filtered.length, "result");
  els.sources.innerHTML = state.filtered.map((source) => {
    const uses = source.teachingUses
      .slice(0, 2)
      .map((id) => state.data.teachingUseLabels[id] ?? id);
    return `
      <button class="source-row ${source.id === state.selectedId ? "active" : ""}" data-source-id="${escapeHtml(source.id)}">
        <span class="source-title">${escapeHtml(source.title)}</span>
        <span class="source-meta">${escapeHtml([source.language, ...source.jurisdictions.slice(0, 2)].join(" / "))}</span>
        <span class="source-preview">${escapeHtml(source.textPreview)}</span>
        <span class="chips">${tokenList(uses)}</span>
      </button>
    `;
  }).join("");

  for (const row of els.sources.querySelectorAll("[data-source-id]")) {
    row.addEventListener("click", () => {
      state.selectedId = row.dataset.sourceId;
      renderSources();
      renderDetail();
    });
  }
}

function renderDetail() {
  const source = state.sources.find((item) => item.id === state.selectedId);
  if (!source) {
    els.sourceDetail.innerHTML = `<p class="empty-state">No matching source.</p>`;
    return;
  }

  const teachingUses = source.teachingUses.map((id) => state.data.teachingUseLabels[id] ?? id);
  els.sourceDetail.innerHTML = `
    <div class="detail-header">
      <p class="eyebrow">Selected source</p>
      <h3>${escapeHtml(source.title)}</h3>
    </div>
    <p class="detail-preview">${escapeHtml(source.textPreview)}</p>
    <dl class="source-facts">
      <dt>Language</dt><dd>${escapeHtml(source.language)}</dd>
      <dt>Jurisdiction</dt><dd>${escapeHtml(source.jurisdictions.join(", "))}</dd>
      <dt>Source type</dt><dd>${escapeHtml(source.sourceType)}</dd>
      <dt>Updated</dt><dd>${escapeHtml(source.updatedAtLabel)}</dd>
    </dl>
    <h4>Teaching use</h4>
    <div class="chips">${tokenList(teachingUses)}</div>
    <h4>Research themes</h4>
    <div class="chips muted">${tokenList(source.researchThemes, "chip muted")}</div>
  `;
}

function scaleCanvas(canvas) {
  const context = canvas.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const bounds = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(bounds.width * ratio));
  canvas.height = Math.max(1, Math.floor(bounds.height * ratio));
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { context, width: bounds.width, height: bounds.height };
}

function renderHeroMap() {
  const { context, width, height } = scaleCanvas(els.heroMap);
  const stats = state.data.stats;
  const themes = stats.topThemes.slice(0, 5);
  const cx = width * 0.5;
  const cy = height * 0.48;
  const radius = Math.min(width, height) * 0.31;

  context.clearRect(0, 0, width, height);
  context.fillStyle = "#fbfbf7";
  context.fillRect(0, 0, width, height);

  themes.forEach((theme, index) => {
    const angle = (Math.PI * 2 * index) / themes.length - Math.PI / 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    context.strokeStyle = "rgba(31, 41, 51, 0.16)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(cx, cy);
    context.lineTo(x, y);
    context.stroke();
  });

  context.fillStyle = "#1f2933";
  context.beginPath();
  context.arc(cx, cy, 46, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#ffffff";
  context.font = "700 22px system-ui";
  context.textAlign = "center";
  context.fillText(stats.sourceCount, cx, cy - 2);
  context.font = "600 12px system-ui";
  context.fillText("sources", cx, cy + 17);

  themes.forEach((theme, index) => {
    const angle = (Math.PI * 2 * index) / themes.length - Math.PI / 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    const nodeRadius = 21 + Math.min(16, theme.count * 0.9);
    context.fillStyle = palette[index % palette.length];
    context.beginPath();
    context.arc(x, y, nodeRadius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#ffffff";
    context.font = "700 13px system-ui";
    context.textAlign = "center";
    context.fillText(theme.count, x, y + 5);

    context.fillStyle = "#1f2933";
    context.font = "650 12px system-ui";
    const label = theme.name.length > 21 ? `${theme.name.slice(0, 19)}...` : theme.name;
    const labelWidth = context.measureText(label).width;
    let labelX = x + (x > cx ? nodeRadius + 9 : -nodeRadius - 9);
    let alignment = x > cx ? "left" : "right";
    if (alignment === "left" && labelX + labelWidth > width - 12) {
      labelX = width - 12;
      alignment = "right";
    }
    if (alignment === "right" && labelX - labelWidth < 12) {
      labelX = 12;
      alignment = "left";
    }
    context.textAlign = alignment;
    context.fillText(label, labelX, y + 4);
  });

  els.heroCaption.textContent = `${countLabel(stats.sourceCount, "source")} across ${countLabel(stats.themeCount, "research theme")}`;
}

function renderThemeBars() {
  const { context, width, height } = scaleCanvas(els.themeBars);
  const themes = state.filtered
    .flatMap((source) => source.researchThemes)
    .reduce((map, theme) => map.set(theme, (map.get(theme) ?? 0) + 1), new Map());
  const top = [...themes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7);
  const max = Math.max(1, ...top.map((item) => item[1]));

  context.clearRect(0, 0, width, height);
  context.fillStyle = "#fbfbf7";
  context.fillRect(0, 0, width, height);
  context.font = "650 12px system-ui";
  context.textBaseline = "middle";

  top.forEach(([theme, count], index) => {
    const y = 22 + index * 27;
    const barWidth = ((width - 150) * count) / max;
    context.fillStyle = palette[index % palette.length];
    context.fillRect(12, y - 7, barWidth, 14);
    context.fillStyle = "#1f2933";
    const label = theme.length > 22 ? `${theme.slice(0, 20)}...` : theme;
    context.fillText(`${label} (${count})`, 22 + barWidth, y);
  });
}

async function init() {
  const response = await fetch("./data/site-data.json", { cache: "no-store" });
  if (!response.ok) throw new Error("Public site data could not be loaded.");
  state.data = await response.json();
  state.sources = state.data.sources;
  state.filtered = state.sources;
  state.selectedId = state.sources[0]?.id ?? null;

  renderMetrics();
  renderArticle();
  renderPublishFacts();
  renderOptions();
  renderHeroMap();
  applyFilters();

  for (const element of [els.query, els.teachingUse, els.jurisdiction, els.theme, els.language]) {
    element.addEventListener("input", applyFilters);
  }

  window.addEventListener("resize", () => {
    renderHeroMap();
    renderThemeBars();
  });
}

init().catch((error) => {
  document.querySelector("main").innerHTML = `
    <section class="error-panel">
      <h2>Site data unavailable</h2>
      <p>${escapeHtml(error.message)}</p>
    </section>
  `;
});
