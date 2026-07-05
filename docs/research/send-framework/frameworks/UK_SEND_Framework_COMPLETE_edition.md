# UK-Wide SEND/ALN/ASN Framework: Implementation Reference for RoutineStars
## COMPLETE EDITION — Parts A–H + Consolidated Deliverables

**Status:** National statutory framework compiled from authoritative UK government, legislative, and professional-body sources, current as of **5 July 2026**. This edition completes the original reference (which covered Parts A–C in full and stopped mid-way through Part D) by finishing Part D and adding Parts E, F, G and H, plus the three consolidated deliverables the original brief asked for (enum list, timescale table, gap list).

Where local-authority variation exists, the statutory floor is stated and the axis of variation is named in the Gap List (final section). This is a reference for building software, not legal advice — see the caveats in the Gap List before hard-coding anything with real legal consequences (deadlines, consent logic, retention).

---

## How to Read This Document

| Label | Meaning |
|---|---|
| **STATUTORY** | Binding requirement in primary or secondary legislation. Cite the Act/Regulation. |
| **STATUTORY GUIDANCE** | Code of Practice or ministerial guidance that bodies "must have regard to" (England/Wales/NI) or which is issued under the Act (Scotland). Departures require justification. |
| **GOOD PRACTICE** | Non-binding guidance from a recognised national body. Useful for credibility; not enforceable. |
| **PROPOSED / IN CONSULTATION** | Not yet law. Included because it will shape your data model, but must not be presented to users as current legal fact. |

**Nations covered:** England (E), Wales (W), Scotland (S), Northern Ireland (NI). Where an item is nation-specific it is labelled; where it applies UK-wide it is labelled "All."

---

## ⚠️ 2026 REFORM WATCH — read this before anything else

All four UK nations are simultaneously mid-reform right now. This doesn't change the statutory floor documented below — **everything in Parts A–H is the live, current law/guidance as of this compilation** — but it does mean your schema needs versioning headroom. Treat this table as a standing "check before you ship" list.

| Nation | What's moving | Where it stands (July 2026) | Why it matters to your data model |
|---|---|---|---|
| **England** | *Every Child Achieving and Thriving* schools white paper + **Education for All Bill** | White paper published 23 Feb 2026; 12-week consultation ("SEND Reform: Putting Children and Young People First") closed 18 May 2026; Bill confirmed in the King's Speech 13 May 2026 but not yet introduced/passed. DfE's formal consultation response is still pending. Source: gov.uk Education Hub, 13 May 2026; House of Commons Library briefing CBP-10550. | Proposes replacing today's binary "SEN Support vs EHCP" model with a 4-tier system (Universal → Targeted → Specialist, with a new **Individual Support Plan (ISP)** — a digital, non-appealable plan — for every child with identified SEND, and EHCPs reserved for "Specialist Provision Package" cases). **Explicit transitional protection: no changes to existing EHCP entitlements before September 2030.** Design your evidence/outcome schema so an "ISP" can slot in as a plan-type alongside EHC Plan/IDP/CSP/Statement without a rebuild. |
| **Wales** | ALN legislative framework review | Review launched Oct 2024, findings published 14 Oct 2025 (Cabinet Secretary oral statement to Senedd). Separately, a 4-year formative evaluation of the whole ALN system is running to 2027. Source: gov.wales, "Additional Learning Needs (ALN) legislative framework review." | The review flagged real inconsistency in how "ALN" is applied — official Senedd research shows the proportion of pupils identified as having ALN fell from 19.5% (2020/21) to 9.5% (2024/25), a 53% drop, which the Cabinet Secretary herself has linked to inconsistent application of the "universal provision" boundary rather than falling need. If you're building disposition logic that maps to the ALN/no-ALN threshold, expect the threshold definition itself to be a live target for clarification. |
| **Scotland** | Code of Practice refreshed to a 4th edition | *Supporting Children's Learning: Code of Practice, Fourth Edition* published for consultation Feb 2026, explicitly stated to make **no legislative change** — it's a clarity/readability rewrite of the 2017 edition, not a new law. Source: gov.scot, Fourth Edition 2026. | Cite the **Fourth Edition (2026)**, not the 2017 edition, in anything user-facing — paragraph numbers have moved. |
| **Northern Ireland** | SEN Reform Agenda & Delivery Plan 2025–2030 | Policy statement published 28 Aug 2025; Outcomes Framework 2025–2030 published 20 June 2025; draft 2026 SEN Regulations currently under extended Education Committee scrutiny at the NI Assembly (ministerial statement acknowledging delay, late June 2026). ~£570m committed over 5 years. Source: NI Dept of Education; NI Assembly briefing NIAR 108-2026. | NI is the most unsettled of the four: most of the SEND Act (NI) 2016 remains uncommenced 10 years after Royal Assent, the 1998 Code is still technically operative, and terminology is mid-swap (SENCO→Learning Support Co-ordinator; IEP→Personal Learning Plan) ahead of the new Regulations landing. Build your NI enums with both old and new terms as synonyms. |

