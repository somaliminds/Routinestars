# Data Protection Impact Assessment (DPIA) — Multi-Professional Support Portal

**Status:** Mitigations IMPLEMENTED · awaiting director sign-off (see §9)
**Owner:** RoutineStars Ltd (data controller)
**Prepared:** July 2026 · **Updated:** July 2026 (reconciled to shipped build)
**Scope:** The proposed "Professional tier" portal that gives external support
workers (SENCO/ALNCo, EP, SALT, OT, physiotherapist, paediatrician, CAMHS,
specialist teacher, TA/LSA, social worker, school nurse, portage, EY
practitioner) scoped, consent-based access to a child's RoutineStars data and
lets them contribute structured input.

> A DPIA is **mandatory** before this processing begins — the ICO Children's
> Code (statutory code under DPA 2018 s.123) requires a DPIA for any likely
> high-risk processing of children's personal data, and sharing a child's
> special-category (health/SEND) data with third-party professionals is
> high-risk by definition. **The portal must not launch until this DPIA is
> completed, approved, and its mitigations implemented.** Source basis:
> `docs/research/send-framework` §G.

---

## 1. Why the processing is high-risk

| Risk factor (ICO screening)    | Applies? | Why                                                                                            |
| ------------------------------ | -------- | ---------------------------------------------------------------------------------------------- |
| Special-category data          | ✅       | Health data — emotional check-ins, routine/behavioural data revealing disability/mental health |
| Children's data (under-13)     | ✅       | Core user population is 4–14; under-13s cannot consent for themselves (UK GDPR Art.8)          |
| Data shared with third parties | ✅       | The whole point of the portal — professionals outside the family                               |
| Vulnerable data subjects       | ✅       | SEND children are a vulnerable group                                                           |
| Combining/matching datasets    | ⚠️       | Multiple professionals build a fuller picture of one child                                     |
| Systematic monitoring          | ⚠️       | Longitudinal daily routine + emotional data                                                    |

Multiple triggers → **DPIA mandatory**; treat as high-risk throughout.

---

## 2. Description of the processing

### 2.1 Data flows

```
[Child completes routines on tablet]
        → RoutineStars backend (Supabase, EU/Frankfurt)
        → Parent views + manages (existing)
        → NEW: Parent grants scoped consent to a named professional
                → Professional views a role-scoped subset of the child's data
                → Professional contributes structured input (advice/targets)
                → Every access + contribution is audit-logged
```

### 2.2 Data categories a professional could see (role-scoped — §F2)

- Child first name, age band, avatar (never surname/DOB unless strictly needed)
- EHCP outcomes + APDR cycle records
- Completion data, timings, streaks (the evidence)
- Zones-of-Regulation emotional check-ins
- Environment tags (home/school/respite)
- Documents the parent chooses to share (Annual Review pack, One Page Profile)

**Data minimisation:** each role sees only the minimum needed for its function
(§F2 defines the per-role view). Default is the _least_ data; the parent widens
scope explicitly.

### 2.3 What professionals can do

- **View** the scoped subset (read-mostly)
- **Contribute** structured input tagged to outcomes (advice notes, recommended
  targets) — they do **not** run the statutory process or edit the child's core
  records. This keeps RoutineStars out of regulated case-management territory.

---

## 3. Lawful basis (UK GDPR)

| Question                           | Answer                                                                                                                                                                                                                              |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Art.6 basis                        | **Consent (Art.6(1)(a))** — sharing with a third-party professional at the parent's direction is consent-based (public-task/contract bases are for the professionals' own statutory processing, not for RoutineStars' sharing act). |
| Art.9 condition (special category) | **Explicit consent (Art.9(2)(a))** captured from the parent. Where a professional processes it under their own health/social-care duty, Art.9(2)(h) applies to _them_, not to RoutineStars' sharing.                                |
| Under-13 consent                   | Parent/guardian consents on the child's behalf (UK GDPR Art.8(1)); the child cannot consent alone. Record who consented and their relationship.                                                                                     |

