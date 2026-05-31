# RoutineStars — Claude Code Reference

> SEN Autism Daily Routine App · Multi-User Micro-SaaS · Child Tablet + Parent Phone App

RoutineStars helps autistic children aged 4–14 follow daily routines independently via gamified visual step sequencing. Parents configure schedules, approve completions, and track progress from a separate phone app. Built on React Native + Expo with Supabase as the primary backend.

---

## Spec Documents

- `RoutineStars_ClaudeCode_BuildGuide.md` — tech stack, design system, build phases, quality rules
- `RoutineStars_UML_Specification-1.md` — class diagram, ERD (12 tables), sequence diagrams, gamification, activity sets

---

## Session Starter Prompt (copy-paste at start of every session)

```
I am building RoutineStars — a SEN autism daily routine app for children aged 4-14.
It is a multi-user micro-SaaS with child tablet app and parent phone app.

Reference documents in this repo:
- RoutineStars_UML_Specification-1.md — full system design
- RoutineStars_ClaudeCode_BuildGuide.md — tech stack, quality rules, build phases

Tech stack: React Native + Expo SDK 51, Supabase (PostgreSQL + Auth + Storage + Realtime
+ Edge Functions), Stripe billing.

Today we are working on: [DESCRIBE WHAT YOU WANT TO BUILD]

Apply all quality rules from Section 5 of the build guide.
After completing, run all tests and show me a summary.
```

---

## Quality Rules — Apply to ALL Code (Section 5)

> Paste this block into every session prompt when building features.

```
QUALITY RULES — apply to all code you write:
1.  TypeScript strict mode — no "any" types allowed
2.  All database queries must use Row Level Security (Supabase RLS)
3.  All user-facing strings must be in a translation file (i18n-ready)
4.  Every component must handle: loading state, error state, empty state
5.  All forms must validate with Zod before submission
6.  API routes must validate request body with Zod
7.  Sensitive data (PIN, tokens) must never appear in logs or error messages
8.  All child-facing touch targets minimum 60x60px (80x80px preferred)
9.  Every new feature needs at least one unit test
10. Before finishing, run: npm run typecheck && npm run lint && npm test
    Fix all errors before marking the task complete.
```

---

## Security Checklist (Section 5.1)

- [ ] Parent PIN stored as bcrypt hash (cost factor 12) — never plaintext
- [ ] JWT: 15-min access tokens + 7-day refresh tokens, stored in SecureStore
- [ ] Supabase RLS: child data only accessible to linked parent user
- [ ] Rate limiting on approval endpoints (max 10 req/min per user)
- [ ] HTTPS enforced on all API routes — no HTTP fallback
- [ ] COPPA: no analytics on under-13 without parent consent
- [ ] UK GDPR: data retention (90 days completions, 1 year reports)
- [ ] No third-party ad SDKs on child-facing screens
- [ ] Stripe webhooks verified with signing secret before processing

---

## Accessibility Checklist (Section 5.2)

- [ ] WCAG 2.1 AA minimum, AAA on child-facing screens
- [ ] Reduced motion mode respects system `prefers-reduced-motion`
- [ ] High contrast mode available in settings (min 7:1 contrast ratio child screens)
- [ ] Audio narration on every step — all content accessible without reading
- [ ] Timers are informational only — never blocking or causing alerts
- [ ] Font scaling: test at 200% system font size — no overflow or truncation
- [ ] All images have meaningful alt text for screen reader support
- [ ] Min touch target 80x80px on all child-facing interactive elements

---

## Design System — Colour Palette (Section 3.1)

| Token | Hex | Usage |
|---|---|---|
| brand.primary | `#7C3AED` | Primary buttons, active states, brand elements |
| brand.dark | `#5B21B6` | Headings, deep brand elements |
| brand.light | `#F5F3FF` | Card backgrounds, subtle highlights |
| accent.star | `#F59E0B` | Stars, rewards, celebration elements |
| accent.success | `#10B981` | Completed states, tick marks, locked sets |
| accent.warning | `#F97316` | Timer warnings, amber progress bars |
| accent.danger | `#EF4444` | Overtime indicators, redo states |
| child.sky | `#0EA5E9` | Child UI accents, step cards |
| child.rose | `#F43F5E` | High-energy activity sets |
| child.lime | `#84CC16` | Morning/school sets |
| neutral.900 | `#111827` | Primary text |
| neutral.500 | `#6B7280` | Secondary text, placeholders |
| neutral.100 | `#F3F4F6` | Page backgrounds |

