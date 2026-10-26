# Rooted

Build the complete working app now, not a plan or landing page. Name: Rooted. Tagline: Build what matters, daily. User wants to use it tonight. Mobile-first installable web app/PWA for iPhone, responsive desktop too. No App Store distribution. Full scope below. Screenshots could not yet be transferred, so use the precise visual and behavioral description here.

DESIGN: polished charcoal black (#202020) background, dark grey rounded cards (#292929), white rounded friendly sans typography, generous but compact mobile spacing. Warm gold (#d5ac4a) primary buttons, gold gradient completed activity buttons. Teal completion counters. Pillar icons: teal cross Faith, coral people Family, cyan dumbbell Fitness, gold ascending bars Finance. Gold outline and gold shaded entire pillar card when both activities complete. Header Rooted leaf/root mark, profile/name, accumulated P points, flame streak. No fake notifications, no social search, no Chat tab. Bottom navigation Home, History, Settings, all functional. Do not replicate iPhone status bar or BeReal indicator.

HOME: Progress card with Daily/Weekly/Monthly dropdown and real bar chart, then '4 Pillars', four cards each with 0/2,1/2,2/2. Faith: Read Bible, Prayer. Family: Marriage, Relationship. Fitness: Exercise, Nutrition. These SIX buttons are immediate completion toggles on home; NO detail screens for them. Tap one: just it lights gold/check; both: entire pillar gold. Can undo checkbox and remove its point. Finance: Learn, Plan open Finance detail tabs. Below four pillars Bonus Points: Add Gratitude, Add Journal. Show their daily completed state.

POINT RULES: one point per each of 8 pillar activities + one gratitude + one journal = max TEN/day. Total P = actual all-time earned points, initially zero, do not copy 489 fake screenshot data. No additional points for repeat journal/entries same day or switching journal mode. Unchecking simple habit removes its point, rechecking cannot inflate total. Derive score from unique daily activity records (unique user,local_date,activity) with atomic/idempotent upserts; guard double taps/retries. Bonus entries persist and editing must not duplicate award. Pillar counts exclude bonuses. STREAK: ANY one completed point-producing activity makes that local calendar date qualifying. First day =1; consecutive dates add one. If today empty but yesterday qualified preserve yesterday's active streak until today's end. Missing an entire day resets to 0. Local timezone default America/Chicago; editable IANA timezone. Daily checklist resets at local midnight without erasing history, total, entries. Recompute on focus/rollover, avoid UTC date bugs and DST elapsed-hours bugs.

FINANCE: header back, Learn and Plan tabs.
Learn: 'What have you learned?' multiline field, Submit (nonempty required), View Archives. Save timestamped entry, award Learn today, update home and navigate clearly. Archives with date/type filters and readable detail, edit saved entries.
Plan: two required checkboxes 'Review your calendar for the day.' and 'Review all your quests.' Done enabled only when both selected, saves and awards Plan. These are user attestation checkboxes; NO need to build calendar integration or quest management. Persist checkbox state and completed flow.

GRATITUDE: 'Write 3 things that you are grateful for.' Provide three fields (all required) and Submit. Save entry and award daily gratitude once. Archives/read/edit from History.
JOURNAL: Select Type with Free-Flow, Re-Frame, Devotional tabs, good responsive text without broken 'Devotion al'. Free-Flow and Devotional each show Journal Entry multiline + Submit (nonempty). No AI generation required. Re-Frame shows nine prompts, each multiline:
1 What emotion am I feeling?
2 What thought or situation triggered this emotion?
3 Why did I get triggered by this specific thought or situation?
4 What is the belief I have about myself, that event or another person?
5 Is this belief true?
6 Can you be certain this is 100% true?
7 How does this belief affect me or the people around me? How do I treat others when I believe this?
8 How could I see myself, this situation or person differently in a way that serves me and the people around me?
9 What evidence is there to support this new belief?
Submit at bottom. Require meaningful answers for guided entry, show inline validation and preserve draft if switching type/back. All modes save structured entries and award at most ONE journal point/day combined. Allow multiple entries/day without extra points. History supports viewing and editing entries without changing their original earned date.

PERSISTENCE/PRIVACY: implement real backend/auth with Lovable Cloud if available, email sign-up/login, password reset, session persistence, profile display name and timezone; enforce owner-only RLS on all user data. No journal content public or shared between accounts. Never include secret keys client-side. If Cloud needs a human approval, clearly report it and meanwhile build entire app with a working explicitly labeled local-only guest mode persisted in localStorage so usable tonight; guest data stays distinct by storage namespace and can be safely migrated once into signed-in account with dedupe, no silent overwrite. Do not call guest local data 'synced'. Show saved/error/sync status truthfully. New users start genuinely empty, no fake chart data. Draft persistence, loading/error/empty states; don't lose entered text on save failure. Profile settings, logout; simple JSON export personal data for backup. Do not put development jargon in normal product screens.

CHARTS: Daily shows current week's Mon-Sun totals 0..10, Weekly aggregates weeks, Monthly aggregates months, clear labels and period total, chart accessible. History has daily activity records and Learn/Gratitude/Journal archives with date/type filtering. Distinguish today score vs selected period score vs all-time P.

PWA: manifest, Rooted icon and apple touch icon, standalone display, theme color, mobile safe areas and keyboard-safe inputs, no horizontal overflow at 375/390/430px, tap targets >=44px. Home Screen install guidance for Safari in settings. Appropriate app shell caching, never cache other users' private backend responses. Offline local guest mode usable; authenticated offline behavior must not pretend unsaved changes succeeded.

NO COMMUNITY FEATURES of any kind now: no user search, chat, feed, events, leaderboards, invitations, friends. Structure data by user for future extension only. No AI coach, payments, bank connector or extra scope. No external credentials required to make core app work.

IMPLEMENT ALL screens and connected behavior this turn. Run build/typecheck and meaningful tests of 10-point cap, duplicate submits, checkbox undo/recheck, three journal types one daily reward, streak day gaps and midnight local rollover. Verify navigation, form validation, persisted refresh state and mobile layout. Report implemented capabilities, tests actually run, and any blockers accurately. Keep this as one maintained project for later GitHub sync, don't claim GitHub connected unless it is.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://rootedroutinetracker.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/601f52f6-a142-479d-a94d-4ad23813b0cc).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
