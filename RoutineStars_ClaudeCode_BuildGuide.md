  
**🌟 RoutineStars**

Claude Code Build Guide

*Production-Grade SEN Autism Routine App  ·  Multi-User Micro-SaaS*

Built entirely with Claude Code  ·  Zero-to-Minimal Coding Required

# **1\. How to Use This Guide with Claude Code**

This document is your master build specification. Feed it to Claude Code at the start of each session. Claude Code will read your RoutineStars UML Specification alongside this guide to write, test, and deploy every part of the application — no coding experience required from you.

## **1.1 What Claude Code Does For You**

| Capability | What Claude Code Handles |
| :---- | :---- |
| File Creation | Creates every file: components, APIs, DB schemas, configs, tests |
| Debugging | Reads error messages and fixes bugs autonomously |
| Database | Writes and runs all SQL migrations in Supabase |
| Testing | Writes and runs unit \+ integration tests |
| Deployment | Configures CI/CD, writes deployment scripts |
| Refactoring | Improves code quality, performance, accessibility |
| Documentation | Writes inline comments, README, API docs |

## **1.2 How to Talk to Claude Code**

You do not write code. You give Claude Code clear instructions. Here are the most effective command patterns:

| // Starting a session — always give context first: "Read ROUTINESTARS\_UML\_SPECIFICATION.docx and this BUILD\_GUIDE.docx.  We are building the RoutineStars SEN autism app. Today we are  working on Phase 1 Sprint 1: Supabase schema setup." // Asking for implementation: "Create the complete Supabase PostgreSQL schema from Section 4 of the UML spec.  Include Row Level Security policies for child/parent data isolation.  Run the migration and confirm it succeeded." // Asking for UI work: "Build the Child Home Screen. It should show today's activity sets as  large colourful cards. Use the design system in Section 3 of this guide.  Make it visually playful and suitable for a child aged 4-14 with autism." // When something goes wrong: "There is an error: \[paste error\]. Fix it and explain what caused it." // Reviewing progress: "Run all tests and show me a summary. Fix any failures." |
| :---- |

# **2\. Complete Technology Stack**

Every tool chosen is free to start, scales to production, and is fully supported by Claude Code. All tools have generous free tiers that cover development and early users.

## **2.1 Frontend — React Native \+ Expo**

| Tool | Purpose | Why This Choice |
| :---- | :---- | :---- |
| React Native 0.74+ | Core app framework | Single codebase for iOS \+ Android \+ Web |
| Expo SDK 51+ | Build \+ OTA updates | No Xcode/Android Studio needed, Claude Code deploys via CLI |
| Expo Router v3 | Navigation | File-based routing, automatic deep links |
| NativeWind v4 | Styling (Tailwind) | Utility-first CSS, consistent design tokens |
| React Native Reanimated 3 | Animations | 60fps native animations for celebrations |
| Lottie RN | Celebration effects | Pre-built confetti, star, trophy animations |
| React Native Gesture Handler | Drag & drop | Required for drag-and-drop schedule builder |
| Expo AV | Audio narration | Built-in audio player, offline support |
| Expo Notifications | Push alerts | Cross-platform push notification support |
| Zustand | State management | Simple, minimal boilerplate, TypeScript-first |
| TanStack Query v5 | Data fetching | Caching, offline sync, optimistic updates |
| React Hook Form \+ Zod | Forms \+ validation | Type-safe forms with schema validation |
| date-fns | Date utilities | Lightweight, tree-shakeable date library |

## **2.2 Backend — Supabase (Primary) \+ Fastify (API Layer)**

| Tool | Purpose | Why This Choice |
| :---- | :---- | :---- |
| Supabase (PostgreSQL) | Primary database | RLS for child safety, real-time subscriptions, hosted |
| Supabase Auth | Authentication | JWT \+ OAuth, PIN stored separately, free tier generous |
| Supabase Storage | Media files | CDN-backed audio \+ illustration delivery |
| Supabase Edge Functions | Serverless logic | Deno-based functions for reward calculations, notifications |
| Supabase Realtime | Live sync | WebSocket-based parent/child app sync |
| Fastify (Node.js) | API gateway | High-performance REST API, TypeScript, plugin ecosystem |
| Upstash Redis | Cache \+ rate limits | Serverless Redis, free tier, session management |
| Firebase FCM | Push notifications | Most reliable cross-platform push delivery |
| Resend | Transactional email | Simple API, React Email templates, generous free tier |

## **2.3 Infrastructure & DevOps**

