# RoutineStars — Complete UX Journey

> Last updated: 2026-05-22

---

## Table of Contents
1. [First-Time Onboarding (Parent)](#1-first-time-onboarding)
2. [Daily Child Journey](#2-daily-child-journey)
3. [Step Sequencer](#3-step-sequencer)
4. [Parental Approval Flow](#4-parental-approval-flow)
5. [Rewards System — How Badges Unlock](#5-rewards-system)
6. [Parent App — Daily Use](#6-parent-app-daily-use)
7. [Switching Between Child and Parent App](#7-switching-between-apps)
8. [Screen Map](#8-screen-map)

---

## 1. First-Time Onboarding

```
App Launch
    |
    v
/(auth)/welcome          "RoutineStars — Building independence, one star at a time"
    |                    [Get Started - It's Free]  [Sign In]
    |
    +--- NEW USER -------------------------------------------------------+
    |                                                                    |
    v                                                                    |
/(auth)/signup           Email + Password + Full Name                   |
    |                    -> Supabase Auth creates user row              |
    |                    -> Sends verification email                    |
    v                                                                    |
/(auth)/verify-email     "Check your email - tap the link to verify"   |
    |                    -> User taps link in email                     |
    |                    -> Supabase confirms session                   |
    v                                                                    |
/(auth)/setup-pin        Create 4-digit PIN (two-step: enter + confirm) |
    |                    -> Calls hash-pin edge function                |
    |                    -> PIN stored as bcrypt hash (cost 12)         |
    |                    -> NEVER stored in plaintext                   |
    v                                                                    |
/(auth)/create-child-    Child name + Date of birth + Avatar emoji      |
  profile                -> Creates child_profile row                   |
    |                    -> Links to parent user_id                     |
    v                                                                    |
/(auth)/choose-plan      Free / Starter 7.99 / Family 14.99            |
    |                    -> Creates Stripe customer                     |
    |                    -> Free tier: no card required                 |
    v                                                                    |
/(auth)/schedule-wizard  Guided wizard - pick suggested activity sets   |
    |                    by child age group                             |
    |                    -> Creates DaySchedule for current week        |
    v                                                                    |
/(parent)/dashboard      Parent is now set up                           |
                                                                        |
    <------------------ RETURNING USER ---------------------------------+
    |
    v
/(auth)/login            Email + Password
    |                    -> Supabase Auth signs in
    |                    -> AuthGuard reads role from users table
    |                    -> role=parent -> /(parent)/dashboard
    |                    -> role=child  -> /(child)/select-profile
```

---

## 2. Daily Child Journey

```
/(child)/select-profile
    |   Shows all child profiles linked to this account
    |   Child taps their avatar/name
    |   -> Sets selectedChild in child.store (Zustand)
    v
/(child)/(tabs)/home     CHILD HOME SCREEN
    |
    |   TOP BAR:
    |   [<- Parent]  (PIN gate button)        [Avatar + Name]
    |
    |   HEADER:
    |   "Good morning, Alex!"
    |   Today's date
    |   Stars earned today (top right)
    |
    |   PROGRESS BAR:
    |   "Today's Progress  2 / 5 done" --------
    |
    |   ALL DONE BANNER (shown when dayProgress = 1):
    |   "All done today! Amazing!"
    |
    |   ACTIVITY CARDS (ordered by order_in_day):
    |
    |   [ Brushing Teeth       PENDING ]   <- Grey, tappable
    |   [ 3 stars              08:00   ]
    |
    |   [ Getting Ready     IN PROGRESS]   <- Coloured, tappable
    |   [ 4 stars              08:30   ]
    |
    |   [ City Explorer        APPROVED]   <- Green tick, locked
    |   [ 5 stars              14:00   ]
    |
    |   Card statuses:
    |   PENDING            -> grey card, tappable
    |   IN_PROGRESS        -> brand-primary coloured, tappable
    |   PAUSED             -> amber, tappable
    |   AWAITING_APPROVAL  -> yellow pulse, NOT tappable (waiting for parent)
    |   APPROVED           -> green tick, locked
    |   LOCKED             -> green tick, locked
    |   SKIPPED            -> grey strikethrough
    |
    |   Tapping a tappable card:
    v
/(child)/step-sequencer  (see Section 3)
```

---

## 3. Step Sequencer

```
/(child)/step-sequencer

    BEFORE first step:
    Full-screen animated intro for the activity set name

    FOR EACH STEP (shown one at a time):

    +------------------------------------------+
    |  Step 2 of 5              Progress bar    |
    |                                           |
    |         [STEP ILLUSTRATION / EMOJI]       |
    |                                           |
    |    "Brush your teeth for 2 minutes"       |
    |         (large, min 32px text)            |
    |                                           |
    |         1:45 remaining                    |  <- informational only, never blocks
    |                                           |
    |   +--------------------------------------+|
    |   |              DONE!                   || <- min 80x80px touch target
    |   +--------------------------------------+|
    |                                           |
    |   [Listen again]                          |  <- replays audio narration
    +------------------------------------------+

    On DONE tap:
    -> Saves StepCompletion to Supabase (or SQLite queue if offline)
    -> Star burst animation
    -> Sound effect
    -> Moves to next step

    LAST STEP completed:
    -> ScheduledSet status -> AWAITING_APPROVAL (if requires_approval = true)
    -> OR -> status -> APPROVED directly (if requires_approval = false)
    -> Calls reward-engine edge function:
        - Calculates stars earned
        - Checks all 14 badge conditions
        - Updates total_stars + current_streak
        - Awards newly earned badges
    -> CelebrationModal shown:
        "You earned 4 stars!"
        [newly earned badge: "City Explorer unlocked!" if applicable]
        -> Auto-dismisses after 5 seconds OR taps dismiss
    -> If requires_approval:
        -> ApprovalScreen shown (fullscreen, no escape)
        -> Push notification sent to parent phone
        -> Waits for parent to approve/redo via Realtime channel
    -> If auto-approved:
        -> Returns to home screen
        -> Child rewards screen updated (query cache invalidated)
```

---

## 4. Parental Approval Flow

```
CHILD SIDE (tablet):                    PARENT SIDE (phone):

ApprovalScreen shown                    Push notification arrives:
+-------------------------+            "Alex finished Brushing Teeth"
|  Waiting for parent     |
|                         |              Parent opens notification
|  "Brushing Teeth"       |                        |
|  Completed in 4m 32s    |                        v
|                         |            /(parent)/approve/[completionId]
|  Progress bar: 3 steps  |
|                         |            Shows each step with time taken:
|  [spinning animation]   |            Step 1: Wet toothbrush    0:18
+-------------------------+            Step 2: Brush 2 mins      2:04
                                        Step 3: Rinse & spit      0:27
Realtime subscription                           Total: 4m 32s
listening on:
`approval-{completionId}`              [Approve]  [Redo]
        |
        |  -- Parent taps Approve ----------------------------------------+
        |  scheduled_set.status -> APPROVED                               |
        |  reward-engine called                                            |
        |  Realtime event fires (postgres_changes)                        |
        v                                                                  |
CelebrationModal shown <--------------------------------------------------+
"Amazing! You earned 4 stars!"
+ any newly earned badges shown

        |  -- Parent taps Redo -------------------------------------------+
        |  Broadcast event: { type: 'redo' }                              |
        v                                                                  |
Child returns to home screen <--------------------------------------------+
Set status -> PENDING again
```

---

## 5. Rewards System

### How Stars Are Earned
Each ActivitySet has a `star_value` (1-10). Stars are awarded when a set is **APPROVED**.
Bonus stars are awarded for streak milestones (see below).

### How Badges Unlock

Badges are checked automatically by the **reward-engine** edge function
every time a set is approved. The child does not need to do anything extra —
badges appear automatically on the Rewards screen.

| Badge | Unlock Condition |
|---|---|
| Sparkling Teeth | Brushing Teeth set completed 5+ times |
| Early Bird | Waking Up + Breakfast both done before 08:00 on same day |
| School Ready Star | Getting Ready for School completed 10+ times |
| Homework Hero | Homework set completed 7 consecutive days |
| Sleepy Champion | Bedtime set completed on-time 5+ times |
| Park Explorer | Going to the Park completed at least once |
| Super Shopper | Supermarket set completed at least once |
| City Explorer | City Centre set completed at least once |
| Full Week Champ | Every scheduled set completed for any single calendar week |
| Golden Month | Perfect Day achieved 20+ times in one calendar month |
| 3-Day Streak | 3 consecutive days with at least 1 completion |
| 7-Day Streak | 7 consecutive days with at least 1 completion |
| Perfect Day | All scheduled sets completed today |
| Weekend Adventurer | Any weekend activity set completed at least once |

### Streak Bonus Stars
| Streak | Bonus |
|---|---|
| 3 days | +15 stars |
| 7 days | +50 stars |

### Rewards Screen (child)

```
/(child)/(tabs)/rewards

+-----------------------------------+
|  127 Total Stars                  |
|  Progress bar  -------> 200       |  <- Star meter with next milestone
|                                   |
|  5-day streak!                    |
|  Streak bar  5/7 days             |
+-----------------------------------+

BADGES GRID (3 columns):

[Sparkling Teeth EARNED] [Early Bird EARNED] [School Ready LOCKED]
[Homework Hero LOCKED]   [Sleepy Champ EARNED] [Park Explorer LOCKED]
...

Tapping an earned badge -> full-screen badge detail modal
Tapping a locked badge  -> shows unlock condition hint
```

---

## 6. Parent App — Daily Use

```
/(parent)/dashboard
    |
    |   TODAY AT A GLANCE:
    |   - Completion rate: 3/5 activities done (60%)
    |   - Pending approvals badge count
    |   - Child profile switcher (if multiple children)
    |   - Week summary bar chart
    |
    +-- [Dashboard] -- [Schedule] -- [Activities] -- [Reports] -- [Settings]
    |
    +- Schedule tab -> /(parent)/schedule
    |     7-day horizontal timeline
    |     Hourly grid - drag activity sets into time slots
    |     Conflict detection (overlapping times -> warning)
    |     requires-approval toggle per set
    |     [Save & Publish] -> syncs via Supabase Realtime to child tablet
    |
    +- Activities tab -> /(parent)/activity-sets
    |     List of all activity sets (built-in + custom)
    |     Tap a set -> edit steps, reorder (drag), set durations
    |     [+ Create Custom Set] -> new set flow
    |     Upload custom illustration per set
    |
    +- Reports tab -> /(parent)/reports
    |     Daily completion rate chart
    |     Weekly heatmap calendar
    |     Badge timeline (when each badge was earned)
    |     Per-child streak history
    |     [Export PDF]
    |
    +- Settings tab -> /(parent)/settings
          +- Change PIN (for child->parent switch gate)
          +- Notification preferences
          +- Child profile management (add/edit/delete)
          +- Care team sharing (invite by email)
          +- Sign Out
```

---

## 7. Switching Between Apps

### Child to Parent (PIN gate)

```
Child Home Screen
    |
    [<- Parent] button (top left of Today tab)
    |
    v
PIN Gate Modal slides up:
+----------------------------------+
|     Parent Access                |
|  Enter your 4-digit PIN          |
|                                  |
|     o  o  o  o   (4 dots)        |
|                                  |
|   [1][2][3]                      |
|   [4][5][6]                      |
|   [7][8][9]                      |
|      [0][<-]                     |
|                                  |
|        [Cancel]                  |
+----------------------------------+
    |
    Child enters 4 digits
    -> Calls verify-pin edge function
    -> If valid:   router.replace('/(parent)/dashboard')
    -> If invalid: "Incorrect PIN. Try again." + reset dots
    -> If no PIN set yet: any 4 digits work (prompts parent to set one)
    |
    v
/(parent)/dashboard
```

### Parent to Child (no PIN needed)
The parent uses the child device directly.
To hand device back to child: navigate to /(child)/select-profile or
use the child device's home app switcher.

---

## 8. Screen Map

```
app/
+-- index.tsx                    -> Redirects to /(auth)/welcome
|
+-- (auth)/
|   +-- welcome.tsx              -> Landing page
|   +-- signup.tsx               -> Create account
|   +-- verify-email.tsx         -> Email confirmation gate
|   +-- setup-pin.tsx            -> 4-digit PIN creation (onboarding)
|   +-- login.tsx                -> Sign in
|   +-- forgot-pin.tsx           -> Password reset email
|   +-- create-child-profile.tsx -> First child setup
|   +-- choose-plan.tsx          -> Stripe plan selection
|   +-- schedule-wizard.tsx      -> Guided first-schedule setup
|
+-- (child)/
|   +-- select-profile.tsx       -> Choose which child (multi-child accounts)
|   +-- step-sequencer.tsx       -> Step-by-step activity flow
|   +-- (tabs)/
|       +-- home.tsx             -> Today's schedule + progress
|       +-- rewards.tsx          -> Stars, badges, streak
|       +-- _layout.tsx          -> Tab bar + PIN gate modal (child->parent switch)
|
+-- (parent)/
|   +-- dashboard.tsx            -> Today overview + approvals
|   +-- schedule.tsx             -> Weekly drag-drop schedule builder
|   +-- activity-sets.tsx        -> Activity set editor
|   +-- reports.tsx              -> Charts, heatmap, PDF export
|   +-- settings.tsx             -> PIN change, notifications, profiles
|   +-- subscription.tsx         -> Plan management + Stripe portal
|   +-- approve/[completionId]   -> Step-by-step approval review
|
+-- privacy-policy.tsx
|
+-- dev/                         <- DEV ONLY (redirects to welcome in production)
    +-- components.tsx           -> Design system showcase
```

---

## Edge Functions Reference

| Function | Called From | Purpose |
|---|---|---|
| `hash-pin` | setup-pin screen | Bcrypt-hash PIN on first setup |
| `verify-pin` | Child tab layout (PIN gate) | Verify PIN before parent switch |
| `change-pin` | Settings screen | Change PIN (verifies old, sets new) |
| `reward-engine` | step-sequencer (on completion) | Calculate stars + award badges |
| `approve-completion` | Parent approve screen | Mark set approved, trigger rewards |

---

## Offline Behaviour

When device has no internet:
- Today's schedule + steps served from local SQLite cache (expo-sqlite)
- Step completions queued in SQLite
- Audio narration served from Expo FileSystem cache
- On reconnect: useSyncPending hook drains queue to Supabase

---

## Data Flow Summary

```
Parent configures schedule
    -> day_schedules + scheduled_sets written to Supabase
    -> Realtime pushes update to child tablet

Child completes steps
    -> step_completions written (online: Supabase, offline: SQLite queue)
    -> scheduled_set status: PENDING -> IN_PROGRESS -> AWAITING_APPROVAL

Parent approves
    -> scheduled_set status -> APPROVED
    -> reward-engine runs: stars + badges awarded
    -> Realtime notifies child tablet -> CelebrationModal

Child sees updated rewards
    -> TanStack Query invalidates ['childRewards', childId]
    -> Rewards screen re-fetches
```
