

🌟

**RoutineStars**

*SEN Autism Daily Routine App*

**Complete System UML Specification**

Version 1.0  |  Confidential Design Document

| *For children with autism spectrum disorder (ASD) and special educational needs (SEN)* Gamified  |  Parental-Controlled  |  Visual Sequencing  |  Progress Tracking |
| :---: |

# **Table of Contents**

| 1\. Executive Summary *Project Overview & Design Goals* |
| :---: |

## **1.1 Application Overview**

RoutineStars is a tablet-first application designed to enable autistic children aged 4–14 to follow daily routines independently, with minimal adult direction. Grounded in ABA therapy, TEACCH methodology, and AAC principles, the app delivers gamified visual sequencing across weekday and weekend activity sets.

## **1.2 Core Design Principles**

* Predictability — every routine follows the same visual language so children know what to expect

* Autonomy — the child drives interaction; adults supervise from a separate parent portal

* Positive Reinforcement — stars, trophies, and animations reward every completion

* Parental Control — all schedule editing, approval, and lockout is mediated through the parent app

* Accessibility — high contrast, AAC-style icons, audio narration, and touch-optimised UI

## **1.3 Activity Set Catalogue**

**Weekday Sets:**

* Waking Up Set

* Brushing Teeth Set

* Getting Dressed Set

* Breakfast Set

* Getting Ready for School Set

* After-School Set

* Changing Out of School Clothes Set

* Eating Tea / Lunch Set

* Homework / Study / Activity Set

* Eating Dinner Set

* Washing, Brushing & Bedtime Set

**Weekend Sets:**

* Going to the Park Set

* Going to the Supermarket Set

* Going to the City Centre Set

* Custom Weekend Activity (parent-defined)

| 2\. Actors & Use Case Diagram *Who interacts with the system and how* |
| :---: |

## **2.1 System Actors**

| Child (Primary) | Follows routines, marks steps complete, earns rewards, views progress |
| :---- | :---- |
| **Parent / Guardian** | Configures schedules, approves completions, manages lockout, views reports |
| **System (Timer)** | Automated timers, progress tracking, badge awards, notifications |
| **Notification Service** | Sends push alerts to parent device when child requests approval |

## **2.2 Use Case Diagram (PlantUML)**

| @startuml RoutineStars\_UseCaseDiagram left to right direction skinparam actorStyle awesome actor "Child" as C \#LightBlue actor "Parent / Guardian" as P \#LightGreen actor "Timer System" as T \#LightYellow actor "Notification\\nService" as N \#LightPink rectangle "RoutineStars Application" {   package "Child Module" {     usecase UC1 as "View Today's\\nSchedule"     usecase UC2 as "Follow Activity Set\\n(Step Sequencing)"     usecase UC3 as "Mark Step Complete"     usecase UC4 as "View Progress Bar"     usecase UC5 as "Earn Stars & Badges"     usecase UC6 as "Request Parent Approval"     usecase UC7 as "View Reward Collection"     usecase UC8 as "Hear Audio Narration"   }   package "Parent Module" {     usecase UC9  as "Configure Weekly\\nSchedule"     usecase UC10 as "Drag & Drop Activities\\nto Timeline"     usecase UC11 as "Create / Edit\\nActivity Set"     usecase UC12 as "Approve Set Completion"     usecase UC13 as "Trigger Full Lockout"     usecase UC14 as "Set Time Allocations"     usecase UC15 as "View Child Progress\\nReports"     usecase UC16 as "Manage Reward System"     usecase UC17 as "Add/Edit Steps in Set"     usecase UC18 as "Set PIN / Passcode"   }   package "System Automation" {     usecase UC19 as "Countdown Timer"     usecase UC20 as "Award Badges\\nAutomatically"     usecase UC21 as "Send Push Notification\\nto Parent"     usecase UC22 as "Lock Screen After\\nCompletion"     usecase UC23 as "Generate Progress\\nAnalytics"   } } C \--\> UC1 C \--\> UC2 C \--\> UC3 C \--\> UC4 C \--\> UC5 C \--\> UC6 C \--\> UC7 C \--\> UC8 P \--\> UC9 P \--\> UC10 P \--\> UC11 P \--\> UC12 P \--\> UC13 P \--\> UC14 P \--\> UC15 P \--\> UC16 P \--\> UC17 P \--\> UC18 T \--\> UC19 T \--\> UC20 T \--\> UC22 T \--\> UC23 UC6 ..\> UC21 : \<\<include\>\> UC12 ..\> UC13 : \<\<include\>\> UC3  ..\> UC20 : \<\<extend\>\> UC2  ..\> UC19 : \<\<include\>\> N \--\> UC21 UC21 ..\> N : \<\<include\>\> @enduml |
| :---- |