| Tool | Purpose | Why This Choice |
| :---- | :---- | :---- |
| GitHub | Source control | Free private repos, Claude Code reads/writes git natively |
| GitHub Actions | CI/CD pipeline | Automated tests, builds, deployments on every push |
| EAS Build (Expo) | App store builds | Managed cloud builds, no local Mac needed for iOS |
| EAS Update | OTA updates | Push JS-layer updates instantly without app store review |
| Railway / Render | Fastify API hosting | One-click Node.js deployment, auto-scaling, free tier |
| Cloudflare | CDN \+ DNS | Free CDN, DDoS protection, edge caching |
| Sentry | Error monitoring | Crash reporting for both apps, free tier 5k errors/month |
| PostHog | Analytics | GDPR-compliant, self-hosted option, funnel analysis |
| Doppler / dotenv-vault | Secrets management | Secure environment variable management across environments |

## **2.4 Multi-User SaaS Layer**

| Tool | Purpose | Why This Choice |
| :---- | :---- | :---- |
| Stripe | Subscriptions \+ billing | Industry standard, Stripe Billing for SaaS plans, webhooks |
| Stripe Customer Portal | Self-serve billing | Users manage plans, cancel, upgrade — no custom UI needed |
| LemonSqueezy (alt.) | Merchant of record | Handles VAT/tax globally, simpler for solo founders |
| Supabase RLS | Tenant isolation | Row-level security ensures each family sees only their data |
| Unkey | API key management | If offering a developer/enterprise API tier |

# **3\. Design System & UI Quality Standards**

Claude Code will implement all UI using this design system. Paste this section when asking Claude Code to build any screen.

## **3.1 Colour Palette**

| Token Name | Hex Value | Usage |
| :---- | :---- | :---- |
| brand.primary | \#7C3AED | Primary buttons, active states, brand elements |
| brand.dark | \#5B21B6 | Headings, deep brand elements |
| brand.light | \#F5F3FF | Card backgrounds, subtle highlights |
| accent.star | \#F59E0B | Stars, rewards, celebration elements |
| accent.success | \#10B981 | Completed states, tick marks, locked sets |
| accent.warning | \#F97316 | Timer warnings, amber progress bars |
| accent.danger | \#EF4444 | Overtime indicators, redo states |
| child.sky | \#0EA5E9 | Child UI accents, step cards |
| child.rose | \#F43F5E | High-energy activity sets |
| child.lime | \#84CC16 | Morning/school sets |
| neutral.900 | \#111827 | Primary text |
| neutral.500 | \#6B7280 | Secondary text, placeholders |
| neutral.100 | \#F3F4F6 | Page backgrounds |

## **3.2 Typography Scale**

| Token | Size / Weight | Used For |
| :---- | :---- | :---- |
| text.display | 40px / 800 / Nunito | Step titles on child screens (AAC-style large) |
| text.heading | 28px / 700 / Nunito | Screen headings, activity set names |
| text.subhead | 22px / 600 / Nunito | Card titles, section labels |
| text.body | 18px / 400 / Nunito | Instructions, descriptions |
| text.caption | 14px / 400 / Nunito | Timestamps, metadata, parent dashboard labels |
| text.parent | 16px / 400 / Inter | Parent app — more professional, less playful |

Font choice: Nunito for child-facing (rounded, friendly, high legibility for dyslexia). Inter for parent app (professional). Both available via Expo Google Fonts.

## **3.3 Component Library — Prompt to Claude Code**

Tell Claude Code to build these reusable components first, before building any screens:

| Build the following reusable components in src/components/ui/: ActivityCard     \- large card with emoji, colour theme, title, star value,                    status badge (PENDING/IN\_PROGRESS/LOCKED), tap handler StepCard         \- full-width step with illustration placeholder, title,                    instruction text, countdown timer, BIG TICK button (min 80px) ProgressBar      \- animated bar, supports: step/set/day/week variants,                    colour changes green \-\> amber \-\> red based on percent StarCounter      \- animated star count with pop animation on increment BadgeDisplay     \- grid of earned badges, greyed-out locked badges ApprovalScreen   \- fullscreen modal: child holding screen,                    no navigation escape possible CelebrationModal \- confetti \+ stars \+ trophy animation using Lottie,                    plays on set completion PINPad           \- 6-digit PIN entry for parent authentication,                    bcrypt comparison against stored hash ScheduleTimeline \- 7-day horizontal scroll, drag-and-drop activity placement,                    time slot grid, conflict detection Each component must: be fully typed with TypeScript, support reduced-motion mode, meet 60x60px minimum touch target, support dark mode via NativeWind. |
| :---- |