**Consent must be:** explicit · informed · specific/scoped (which professional,
which data, which purpose) · time-limited (expiry) · freely given · and
**withdrawable** at any time without detriment.

---

## 4. Required controls — data model

### 4.1 Consent ledger (§G1 `CONSENT_RECORD`)

```
consent_records:
  consent_id            uuid pk
  child_id              uuid fk
  consent_given_by      uuid  (the parent user)
  relationship          text  ('parent' | 'guardian')
  consent_date          timestamptz
  professional_id       uuid fk (the invited professional)
  professional_role     enum  (§F1 role enum)
  professional_org      text
  data_categories       text[] (scoped enum — what they may see)
  purpose               text
  expiry_date           date  (time-limited; required)
  withdrawn_at          timestamptz null
  withdrawn_by          uuid null
  created_at / updated_at
```

Access is **denied** unless a matching, non-expired, non-withdrawn consent
exists. Withdrawal is immediate and irreversible for future access.

### 4.2 Information-sharing / access audit log (§G2 `INFORMATION_SHARING_LOG`)

```
access_audit_log:
  event_id          uuid pk
  timestamp         timestamptz
  actor_id          uuid  (who accessed)
  actor_role        enum
  child_id          uuid
  data_categories   text[] (what was accessed)
  action            enum ('VIEW' | 'CONTRIBUTE' | 'EXPORT')
  purpose           text
  lawful_basis      enum
  consent_id        uuid fk (which consent authorised it)
  decision_rationale text null
```

**Every** professional read, contribution, and export writes one row. The log
is append-only and retained per §4.4.

### 4.3 The seven golden rules (DfE information-sharing guidance, §G2)

The portal design and staff processes must uphold: (1) data-protection law is a
framework not a barrier; (2) be open and honest about sharing; (3) seek advice
when in doubt; (4) share with consent where appropriate and respect refusals;
(5) base decisions on safety and wellbeing; (6) necessary, proportionate,
relevant, adequate, accurate, timely, secure; (7) record the decision and
reasons. The audit log operationalises rule 7.

### 4.4 Retention (§G4)

- Consent records: duration of consent + 6 years
- Audit log: minimum 6 years (safeguarding-adjacent)
- Shared SEND records follow the IRMS schools schedule (leaver + 6 years or age
  25). Implement **configurable** retention per record type.

---

## 5. ICO Children's Code — the 15 standards (§G3)

Design commitments the portal must meet:

| #   | Standard                    | Commitment                                                  |
| --- | --------------------------- | ----------------------------------------------------------- |
| 1   | Best interests of the child | Primary design consideration; documented in this DPIA       |
| 2   | DPIA                        | This document                                               |
| 3   | Age-appropriate application | Under-13 protections applied by default                     |
| 4   | Transparency                | Age-appropriate privacy info for parent + child             |
| 5   | Detrimental use             | No use of data detrimental to the child's wellbeing         |
| 6   | Policies upheld             | Published standards enforced                                |
| 7   | High-privacy defaults       | Sharing OFF by default; parent opts in per professional     |
| 8   | Data minimisation           | Role-scoped views; least data by default                    |
| 9   | Data sharing                | Only with explicit, scoped consent + safeguards             |
| 10  | Geolocation                 | Off (not collected)                                         |
| 11  | Parental controls           | Parent grants/revokes access transparently                  |
| 12  | Profiling                   | Off by default; no profiling of the child in the portal     |
| 13  | Nudge techniques            | No nudging parents/children to weaken privacy               |
| 14  | Connected devices           | N/A / secured                                               |
| 15  | Online tools                | Prominent, accessible privacy tools (view/withdraw consent) |

---

## 6. Risks and mitigations