| 3\. Class Diagram *Domain model — entities and relationships* |
| :---: |

## **3.1 Core Domain Classes**

| @startuml RoutineStars\_ClassDiagram skinparam classAttributeIconSize 0 skinparam classFontStyle bold class User {   \+userId: UUID   \+name: String   \+role: Enum{CHILD, PARENT}   \+avatarUrl: String   \+createdAt: DateTime } class ChildProfile {   \+profileId: UUID   \+childName: String   \+dateOfBirth: Date   \+avatarEmoji: String   \+totalStars: Int   \+totalBadges: Int   \+currentStreak: Int   \+parentId: UUID } class ParentProfile {   \+profileId: UUID   \+pinCode: String (hashed)   \+notifyOnCompletion: Boolean   \+notifyOnRequest: Boolean   \+linkedChildIds: List\<UUID\> } class ActivitySet {   \+setId: UUID   \+setName: String   \+category: Enum{MORNING,SCHOOL,AFTERNOON,EVENING,WEEKEND}   \+iconEmoji: String   \+colourTheme: String   \+totalDurationMins: Int   \+requiresParentalApproval: Boolean   \+isCustom: Boolean } class Step {   \+stepId: UUID   \+setId: UUID   \+orderIndex: Int   \+title: String   \+instructionText: String   \+audioNarration: String (URL)   \+illustrationUrl: String   \+durationSeconds: Int   \+rewardStars: Int } class DaySchedule {   \+scheduleId: UUID   \+childId: UUID   \+dayOfWeek: Enum{MON..SUN}   \+date: Date   \+isWeekend: Boolean   \+createdByParentId: UUID } class ScheduledSet {   \+scheduledSetId: UUID   \+scheduleId: UUID   \+setId: UUID   \+orderInDay: Int   \+startTime: Time   \+endTime: Time   \+status: Enum{PENDING,IN\_PROGRESS,AWAITING\_APPROVAL,APPROVED,LOCKED} } class Completion {   \+completionId: UUID   \+scheduledSetId: UUID   \+childId: UUID   \+startedAt: DateTime   \+completedAt: DateTime   \+starsEarned: Int   \+parentApproved: Boolean   \+approvedAt: DateTime   \+approvedByParentId: UUID } class StepCompletion {   \+stepCompId: UUID   \+completionId: UUID   \+stepId: UUID   \+completedAt: DateTime   \+timeTakenSeconds: Int } class Reward {   \+rewardId: UUID   \+type: Enum{STAR,BADGE,TROPHY,STREAK\_BONUS}   \+name: String   \+iconUrl: String   \+description: String   \+starsRequired: Int } class ChildReward {   \+childRewardId: UUID   \+childId: UUID   \+rewardId: UUID   \+earnedAt: DateTime } class Notification {   \+notifId: UUID   \+recipientUserId: UUID   \+type: Enum{APPROVAL\_REQUEST,SET\_COMPLETE,BADGE\_EARNED}   \+message: String   \+sentAt: DateTime   \+isRead: Boolean } class LockoutEvent {   \+lockoutId: UUID   \+childId: UUID   \+scheduledSetId: UUID   \+lockedAt: DateTime   \+unlockedAt: DateTime   \+unlockedByParentId: UUID } ' ─── Relationships ────────────────────────────────────────── User         ||--o{ ChildProfile  : "has" User         ||--o{ ParentProfile : "has" ParentProfile ||--o{ ChildProfile : "manages" ChildProfile  ||--o{ DaySchedule  : "has" DaySchedule   ||--o{ ScheduledSet : "contains" ScheduledSet  }o--|| ActivitySet  : "references" ActivitySet   ||--o{ Step         : "has" ScheduledSet  ||--o{ Completion   : "tracked by" Completion    ||--o{ StepCompletion : "consists of" ChildProfile  ||--o{ ChildReward  : "earns" ChildReward   }o--|| Reward       : "references" ChildProfile  ||--o{ Notification : "receives" Completion    ||--o{ LockoutEvent : "triggers" @enduml |
| :---- |