## **3.4 Child UI Rules (Non-Negotiable)**

* Minimum touch target: 80x80px for all interactive elements on child screens

* All text: minimum 22px. Step titles: minimum 32px

* Illustrations: placeholder with emoji \+ colour background until real art assets added

* No small icons without text labels. Every interactive element must be labelled

* Timer is INFORMATIONAL only — never blocks or panics the child

* Every successful action plays a sound \+ animation (can be disabled in settings)

* Reduced motion mode: disable all animations, show simple colour changes instead

* High contrast mode: minimum 7:1 contrast ratio (AAA standard for child accessibility)

* No error messages shown to child — only gentle, positive prompts

# **4\. Build Phases & Claude Code Sprint Plan**

Each phase is a set of Claude Code sessions. Copy the prompt at the start of each session. Complete each phase fully before moving to the next.

## **Phase 1 — Foundation (Week 1-2)**

| Sprint | Task | Claude Code Prompt Starter |
| :---- | :---- | :---- |
| 1.1 | Repo \+ project setup | "Initialise a new Expo SDK 51 project with TypeScript, NativeWind v4, Expo Router v3. Create the folder structure: src/app, src/components, src/lib, src/hooks, src/stores, src/types. Add ESLint, Prettier, and Husky pre-commit hooks." |
| 1.2 | Supabase schema | "Create the complete PostgreSQL schema from Section 4 of the RoutineStars UML spec. Include all tables, foreign keys, indexes, and Row Level Security policies. Child profiles must only be accessible to their linked parent. Run the migration." |
| 1.3 | Supabase types | "Run supabase gen types typescript and create src/types/database.ts. Add helper types for all table rows and insert/update types." |
| 1.4 | Auth flow | "Build the authentication flow: parent signup, email verification, PIN setup screen, child profile creation. Use Supabase Auth for JWT. Store parent PIN as bcrypt hash (cost 12\) in parent\_profiles table. Build login, forgot PIN, and session refresh." |
| 1.5 | Design system | "Build all components from the design system section of BUILD\_GUIDE.docx. Create a Storybook-style test screen at /dev/components that shows every component in all states." |

## **Phase 2 — Child App Core (Week 3-4)**

| Sprint | Task | Claude Code Prompt Starter |
| :---- | :---- | :---- |
| 2.1 | Child home screen | "Build the Child Home Screen. Fetch today's DaySchedule for the logged-in child. Display activity sets as large ActivityCard components in order. Show day progress bar at top. Implement the state colours: PENDING=grey, IN\_PROGRESS=coloured, LOCKED=green tick." |
| 2.2 | Step sequencer | "Build the Activity Set screen. Load all steps for the selected set. Show one step at a time using StepCard. Implement: countdown timer, BIG TICK button, step progress bar, audio narration playback, star award animation. Save StepCompletion to database on each tick." |
| 2.3 | Reward engine | "Build the Reward Engine as a Supabase Edge Function. On set completion: calculate stars earned, check badge eligibility against all badge conditions in the UML spec, award new badges, update child total\_stars and current\_streak. Return reward summary to client." |
| 2.4 | Parental approval | "Build the parental approval flow: fullscreen ApprovalScreen (no navigation escape), push notification to parent via Firebase FCM, parent review screen showing step-by-step times, Approve/Redo buttons. On approve: trigger lockout, show CelebrationModal." |
| 2.5 | Reward collection | "Build the Reward Collection screen. Show all earned badges in a grid. Show locked badges greyed out with unlock condition text. Animated star meter. Streak counter with flame animation." |

## **Phase 3 — Parent App (Week 5-6)**

| Sprint | Task | Claude Code Prompt Starter |
| :---- | :---- | :---- |
| 3.1 | Parent dashboard | "Build the Parent Dashboard home screen. Show: today's completion rate, pending approvals (badge count), active child profile switcher, week progress summary. Use Inter font and a more professional visual style than the child app." |
| 3.2 | Schedule builder | "Build the Weekly Schedule Builder. 7-day timeline with hourly grid. Drag-and-drop from activity set palette. Conflict detection with warning. Time allocation editor. Requires-approval toggle per set. Save & Publish button that syncs to child app via Supabase Realtime." |
| 3.3 | Activity set editor | "Build the Activity Set Editor. List all default sets. Allow parent to: edit step text, reorder steps (drag), set durations, toggle approval requirement, upload custom illustration. Build Create Custom Set flow." |
| 3.4 | Progress reports | "Build the Progress Reports screen. Daily completion rate chart (recharts/Victory). Weekly heatmap. Badge timeline. Per-child streak history. Export to PDF option." |
| 3.5 | Settings | "Build Parent Settings: PIN change, notification preferences, child profile management (add/edit/delete), care team sharing (invite by email with view-only or approval role)." |

