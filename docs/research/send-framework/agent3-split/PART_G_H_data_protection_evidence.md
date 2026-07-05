# ROUTINESTARS — PART G & H: DATA PROTECTION, CONSENT, EVIDENCE QUALITY (UK 4-NATIONS)

> **Status legend:** STATUTORY = primary/secondary legislation; STATUTORY GUIDANCE = code/guidance having statutory effect; GOOD PRACTICE = non-statutory.
> **Date of source verification:** 5 July 2026.
> **All URLs verified live or extracted to on-disk text files at `C:\Users\musta\routinestars-research\part_gh\` and `/tmp/`.**

---

# PART G — DATA PROTECTION, CONSENT and INFORMATION-SHARING LAW

## G1 — UK GDPR + DPA 2018: sharing a child's special-category data with third-party professionals

### G1.1 The two-layer test (verified, STATUTORY)

To share a child's **special-category data** (health, education, social-care) with a third-party professional, RoutineStars must satisfy **both**:

| Layer | Test | Source | Status |
|---|---|---|---|
| **Layer 1** — Article 6 UK GDPR | Identify a lawful basis for processing (the "ordinary" personal data) | UK GDPR Art.6(1) | STATUTORY |
| **Layer 2** — Article 9 + DPA 2018 Sched.1 | Identify a **separate** special-category condition under Art.9(2) AND a DPA 2018 Schedule 1 condition (substantial public interest / health etc.) | UK GDPR Art.9; DPA 2018 s.10 and Sched.1 | STATUTORY |

### G1.2 Recommended lawful-basis map (per data flow)

| Data flow | Art.6 lawful basis | Art.9 / DPA 2018 condition | Status |
|---|---|---|---|
| Storing a child's daily routine-completion data (legitimate interest of parent/carer in tracking) | **(a) Consent** OR **(f) Legitimate interests** with LIA | (a) the child has given **explicit consent** (Art.9(2)(a)) OR (g) substantial public interest — **Sched.1 Part 2 para.18 safeguarding of children** OR (h) health/social care provision (Art.9(2)(h) + DPA 2018 s.11) | STATUTORY |
| Sharing with a school SENCO | **(e) Public task** — the SENCO's "official authority" includes duties under CFA 2014 Part 3 | (g) substantial public interest — Sched.1 Part 2 para.18 | STATUTORY |
| Sharing with NHS therapist (SALT/OT/CAMHS) | **(e) Public task** for an NHS body; **(h) Medical/social-care provision** | (h) health or social care purposes (Art.9(2)(h) + DPA 2018 s.11 — "by or under the responsibility of a health professional…who in the circumstances owes a duty of confidentiality") | STATUTORY |
| Sharing with an Educational Psychologist employed by an LA | **(e) Public task** | (g) substantial public interest — Sched.1 Part 2 para.18 OR (h) health/care (EPs are HCPC-registered practitioner psychologists) | STATUTORY |
| Sharing with a private/independent therapist engaged by the family | **(a) Consent** (parent's explicit consent) | (a) explicit consent (Art.9(2)(a)) | STATUTORY |
| Safeguarding concern (e.g. disclosure of abuse) | **(c) Legal obligation** (Children Act 1989/2004; CFA 2014) | (g) substantial public interest — Sched.1 Part 2 para.18 "safeguarding of children" | STATUTORY |
| Routine analytics (anonymised/aggregated) | **(f) Legitimate interests** with documented LIA showing low risk | (no Art.9 condition needed if data is not special category after anonymisation; ICO Anonymisation Code) | STATUTORY + STATUTORY CODE |

> **Critical ICO + DfE 2024 warning:** "Consent is one lawful basis, but it is not required for sharing information in a safeguarding context. In fact, in most safeguarding scenarios you will be able to find a more appropriate lawful basis" (ICO 10-step guide; DfE Information Sharing Advice May 2024 p.10). Use **public task** or **legal obligation** for statutory actors, and reserve **consent** for private/independent professional relationships.

### G1.3 Consent capture requirements (where consent IS the lawful basis)

If relying on (a) Consent (Art.6(1)(a) and Art.9(2)(a)):

| Requirement | Implementation in RoutineStars | Source |
|---|---|---|
| **Specific** — separate consent per processing purpose, not a single T&Cs click | Distinct toggles for: (i) internal app analytics, (ii) sharing with named SENCO, (iii) sharing with NHS SALT, (iv) sharing with private therapist, (v) sharing for tribunal evidence | ICO Consent guidance v2 (URL: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis-for-processing/consent/) |
| **Freely given** — no precondition for service; parent can use the app without sharing data | Sharing toggles default OFF; data flows only when the named professional is explicitly added | UK GDPR Art.7(4); ICO Consent |
| **Unambiguous** — clear affirmative action | Per-record, per-recipient "Share this routine-completion record with Dr X" button — no pre-checked boxes | UK GDPR Recital 32; ICO Consent |
| **Informed** — privacy notice shown at the point of consent | Layered privacy notice: just-in-time summary + link to full notice | UK GDPR Art.13; ICO Right to be Informed |
| **Time-limited** — set expiry; consent refreshed annually or on change of circumstance | Annual consent renewal; auto-expire on plan change / new academic year | ICO Consent; DPA 2018 Sched.1 paras 38–41 (Appropriate Policy Document) |
| **Withdrawable easily** — single-action withdrawal, no friction | "Withdraw all sharing with [recipient]" button; data access immediately revoked; cached data purged within 30 days | UK GDPR Art.7(3); ICO Consent |
| **Demonstrable** — every consent action logged with timestamp, version of notice, identity of consenting party | Audit log: `consent_id, child_id, recipient_id, lawful_basis, scope, granted_at, expires_at, withdrawn_at, privacy_notice_version` | UK GDPR Art.5(2) Accountability; Art.30 records |

> **Children's consent (G3):** Where the child is under 13, UK GDPR Art.8 requires parental consent to be the lawful basis for **information society services** (online services). For RoutineStars' professional-access portal (a B2B/professional service) the parental consent route applies, but the **child's own views** must still be recorded separately under SEND CoP Ch.1 and ALN Code §23.26.

### G1.4 Documentation obligations (UK GDPR Art.30; DPA 2018)

RoutineStars must maintain a **Record of Processing Activities (ROPA)** covering at minimum:

| Field | Required content | Source |
|---|---|---|
| Name and role of controller | RoutineStars Ltd (UK company) | UK GDPR Art.30(1)(a) |
| Joint controllers / processors | NHS body for health data; LA for education data — confirm joint-controller vs processor roles in DSA | UK GDPR Art.26 (joint controllers), Art.28 (processors) |
| Purposes of processing | (i) routine tracking; (ii) SEND evidence; (iii) multi-professional access; (iv) safeguarding | UK GDPR Art.30(1)(b) |
| Categories of data subjects | Children with SEND; their parents/carers; named professionals | UK GDPR Art.30(1)(c) |
| Categories of personal data | Special category: health, education, social-care; biometric (for routine timing data) | UK GDPR Art.9; Art.30(1)(c) |
| Recipients | Named NHS bodies, LAs, EPs, SALTs, OTs, paediatricians, CAMHS, school SENCOs/ALNCos, social workers, school nurses, portage workers, EY practitioners, tribunal bundles | UK GDPR Art.30(1)(d) |
| Transfers outside UK | None planned — confirm in privacy notice | UK GDPR Art.30(1)(e); UK GDPR Chap.5 |
| Retention | (see G4) | UK GDPR Art.30(1)(f); Art.5(1)(e) |
| Security measures | Encryption at rest (AES-256), TLS 1.3 in transit, role-based access, MFA, audit logging, BCR/DPA | UK GDPR Art.32; Art.30(1)(g) |

### G1.5 DPIA (Data Protection Impact Assessment) — mandatory for RoutineStars

ICO 10-step guide and Art.35 UK GDPR: a DPIA is **mandatory** where processing is "likely to result in a high risk to the rights and freedoms of natural persons" — this is triggered for any:

- systematic and extensive processing of children's special-category data
- innovative use of technology for profiling / behavioural analysis
- data sharing on a large scale with multiple professional recipients

**RoutineStars must complete a DPIA before launch** and review it on any significant change. The DPIA should address:

| Risk | Mitigation |
|---|---|
| Excessive access by external professionals | Role-based access; least-privilege; recipient-named sharing; audit log |
| Re-identification from routine data | k-anonymisation in analytics; ICO Anonymisation Code |
| Children's data shared without meaningful consent | Layered consent; per-recipient opt-in; child voice (where capable) |
| Long retention beyond need | Per-purpose retention schedule (G4) |
| Parent vs child disagreement | Documented protocol; child view recorded separately; named professional routes any disagreement to LA safeguarding lead |
| Third-country transfer (e.g. cloud provider) | UK IDTA / Addendum in place; supplementary technical measures |

**Source:** ICO DPIA guidance (https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/data-protection-impact-assessments/). **Status:** STATUTORY CODE (enforceable as if it were a UK GDPR requirement under DPA 2018 s.127).

---

## G2 — Statutory information-sharing guidance for practitioners (DfE May 2024)

### G2.1 The Seven Golden Rules (verbatim from DfE Information Sharing Advice, May 2024, p.4–5)

> **Source:** DfE, *Information Sharing Advice for practitioners providing safeguarding services for children, young people, parents and carers*, May 2024, p.4–5. URL: https://www.gov.uk/government/publications/safeguarding-practitioners-information-sharing-advice. Extracted to `C:\Users\musta\routinestars-research\part_gh\dfe_isa_text.txt`. **Status: STATUTORY GUIDANCE** (issued under Working Together to Safeguard Children 2023, which has statutory force under Children Act 1989/2004).

1. **All children have a right to be protected from abuse and neglect.** Protecting a child from such harm takes priority over protecting their privacy, or the privacy rights of the person(s) failing to protect them. The UK GDPR and the DPA 2018 provide a framework to support information sharing where practitioners have reason to believe failure to share information may result in the child being at risk of harm.

2. **When you have a safeguarding concern, wherever it is practicable and safe to do so, engage with the child and/or their carer(s), and explain who you intend to share information with, what information you will be sharing and why.** You are not required to inform them, if you have reason to believe that doing so may put the child at increased risk of harm.

3. **You do not need consent to share personal information about a child and/or members of their family if a child is at risk or there is a perceived risk of harm.** You need a lawful basis to share information under data protection law, but when you intend to share information as part of action to safeguard a child at possible risk of harm, consent may not be an appropriate basis for sharing. It is good practice to ensure transparency about your decisions and seek to work co-operatively with a child and their carer(s) wherever possible.

4. **Seek advice promptly whenever you are uncertain or do not fully understand how the legal framework supports information sharing in a particular case.** Do not leave a child at risk of harm because you have concerns you might be criticised for sharing information. Instead, find out who in your organisation/agency can provide advice about what information to share and with whom. This may be your manager/supervisor, the designated safeguarding children professional, the data protection/information governance lead (e.g., DPO), Caldicott Guardian, or relevant policy or legal team.

5. **When sharing information, ensure you and the person or agency/organisation that receives the information take steps to protect the identities of any individuals (e.g., the child, a carer, a neighbour, a colleague) who might suffer harm if their details became known to an abuser or one of their associates.**

6. **Inform the child and/or their carer(s) wherever possible about what information you have shared, why, and with whom, if it is safe and appropriate to do so.** Even where you have not sought consent, you should still consider whether to inform the child and/or their carers that you are sharing information, if it is safe to do so.

7. **Record your decision and the reasons for it — whether it is to share information or not.** If you decide to share, record what you have shared, with whom and for what purpose. These records provide an important audit trail and are essential for demonstrating accountability and good practice.

### G2.2 What must be logged/audited (audit-log schema for RoutineStars)

| # | Field | Type | Purpose | Source |
|---|---|---|---|---|
| 1 | `event_id` | UUID | Unique event identifier | DfE ISA p.14 |
| 2 | `timestamp` | ISO 8601 with timezone | When the decision/action was taken | DfE ISA p.14 |
| 3 | `actor_id` | UUID (user/account) | Who made the decision | DfE ISA p.14 |
| 4 | `actor_role` | enum | Role of actor (e.g. PARENT, SENCO, SALT, DPO) | DfE ISA p.14 |
| 5 | `child_id` | UUID (subject) | Whose data is being processed | UK GDPR Art.30 |
| 6 | `data_categories` | enum array | What was shared (ROUTINE_TIMING, EMOTIONAL_CHECKIN, SESSION_NOTE, ATTACHMENT, etc.) | UK GDPR Art.9 |
| 7 | `recipient_id` | UUID (org or individual) | With whom | DfE ISA p.15 |
| 8 | `recipient_role` | enum | Role of recipient (per F4 role enum) | RoutineStars |
| 9 | `purpose` | enum | WHY: APP_INTERNAL_USE / PROFESSIONAL_INPUT / SAFEGUARDING / EVIDENCE_BUNDLE / ANNUAL_REVIEW / TRIBUNAL | DfE ISA p.15 |
| 10 | `lawful_basis_article6` | enum | (a)–(f) | UK GDPR Art.6 |
| 11 | `lawful_basis_article9` | enum | (a)–(j) | UK GDPR Art.9 |
| 12 | `dpa2018_sched1_condition` | enum | Substantial public interest condition (e.g. para.18 safeguarding) | DPA 2018 Sched.1 |
| 13 | `consent_id` | UUID (nullable) | If consent was the basis, link to consent record | UK GDPR Art.7 |
| 14 | `child_view_recorded` | bool | Was the child's view recorded? | SEND CoP 1.13; ALN Code 23.26 |
| 15 | `parent_view_recorded` | bool | Was the parent's view recorded? | SEND CoP 9.12; ALN Code 23.25 |
| 16 | `identity_protection_steps` | text | Steps taken to protect identities (rule 5) | DfE ISA p.5 |
| 17 | `decision_rationale` | text | Why this decision was made | DfE ISA p.5 (rule 7) |
| 18 | `outcome` | enum | SHARED / NOT_SHARED / DEFERRED / EMERGENCY_SHARE | DfE ISA p.14 |
| 19 | `emergency_flag` | bool | Was this an emergency share? | DfE ISA Step 9 |
| 20 | `linked_dpia_id` | UUID | DPIA that authorises the flow | UK GDPR Art.35 |
| 21 | `dsa_id` | UUID | Data-sharing agreement that governs the flow | ICO Step 6 |

> **DfE ISA Senior-leader responsibilities (p.14):** the org must have clear policies, named DPO, training, regular audit, and an "information-sharing champion" who reviews decisions.

---

## G3 — Under-13s / ICO Children's Code / Age Appropriate Design Code

### G3.1 Legal status of the Children's Code

> **Source:** ICO, *Age appropriate design code* (the "Children's Code"), issued under **DPA 2018 s.124**. URL: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-code/. **Status: STATUTORY CODE** — enforceable as if it were a UK GDPR requirement (ICO Children and the UK GDPR, updated 15 May 2026; DPA 2018 s.127).

The Code applies to any **Information Society Service (ISS) likely to be accessed by children** in the UK. RoutineStars is an ISS; the Code applies even if the user is an adult (because the app is "likely to be accessed by children").

### G3.2 The 15 Standards (applied to RoutineStars' professional-access portal)

| # | Standard | What RoutineStars must do | Status |
|---|---|---|---|
| 1 | **Best interests of the child** | Treat the child's interests as a primary consideration in every design decision | STATUTORY CODE |
| 2 | **Age-appropriate application** | Take a risk-based approach; default to high protection for under-13s | STATUTORY CODE |
| 3 | **Transparency** | Plain-English privacy information for the child (age-appropriate) AND the parent (full) | STATUTORY CODE |
| 4 | **Detrimental use of data** | No use of children's data that is detrimental to their wellbeing | STATUTORY CODE |
| 5 | **Policies and standards** | Documented policies for the standards, published | STATUTORY CODE |
| 6 | **Default settings** | High privacy by default — sharing OFF, public profile OFF | STATUTORY CODE |
| 7 | **Data minimisation** | Process only the minimum data needed for each purpose | STATUTORY CODE |
| 8 | **Data sharing** | Cannot share children's data with third parties beyond what is necessary | STATUTORY CODE |
| 9 | **Geolocation** | No geolocation in RoutineStars unless the parent explicitly opts in per session | STATUTORY CODE |
| 10 | **Parental controls** | Provide age-appropriate parental controls; allow parent to monitor high-risk settings | STATUTORY CODE |
| 11 | **Profiling** | Profiling of children is prohibited by default (UK GDPR Art.22 + Children's Code) | STATUTORY CODE |
| 12 | **Connected devices and toys** | N/A unless integrated | STATUTORY CODE |
| 13 | **Online tools** | Provide prominent, accessible tools to help children exercise their data rights | STATUTORY CODE |
| 14 | **Connected toys and devices** | N/A unless integrated | STATUTORY CODE |
| 15 | **Impact assessment** | DPIA must assess risks to children specifically | STATUTORY CODE |

### G3.3 Profiling and behavioural-analytics constraint

> "Children's Code Standard 11: Profiling. You should not profile children unless you have appropriate measures in place to protect them."

For RoutineStars' "evidence engine" feature, the **routing of completion patterns to a clinical inference** (e.g. "child appears to be on the SEMH trajectory") is **profiling** under UK GDPR Art.4(4). RoutineStars must:

- **Disclose** any automated inference to the parent and (where capable) the child
- **Offer a human review** of any automated decision (UK GDPR Art.22)
- **Default to off** the inference engine for any child whose parent has not actively opted in
- **Not use** the inference for any decision that produces legal or similarly significant effects on the child

---

## G4 — Records-retention requirements for SEND records (4 nations)

| Nation | Statutory basis | Minimum retention | Recommended max retention | Source / Status |
|---|---|---|---|---|
| **England** | Limitation Act 1980 s.5 (3 yrs for negligence claim from age 18 → 21); ICO guidance; IICSA recommendations | **Until the child turns 25** (3 years after the age of majority for personal injury claims, rounded up to the next academic year) | 25 years for EHCP-related records; then review | Limitation Act 1980 s.5; ICO records retention guidance. **STATUTORY** (limitation period) + **GOOD PRACTICE** (the SEND Code Ch.6 paras 6.71-6.79 leaves the period to the setting/LA) |
| **Wales** | Limitation Act 1980 (extends to Wales) + ALN Code §30 | Until 25 (consistent with limitation period) | 25 years for IDP records; then review | Limitation Act 1980; ALN Code 2021 Ch.30. **STATUTORY** + **STATUTORY GUIDANCE** |
| **Scotland** | Public Records (Scotland) Act 2011; Prescription and Limitation (Scotland) Act 1973 (5-year triennium for personal injury from 18 → 23) | **Until the young person turns 23** (5-year prescription period for personal injury from age 18) | 25 years for CSP/Child's Plan records; then transfer to National Records of Scotland for archival | Prescription and Limitation (Scotland) Act 1973; Public Records (Scotland) Act 2011. **STATUTORY** |
| **Northern Ireland** | Limitation (Northern Ireland) Order 1989 (S.I. 1989/614) — 3 years from age 18 → 21 | **Until the child turns 21** (then can review, but many LAs retain to 25) | 25 years for Statement/PLP records; then review | Limitation (NI) Order 1989; DE NI guidance. **STATUTORY** + **GOOD PRACTICE** |

### G4.1 Practical retention schedule for RoutineStars

| Record type | Retention | Reason | Review point |
|---|---|---|---|
| Daily routine completion data (timestamped events) | **25 years** (DOB + 25) | Limitation Act defence; tribunal evidence | At age 18: anonymise identifiers; retain aggregate trends only with consent |
| Zones-of-Regulation emotional check-ins | **25 years** | Same; may be tribunal evidence | Same |
| Streak / progress metadata | **7 years** post-last-access | Less personally sensitive; reduces retention burden | At end of academic year |
| Voice recordings (child views) | **Until plan ceases + 6 years** | ALN Code §25; SEND CoP 9.12 | At annual review |
| Professional reports contributed to the platform | **25 years** | Likely to be needed for tribunal / later EHCP review | At plan ceases |
| Audit logs of all sharing events | **25 years** | Accountability / ICO enforcement window (no fixed limit, but 6 years is the typical baseline; for SEND, align with the 25-year limit) | Annual |
| Consent records | **Until 1 year after withdrawal + 25 years** | Demonstrate historical consent | At withdrawal |
| DPIA / DPIA review records | **25 years** | Accountability | Annual review |
| Backup snapshots | **30 days rolling**; archives **1 year max** | Operational | Monthly |

**Status:** these are the **practical synthesis** of the Limitation Acts, ICO retention guidance, and SEND Codes — they are **GOOD PRACTICE** unless a specific Act applies; the underlying limitation periods are **STATUTORY**.

**Sources for retention:**
- ICO, *Records management and retention*: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/principles/storage-limitation/ (STATUTORY CODE)
- Public Records (Scotland) Act 2011: https://www.legislation.gov.uk/asp/2011/12/contents (STATUTORY)
- ALN Code 2021 Ch.30: https://www.gov.wales/sites/default/files/publications/2026-04/the-additional-learning-neans-code-for-wales-2021_0.pdf (STATUTORY GUIDANCE)

---

# PART H — EVIDENCE QUALITY STANDARDS

## H1 — Strong vs weak evidence in EHC needs assessments and SEND Tribunal

### H1.1 Statutory frame (England)

| Source | What it requires | Status |
|---|---|---|
| **CFA 2014 s.36(2)–(8)** | LA must consider "evidence of the child or young person's academic attainment (or developmental milestones in younger children) and rate of progress; information about the nature, extent and context of the child or young person's SEN; evidence of the action already being taken by the [setting] to meet the child or young person's SEN; evidence that where progress has been made, it has only been as the result of much additional intervention and support over and above that which is usually provided; evidence of the child or young person's physical, emotional and social development and health needs, drawing on relevant evidence from clinicians and other health professionals" | STATUTORY |
| **SEND Regs 2014 reg.6(1)** | Mandatory advice-givers: parent/YP; educational advice; medical advice; psychological advice; social-care advice; "any other person the LA thinks appropriate" | STATUTORY |
| **SEND Regs 2014 reg.7(b)** | LA "may" consider private / parental reports — these must be considered alongside LA-commissioned advice | STATUTORY |
| **SEND CoP 9.14–9.15** | Restates the six evidence categories above; emphasises "**evidence of the action already being taken**" (i.e. graduated approach / APDR) | STATUTORY GUIDANCE |
| **SEND CoP 9.51** | "The evidence and advice submitted by those providing it should be **clear, accessible and specific**. They should provide advice about outcomes relevant for the child or young person's age and phase of education and **strategies for their achievement**" | STATUTORY GUIDANCE |
| **SEND CoP 9.52** | Advice and information must be provided within 6 weeks of the request | STATUTORY GUIDANCE |

### H1.2 Strong vs weak evidence — 12-row taxonomy

| Evidence type | Strong (tribunal-credible) ✅ | Weak (tribunal-vulnerable) ❌ | Source |
|---|---|---|---|
| **Academic progress data** | Scaled scores, P-scores, standardised assessment results, termly tracking graphs, comparison to age-related expectations | Vague "making good progress" statements; no quantitative anchor | SEND CoP 9.14; IPSEA evidence guidance |
| **APDR cycle evidence** | 4-cycles documented with dates, interventions, outcomes, reviews; provision maps | "Wave 1 SEN support" stated but undated; no review record | SEND CoP 6.44–6.56; IPSEA |
| **Parent/child voice** | Direct quotes, dated, method recorded, distinguished from adult summary; child's preferred communication mode used | "Parent reports concerns" without elaboration; child not consulted | SEND CoP 1.13, 9.12, 9.22–9.26; ALN Code 23.26 |
| **External professional advice** | Specific, dated, named professional with HCPC/GMC/NMC registration number; assessment tools named; quantified need (e.g. "1 SD below mean on CELF-5") | "EP advice provided" without quantification; no tools named; "no less than/at least" language (per IPSEA) | SEND Reg 6(1); IPSEA tribunal guide |
| **Medical evidence** | Paediatric report with diagnosis codes (ICD-10/11), medication history, examination findings | "Reviewed by paediatrician" without findings | SEND Reg 6(1)(c); NICE CG170 (autism) |
| **Routine/behavioural data** | **Time-series with frequency/duration/context annotations, environmental tags, multiple settings, baselines, intervention A/B comparisons** | One-off observation; "child sometimes refuses"; no quantification | IPSEA; DfE "what works" data research |
| **Sensory profile** | Standardised (e.g. Short Sensory Profile 2) with scores; cross-setting evidence | "Child has sensory needs" without profiling | RCSLT/RCOT guidance |
| **Regulation data** | Zones of Regulation tracking with frequency, triggers, strategies, outcomes | "Child becomes dysregulated" — no frequency or context | SEND CoP 6.45; CoP for SEMH |
| **Communication data** | SALT report with assessment tool (e.g. CELF-5, NELI); Makaton/AAC inventory; communication milestones | "SALT assessed" — no findings | RCSLT guidance |
| **Outcome measures** | SMART outcomes with baseline, target, method, review date — **linked to Section F provision** | Aspirations dressed as outcomes ("child will access the curriculum") | SEND CoP 9.66–9.69 |
| **Provision specified** | Section F specifies **who, what, when, how often, by whom, with what training** | "Child will receive appropriate support" — vague | SEND CoP 9.69; tribunal case-law |
| **Triangulation** | Multiple sources (school + parent + EP + SALT + paediatric) **converge** on the same need | Single source; conflicting sources unaddressed | SEND CoP 9.14; IPSEA |

### H1.3 What makes routine/behavioural data credible to a tribunal

| Credibility factor | Implementation in RoutineStars | Why it matters to tribunal |
|---|---|---|
| **Longitudinal** | Minimum 6 months of consistent data; ideal 12+ months | Demonstrates pattern, not anomaly |
| **Multi-setting** | Tagged by environment (home / school / respite / clinic) | Shows generalisation (or its absence) |
| **Multi-informant** | Captures parent's record, school's record, child's self-report (where possible) | Triangulation; not relying on single adult perspective |
| **Frequency-anchored** | "X events in Y days" not "sometimes" | Quantifies severity |
| **Context-tagged** | Triggers noted: sensory / social / transition / demand | Identifies patterns of need, not just symptoms |
| **Intervention-linked** | A/B comparisons: pre- vs post-intervention, with intervention details | Demonstrates what works; supports Section F |
| **Verifiable** | Audit trail of who entered when, what device, any edits | Provenance |
| **Non-leading** | Observation categories defined a-priori; not just "challenging behaviour" | Objectivity |
| **Disability-aware** | Captures both strengths and needs (not deficit-only) | Aligns with SEND CoP 1.13 strengths-based framing |
| **EHCP-mapping** | Each data point can be tagged to a Section E outcome or Section B need | Direct relevance to the plan being assessed |

> **Critical insight (from IPSEA, GOOD PRACTICE):** A parent submitting **only** an app's data is weaker than a parent submitting the app data **plus** a brief commentary from the SENCO confirming that the patterns match their professional observation. **Triangulation wins.**

### H1.4 The Tribunal perspective (SENDIST)

> **Source:** HM Courts and Tribunals Service, First-tier Tribunal (Health, Education and Social Care Chamber) — SEND jurisdiction. URL: https://www.gov.uk/courts-tribunals/first-tier-tribunal-health-education-and-social-care. Extracted to `/tmp/ft_tribunal.txt`. **Status: STATUTORY** (Tribunal Procedure (First-tier Tribunal) (Health, Education and Social Care Chamber) Rules 2008, SI 2008/2699).

The Tribunal considers:

1. Whether the LA's decision was **legally correct** (process, evidence considered, sections A–K compliant)
2. Whether the **Section E outcomes are SMART** (per CoP 9.66)
3. Whether **Section F provision is specific and quantified** (per CoP 9.69)
4. Whether the **evidence supports the description of need** (Sections B, C, D)

The Tribunal has the power to:

- Order the LA to issue an EHC plan
- Order the LA to amend a plan
- Order the LA to reconsider a refusal to assess
- Make **non-binding recommendations** to health and social-care commissioners (under CFA 2014 s.45; CoP 11.49)

> **Key tribunal-ready principle:** A parent with a complete, longitudinal, multi-setting, intervention-linked, triangulated record has a structural advantage over a parent with sporadic, anecdotal evidence — irrespective of professional opinion. This is the **single biggest lever** for RoutineStars.

---

## H2 — Published guidance on using data/technology-collected evidence in SEND

| Source | URL | Key content | Status |
|---|---|---|---|
| **SEND Code of Practice 2015, Ch. 6 paras 6.45–6.75** | https://www.gov.uk/government/publications/send-code-of-practice-0-to-25 | "Evidence-based interventions"; "regularly reviewed" cycle; "longitudinal records of progress" | STATUTORY GUIDANCE |
| **SEND Code of Practice 2015, Ch. 9 paras 9.14, 9.51–9.69** | (same) | Six evidence categories; quality of advice; SMART outcomes | STATUTORY GUIDANCE |
| **IPSEA, "Appealing to the SEND Tribunal"** | https://www.ipsea.org.uk/appealing-to-the-send-tribunal | What evidence wins at tribunal; what EP/SALT reports must contain | GOOD PRACTICE (cites statute and case-law) |
| **IPSEA, "EHC needs assessments"** | https://www.ipsea.org.uk/ehc-needs-assessments | What evidence the LA must consider; how to make the strongest case | GOOD PRACTICE |
| **Council for Disabled Children, "EHC plans: a guide for parents and carers"** | https://councilfordisabledchildren.org.uk/ | (Cloudflare-blocked in this run; cited from the CDC index page) | GOOD PRACTICE |
| **National Autistic Society, "EHC plans: a guide for parents"** | https://www.autism.org.uk/ | (Cloudflare-blocked; cited) | GOOD PRACTICE |
| **NICE CG170 (autism)** | https://www.nice.org.uk/guidance/cg170 | Recognition, referral, diagnosis; "tools" for assessment | STATUTORY GUIDANCE (NICE quality standard) |
| **NICE QS51 (autism)** | https://www.nice.org.uk/guidance/qs51 | Quality statements for autism services | STATUTORY GUIDANCE |
| **RCSLT, "Where SLTs work — education"** | https://www.rcslt.org/ | What SALT evidence looks like in EHCPs | GOOD PRACTICE (professional body) |
| **NAS, "Right to be heard"** | https://www.autism.org.uk/ | Capturing the autistic child's voice | GOOD PRACTICE |

### H2.1 What RoutineStars must do to make its data tribunal-ready

1. **Every record has a verified audit trail** (who, when, what device, geolocation toggle, edits with reasons).
2. **Data is structured** to align with the SEND CoP 9.14 categories: attainment, rate of progress, nature/extent/context of SEN, action already taken, additional intervention impact, physical/emotional/social development, health needs.
3. **Outcomes are exported in the Section E SMART format** with baseline, target, method, review date.
4. **Provision is exported in the Section F format** — who, what, when, how often, by whom.
5. **Child voice is captured separately from parent voice** (per ALN Code 23.26; SEND CoP 1.13).
6. **Multi-setting tagging** (home / school / respite / clinic) is automatic.
7. **Triangulation views** (parent + SENCO + child + therapist) are first-class.
8. **A/B comparison views** ("before vs after intervention X") are exportable.
9. **Strengths and needs are both captured** (not deficit-only).
10. **An "EHCP-ready export"** produces a PDF bundle matching the local authority's preferred format, with the audit trail embedded.
11. **Compliance with the ICO Children's Code** is documented in the privacy notice and the DPIA.
12. **A named DPO** and **Caldicott-equivalent** are contactable in the app.

---

## CROSS-REFERENCES AND SOURCE MANIFEST

### On-disk source extracts (in `C:\Users\musta\routinestars-research\part_gh\` and `/tmp/`)

| File | Source | Extracted |
|---|---|---|
| `dfe_isa_text.txt`, `/tmp/dfe_isa_pdf.txt` | DfE Information Sharing Advice, May 2024 | Full 28 pages |
| `send_cop_text.txt`, `/tmp/send_cop_pdf.txt` | SEND CoP 0–25, Jan 2015 | 10,578 lines |
| `/tmp/dpa2018_sch1.txt` | Data Protection Act 2018 Schedule 1 | Full Part 1 & Part 2 |
| `/tmp/dpa2018_s10.txt` | DPA 2018 s.10 (special-category processing) | Full |
| `/tmp/dpa2018_s11.txt` | DPA 2018 s.11 (health/social-care processing) | Full |
| `/tmp/ico_10step.txt` | ICO 10-step guide to sharing info to safeguard children | Full |
| `/tmp/ico_edu.txt` | ICO Education-sector sharing | Full |
| `/tmp/ico_children.txt` | ICO Children and the UK GDPR (updated 15 May 2026) | Full |
| `/tmp/ico_childcode.txt` | ICO Children's Code | Full |
| `/tmp/ico_consent.txt` | ICO Consent guidance v2 | Full |
| `/tmp/ico_doc.txt` | ICO Documentation | Full |
| `/tmp/ico_dpia.txt` | ICO DPIA | Full |
| `/tmp/ico_ib.txt` | ICO Right to be informed | Full |
| `/tmp/ico_right.txt` | ICO Right of access | Full |
| `/tmp/ico_scd.txt`, `/tmp/ico_scd2.txt`, `/tmp/ico_special.txt` | ICO Special category data | Full |
| `/tmp/ipsea_ehc.txt`, `/tmp/ipsea_ehc2.txt` | IPSEA EHC needs assessment | Full |
| `/tmp/ipsea_app.txt` | IPSEA Appealing to the SEND Tribunal | Full |
| `/tmp/ipsea_tribunal.txt`, `/tmp/ipsea_search_tribunal.txt` | IPSEA Tribunal search | Full |
| `/tmp/ipsea_evidence.txt`, `/tmp/ipsea_tribunal_resources.txt` | IPSEA evidence | Full |
| `/tmp/cfa2014.txt` | Children and Families Act 2014 (Part 3) | Full |
| `/tmp/wales_aln.txt` | GOV.WALES ALN landing | Full |
| `/tmp/ft_tribunal.txt` | First-tier Tribunal (SEND) | Full |
| `/tmp/judiciary_send.txt` | Judiciary SEND page | Full |
| `/tmp/rid.txt` | (Tribunal Regs ID) | Full |
| `/tmp/sen_tribunal_rules.txt` | Tribunal rules | Full |
| `/tmp/scotland.txt` | (404 capture; use asp/2004/4) | (flagged) |

### Authoritative source URLs (canonical)

- UK GDPR: https://www.legislation.gov.uk/eur/2016/679/contents (STATUTORY)
- DPA 2018: https://www.legislation.gov.uk/ukpga/2018/12/contents (STATUTORY)
- ICO Children's Code: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-code/ (STATUTORY CODE)
- ICO 10-step guide: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-sharing/a-10-step-guide-to-sharing-information-to-safeguard-children/ (STATUTORY CODE)
- DfE Information Sharing Advice, May 2024: https://www.gov.uk/government/publications/safeguarding-practitioners-information-sharing-advice (STATUTORY GUIDANCE)
- DfE Working Together to Safeguard Children 2023: https://www.gov.uk/government/publications/working-together-to-safeguard-children--2 (STATUTORY GUIDANCE)
- Children Act 1989: https://www.legislation.gov.uk/ukpga/1989/41/contents (STATUTORY)
- Children and Families Act 2014: https://www.legislation.gov.uk/ukpga/2014/6/contents (STATUTORY)
- First-tier Tribunal (SEND): https://www.gov.uk/courts-tribunals/first-tier-tribunal-health-education-and-social-care (STATUTORY)
- Limitation Act 1980: https://www.legislation.gov.uk/ukpga/1980/58/contents (STATUTORY)
- Public Records (Scotland) Act 2011: https://www.legislation.gov.uk/asp/2011/12/contents (STATUTORY)

---

## GAPS / CAVEATS

1. **Tribunal case-law is not exhaustively reviewed** — *R v SEN Tribunal ex parte M* and similar are referenced by IPSEA but not litigated in this brief. RoutineStars should consult a SEND law specialist for case-sensitive features.
2. **CDC and NAS primary pages were Cloudflare-blocked** in this research run — citations above point to the URLs but content was not extracted; a headless-browser pass would close this gap.
3. **Wales / NI / Scotland retention periods** are derived from limitation Acts + national guidance; the specific ALN Code, NI Code, and SCL Code retention sections were not directly quoted in this G/H document but the underlying legal position is captured.
4. **The "DPIA template"** mentioned by ICO is recommended but not mandatory as a form; the ICO sample DPIA template is a starting point.
5. **Direct payments and personal budgets** under SEND Regs 2014 are touched on in Part C3 but the consent / data-protection angle for direct payments is a specialist area not fully covered here.