## Design System — Typography (Section 3.2)

| Token | Size / Weight / Font | Used For |
|---|---|---|
| text.display | 40px / 800 / Nunito | Step titles on child screens (AAC-style large) |
| text.heading | 28px / 700 / Nunito | Screen headings, activity set names |
| text.subhead | 22px / 600 / Nunito | Card titles, section labels |
| text.body | 18px / 400 / Nunito | Instructions, descriptions |
| text.caption | 14px / 400 / Nunito | Timestamps, metadata, parent dashboard labels |
| text.parent | 16px / 400 / Inter | Parent app — professional, less playful |

**Fonts:** Nunito (child-facing, rounded + legible). Inter (parent app). Both via Expo Google Fonts.

---

## Child UI Non-Negotiables (Section 3.4)

- Min touch target: **80x80px** on all child-facing interactive elements
- All text: min **22px**. Step titles: min **32px**
- Illustrations: emoji + colour background placeholder until real art assets added
- No small icons without text labels
- Timer is **informational only** — never blocks or panics the child
- Every successful action plays **sound + animation** (disable in settings)
- Reduced motion mode: simple colour changes only, no animations
- **No error messages shown to child** — only gentle, positive prompts

---

## Folder Structure (Section 6)

```
routinestars/
├── apps/
│   ├── mobile/               # Expo React Native app (child + parent)
│   │   └── src/
│   │       ├── app/          # Expo Router screens
│   │       │   ├── (child)/  # Child tab group
│   │       │   ├── (parent)/ # Parent tab group
│   │       │   └── (auth)/   # Auth screens
│   │       ├── components/
│   │       │   ├── ui/       # Design system components
│   │       │   ├── child/    # Child-specific components
│   │       │   └── parent/   # Parent-specific components
│   │       ├── lib/          # supabase.ts, stripe.ts, notifications.ts
│   │       ├── hooks/        # Custom React hooks
│   │       ├── stores/       # Zustand stores
│   │       └── types/        # TypeScript types
│   └── web/                  # Optional: Next.js marketing site
├── packages/
│   ├── database/             # Supabase migrations + types
│   ├── shared/               # Shared types + utilities
│   └── ui/                   # Shared component library
├── supabase/
│   ├── migrations/           # SQL migration files
│   └── functions/            # Edge Functions
├── .github/workflows/        # CI/CD pipelines
└── docs/
```

---

## SaaS Pricing Tiers (Section 8)

| Tier | Price | Children | Sets | Features |
|---|---|---|---|---|
| Free | £0 | 1 | 5 built-in only | Basic reports |
| Starter | £7.99/mo | Up to 3 | All 15 built-in | Full reports + export |
| Family | £14.99/mo | Unlimited | All + custom | Reports + care team sharing |
| School | £49/mo | Up to 30 | All + bulk import | Teacher portal + analytics |

---

## Database Tables (Section 4 ERD — 12 tables)

`users` · `child_profiles` · `parent_profiles` · `activity_sets` · `steps` · `day_schedules` · `scheduled_sets` · `completions` · `step_completions` · `rewards` · `child_rewards` · `lockout_events` · `notifications`

---

## Scheduled Set Status States

`PENDING` → `IN_PROGRESS` → `AWAITING_APPROVAL` → `APPROVED` → `LOCKED`
Also: `PAUSED` (from IN_PROGRESS) · `SKIPPED` (from PENDING)

---

## Build Progress Checklist

Mark tasks complete as each sprint is finished. Use `- [x]` when done.

### Phase 1 — Foundation (Week 1-2)