| 4\. Entity Relationship Diagram (ERD) *Database schema and relationships* |
| :---: |

## **4.1 Database Tables**

| @startuml RoutineStars\_ERD \!define TABLE(name,desc) class name as "desc" \<\< (T,\#FFAAAA) \>\> hide methods TABLE(users, "users") {   PK user\_id UUID   \--    name VARCHAR(100)   role ENUM('child','parent')   avatar\_url TEXT   created\_at TIMESTAMPTZ } TABLE(child\_profiles, "child\_profiles") {   PK profile\_id UUID   FK user\_id UUID   FK parent\_id UUID   \--   child\_name VARCHAR(80)   date\_of\_birth DATE   avatar\_emoji VARCHAR(10)   total\_stars INT DEFAULT 0   current\_streak INT DEFAULT 0 } TABLE(parent\_profiles, "parent\_profiles") {   PK profile\_id UUID   FK user\_id UUID   \--   pin\_hash VARCHAR(255)   notify\_on\_completion BOOLEAN   notify\_on\_request BOOLEAN } TABLE(activity\_sets, "activity\_sets") {   PK set\_id UUID   \--   set\_name VARCHAR(100)   category VARCHAR(30)   icon\_emoji VARCHAR(10)   colour\_theme VARCHAR(20)   total\_duration\_mins INT   requires\_approval BOOLEAN   is\_custom BOOLEAN   created\_by\_parent\_id UUID } TABLE(steps, "steps") {   PK step\_id UUID   FK set\_id UUID   \--   order\_index INT   title VARCHAR(120)   instruction\_text TEXT   audio\_url TEXT   illustration\_url TEXT   duration\_seconds INT   reward\_stars INT DEFAULT 1 } TABLE(day\_schedules, "day\_schedules") {   PK schedule\_id UUID   FK child\_id UUID   \--   day\_of\_week SMALLINT   schedule\_date DATE   is\_weekend BOOLEAN   created\_by UUID } TABLE(scheduled\_sets, "scheduled\_sets") {   PK scheduled\_set\_id UUID   FK schedule\_id UUID   FK set\_id UUID   \--   order\_in\_day SMALLINT   start\_time TIME   end\_time TIME   status VARCHAR(30) } TABLE(completions, "completions") {   PK completion\_id UUID   FK scheduled\_set\_id UUID   FK child\_id UUID   \--   started\_at TIMESTAMPTZ   completed\_at TIMESTAMPTZ   stars\_earned INT   parent\_approved BOOLEAN   approved\_at TIMESTAMPTZ   approved\_by UUID } TABLE(step\_completions, "step\_completions") {   PK step\_comp\_id UUID   FK completion\_id UUID   FK step\_id UUID   \--   completed\_at TIMESTAMPTZ   time\_taken\_seconds INT } TABLE(rewards, "rewards") {   PK reward\_id UUID   \--   type VARCHAR(30)   name VARCHAR(80)   icon\_url TEXT   description TEXT   stars\_required INT } TABLE(child\_rewards, "child\_rewards") {   PK child\_reward\_id UUID   FK child\_id UUID   FK reward\_id UUID   \--   earned\_at TIMESTAMPTZ } TABLE(lockout\_events, "lockout\_events") {   PK lockout\_id UUID   FK child\_id UUID   FK scheduled\_set\_id UUID   \--   locked\_at TIMESTAMPTZ   unlocked\_at TIMESTAMPTZ   unlocked\_by UUID } TABLE(notifications, "notifications") {   PK notif\_id UUID   FK recipient\_user\_id UUID   \--   type VARCHAR(40)   message TEXT   sent\_at TIMESTAMPTZ   is\_read BOOLEAN DEFAULT FALSE } users              ||--o{ child\_profiles   : "user\_id" users              ||--o{ parent\_profiles  : "user\_id" parent\_profiles    ||--o{ child\_profiles   : "parent\_id" child\_profiles     ||--o{ day\_schedules    : "child\_id" day\_schedules      ||--o{ scheduled\_sets   : "schedule\_id" activity\_sets      ||--o{ scheduled\_sets   : "set\_id" activity\_sets      ||--o{ steps            : "set\_id" scheduled\_sets     ||--o{ completions      : "scheduled\_set\_id" completions        ||--o{ step\_completions : "completion\_id" steps              ||--o{ step\_completions : "step\_id" child\_profiles     ||--o{ child\_rewards    : "child\_id" rewards            ||--o{ child\_rewards    : "reward\_id" scheduled\_sets     ||--o{ lockout\_events   : "scheduled\_set\_id" child\_profiles     ||--o{ lockout\_events   : "child\_id" users              ||--o{ notifications    : "recipient\_user\_id" @enduml |
| :---- |

| 5\. Sequence Diagrams *Key interaction flows between actors and system* |
| :---: |

## **5.1 Child Completes an Activity Set**

| @startuml SD\_CompleteActivitySet actor Child as C participant "Child App\\n(UI)" as UI participant "Routine\\nEngine" as RE participant "Timer\\nService" as TS participant "Reward\\nEngine" as RW participant "Notification\\nService" as NS participant "Parent App" as PA database "Database" as DB C \-\> UI : Tap today's schedule UI \-\> DB : fetchDaySchedule(childId, today) DB \--\> UI : List\<ScheduledSet\> UI \--\> C : Display activity timeline C \-\> UI : Tap activity set (e.g. Brushing Teeth) UI \-\> RE : startActivitySet(scheduledSetId) RE \-\> DB : loadSteps(setId) DB \--\> RE : List\<Step\> RE \-\> TS : startTimer(step.durationSeconds) RE \--\> UI : displayFirstStep(step) loop For each step   UI \--\> C : Show illustration \+ audio narration   TS \--\> UI : Tick countdown timer   C \-\> UI : Tap BIG TICK (step complete)   UI \-\> RE : markStepComplete(stepId)   RE \-\> DB : saveStepCompletion(stepId, timeTaken)   RE \-\> RW : awardStepStars(step.rewardStars)   RW \--\> UI : Star animation \+ sound effect   RE \--\> UI : Display next step end RE \-\> DB : saveCompletion(scheduledSetId, starsEarned) RE \-\> RW : checkBadgeEligibility(childId) RW \--\> UI : Show celebration animation alt Requires Parental Approval   UI \--\> C : Show 'Get Mum or Dad to Check\!' screen   UI \-\> NS : sendApprovalRequest(parentId, completionId)   NS \-\> PA : Push notification: 'Brushing Teeth complete\!'   PA \-\> DB : approveCompletion(completionId, parentId)   DB \-\> RE : triggerLockout(scheduledSetId)   RE \--\> UI : Lock screen (confetti \+ Well Done\!) else No Approval Required   DB \-\> RE : autoLock(scheduledSetId)   RE \--\> UI : Lock screen (confetti \+ Well Done\!) end @enduml |
| :---- |

## **5.2 Parent Configures Weekly Schedule (Drag & Drop)**

| @startuml SD\_ParentConfigSchedule actor Parent as P participant "Parent App\\n(UI)" as UI participant "Schedule\\nService" as SS database "Database" as DB participant "Child App" as CA P \-\> UI : Open Weekly Planner UI \-\> DB : fetchWeeklySchedule(childId, weekOf) DB \--\> UI : DaySchedule\[7\] UI \-\> DB : fetchAllActivitySets() DB \--\> UI : List\<ActivitySet\> UI \--\> P : Show week timeline \+ activity set palette P \-\> UI : Drag 'Brushing Teeth' to Monday 8:00am UI \-\> SS : addScheduledSet(scheduleId, setId, orderInDay, startTime) SS \-\> DB : INSERT scheduled\_sets DB \--\> SS : scheduledSetId SS \--\> UI : Confirm placement, update timeline P \-\> UI : Drag 'Breakfast Set' to Monday 8:30am UI \-\> SS : addScheduledSet(scheduleId, setId2, 2, '08:30') SS \-\> DB : INSERT scheduled\_sets SS \--\> UI : Update Monday timeline P \-\> UI : Tap 'Save & Publish Schedule' UI \-\> SS : publishSchedule(scheduleId) SS \-\> DB : UPDATE day\_schedules SET published=true SS \-\> CA : syncSchedule(childId, weekSchedule) CA \--\> P : Child app refreshes with new schedule UI \--\> P : 'Schedule saved\! Your child can see it now.' @enduml |
| :---- |

## **5.3 Parental Approval & Lockout Flow**

| @startuml SD\_ParentalApproval actor Child as C participant "Child App" as CA participant "Notification\\nService" as NS actor Parent as P participant "Parent App" as PA participant "Lockout\\nEngine" as LE database DB C \-\> CA : All steps complete — tap 'I'm Done\!' CA \-\> NS : notifyParent(parentId, completionId, setName) NS \-\> PA : Push: '\[Child\] finished Brushing Teeth\!' CA \--\> C : Show holding screen: note right of CA : 'Get Mum or Dad to\\ncheck your teeth\! 🦷'\\n(full screen, no navigation) P \-\> PA : Open notification PA \-\> DB : fetchCompletion(completionId) DB \--\> PA : Completion details \+ step times PA \--\> P : Show completion summary \+ step-by-step review alt Parent Approves   P \-\> PA : Tap 'Approve & Lock'   PA \-\> DB : approveCompletion(completionId, parentId, now())   PA \-\> LE : triggerLockout(scheduledSetId, childId)   LE \-\> DB : INSERT lockout\_events   LE \-\> CA : lockScreen(scheduledSetId)   CA \--\> C : Celebration screen — confetti \+ badge \+ stars   CA \--\> C : LOCKED — set greyed out with tick on timeline else Parent Requests Redo   P \-\> PA : Tap 'Needs Redo'   PA \-\> DB : resetCompletion(completionId)   PA \-\> CA : notifyChild(childId, 'Try again\!')   CA \--\> C : Gentle prompt to repeat the set end @enduml |
| :---- |

| 6\. State Machine Diagrams *Lifecycle states of key entities* |
| :---: |

## **6.1 Scheduled Set State Machine**

| @startuml SM\_ScheduledSet skinparam state { BackgroundColor LightBlue; BorderColor Navy } \[\*\] \--\> PENDING : Parent adds set to schedule PENDING \--\> IN\_PROGRESS : Child taps to start PENDING \--\> SKIPPED     : Parent removes from day IN\_PROGRESS \--\> AWAITING\_APPROVAL : Child marks all steps done IN\_PROGRESS \--\> PAUSED            : Child exits mid-routine PAUSED \--\> IN\_PROGRESS : Child resumes PAUSED \--\> IN\_PROGRESS : Timer nudge after 5 min AWAITING\_APPROVAL \--\> APPROVED     : Parent taps Approve AWAITING\_APPROVAL \--\> IN\_PROGRESS  : Parent taps Redo APPROVED \--\> LOCKED : Lockout engine triggers LOCKED \--\> \[\*\] : End of day archive SKIPPED \--\> \[\*\] note right of AWAITING\_APPROVAL   Child sees holding screen:\\n  'Get Mum or Dad to check\!'\\n  No navigation available. end note note right of LOCKED   Set displays with green tick.\\n  No re-entry possible without\\n  Parent PIN reset. end note @enduml |
| :---- |

## **6.2 Step State Machine**

| @startuml SM\_Step \[\*\]          \--\> NOT\_STARTED NOT\_STARTED  \--\> ACTIVE       : Previous step complete / set started ACTIVE       \--\> COMPLETE     : Child taps Big Tick button ACTIVE       \--\> ACTIVE       : Timer tick (audio cue every 30s) COMPLETE     \--\> \[\*\] note right of ACTIVE : Stars awarded immediately on completion @enduml |
| :---- |

| 7\. Activity Diagrams *Process flows for key workflows* |
| :---: |

## **7.1 Child Morning Routine Flow**

| @startuml AD\_MorningRoutine start :Wake up notification on device; :Open RoutineStars app; :View Today's Schedule (timeline); repeat   :Select next PENDING activity set;   :View set overview (name, icon, star value);   :Tap START;   repeat     :Read step instruction;     :Listen to audio narration (optional);     :Complete the physical step;     :Tap BIG TICK button;     :Star animation \+ sound;   repeat while (More steps?) is (Yes)   \-\> No;   if (Requires Parental Approval?) then (Yes)     :Show 'Get Mum or Dad to Check\!' screen;     :Wait for parent notification response;     if (Parent approves?) then (Yes)       :Confetti celebration;       :Award bonus stars;       :LOCK this set on timeline;     else (No \- Redo)       :Gentle prompt to try again;       :Reset step completions;     endif   else (No)     :Auto-celebration \+ LOCK;   endif repeat while (More sets today?) is (Yes) \-\> No; :Show Daily Complete screen; :Award day streak bonus; stop @enduml |
| :---- |

## **7.2 Parent Schedule Setup Flow**

| @startuml AD\_ParentSetup start :Parent opens Parent App; :Authenticate with PIN; :Select child profile; :Open Weekly Planner; fork   :View existing week schedule; fork again   :Browse Activity Set library; end fork repeat   :Select a day (Mon-Sun);   :Drag activity set to time slot;   if (Conflict with existing set?) then (Yes)     :Show conflict warning;     :Adjust time or remove conflict;   endif   :Set start time & duration;   :Set requires-approval toggle; repeat while (More sets to add?) is (Yes) \-\> No; :Review full week summary; :Tap Save & Publish; :Child app syncs automatically; stop @enduml |
| :---- |

| 8\. Component & Architecture Diagram *Technical system architecture* |
| :---: |

## **8.1 High-Level Component Diagram**

| @startuml RoutineStars\_Components skinparam componentStyle uml2 package "Child Device (Tablet)" {   \[Child App UI\] as CAUI   \[Routine Engine\] as RE   \[Timer Service\] as TS   \[Audio Player\] as AP   \[Offline Cache\] as OC   CAUI \--\> RE   CAUI \--\> TS   CAUI \--\> AP   RE   \--\> OC } package "Parent Device (Phone/Tablet)" {   \[Parent App UI\] as PAUI   \[Schedule Builder\\n(Drag & Drop)\] as SB   \[Approval Manager\] as AM   \[Progress Dashboard\] as PD   PAUI \--\> SB   PAUI \--\> AM   PAUI \--\> PD } package "Backend Services" {   \[API Gateway\] as GW   \[Auth Service\] as AUTH   \[Schedule Service\] as SCHED   \[Completion Service\] as COMP   \[Reward Engine\] as RWE   \[Notification Service\] as NOTIF   \[Lockout Service\] as LOCK   \[Analytics Service\] as ANALY   GW \--\> AUTH   GW \--\> SCHED   GW \--\> COMP   GW \--\> NOTIF   COMP \--\> RWE   COMP \--\> LOCK   COMP \--\> ANALY   COMP \--\> NOTIF } package "Data Layer" {   database "PostgreSQL" as PG   database "Redis Cache" as REDIS   storage "Media Storage\\n(S3/CDN)" as S3   SCHED \--\> PG   COMP  \--\> PG   RWE   \--\> PG   LOCK  \--\> PG   ANALY \--\> PG   AUTH  \--\> REDIS   SCHED \--\> REDIS } package "External" {   \[Firebase FCM\\n(Push)\] as FCM   NOTIF \--\> FCM } CAUI  \--\> GW : HTTPS REST/WebSocket PAUI  \--\> GW : HTTPS REST RE    \--\> OC OC    ..\> GW : Sync when online GW    \--\> S3 : Media assets @enduml |
| :---- |

| 9\. Gamification System Design *Rewards, badges, progress, and motivation mechanics* |
| :---: |

## **9.1 Star & Reward Economy**

| Element | How Earned | Stars Value | Visual Feedback |
| ----- | ----- | ----- | ----- |
| Step Complete | Tap the Big Tick on each step | 1 star | Star pop animation \+ chime |
| Set Complete | Finish all steps in a set | 5 stars | Confetti explosion \+ fanfare |
| On-Time Bonus | Finish within allocated time window | \+3 stars | Lightning bolt animation |
| Perfect Day | Complete all scheduled sets in one day | 20 stars | Trophy spin \+ fireworks |
| Streak (3 days) | 3 consecutive days of completion | 15 stars | Flame badge award |
| Streak (7 days) | 7 day streak | 50 stars | Super badge \+ parent notif |
| Parent Gold Star | Parent adds bonus star at approval | \+5 stars | Golden star from parent |
| Weekend Adventure | Complete a weekend set | 10 stars | Explorer badge |

## **9.2 Badge Collection System**

| Badge | Unlock Condition | Category |
| ----- | ----- | ----- |
| Sparkling Teeth | Complete Brushing Teeth 5 times | Hygiene |
| Early Bird | Complete Waking Up \+ Breakfast sets before 8am | Morning |
| School Ready Star | Complete Getting Ready for School 10 times | School |
| Homework Hero | Complete Homework Set 7 days in a row | Learning |
| Sleepy Champion | Complete Bedtime Set on time for 5 days | Evening |
| Park Explorer | Complete Going to the Park set | Weekend |
| Super Shopper | Complete Supermarket set | Weekend |
| City Explorer | Complete City Centre set | Weekend |
| Full Week Champion | Complete every scheduled set for a whole week | Milestone |
| Golden Month | Achieve Perfect Day 20 times in one month | Milestone |

## **9.3 Progress Bar Architecture**

| Step Progress Bar | Per-step: fills as time elapses — green while on track, amber if slow, red if overtime |
| :---- | :---- |
| **Set Progress Bar** | Shows X of N steps completed. Animates with each tick. |
| **Day Progress Bar** | Shows total sets: pending / in-progress / awaiting approval / locked (green tick) |
| **Week Progress Bar** | Parent dashboard: % of scheduled sets completed across the week |
| **Star Meter** | Running total of stars earned today \+ all-time. Fills towards next reward milestone. |
| **Streak Counter** | Animated flame counter for consecutive days of full completion |

| 10\. Activity Set Specifications *Default steps for each built-in set* |
| :---: |

## **10.1 Weekday Sets — Default Step Counts & Durations**

| Activity Set | Default Steps | Allocated Time | Approval Required | Category |
| ----- | ----- | ----- | ----- | ----- |
| Waking Up Set | 5 | 10 min | Optional | Morning |
| Brushing Teeth Set | 6 | 5 min | Yes | Hygiene |
| Getting Dressed Set | 7 | 10 min | Optional | Morning |
| Breakfast Set | 5 | 20 min | Optional | Morning |
| Getting Ready for School Set | 6 | 10 min | Yes | School |
| After-School Set | 4 | 15 min | No | Afternoon |
| Changing Out of School Clothes | 5 | 10 min | Optional | Afternoon |
| Eating Tea / Lunch Set | 5 | 25 min | No | Afternoon |
| Homework / Study Set | 6 | 45 min | Yes | Learning |
| Eating Dinner Set | 5 | 30 min | No | Evening |
| Washing, Brushing & Bedtime | 8 | 20 min | Yes | Evening |

## **10.2 Weekend Sets — Default Step Counts & Durations**

| Activity Set | Default Steps | Allocated Time | Approval Required | Notes |
| ----- | ----- | ----- | ----- | ----- |
| Going to the Park Set | 8 | 60 min | Yes | Includes getting ready, travel prep, park visit |
| Going to the Supermarket Set | 7 | 45 min | Yes | Includes list check, in-store, packing away |
| Going to the City Centre Set | 9 | 90 min | Yes | Travel prep, safety rules, activity steps |
| Custom Weekend Activity | Varies | Parent-set | Parent choice | Fully editable by parent |

## **10.3 Sample: Brushing Teeth Set — Full Step Specification**

| Step \# | Step Title | Instruction | Duration | Stars |
| ----- | ----- | ----- | ----- | ----- |
| 1 | Get Your Toothbrush | Pick up your toothbrush from the holder | 20s | 1 |
| 2 | Put On Toothpaste | Squeeze a pea-sized blob of toothpaste | 20s | 1 |
| 3 | Wet Your Brush | Turn on the tap and wet your brush | 10s | 1 |
| 4 | Brush Your Teeth | Brush in circles for 2 whole minutes\! | 2m | 2 |
| 5 | Spit and Rinse | Spit out, then swish clean water around | 20s | 1 |
| 6 | Put Brush Away | Rinse your brush and put it back in the holder | 15s | 1 |

| 11\. Parental Control Specification *Lockout, approval, and guardian features* |
| :---: |

## **11.1 Parental Approval Flow**

1. Child completes all steps in a set that has approval enabled

2. Child app displays FULL SCREEN holding message: 'Get Mum or Dad to Check\!' — no navigation possible

3. Push notification sent immediately to parent's device

4. Parent opens notification, reviews step-by-step completion times in Parent App

5. Parent selects Approve or Needs Redo

6. On Approve: celebration screen fires, set locks, stars awarded, progress saved

7. On Redo: child receives gentle on-screen prompt, set resets to IN\_PROGRESS

## **11.2 Full Lockout Feature**

| Trigger | Parent taps Approve & Lock in the Parent App after reviewing completion |
| :---- | :---- |
| **Visual State** | Locked set displays green tick overlay on timeline — no tap interaction possible |
| **Screen Behaviour** | Child sees celebration screen initially, then timeline with locked set greyed out |
| **Override** | Parent can unlock via PIN entry in Parent App — full audit log recorded |
| **Auto-Archive** | All locked sets archive at midnight, ready for next day's fresh schedule |
| **Data Retention** | Completion data stored 90 days — viewable in Parent progress reports |

## **11.3 Parent Dashboard Features**

* Weekly schedule builder with drag-and-drop timeline (7-day view)

* Activity Set library — browse, customise, create new sets

* Time allocation editor — set start/end times, buffer periods

* Approval queue — see pending approvals sorted by time

* Progress reports — daily, weekly, monthly completion rates

* Star & badge history — full reward timeline per child

* Streak tracking — consecutive day completion charts

* Multi-child support — switch between child profiles

* PIN management — change parent access PIN

* Notification preferences — toggle push alerts per event type

* Care team sharing — invite grandparents, teachers, therapists (view-only or approval)

| 12\. Non-Functional Requirements *Accessibility, performance, and security* |
| :---: |

## **12.1 Accessibility**

* WCAG 2.1 AA compliance minimum across all child-facing screens

* High contrast mode — minimum 4.5:1 contrast ratio throughout

* AAC-style icons — symbol-based imagery consistent with PCS / Widgit standards

* Audio narration — every step has pre-recorded narration; adjustable speed

* Large touch targets — minimum 60x60px for all interactive elements

* No time pressure on child interaction — timers are informational, never blocking

* Adjustable text size — support system font scaling up to 200%

* Reduced motion mode — disable animations for sensory-sensitive children

## **12.2 Performance**

| App load time | \< 2 seconds on mid-range tablet (2GB RAM) |
| :---- | :---- |
| **Step transition** | \< 300ms animation between steps |
| **Offline support** | Full child-facing functionality available offline; syncs when reconnected |
| **Push notification** | \< 5 second delivery from completion event to parent device |
| **Schedule sync** | Real-time WebSocket sync between parent and child apps |
| **Data storage** | Local SQLite cache on device; cloud PostgreSQL as source of truth |

## **12.3 Security**

* Parent PIN stored as bcrypt hash (min cost factor 12\) — never plaintext

* JWT authentication with short-lived access tokens (15 min) \+ refresh tokens

* End-to-end HTTPS for all API communication

* Child profile data encrypted at rest in database

* COPPA and UK GDPR compliant — no third-party advertising, no data selling

* Parent must re-authenticate to access sensitive settings (PIN, schedule delete)

* Rate limiting on approval endpoints to prevent accidental spam

| 13\. Recommended Technology Stack *Implementation technology choices* |
| :---: |

| Layer | Technology | Rationale |
| ----- | ----- | ----- |
| Child App (tablet) | React Native \+ Expo | Cross-platform iOS/Android, large UI library, smooth animations |
| Parent App (mobile) | React Native \+ Expo | Shared codebase with child app, rapid iteration |
| Animations | Lottie \+ React Native Reanimated | High-quality celebration animations, reduced motion support |
| Backend API | Node.js \+ Fastify | High performance, TypeScript support, websocket ready |
| Database | PostgreSQL (Supabase) | Relational integrity, Row Level Security, real-time subscriptions |
| Cache / Sessions | Redis (Upstash) | Fast session management, rate limiting |
| File Storage | Supabase Storage / S3 | CDN-backed media delivery for illustrations and audio |
| Push Notifications | Firebase Cloud Messaging | Cross-platform push, reliable delivery |
| Auth | Supabase Auth \+ custom PIN | JWT management \+ custom parent PIN layer |
| CI/CD | GitHub Actions \+ EAS Build | Automated builds, OTA updates via Expo |
| Analytics | PostHog (self-hosted) | Privacy-compliant usage analytics, funnel analysis |

## **14\. Future Enhancement Roadmap**

| Phase | Feature | Priority |
| ----- | ----- | ----- |
| v1.1 | Custom photo steps — parent uploads real photos of their child's bathroom/bedroom | High |
| v1.1 | Video step modelling — short clips showing how to do each step | High |
| v1.2 | AAC talker integration — child can communicate needs during routine | High |
| v1.2 | Emotion check-in — how does the child feel before/after each set? | Medium |
| v1.3 | Therapist / teacher portal — view progress, set school-specific sets | Medium |
| v1.3 | AI routine suggestions — recommend schedule based on completion patterns | Medium |
| v2.0 | Smart watch companion — step reminders on Apple Watch / Wear OS | Low |
| v2.0 | Voice command — child says 'done\!' to complete a step hands-free | Low |
| v2.1 | Sibling mode — multiple child profiles with separate reward tracks | Medium |
| v2.1 | Social sharing — parent shares badge milestone to private family group | Low |

| RoutineStars — End of UML Specification *Building independence, one star at a time. 🌟* |
| :---: |