---

# PART A — THE STATUTORY FRAMEWORK

## A1. Primary Legislation and Codes of Practice

| Nation | Statute | Key Sections | Regulations | Code of Practice | Code Status & Date |
|---|---|---|---|---|---|
| **England** | Children and Families Act 2014 (CFA 2014) | Part 3 (ss.20–40); s.20 (EHC needs assessments); s.21 (EHC plans); s.24 (duty to secure provision); s.27 (co-operation duties) | The Special Educational Needs and Disability Regulations 2014 (SI 2014/1530), amended 2024 for the SENCO qualification change (see F1) | SEND Code of Practice 0–25 (DfE, Jan 2015, revised Jan 2020) | **STATUTORY GUIDANCE** under CFA 2014 s.41; "must have regard to." Still the current Code as of this compilation — the 2026 white paper (see Reform Watch) has not yet resulted in a Code revision. |
| **Wales** | Additional Learning Needs and Education Tribunal (Wales) Act 2018 (ALNET Act 2018) | Whole Act; ss.5–10 (ALN duties on schools/FEIs); ss.11–24 (LA duties incl. IDP maintenance, revision, re-determination); ss.25–34 (statutory appeals/Tribunal) | The Additional Learning Needs (Wales) Regulations 2021 (SI 2021/673) | ALN Code for Wales 2021 (Welsh Government, 2021) | **STATUTORY GUIDANCE** issued under ALNET Act s.68; "must have regard to." Made 1 Sept 2021; phased implementation ran 2021–2023, with automatic transfer of remaining SEN-system children completing by 31 Aug 2023. Currently under legislative-framework review (see Reform Watch) — no Code amendment yet. |
| **Scotland** | Education (Additional Support for Learning) (Scotland) Act 2004 ("the 2004 Act"), as amended by the ASL (Scotland) Act 2009 and the Education (Scotland) Act 2016 | Whole Acts; Part 2 (ss.1–16, ASL planning); Part 3 (CSPs, ss.19–32); Part 4 (Tribunal/dispute resolution) | The Additional Support for Learning (Co-ordinated Support Plan) (Scotland) Regulations 2005, as amended 2010; The Additional Support for Learning (Appropriate Agency Request Period and Exceptions) (Scotland) Regulations 2005; The Additional Support for Learning Dispute Resolution (Scotland) Regulations 2005 | *Supporting Children's Learning: Code of Practice* — **Fourth Edition (2026)**, replacing the 2017 third edition | **STATUTORY GUIDANCE** issued under s.27 of the 2004 Act; "must have regard to." Fourth edition explicitly makes no change to the underlying law — a clarity/navigation rewrite only. |
| **Northern Ireland** | Special Educational Needs and Disability Act (Northern Ireland) 2016 (SEND Act NI 2016) | Whole Act, but only partially commenced (see below); underlying primary legislation is still the Education (NI) Order 1996, Articles 2–9 | Draft SEN Regulations (Northern Ireland) 2026 — under NI Assembly Education Committee scrutiny, not yet made | Code of Practice on the Identification and Assessment of SEN (DE/DoE NI, 1998), plus Supplements (2005–2020) on literacy, numeracy and behaviour — **still the operative Code** | **STATUTORY GUIDANCE** under the Education (NI) Order 1996 Art. 9. Only ss.1, 6, 15, 16, 18, 19 of the 2016 Act are commenced (s.1: duty to have regard to the child's views, commenced 18 Dec 2020; s.6: reduced time limits, commenced 30 Sept 2016). Ten years after Royal Assent, most of the 2016 Act — including the Learning Support Co-ordinator duty (replacing SENCO) and the Personal Learning Plan duty (replacing IEP) — awaits the new Regulations before it can be commenced. |

**Authoritative sources:**
- England SEND Code 0–25: https://www.gov.uk/government/publications/send-code-of-practice-0-to-25 (Gov.uk, rev. 2020-01-01)
- England White Paper / reform tracker: https://educationhub.blog.gov.uk/2026/05/schools-white-paper-what-parents-need-to-know-about-changes-to-the-send-system/ (13 May 2026)
- Wales ALN Code 2021: https://www.gov.wales/sites/default/files/publications/2025-01/250124-the-additional-learning-needs-code-for-wales-2021.pdf
- Wales ALN legislative review: https://www.gov.wales/additional-learning-needs-aln-legislative-framework-review (2025)
- Scotland Code, Fourth Edition 2026: https://www.gov.scot/publications/supporting-childrens-learning-code-practice-statutory-guidance-education-additional-support-learning-scotland-act-2004-fourth-edition-2026/
- NI New SEN Framework: https://www.education-ni.gov.uk/articles/new-sen-framework
- NI SEN Reform Agenda tracking: NI Assembly Research and Information Service briefing NIAR 108-2026 (Dec 2025/Apr 2026)

## A2. Legal Definition of SEN / ALN / ASN

| Nation | Term | Statutory test (paraphrased — see source for exact wording) |
|---|---|---|
| **England** | Special Educational Needs and Disability (SEND) | CFA 2014 s.20(1)–(2): a child/young person has SEN if they have a learning difficulty or disability calling for special educational provision. A learning difficulty is one "significantly greater" than the majority of peers, or one where mainstream ordinary provision wouldn't meet it. |
| **Wales** | Additional Learning Needs (ALN) | ALNET Act 2018 s.2: a person has ALN if they have a learning difficulty or disability calling for additional learning provision "substantially" more than the majority of peers receive. The 2025 legislative review found this "substantially more" test — deliberately different from England's "significantly greater" — is being applied inconsistently, and is a live source of the 53% fall in identified ALN since 2020/21 (see Reform Watch). |
| **Scotland** | Additional Support Needs (ASN) | 2004 Act s.1(1), as amended: a child/young person has ASN where, for whatever reason, they're unable to benefit adequately from school education without additional support. Deliberately broader than England/Wales — captures short-term and non-disability-related needs. |
| **Northern Ireland** | Special Educational Needs (SEN) | Education (NI) Order 1996 Art. 5–9 (still operative): a child has SEN if they have "a significantly greater difficulty in learning" than the majority of their year group, or a disability hindering use of generally-provided educational facilities. |

**Sources:** CFA 2014 Part 3: https://www.legislation.gov.uk/ukpga/2014/6/part/3 · ALNET Act 2018: https://www.legislation.gov.uk/anaw/2018/2 · ASL (Scotland) Act 2004: https://www.legislation.gov.uk/asp/2004/4 · Education (NI) Order 1996: https://www.legislation.gov.uk/nisi/1996/274 · Wales ALN review key issues (definition inconsistency): https://educationtribunal.gov.wales/sites/educationtribunal/files/2025-10/aln-review-2025-en.pdf

## A3. Categories / Areas of Need (Controlled Enums)

### England — SEND Code 0–25, Chapter 6, paras 6.28–6.35 — **STATUTORY GUIDANCE**

| Enum Value | Notes |
|---|---|
| `COMMUNICATION_AND_INTERACTION` | ASD (autism), SLCN (speech, language, communication needs) |
| `COGNITION_AND_LEARNING` | MLD, SLD, PMLD, SpLD (e.g. dyslexia) |
| `SOCIAL_EMOTIONAL_MENTAL_HEALTH` | ADHD, attachment disorders, mental health conditions. Code explicitly warns against equating this with "behaviour" alone |
| `SENSORY_AND_PHYSICAL` | Visual/hearing/multi-sensory impairment, physical disability |

### Wales — ALN Code 2021, Chapter 4 — **STATUTORY GUIDANCE**

Wales decouples areas of need from categories of provision — four "types of additional learning provision" instead:

| Enum Value |
|---|
| `ALP_CURRICULUM_AND_TEACHING` |
| `ALP_HEALTH_AND_SOCIAL_CARE` |
| `ALP_HUMAN_INTERACTION_SUPPORT` |
| `ALP_SENSORY_AND_PHYSICAL` |

### Scotland — no formal taxonomy in statute — **STATUTORY (broad definition) + GOOD PRACTICE categorisation**

| Enum Value (convention, not statutory) |
|---|
| `COGNITION_AND_LEARNING` |
| `COMMUNICATION_AND_INTERACTION` |
| `SOCIAL_EMOTIONAL_BEHAVIOURAL` |
| `SENSORY_AND_PHYSICAL` |
| `PHYSICAL_MOTOR` |
| `HEALTH_AND_PHYSICAL_CARE` |

### Northern Ireland — 1998 Code, Chapter 3 — **STATUTORY GUIDANCE**

| Enum Value |
|---|
| `COGNITION_AND_LEARNING` |
| `COMMUNICATION_AND_INTERACTION` |
| `BEHAVIOURAL_SOCIAL_AND_EMOTIONAL` |
| `SENSORY_AND_PHYSICAL` |

**Sources:** as Part A1, plus England Engagement Model areas (a related but distinct enum — see D3) and PfA outcome domains (D3).

## A4. Statutory Duties on Schools / LAs / Health Bodies

| Body | England (CFA 2014) | Wales (ALNET Act 2018) | Scotland (ASL Acts) | Northern Ireland (1996 Order + 2016 Act, partial) |
|---|---|---|---|---|
| **Schools** | s.42: reasonable adjustments & accessibility; SEN support duty; co-operate with LA on EHC needs assessment | ss.5–10: identify ALN, decide on IDP, secure ALP, maintain IDPs for transfer | s.4: authority must "provide additional support" as appropriate; duty to identify | Art. 6, 1996 Order: best-endeavours duty to meet SEN; co-operate with EA. (2016 Act's Learning Support Co-ordinator duty not yet commenced) |
| **Local Authority** | s.36–37: keep under review; s.20: assess; s.21: issue/maintain EHC plan; s.30: maintain; s.32: review annually | ss.13–14: decide; ss.14–18 IDP; ss.25–32 appeals; ss.34–37 dispute-avoidance duty | s.4 (identify/provide); Part 3 (CSPs for high-needs named cases) | Art. 5 (assess); Art. 7 (statement, preserved under transition) |
| **Health bodies** | s.26: NHS bodies must co-operate; designate a medical officer; supply advice within statutory advice-gathering window | ss.14–17: Health boards must secure "related ALP"; Designated Education Clinical Lead Officer (DECLO) duty per Local Health Board | s.19–20: health role in CSP process; must respond to EA requests for help within 10 weeks (2005 Regulations) | Art. 6: Health & Social Care Board co-operation duties |


---

# PART B — THE GRADUATED APPROACH / APDR CYCLE

## B1. APDR Structure by Nation

### England — SEND Code 0–25, Chapter 6, paras 6.39–6.65 — **STATUTORY GUIDANCE** ("Graduated Approach")

The cycle is the legal process for SEN Support (i.e. support *without* an EHCP).

| Phase | What Must Be Recorded | Who Is Responsible | Typical Cadence | "Good Evidence" Criteria |
|---|---|---|---|---|
| **ASSESS** | Holistic picture: strengths, parents' concerns, child's views, teacher observations, attainment, diagnostic history, external assessments; what has and hasn't worked | Class teacher (lead) with SENCO oversight; EP/SALT/OT on referral | Ongoing; refreshed each cycle | Multiple data sources over time, not a single incident; clear baseline |
| **PLAN** | Teaching adjustments; specific interventions; SMART outcomes/targets; named staff; review date | SENCO with parents and pupil | At least termly | Targets are SMART; plan is parent- and pupil-agreed |
| **DO** | Delivery of interventions; monitoring logs of frequency/duration; fidelity; amendments | Class teacher under SENCO oversight | Continuous | Quantitative (frequency) AND qualitative (response) engagement |
| **REVIEW** | What worked, impact on progress, decision: maintain / escalate to EHC needs assessment / change plan. Code para 6.65 is the only statutory escalation gateway | SENCO, teacher, parents, pupil, external | At least termly; annually as a minimum | Progress data vs baseline AND peers; named decision on next steps |

### Wales — ALN Code 2021, Chapter 4, paras 4.18–4.45 — **STATUTORY GUIDANCE** (IDP replaces APDR at school level)

Wales is **plan-led**, not cycle-led:

| Step | Action | Responsibility |
|---|---|---|
| 1. Decide | Whether the child has ALN and whether an IDP is required | ALNCo (school); LA on appeal/disagreement |
| 2. Plan | Develop/issue IDP with child & parent | ALNCo, teacher, parent, child |
| 3. Provide | Deliver provision; monitor progress | Teacher; ALNCo oversight |
| 4. Review | Review annually or earlier; record progress; revise | ALNCo; parent & child views captured |

If a parent disagrees with the school's "decide" outcome, s.70 gives a right of appeal to the LA, which must re-determine within a set period (Part E).

### Scotland — ASL Staged Intervention — **STATUTORY GUIDANCE**

Scotland does not impose an APDR framework in statute. The Fourth Edition Code (2026) sets out a **staged approach** (most local models use 3–6 stages) under the GIRFEC umbrella:

| Stage | Description |
|---|---|
| **Universal** | Universal provision; no additional needs identified |
| **Targeted** | Within-school intervention using internal resources; multi-agency advice at school's discretion |
| **Specialist** | Multi-agency involvement; may trigger a **Co-ordinated Support Plan (CSP)** under Part 3 of the 2004 Act |

Planning cycle: the GIRFEC assess–plan–action–review cycle. **Correction to earlier drafts of this reference:** the "Named Person" is *not* a distinct statutory role — Parts 4 and 5 of the Children and Young People (Scotland) Act 2014, which would have put a mandatory Named Person and Child's Plan on a statutory footing, were never commenced. Following the 2016 UK Supreme Court ruling on the information-sharing provisions (*Christian Institute and Others v Lord Advocate*), the Scottish Government announced in September 2019 it would seek to repeal Parts 4 and 5 rather than fix them. "Named person" and "lead professional" survive purely as **GIRFEC practice terms** — a co-ordinating function performed by whichever universal-service professional already knows the child (a teacher or health visitor), not a separate legal duty. Treat any `named_person` field in your schema as a **GOOD PRACTICE / practice-guidance** role, not a statutory one.

### Northern Ireland — Code of Practice (1998), 5-stage model — **STATUTORY GUIDANCE**, mid-transition

| Stage | Description | 2026 terminology shift |
|---|---|---|
| Stage 1 | School-based concerns; class teacher's responsibility | unchanged |
| Stage 2 | School-based action: SENCO involved; IEP-style plan | SENCO → **Learning Support Co-ordinator (LSC)**; IEP → **Personal Learning Plan (PLP)**, reviewed twice yearly |
| Stage 3 | School-based Plus: external services involved | Increasingly delivered via new **Local Impact Teams (LITs)** — 28 launched Sept 2025, multi-disciplinary (autism, language/communication, literacy, SEBD specialists) |
| Stage 4 | EA level: statutory assessment | EA should decide within **12 weeks** of completing the assessment |
| Stage 5 | Statement of SEN issued | Statutory assessment process target: **26 weeks** end-to-end |

NI's reform is genuinely live: LSC/PLP terminology is already in everyday use even though the underlying 2016 Act sections that would make them statutory (s.3 for PLP; the LSC duty) are not yet commenced — schools are "encouraged" to use them pending the new Regulations. Build both old and new labels as synonyms in your NI enum.

**Sources:** England Code 6.39–6.65: https://www.gov.uk/government/publications/send-code-of-practice-0-to-25 · Wales Code Ch.4: https://www.gov.wales/sites/default/files/publications/2025-01/250124-the-additional-learning-needs-code-for-wales-2021.pdf · Scotland Fourth Edition, Ch.3–4: https://www.gov.scot/publications/supporting-childrens-learning-code-practice-statutory-guidance-education-additional-support-learning-scotland-act-2004-fourth-edition-2026/ · Scotland Named Person repeal announcement: https://www.gov.scot/news/children-and-young-people-information-sharing-bill/ (Sept 2019) · NI New SEN Framework: https://www.education-ni.gov.uk/articles/new-sen-framework · NI current practice (LSC/PLP, timescales): https://www.ndcs.org.uk/advice-and-support/all-advice-and-support-topics/education-and-learning/education-and-learning-northern-ireland/additional-support-northern-ireland · NI Local Impact Teams: https://www.eani.org.uk/news/all-ni-schools-will-need-to-be-involved-in-providing-for-children-with-special-educational (27 Aug 2025)

## B2. Mapping Daily Routine Data → APDR Evidence (England) and Equivalents

| APDR Phase | RoutineStars Data That Evidences It | Why It Is Credible Evidence |
|---|---|---|
| ASSESS | Baseline routine-completion rates over 4–6 weeks; Zones of Regulation check-ins; environment tags (home/school/respite); time-on-step distributions; identified "tricky steps" | Multiple data points over time; same-child baseline comparison; environment-aware so trends are attributable |
| PLAN | SEN Support Plan targets derived directly from observed "tricky steps" (e.g. "complete morning routine independently within 15 mins, 4/5 school days") | Targets are SMART and data-backed; plan can be machine-drafted from observed data |
| DO | Logs of each intervention delivery (e.g. "visual schedule introduced"); adherence counts; fidelity markers | Continuously captured, not retrospectively reconstructed |
| REVIEW | Termly aggregated completion % per step; emotion-tag trends; comparison to baseline; streak data; trajectory (improving/flat/regressing) | Quantified impact; supports the Code para 6.65 decision-gate with trend data |

The mapping for Wales (IDP), Scotland (CSP/GIRFEC) and NI (Statement/PLP) is the same underlying data structure — only the document terminology differs. See Part H for how the SEND Tribunal actually weighs this kind of longitudinal, app-collected data against professional-report evidence — the two are not treated as equivalent, and your evidence exports should say so rather than imply parity.

## B3. SEN Support Plan / IDP Field Structure

### England — SEN Support Plan (no statutory form; Code 6.59 lists minimum content) — **STATUTORY GUIDANCE**

| Field | Type | Required? |
|---|---|---|
| Child's name, DOB, NCY, UPN | string/number | Yes |
| Setting name + DfE number | string | Yes |
| Date of plan; review date; cycle | dates | Yes |
| Area(s) of need (enum from A3) | enum (multi) | Yes |
| Strengths and what works | text | Yes |
| Parent/carer views | text | Yes |
| Child/young person views | text | Yes |
| External views (EP, SALT, OT, paediatrician, social worker, school nurse) | text per role | Yes where available |
| Identified needs | text per area | Yes |
| Provision (interventions, staffing, equipment) | structured | Yes |
| Outcomes/targets (SMART) | array of structured targets | Yes |
| Named staff and responsibilities | structured | Yes |
| Monitoring & measurement approach | text | Yes |
| Date of next review | date | Yes |
| Decision at review (continue/escalate/amend/exit) | enum | Yes (Code 6.65) |

### Wales — IDP field structure (ALN Code 2021, Ch.5) — **STATUTORY FORM**

| Field | Type | Notes |
|---|---|---|
| Plan type | enum: `SCHOOL_IDP` / `LA_IDP` | ALN Code 5.6+ |
| Date issued; date of next review | dates | At least annual |
| 1A–1C. Profile & responsibility | string | Biographical/contact + "About Me" person-centred profile |
| 2A. Description of ALN | text | Mapped to the "substantial additional provision" test |
| 2B. ALP to be provided (incl. outcomes) | structured: provision type, amount, who by, when, where | Must be "specified and quantified" (Ch.23) — vague language like "access to a TA" fails this test |
| 2C. ALP to be secured by an NHS body | structured | Kept separate from education-side provision; the 2025 review flagged this section as a live pain point for health-board delivery |
| 2D. Educational placement | structured | The 2025 review also flagged inconsistent LA practice on naming a placement here |
| Views of child/young person (s.12(4)) | text | Mandatory |
| Views of parents/carers | text | Mandatory |
| Transition arrangements | structured | |
| Signatures & dates | structured | Parent, child (where appropriate), ALNCo |

### Scotland — Co-ordinated Support Plan (CSP), Schedule under ss.19–25 — **STATUTORY DOCUMENT**

| Schedule field | Description |
|---|---|
| 1 | Child/young person's details |
| 2 | Summary of assessment |
| 3 | Educational, health and social-care needs identified |
| 4 | Objectives (outcomes) |
| 5 | Specific educational provision required |
| 6 | Specific health provision required |
| 7 | Specific social-care provision required |
| 8 | Other (e.g. voluntary) provision |
| 9 | Named persons (co-ordinator; multi-agency contacts) |
| 10 | Review arrangements |

A CSP is issued **only** when at least one named non-education agency (health or social work) confirms it will provide support — i.e. it's a high-needs, multi-agency plan. Most children with ASN have school-based plans, not CSPs.

### Northern Ireland — Personal Learning Plan (replacing IEP) + Statement of SEN — **STATUTORY GUIDANCE (1998 Code, Ch.6)**

PLP fields mirror England's SEN Support Plan but use "learning aims" rather than "outcomes," reviewed twice yearly. Statement fields (Articles 5–9, 1996 Order):

| Part | Content |
|---|---|
| 1 | Child details |
| 2 | Assessment details & contributions |
| 3 | Special educational needs (by area) |
| 4 | Special educational provision |
| 5 | Placement details |
| 6 | Named school/provision |
| 7 | Annual review arrangements |

**Sources:** as Part B1, plus Wales IDP structure/review findings: https://educationtribunal.gov.wales/sites/educationtribunal/files/2025-10/aln-review-2025-en.pdf · Wales practitioner guide: https://www.gov.wales/implementing-additional-learning-needs-and-education-tribunal-wales-act-2018-practitioner-guide-0

---

# PART C — KEY DOCUMENT STRUCTURES

## C1. One-Page Profile

**Origin:** Helen Sanderson Associates; used across SEND and adult social care in England, Wales and (by convention) Scotland/NI. **GOOD PRACTICE**, referenced in SEND Code 6.13–6.17.

| Section | Required Field | Content Type |
|---|---|---|
| (1) What people like and admire about me | text (multi-contributor) | Input from those who know the child well |
| (2) What's important to me | text | Child/parent voice |
| (3) How best to support me | text | Concrete adjustments and strategies |
| (4) Communication (national convention) | text | Speech / AAC / signs / objects / facial expressions |
| (5) Routine/sensory profile (convention, esp. autism) | text | Daily routine preferences; sensory triggers and supports |
| Header | metadata | Name, photo (optional), setting |

In Scotland this aligns with the GIRFEC "My World Triangle"; in Wales with IDP Section 1B.

## C2. Parental Narrative / "All About Me"

**Status:** GOOD PRACTICE, not statutory — but its absence is one of the most common drivers of tribunal-criticised LA practice in England. Referenced in SEND Code 6.40–6.46 ("assessment should draw on the parents' knowledge of the child").

| Section | Field | Content |
|---|---|---|
| 1 | Child details | Name, DOB, diagnosis (if any), communication, current setting |
| 2 | Parent/carer details | Names, contact, role |
| 3 | Strengths and what works | What the child enjoys, excels at, finds regulating |
| 4 | History of concerns | Chronological: when concerns began, what was tried, what worked |
| 5 | Presentation at home | Sleep, eating, self-care, emotions, transitions |
| 6 | Presentation at school/setting | Learning, attention, social, communication |
| 7 | Professional involvement | List + dates + outcomes (EP, paediatrician, SALT, OT, CAMHS, social worker, portage) |
| 8 | Parent concerns + hopes | What they want to achieve |
| 9 | Documents referenced | Diagnostic reports, IEPs/PLPs, EHC/ALN/CSP plans |
| 10 | Signature, date, version | Metadata |

**Templates:** IPSEA https://ipsea.org.uk/ · Contact https://contact.org.uk/ · Council for Disabled Children https://councilfordisabledchildren.org.uk/

## C3. EHC Plan / IDP / CSP — Statutory Sections

### England — EHC Plan (CFA 2014 s.21; Code Ch.9) — **STATUTORY FORM** (reg. 4–8, SI 2014/1530, Sch.1)

| Section | Title | Required Content | Appealable to Tribunal? |
|---|---|---|---|
| **A** | Views, interests and aspirations of child/YP and parents | First-person/paraphrased; aspirational | No |
| **B** | Special educational needs | Identified needs mapped to areas of need | **Yes** |
| **C** | Health needs related to SEN | Health needs linked to SEN | No (see extended jurisdiction, H1) |
| **D** | Social-care needs related to SEN | Social-care needs linked to SEN | No (see extended jurisdiction, H1) |
| **E** | Outcomes sought | SMART (Code 9.66); across education/health/social care; PfA focus for Yr 9+ | No |
| **F** | Special educational provision | Quantified — "must be specified" (Code 9.69) | **Yes** |
| **G** | Health provision reasonably required | Specified by NHS body | No |
| **H1** | Social-care provision under s.2 CSDPA 1970 | Specified by LA | No |
| **H2** | Other social-care provision | Optional | No |
| **I** | Placement | Named school/type | **Yes** |
| **J** | Personal budget arrangements | Where requested | No |
| **K** | Advice/information gathered for the assessment | List of all reports obtained | No |

Only Sections **B, F and I** carry a direct right of appeal (CFA 2014 s.51(2); confirmed current practice per IPSEA/SENDIASS guidance, 2026). Health and social-care content (C, D, G, H) can only be brought in via the Tribunal's non-binding "extended" jurisdiction when a B/F/I appeal is already live — see H1.

### Wales — IDP structure — **STATUTORY FORM** under ALNET Act s.12, ALN Code Ch.5. Field structure as B3 above. Health ALP (2C) is kept as a separate section from education ALP, by design — and is exactly the section the 2025 review found hardest for LAs and Local Health Boards to deliver against.

### Scotland — CSP structure — **STATUTORY FORM** under s.23. Field structure as B3 above. Distinctive feature: only issued when a non-education agency agrees to provide.

## C4. EHC Needs Assessment Request — Required Content

### England — **STATUTORY** (CFA 2014 s.20) + **STATUTORY GUIDANCE** (Code 9.11–9.22)

**Who can request:** child's parent (s.20(1)); young person 16–25; school/post-16 institution (s.20(3)); health body (s.20(3)(c)); LA on its own initiative (s.20(5)).

| Field | Content |
|---|---|
| 1. Child details | Name, DOB, address, NCY, UPN |
| 2. Reason for request | Summary narrative |
| 3. Evidence of SEN | Presenting needs across all four areas; what's been tried under SEN Support |
| 4. Parental evidence | "All About Me" narrative (C2) |
| 5. School/setting evidence | APDR cycle outcomes; progress data; interventions delivered; impact |
| 6. External professional evidence | EP, SALT, OT, paediatrician, CAMHS reports where available |
| 7. Why needs can't reasonably be met from resources normally available | The Code 9.14 test |
| 8. Views on whether assessment would help | Family's/school's views, plus parent's wish |
| 9. Consent | Parent consent for the LA to obtain advice |

### Wales — IDP/LA IDP trigger — **STATUTORY** (ALNET Act ss.11–14). School decides first; parent can request an LA IDP at any time (s.16); LA must decide within **12 weeks** of issuing the IDP notice (see Part E for the full timescale chain).

### Scotland — CSP request — **STATUTORY** (2004 Act s.6/s.10). Parent, child or agency may request the authority establish whether a CSP is needed; the authority has a **16-week** statutory period from confirming it will assess, to notifying its decision (Fourth Edition Code, para 122–124 — see Part E).

## C5. Annual Review Pack — England — **STATUTORY GUIDANCE** (Code Ch.9, paras 9.158–9.180)

| Document | Required Content | Source |
|---|---|---|
| Parent/Carer Report form | Views on progress; experience of provision; concerns; updated circumstances; questions | Convention/template (IPSEA/Contact) |
| Child/Young Person Views form | First-person or facilitated (see C6) | Code 9.166; good-practice templates |
| Setting/School Annual Review Report | Progress vs each outcome; updated provision map; intervention impact; transition planning (Yr 9+); recommendation to LA | DfE exemplar; LA-published templates |
| Updated external professional advice (as required) | New EP/SALT/OT/paediatrician input commissioned by LA | Code 9.169 |
| LA review decision document | LA decides within 4 weeks of the review whether to amend/maintain/cease | Code 9.176 + CFA 2014 s.32 |
| Phase transfer/transition plan | For Yr 5→6 and Yr 9 (PfA) transfers | Code 10.2+ |

**Wales equivalent:** ALN Code Ch.7 (IDP review, at least annual). **Scotland equivalent:** CSP review under s.10 of the 2004 Act — routine reviews completed within 12 weeks of the review-due date, absolute maximum 20 weeks with exceptions (Enquire, 2025; see Part E). **NI equivalent:** annual review of Statement, 1998 Code Ch.7; PLPs reviewed twice yearly.

## C6. Pupil Voice / Child Voice Capture — **STATUTORY GUIDANCE in all four nations**

| Field | Content |
|---|---|
| 1. Child details | Name, DOB, mode of communication |
| 2. Method of capture | Enum, see below |
| 3. Date and setting | Date, location |
| 4. Facilitator | Named adult + role |
| 5. Other present | Parent, sibling, friend |
| 6. Form of contribution | First person / paraphrase / multiple choice / drawings / photos / video / AAC transcript |
| 7. The child's views | Text/image/audio/video |
| 8. Communication access considerations | AAC device, signing, Makaton, objects of reference |
| 9. Cross-check/confirmation | Date and method of confirming this is what the child meant |

| Method | Source | Notes |
|---|---|---|
| One-Page Profile (child-led) | Helen Sanderson Associates | Person-centred |
| Talking Mats / mind-mapping | Talking Mats Ltd / NHS Education for Scotland | Visual; accessible for non-verbal |
| Choice boards (low-tech AAC) | Communication Trust / nasen | |
| AAC transcription (Proloquo2Go, Grid, LAMP) | Communication Trust | Requires transcription protocol |
| Draw-and-write | Open University / EEF | |
| Personal passport | SEND Code Ch.6 example | |

**Sources:** SEND Code 6.13–6.17, 9.166: https://www.gov.uk/government/publications/send-code-of-practice-0-to-25 · Council for Disabled Children: https://councilfordisabledchildren.org.uk/ · nasen: https://nasen.org.uk/ · Scotland's Children's Views Service (Fourth Edition Code, footnote 35): available where usual methods can't secure the child's views · Scotland "7 Golden Rules for Participation" (Children and Young People's Commissioner Scotland), footnoted in the Fourth Edition Code.