## **Phase 4 — SaaS Layer & Launch (Week 7-8)**

| Sprint | Task | Claude Code Prompt Starter |
| :---- | :---- | :---- |
| 4.1 | Subscription plans | "Integrate Stripe. Create 3 plans: Free (1 child, 5 sets), Standard £7.99/mo (3 children, all sets), Premium £14.99/mo (unlimited children, care team, custom sets). Add plan gating middleware that checks subscription status before allowing premium features." |
| 4.2 | Onboarding flow | "Build the onboarding flow for new users: welcome screen, create parent account, add first child profile (name, DOB, avatar emoji), choose subscription plan or start free trial, build first week schedule (guided wizard with suggested sets by age)." |
| 4.3 | Offline support | "Implement offline-first architecture. Child app must work fully offline: cache today's schedule, steps, audio files using Expo FileSystem. Queue completions in SQLite (expo-sqlite) when offline. Sync to Supabase when connection restored." |
| 4.4 | Testing suite | "Write comprehensive tests: Jest unit tests for reward engine and lockout logic, Detox E2E tests for: child completing a set, parent approving, schedule building. Target 80%+ coverage on critical paths." |
| 4.5 | App store prep | "Configure EAS Build for iOS and Android. Write App Store description and metadata. Generate screenshots using Expo's screenshot automation. Create privacy policy page (COPPA \+ UK GDPR compliant). Submit to TestFlight and Google Play Internal Testing." |

# **5\. Quality Standards — Tell Claude Code These Rules**

At the start of every session, include this block in your prompt to enforce quality standards:

| "QUALITY RULES — apply to all code you write: 1\. TypeScript strict mode — no "any" types allowed 2\. All database queries must use Row Level Security (Supabase RLS) 3\. All user-facing strings must be in a translation file (i18n-ready) 4\. Every component must handle: loading state, error state, empty state 5\. All forms must validate with Zod before submission 6\. API routes must validate request body with Zod 7\. Sensitive data (PIN, tokens) must never appear in logs or error messages 8\. All child-facing touch targets minimum 60x60px 9\. Every new feature needs at least one unit test 10\. Before finishing, run: npm run typecheck && npm run lint && npm test     Fix all errors before marking the task complete." |
| :---- |

## **5.1 Security Checklist — Ask Claude Code to Verify**

* Parent PIN stored as bcrypt hash (cost factor 12\) — never plaintext

* JWT tokens: 15-minute access tokens, 7-day refresh tokens, stored in SecureStore

* Supabase RLS: child data only accessible to linked parent user

* Rate limiting on approval endpoints (max 10 requests/minute per user)

* HTTPS enforced on all API routes — no HTTP fallback

* COPPA compliance: no analytics on under-13 without parent consent

* UK GDPR: data retention policy (90 days completions, 1 year reports)

* No third-party SDKs with advertising access on child-facing screens

* Stripe webhooks verified with signing secret before processing

## **5.2 Accessibility Checklist**

* WCAG 2.1 AA minimum, AAA on child-facing screens

* Reduced motion mode respects system prefers-reduced-motion setting

* High contrast mode available in settings

* Audio narration on every step — all content accessible without reading

* No time pressure: timers informational, never blocking or causing alerts

* Font scaling: test at 200% system font size — no overflow or truncation

* All images have meaningful alt text for screen reader support

# **6\. Recommended Folder Structure**

Tell Claude Code to create this structure at the start of Phase 1:

