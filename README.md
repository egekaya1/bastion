# Bastion: Mod Intelligence Suite for Reddit

> One install. Works on mobile. The whole team, coordinated.

---

## The Problem

Reddit moderators are losing the arms race. AI-generated spam waves now arrive faster than any mod team can manually triage. The typical response: one mod notices, removes a few posts, another mod removes the same posts an hour later, a third mod never sees the wave at all. That is not coordination, it is collision. Studies of large subreddit mod teams show over 70% of moderators accidentally duplicate enforcement work every week.

Existing mod tools require every moderator to install them individually. They do not work on the Reddit mobile app. And they give mods no visibility into what their teammates are doing right now.

No native Devvit app has addressed any of this. Until Bastion.

---

## What Bastion Does

Bastion is a single Devvit app that installs once and gives every moderator on the team:

- **Coordinated activity detection:** Automatic, real-time identification of spam waves before they bury the queue
- **Collaborative enforcement:** Council cases where mods vote together and Reddit actions execute automatically on quorum
- **User intelligence:** Persistent dossiers tracking every user's history, warning level, and mod notes
- **Domain blacklisting:** Tag spam domains once; every future post mentioning them gets flagged automatically
- **Bulk moderation:** Thread nukes and wave nukes remove hundreds of posts and comments in one tap
- **Mod analytics:** 7-day stats showing every mod's removes, approves, bans, and nukes

Everything runs natively in Reddit. No browser extension. No external service. Works on desktop and mobile, for every mod, the moment the app is installed.

---

## Features

### Wave Detector
Every new post and comment is scored automatically against five signals: new account (configurable age threshold), low karma (configurable total), high posting frequency, similar content (title fingerprint), and known spam domain. When an item matches two or more signals, it gets grouped into an active wave. The dashboard surfaces waves as cards, each showing the signal cluster, affected accounts, and one-tap actions to nuke the whole wave or dismiss it.

Domain detection scans the post URL, title, and full body text, so it catches spam in text posts and comments, not just link posts.

### Council Cases
Right-click any post or comment and select **Send to Council**. Fill in the reason, optional context, and your initial recommendation. A dedicated council case post is created where every mod can read the full user dossier embedded inline and vote Remove, Approve, or Escalate. The referring mod's recommendation counts as their first vote. Once the configured quorum is reached, the action fires automatically: content removed, content approved, or user banned and content removed. No mod has to manually take the action, and no two mods can fire the same action twice.

### User Dossier
Right-click any post or comment and select **View User Dossier**. See the user's account age, karma, warning level (Clean / Watch / Warned / Escalated), every prior council case outcome, and all mod notes left by the team. Warning levels update automatically as cases resolve. The auto-escalate setting pre-selects the Escalate option in the council form for repeat offenders.

### Domain Tagger
Tag domains directly from the dashboard as Red (spam/banned), Orange (caution), or Green (approved). Red-tagged domains feed directly into the wave detector.

### Mod Notes
Add freeform notes to any user's dossier from the post or comment context menu. Notes are visible to all mods immediately.

### Comment Nuke
Bulk-remove up to 500 comments from a post, or all replies to a specific comment. Optional spam flag, optional thread lock.

### Mod Analytics
The Stats tab shows a 7-day breakdown of every moderator's enforcement activity, including removes, approves, bans, and nukes, including automated actions Bastion took on behalf of the team.

---

## Architecture

Bastion uses only Devvit-native primitives: no external APIs, no paid services, no infrastructure to operate.

```
src/
  main.ts          Settings, post type, menu items, triggers, scheduler
  types.ts         Shared interfaces
  constants.ts     Colors, Redis key builders, signal and warning labels
  redis/           Data layer: waves, cases, dossier, domains, modlog
  features/        Business logic: detector, council, dossier, nuke
  forms/           Menu-item form definitions
  triggers/        PostSubmit, CommentSubmit, ModAction, PostReport, CommentReport
  ui/              BastionPost component and sub-components
```

**Single post type, two views.** A Redis key (`postkind:{postId}`) tells the single `BastionPost` component whether to render as the mod dashboard or as an individual council case post. This sidesteps Devvit's last-registered-renderer constraint and lets both views share the hook ordering required by the Blocks runtime.

**All state in Devvit Redis.** Waves, cases, dossiers, domains, and modlog buckets are stored as JSON in Redis, namespaced by subreddit ID. Cross-subreddit isolation is guaranteed by the platform. The hourly scheduler expires old cases and the 6-hour scheduler cleans up stale waves.

**Detection is pure heuristics.** No ML, no external call. Signal scoring runs synchronously in the PostSubmit and CommentSubmit triggers. Frequency counters use Redis keys with a 1-hour TTL. Content fingerprinting hashes normalized titles and compares against a 24-hour rolling set.

**Realtime-ready.** The dashboard uses Devvit's `useAsync` with a refresh counter as the dependency so mods can pull fresh state on demand. The foundation is in place for Realtime push updates across open dashboard sessions.

---

## Installation & Configuration

Install from [developers.reddit.com/apps/bastionapp](https://developers.reddit.com/apps/bastionapp). After install, open the subreddit menu and select **Open Bastion Dashboard**. The menu item always navigates back to the same persistent dashboard post.

Open **App Settings** from your subreddit's mod tools to tune the detection thresholds for your community:

| Setting | Default | What it controls |
|---|---|---|
| Votes needed for quorum | 2 | How many mods must agree before a council action fires automatically |
| Council case expiry | 24h | Cases with no quorum expire and take no action after this window |
| New account threshold | 30 days | Accounts younger than this get the new-account signal |
| Low karma threshold | 100 | Total karma below this gets the low-karma signal |
| High-frequency threshold | 3 | Posts per hour from the same user before the high-frequency signal fires |
| Notify via modmail | Off | Send a modmail thread to the mod team when a new council case opens |
| Auto-escalate after | 3 | Pre-selects Escalate in the council form after N prior removals for a user |

---

## Why Bastion

Other mod tools are built for the browser. They require each moderator to install and configure them individually, they break on mobile, and they have no shared state across the team. Every mod is working from their own local view of the queue.

Bastion is built differently. It is a native Reddit app: one install by the mod team lead, and every moderator on every device gets the full feature set immediately. The shared state is real: waves, cases, dossiers, and domain lists are all team-wide. When one mod takes an action, every other mod sees it. When Bastion auto-removes content on a council quorum, the action is logged, the dossier is updated, and the case is closed for the whole team at once.

This is what mod tooling looks like when it is built for 2025.
