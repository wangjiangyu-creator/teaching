# Data Model

## Source

Drive-derived source metadata plus local curation state. Sources include title, Drive URL, MIME type, language, jurisdictions, teaching-use IDs, research themes, and a short searchable preview.

## CurationNote

Human-edited local note for a source. It stores research argument, teaching uses, research themes, classroom prompt, caution, author, and update time.

## TeachingUse

Stable ID used to organize the corpus by classroom use, such as `comparative-law-seminar`, `legal-education-history`, `research-methods`, `method-exemplars`, and `geopolitics-rule-of-law`.

## ResearchTheme

Human-readable theme label used for source filtering and source detail context, such as `Comparative law`, `Legal education reform`, and `Chinese legal scholarship`.

## ImportRun

Metadata about a manual Codex-assisted Drive import: source folder, import time, number of indexed sources, and import mode.