- [x] **1.1** Repo + project setup — Expo SDK 51 + TypeScript + NativeWind v4 + Expo Router v3 + ESLint + Prettier + Husky pre-commit hooks. Create full folder structure. Add `.gitignore` covering `.env`, `node_modules`, build artefacts.
- [x] **1.2** Supabase schema — all 12 tables, foreign keys, indexes, and RLS policies from Section 4 of the UML spec. Child profiles only accessible to linked parent.
- [x] **1.3** Supabase TypeScript types — run `supabase gen types typescript`, create `src/types/database.ts` with row/insert/update helpers.
- [x] **1.4** Auth flow — parent signup, email verification, PIN setup screen, child profile creation. Supabase Auth for JWT. PIN stored as bcrypt hash (cost 12). Login, forgot PIN, session refresh.
- [x] **1.5** Design system components — all 9 components in `src/components/ui/`: `ActivityCard`, `StepCard`, `ProgressBar`, `StarCounter`, `BadgeDisplay`, `ApprovalScreen`, `CelebrationModal`, `PINPad`, `ScheduleTimeline`. Dev test screen at `/dev/components`.

### Phase 2 — Child App Core (Week 3-4)

- [x] **2.1** Child home screen — fetch today's `DaySchedule`, display `ActivityCard` components in order, day progress bar at top, status colours: PENDING=grey, IN_PROGRESS=coloured, LOCKED=green tick.
- [x] **2.2** Step sequencer — `StepCard` one step at a time, countdown timer, BIG TICK button (min 80px), step progress bar, audio narration playback, star animation, save `StepCompletion` on each tick.
- [x] **2.3** Reward engine — Supabase Edge Function: calculate stars earned, check badge eligibility (all conditions from Section 9.2), award badges, update `total_stars` + `current_streak`, return reward summary.
- [x] **2.4** Parental approval flow — fullscreen `ApprovalScreen` (no navigation escape), Firebase FCM push to parent, parent review screen with step times, Approve/Redo buttons, trigger lockout + `CelebrationModal`.
- [x] **2.5** Reward collection screen — badge grid (earned + greyed locked with unlock condition), animated star meter, streak counter with flame animation.

### Phase 3 — Parent App (Week 5-6)

- [x] **3.1** Parent dashboard — today's completion rate, pending approvals badge count, child profile switcher, week progress summary. Inter font, professional style.
- [x] **3.2** Weekly schedule builder — 7-day horizontal timeline, hourly grid, drag-and-drop from activity set palette, conflict detection with warning, time allocation editor, requires-approval toggle, Save & Publish syncs via Supabase Realtime.
- [x] **3.3** Activity set editor — list/edit/reorder steps (drag), set durations, toggle approval, upload custom illustration, Create Custom Set flow.
- [x] **3.4** Progress reports — daily completion rate chart, weekly heatmap, badge timeline, per-child streak history, PDF export.
- [x] **3.5** Settings — PIN change, notification preferences, child profile management (add/edit/delete), care team sharing (invite by email, view-only or approval role).

### Phase 4 — SaaS Layer & Launch (Week 7-8)

- [x] **4.1** Stripe subscriptions — 3 plans: Free / Starter £7.99/mo / Family £14.99/mo / School £49/mo. Plan gating middleware checks subscription before allowing premium features. Customer Portal for self-serve billing.
- [x] **4.2** Onboarding flow — welcome, create parent account, add first child profile (name, DOB, avatar emoji), choose plan or start free trial, guided schedule wizard with suggested sets by age.
- [x] **4.3** Offline support — child app works fully offline: cache today's schedule + steps + audio via Expo FileSystem. Queue completions in SQLite (`expo-sqlite`) when offline. Sync to Supabase when reconnected.
- [x] **4.4** Test suite — Jest unit tests for reward engine + lockout logic. Detox E2E: child completing a set, parent approving, schedule building. Target 80%+ coverage on critical paths.
- [x] **4.5** App store prep — configure EAS Build for iOS + Android, write App Store/Play Store metadata, generate screenshots, create COPPA + UK GDPR compliant privacy policy page. Submit to TestFlight + Google Play Internal Testing.

---

## Plan Mode Reminders

Always use **Plan Mode** (click the plan toggle before submitting) for:
- Any database migration that deletes or modifies columns
- Changes to authentication or security logic
- Stripe billing configuration changes
- Before the first production deployment