| routinestars/ ├── apps/ │   ├── mobile/               \# Expo React Native app (child \+ parent) │   │   ├── src/ │   │   │   ├── app/          \# Expo Router screens │   │   │   │   ├── (child)/  \# Child tab group │   │   │   │   ├── (parent)/ \# Parent tab group │   │   │   │   └── (auth)/   \# Auth screens │   │   │   ├── components/ │   │   │   │   ├── ui/       \# Design system components │   │   │   │   ├── child/    \# Child-specific components │   │   │   │   └── parent/   \# Parent-specific components │   │   │   ├── lib/ │   │   │   │   ├── supabase.ts │   │   │   │   ├── stripe.ts │   │   │   │   └── notifications.ts │   │   │   ├── hooks/        \# Custom React hooks │   │   │   ├── stores/       \# Zustand stores │   │   │   └── types/        \# TypeScript types │   └── web/                  \# Optional: Next.js marketing/dashboard site ├── packages/ │   ├── database/             \# Supabase migrations \+ types │   ├── shared/               \# Shared types \+ utilities │   └── ui/                   \# Shared component library ├── supabase/ │   ├── migrations/           \# SQL migration files │   └── functions/            \# Edge Functions ├── .github/workflows/        \# CI/CD pipelines └── docs/                     \# Design docs, this file |
| :---- |

# **7\. How to Run Claude Code Sessions Effectively**

## **7.1 Start of Every Session — Master Context Prompt**

| "I am building RoutineStars — a SEN autism daily routine app for children aged 4-14. It is a multi-user micro-SaaS with child tablet app and parent phone app. Reference documents in this repo: \- /docs/RoutineStars\_UML\_Specification.docx — full system design \- /docs/RoutineStars\_Build\_Guide.docx — this file, tech stack, quality rules Tech stack: React Native \+ Expo, Supabase (PostgreSQL \+ Auth \+ Storage \+ Realtime), Fastify API, Redis, Stripe billing, Firebase FCM. Today we are working on: \[DESCRIBE WHAT YOU WANT TO BUILD\] Apply all quality rules from Section 5 of the build guide. After completing, run all tests and show me a summary." |
| :---- |

## **7.2 Useful Commands to Give Claude Code**

| Situation | What to Say |
| :---- | :---- |
| App crashes on launch | "There is a crash on app launch. Read the error in the terminal, find the root cause, fix it, and confirm the app runs." |
| Feature looks wrong | "The \[screen name\] does not look right. \[Describe what is wrong\]. Fix the UI to match the design system in Section 3 of the build guide." |
| Database query is slow | "The \[feature\] is loading slowly. Profile the database query, add appropriate indexes, and verify the performance improvement." |
| Want to review everything | "Do a full code review of everything built so far. Check: TypeScript errors, security issues, accessibility, missing error states, and anything that does not match the spec." |
| Ready to deploy | "Prepare the app for production deployment. Check all environment variables are set, run full test suite, build release versions for iOS and Android, and deploy the Fastify API to Railway." |
| Something unclear | "Explain what \[code/feature/error\] does and why you implemented it this way. What are the alternatives?" |

## **7.3 Plan Mode — Review Before Claude Acts**

For any major change (database migrations, architecture changes, deleting files), use Plan Mode in VS Code by clicking the planning toggle before submitting. Claude Code will show you a plan for review before making any changes. Always use Plan Mode for:

* Any database migration that deletes or modifies columns

* Changes to authentication or security logic

* Stripe billing configuration changes

* Before the first production deployment

# **8\. SaaS Pricing & Business Model**

| Free | Starter — £7.99/mo | Family — £14.99/mo | School — £49/mo |
| :---- | :---- | :---- | :---- |
| 1 child profile | Up to 3 children | Unlimited children | Up to 30 children |
| 5 built-in sets only | All 15 built-in sets | All sets \+ custom | All sets \+ custom \+ bulk import |
| Basic reports only | Full reports \+ export | Reports \+ care team sharing | Reports \+ teacher portal \+ analytics |

# **9\. Quick Reference — Accounts to Create**

Create all these accounts before your first Claude Code session. All have free tiers:

| Service | URL | What You Need |
| :---- | :---- | :---- |
| GitHub | github.com | Create private repo: routinestars |
| Supabase | supabase.com | New project: routinestars-prod |
| Expo / EAS | expo.dev | Account for builds and OTA updates |
| Firebase | console.firebase.google.com | New project for FCM push notifications |
| Stripe | stripe.com | Account \+ 3 product plans created |
| Railway | railway.app | For Fastify API deployment |
| Sentry | sentry.io | Error monitoring for both apps |
| Upstash | upstash.com | Redis database (free tier) |
| Cloudflare | cloudflare.com | DNS \+ CDN for your domain |
| Resend | resend.com | Transactional email |

*Once all accounts are created, tell Claude Code: "Here are my environment variables — \[paste your keys\]. Store them in .env.local and configure Doppler for secrets management."*

*RoutineStars — Build Guide v1.0  ·  Building independence, one star at a time 🌟*