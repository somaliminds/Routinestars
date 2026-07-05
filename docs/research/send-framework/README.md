# SEND / ALN / ASN Framework Research

Reference material for RoutineStars' EHCP evidence-engine and multi-professional
portal features. Compiled July 2026 from three independent AI research agents,
grounded in the actual England SEND Code of Practice (see `primary-sources/`).

**Purpose:** give the data model, PDF exports, timescale trackers, and
professional-access controls a *statutorily correct* foundation across all four
UK nations (England SEND/EHCP, Wales ALN/IDP, Scotland ASN/CSP, Northern Ireland
SEN). Local-authority-specific material is kept separate and flagged non-authoritative.

---

## What to read first

**`frameworks/UK_SEND_National_Framework.md` is the gold copy.** It is the most
complete, self-contained, implementable version — Parts A–H plus consolidated
enums, a machine-readable timescale table, a gap list, and a source index. Start
there. Everything else corroborates or supports it.

---

## Directory map

| Path | What it is | Authority |
|---|---|---|
| `frameworks/UK_SEND_National_Framework.md` | **Gold copy.** Full national framework, implementable enums + timescales. | Curated (agent 1) |
| `frameworks/UK_SEND_Framework_COMPLETE_edition.md` | Second agent's version. Adds a **2026 Reform Watch** callout worth reading. | Curated (agent 2) |
| `agent3-split/PART_A…G_H.md` | Third agent's split-file version (A statutory, B APDR, C documents, F professional ecosystem, G/H data-protection + evidence). | Curated (agent 3) |
| `local-examples/milton-keynes-*.md` | Milton Keynes LA document catalogues. **Non-authoritative — reference only.** Useful as a concrete example of what one LA's implementation looks like; do NOT hardcode MK forms/URLs nationally. | Local example |
| `primary-sources/send-code-of-practice-england*.{pdf,txt}` | The actual England SEND Code of Practice (statutory guidance) + extracted text for searching. | **Primary source** |
| `primary-sources/send-court-code-of-practice.pdf` | SEND tribunal/court reference. | Primary source |

Three independent agents produced the same framework from the same primary
source — that cross-validation is why this is trustworthy enough to build on.

---

## Key facts to carry into the build

1. **RoutineStars' existing `ehcp_outcomes` categories already match England's 4
   statutory areas of need** (Communication & Interaction; Cognition & Learning;
   Social, Emotional & Mental Health; Sensory &/or Physical). See framework §A3.
2. **Only England has a statutory area-of-need enum.** Wales/Scotland/NI must be
   stored as free-text + optional descriptive tags — never forced into England's
   enum. See §A3 implementation note.
3. **§B2 is a ready-made mapping** of RoutineStars daily-completion data → each
   APDR evidence phase (Assess/Plan/Do/Review). This is the backbone of the
   APDR-tracking feature.
4. **§D1 writes SMART-outcome examples that literally cite RoutineStars data** —
   the framework itself treats app-collected routine data as strong evidence.
5. **§H1 evidence-quality standards** (longitudinal, dated, quantified,
   triangulated, multi-environment, includes child voice) describe exactly what
   RoutineStars collects.
6. **The professional portal is governance-first, not screens-first.** §G makes
   a DPIA, a scoped/time-limited/withdrawable consent ledger, and a per-access
   audit log **mandatory** before handling under-13 special-category data. This
   is the Professional-tier moat.
7. **Reform in flight (2025-2026):** England SEND reform + NI SEN reform are
   changing. Keep statutory timescales and section structures in config/data,
   not baked into code.

---

## What was intentionally NOT copied

- Unrelated files found in the source folder (a haulage-company sales lead list:
  `prospects.*`, `NexusLinkR*.xlsx`, `Untitled spreadsheet.xlsx`; a `test.txt`
  "hello world"; an empty `sample2.md`). These have nothing to do with SEND.
- Raw HTML source scrapes (IPSEA, judiciary, NAS, NI, Scotland pages) — bulky
  evidence-trail captures already distilled into the curated frameworks. Re-fetch
  from the source URLs in the framework's source index if provenance is ever needed.

---

## Related

- Feature planning lives in the conversation history; the deferred boot-perf fix
  is tracked separately in project memory (`get_boot_context`).
- The production readiness audit (`PRODUCTION_READINESS_AUDIT.md` at repo root)
  covers the app's current security/compliance posture — relevant to the DPIA.