| Risk                                 | Likelihood | Impact | Mitigation                                                                                                                                                           |
| ------------------------------------ | ---------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Professional sees more than needed   | Med        | High   | Role-scoped views (§F2); data minimisation by default                                                                                                                |
| Consent not properly scoped/expiring | Med        | High   | Consent ledger enforces expiry + scope; access denied without valid consent                                                                                          |
| Access after consent withdrawn       | Low        | High   | Withdrawal is immediate; every access checks live consent state                                                                                                      |
| No record of who saw what            | Med        | High   | Append-only audit log on every access/contribution/export                                                                                                            |
| Professional account compromised     | Low        | High   | Mandatory TOTP MFA, **enforced at the database** — RLS `has_active_consent()` requires `aal2` (migration 032), so an unMFA'd token reads nothing even via direct API |
| Child data used for profiling        | Low        | High   | Profiling off by default (Children's Code #12)                                                                                                                       |
| Over-retention                       | Med        | Med    | Configurable retention + scheduled purge                                                                                                                             |
| Cross-nation legal divergence        | Med        | Med    | England-first; Wales/Scotland/NI stored free-text; no hardcoded taxonomy                                                                                             |

---

## 7. Decisions — resolved and implemented

Every decision that previously blocked the build has been made and the
mitigation shipped. Evidence is in-repo (migrations + code) for audit.

1. **Professional authentication — RESOLVED: full accounts + mandatory MFA.**
   Professionals hold their own Supabase Auth account (invite-gated: an account
   only becomes "professional" when it claims a consent addressed to its email
   — no self-service professional signup). TOTP MFA is **mandatory and enforced
   in the database**: `has_active_consent()` requires `auth.jwt()->>'aal'='aal2'`
   (migration 032), so a professional who has not completed MFA reads nothing —
   even via a direct API call, not just the app UI. Evidence: migrations
   028/029/032; `MfaGate.tsx`; `_layout.tsx` role detection.
2. **Identity verification — RESOLVED (MVP posture): self-declared.** Role +
   organisation captured at consent grant; registration-number verification is
   manual/out-of-band for now and recorded as accepted residual risk (low —
   the parent chooses exactly who to invite by email, and can withdraw
   instantly). Revisit if a self-service professional directory is added.
3. **Contribution scope — RESOLVED: contribution-only.** Professionals may add
   advice / suggested targets / notes and edit only their **own** contributions;
   they cannot alter the child's core records. Enforced by RLS (migration 030:
   insert gated on active OUTCOMES consent; own-row select/update/delete only).
   Keeps RoutineStars out of regulated case-management.
4. **Transparency — RESOLVED.** Every professional view, contribution and export
   writes an append-only audit entry (migration 028) that the parent can read in
   full (Children's Code #11). Consent is scoped, time-limited and instantly
   withdrawable (§4.1).

**Remaining residual risks accepted for launch:** self-declared identity (2
above); manual retention of pre-migration reset tokens (n/a to this portal).
No residual _high_ risk remains that would require prior ICO consultation.

---

## 8. Conclusion

The professional portal was built **governance-first**, in the required order:
consent ledger (§4.1) → audit log (§4.2) → professional auth + MFA (§7.1) →
role-scoped views (§2.2) → contribution templates (§7.3). All mitigations in
§4–§6 are now implemented and verified in code. The Children's-Code
default-privacy posture (§5) holds: least-privilege scope per role, parent in
control, full transparency.

**The only outstanding item is this document's sign-off.** Per the controller's
own policy, no real professional is to be granted access to a real child's data
until a RoutineStars Ltd director has signed §9 below.

---

## 9. Director sign-off

By signing, the RoutineStars Ltd director (as data controller) confirms the
processing described has been reviewed, the §6 risks and §7 decisions are
accepted, and the mitigations in §4–§7 are implemented to the standard required
by the ICO Children's Code and UK GDPR.

|                |                                                                                  |
| -------------- | -------------------------------------------------------------------------------- |
| **Name**       | ______________________________                                                   |
| **Role**       | Director / Data Controller, RoutineStars Ltd                                     |
| **Signature**  | ______________________________                                                   |
| **Date**       | ____________________                                                             |
| **Review due** | 12 months from signing, or on any material change to data flows / sub-processors |

_DPO / external adviser (if consulted):_ ______________________________
