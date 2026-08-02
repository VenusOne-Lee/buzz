# Attention: Consolidated Architecture and Product Proposal

Date: 2 August 2026
Channel of record: #new-feature-build (fc949beb-2b90-412f-bdc7-dbb3e3456b47)
Repo: VenusOne-Lee/buzz, fork of block/buzz. Prototype branch myzone-prototype in worktree REPOS/buzz-myzone; feature commits c7225b20 (action pass), 7bd9cce5 (rename), c416ab2d (defect fixes), 5f921172 (prompt conventions). All pushed to the fork.
Status at time of writing: Buzz One test builds 1 through 4 shipped same-day; test 5 (declared tier) in flight.

---

## 1. Problem and definition

Lee runs nine agents across many channels. The channel feed answers "what happened" but not "what is stuck on me". Agent asks for a decision, an approval, or a manual step drown in ambient activity, so agents block on a human who cannot see that he is the blocker.

One-sentence definition: Attention is a two-way human-in-the-loop surface that projects, from the existing message feed, exactly the items that need the user, and turns every resolution into a posted signal the asking agent receives.

The founding constraint, in Lee's words from the channel: "Done should never be silent." Attention is not a private to-do list over shared conversations. Every action closes a loop.

## 2. Goals and non-goals

### Goals

- Surface only items that need the user: mentions and actionable asks, never ambient activity. That exclusion is the entire differentiation from Inbox.
- Every card resolvable in one interaction. Maya's rule: "nothing enters Needs Me unless there is a button that resolves it. If we cannot offer an action, it is not attention, it is history, and history belongs in Inbox."
- Every action posts a meaningful signal to the asker. No bare receipts, nothing silent.
- The count tells the truth. Actionable and awareness items counted separately ("N need you, M to note"); the unit of counting is the ask, not the message.
- Deterministic behaviour throughout: pure-function extraction and option derivation, unit tested per type, regression tested per field defect.
- Zero relay or protocol changes for v1. The surface is a projection over events the platform already stores and indexes.

### Non-goals (Maya's out-of-scope lists, standing)

- Priority scores, due dates, snooze, analytics, kanban views, task creation. Work lives in its source channel; Attention stays a projection.
- No stream of agent tool calls, no dashboard, no progress percentages, no screen sharing. Maya's framing: "each of those trades your attention for a feeling of control."
- No reader-side model classification (Section 6). Recommended answers are the single sanctioned model use, phase 2, draft-only.
- No new event kinds, no relay changes, no push-allowlist edits in v1.

### Acceptance criteria (Maya's revised spec, the standing definition of done)

1. Every Needs Me card has at least one action that resolves it. No card is read only.
2. Card headline is the ask, never a sender name, never a truncated body.
3. All five actions post a signal that carries meaning. No action posts a bare receipt.
4. Done posts a signal an agent can act on to unblock itself; Nora's codex login card demonstrates it end to end.
5. Quick select renders from declared options where present, derived options otherwise, free text always available.
6. Every action has a five-second undo before the event is published.
7. Expanding a card shows the full message rendered, with no navigation.
8. Needs Me count separates actionable from awareness.
9. Every action reachable by keyboard alone.
10. Extractor and option derivation are pure functions with unit tests per type.

Criteria 1 through 3, 5 through 10 are shipped and verified as of test 4. Criterion 4 (the Nora end-to-end demo) needs the declared request side and is the acceptance test for the whole loop, kept deliberately as the Phase B gate.

## 3. What Buzz already had

The four-agent repo investigation (research file MYZONE_BUZZ_INVESTIGATION.md, all facts verified against source) found the platform half-expecting this feature:

- A reserved, empty needs_action slot. The relay feed defines needs_action as kinds 46010 and 40007 p-tagging the user (crates/buzz-db/src/feed.rs:167), but nothing in the system emits either kind. The WF-08 TODO at crates/buzz-workflow/src/executor.rs:663 suspends approvals without emitting 46010, and 46010 is absent from required_scope_for_kind so clients cannot submit it. needs_action returns an empty list everywhere. The slot was wired and waiting.
- Four surfaces disagree on feed categories: relay SQL (feed.rs), desktop Tauri (src-tauri/commands/messages.rs:45-140, which returns activity and agent_activity empty and maps needs_action to 46010/46011/46012), mobile (activity_provider.dart, agent_activity = kinds 43001-43006), and the CLI (passthrough). agent_activity is a relay-side alias for activity (bridge.rs:1071). Any attention feature must not add a fifth opinion; a client-side projection sidesteps the disagreement.
- buildInboxItems, the desktop's existing feed-to-inbox projection, optional-param friendly by design. Attention layers on top of it rather than replacing it.
- Deep links: buzz://message?channel=<uuid>&id=<hex>[&thread=<root>] externally, /channels/$channelId?messageId=...&threadRootId=... in-app, with ancestor backfill. Cards jump straight to source with no new navigation machinery.
- Preview flags: preview-features.json plus FeatureGate, usePreviewFeatureWarning, and Settings > Experiments; fail-open for unlisted features; the e2e bridge seeds all flags on. A sanctioned corridor for shipping experimental surfaces.
- NIP-RS read state: kind 30078, self-encrypted, client-managed, stored blindly by the relay. Establishes that per-user state is a client concern and that the server cannot know what the user has read.
- NIP-ER reminders: kind 30300, parameterized-replaceable per-item head with status pending/done/cancelled and a relay due-sweeper. Structurally, a reminder is already an attention item with a state machine; this is the platform's precedent for durable per-item state, and the pattern later ruled correct for work-status (Section 7).
- The push allowlist (kinds 7, 9, 1059, 40007, 46010, hand-synced across push_lease.rs:15, a Postgres trigger, and push.rs:57) means anything that eventually populates 46010/40007 gets phone-wake for free.
- The attention contract that already existed was prose: base_prompt.md instructs agents to announce "picked up, blocked + need input, PR up, done" with callback mentions, and a p-tag is simultaneously addressing, attention, and push-wake. V1 builds on this instead of replacing it.

## 4. The shipped architecture

### Projection, not storage

Attention is a pure client-side projection over the existing feed: useHomeFeedQuery plus useChannelsQuery plus useUsersBatchQuery feed buildInboxItems, and projectAttention (desktop/src/features/myzone/lib/attention.ts, renamed to attention in commit 7bd9cce5) layers the attention semantics on top. Only mention and needs_action items surface; ambient activity is excluded by construction. No new event kinds, no relay changes, no schema migrations.

This is not only taste, it is a hard constraint: the community relay is hosted, we do not control its binary, and it rejects unknown event kinds outright at ingest (required_scope_for_kind). A new kind would simply not ingest. Even in a self-hosted world, a new kind is a six-site change (kind.rs, ingest.rs, side_effects, feed.rs, plus desktop and mobile kind mirrors) plus three-way push-allowlist sync. The projection route costs none of that and keeps one event log.

### The ask taxonomy

Six types, from Maya's taxonomy: Decision, Approval, Question, Review, Blocked, Heads up. The first five are actionable and carry a badge on the card; Heads up is the awareness class. Cards render ask-first: the headline is the ask, never a sender name, never a truncated body. Sections order oldest-first under "Waiting on you since" and "Today" headers.

### The demotion tier

Items that are attention-worthy but carry no answerable ask demote to the "To note" strip with a one-click Noted action. This came from Lee overruling Maya's original passive "Heads up" design: awareness items stay visible, clear in one click, and the agent learns they were seen. The split count ("N need you, M to note") keeps the headline number honest.

### Five posting actions, one undo

All five actions post threaded replies p-tagging the asker. Per the locked table:

| Action | Meaning | Agent learns | Card moves to |
|---|---|---|---|
| Reply | Here is my answer, in my words | The answer | Done |
| Quick select | My choice from your options | The chosen option | Done |
| Done | I did the manual thing you needed | Blocker cleared, proceed | Done |
| Noted | Seen, carry on | Stop chasing, no answer coming | Done |
| Waiting | I have this, blocked on someone else | Item alive, stop waiting actively | Waiting |

Done is the action that existed nowhere before: the "I performed the manual step" signal (canonical demo: Nora's codex login card). Noted posts as a short threaded reply rather than a reaction because Kai verified reactions never reach agents (the harness subscribes agents to kinds 9/46010/40007 mention-filtered; kind 7 never enters their queue).

Every action carries a five-second client-side undo: the publish is delayed, an Undo toast shows, and cancellation genuinely prevents publication rather than publishing and deleting. Double-fire protection disables actions while one is pending per card. Keyboard: j k move, e expand, r reply, w waiting, d done, n noted, o open. Agent wake requires no harness change: the reply is a normal p-tagging threaded message, today's trigger path.

### Zone state evolution

V1 stored Needs Me / Waiting / Done zone assignments in per-pubkey localStorage (key buzz-myzone-zones.v1), with Done expiring after seven days and new activity on a parked item reactivating it to Needs Me. Known limit: per-device, non-syncing.

Lee's nothing-silent ruling closed the durable-state question as a side effect. If every action posts, zone state is derivable from the user's own posted responses: public, auditable, and syncing across devices by construction. Kai's acceptance on record: "The private per-device store I shipped in the prototype becomes a cache, not the source of truth. That question is closed." This superseded Kai's earlier lean toward a NIP-ER-style parameterized-replaceable state event for zones.

### Verification discipline

Every build shipped the same day it was cut, and every one shipped through the full gate set at its exact commit, independently re-verified before the delivery post:

- Unit suite green with the count stated against baseline (3778 at test 1's baseline of 3769, 3796 at test 3, 3800 at test 4), colocated node:test *.test.mjs files per the repo convention.
- Both Playwright e2e tests green against the mock bridge (pnpm build:e2e, never plain build), driving the real UI through the full card lifecycle including undo-then-publish, using the kind-46010 injection hook.
- Typecheck, biome, and all repo guards clean (file-size cap, rem-only text, pubkey guards). Zero MyZone references in source after the rename commit.
- The existing Inbox untouched throughout.

The QA gate splits honestly between what automation covers and what it cannot. Automated, asserted in harness tests: exactly one send per action with the correct thread anchor and recipient, undo cancels the delayed publish so nothing is ever posted then deleted, and double-fire protection. Only Rex's independent pass on a throwaway channel covers the same checks against the live relay with real agents, plus the extractor-mislabels-a-real-ask risk no harness test catches. Until that pass runs, the buttons are throwaway-channel only.

## 5. The attention contract

The contract is a request and response protocol between agents and the human, and it is the actual product. Three tiers, strictly ordered by confidence:

1. Declared. The agent states its ask, type, recipient, and options at authoring time. Exact, no guessing. This tier is authoritative wherever present.
2. Derived. For undeclared messages, a deterministic extractor infers the ask and options from message shape, under a strict confidence rule (Section 6).
3. Demotion. Anything attention-worthy but below the confidence bar renders in To note with free-text reply only. A wrong button is worse than no button.

### The declaration convention (v1, prose)

The exact convention, as committed to the agent prompts (Maya's text, accepted in full by Kai):

> **Declare what you need.** When your message needs something from a specific person, open with a declaration line: `**Needs <Name>, <type>:** <the ask in one sentence>`, where type is one of decision, approval, question, review, blocked. Use one line per person and per ask. If there is a sensible closed set of answers, follow it immediately with a bulleted list of two to four options. Write each option as the complete sentence you want back, because their click posts that text verbatim as their reply. Always include an option to decline or ask for more detail. If the answer is genuinely open, give no list. If your message needs nothing from anyone, write no declaration line.

The parser spec is deliberately the same document, so the convention and the code cannot drift:

- Declaration line bold or plain, type exactly one of the five; anything else stays prose and falls to the derived tier.
- The option list must immediately follow the declaration line with no blank line, two to four items. Five or more, malformed, or detached lists are ignored and the ask keeps a free-text box only.
- Needs-<other> lines are excluded from the viewer's count and headline entirely. The client matches against the viewer's own display name, which gives the extractor the one thing the derived tier could never have: the name.
- N declaration lines for the viewer means askCount N, exact.

Defaults per type when the agent supplies no options: Approval gets Approve / Reject, Review gets Looks good / Changes needed, Blocked gets I have done it / I cannot do it. Decision and Question get no default, deliberately, because those are exactly where derivation failed; the agent must think about its own alternatives or ask openly.

Five authoring rules keep the option sets honest (Maya): each option is the complete sentence you want back, because the click posts it verbatim; always include a way out (decline or ask for more detail); two to four options, more is a form; options must be mutually exclusive, the confidence rule enforced at authoring time instead of guessed at read time; and never offer options you will not act on differently. The standing UI rule: the free-text box is always visible beside any options, never hidden behind an Other button, so options remain a shortcut and never the only path.

One convention closes all four field defects (Section 6): declared type fixes badges, declared options fix quick select, per-person lines fix addressed-to-you, per-ask lines make the multi-ask split exact. It also resurrects, safely, the exact list parser removed in the defect pass: guessed, it harvested context lists that were not answers; anchored to a declaration, it is the most reliable rule in the system. The declaration line unifies with the TL;DR convention: if a message has an ask, the ask is the summary, one line, never two.

### Why prose beat tags for v1

The original schema was structured tags on ordinary kind-9 messages: ["attn", type, ask] plus repeatable ["attn-opt", option] on the request, ["attn-res", requestEventId, action(+option)] on the response. Zero migrations, GIN-indexed server-side today. It was blocked twice on the send path:

1. The desktop send pipeline validates outgoing tags against a media-only gate in the Rust layer (events.rs:98-107); attaching attn-res failed the whole send. Found during the test 3 build.
2. buzz messages send exposes no arbitrary-tag flag, only channel, content, kind, reply-to, broadcast, file and mention. Maya found this; Kai re-ran the help and confirmed.

Both halves of the protocol already existed as prose: the response buttons shipped in test 3 posting fixed sentences (Done, Noted, Waiting each have an exact frozen wording, deterministic parse targets), and the declaration line is one prompt bullet. So the declared contract v1 is structured prose, the extractor gets one high-confidence rule for the declaration shape, and the tag schema (attn/attn-opt/attn-res, names already final) is demoted to a later formalisation, Phase C, done once when the send paths are touched for other reasons. A known caveat on record either way: multi-letter tags are not filterable in stock relay REQ subscriptions, only server-side and in clients; acceptable for phases 1 and 2.

## 6. Defect history as evidence for determinism

Lee's first live-use screenshot (test 3, 11:40Z) surfaced three field defects in the derived tier. All were accepted and fixed deterministically within the hour, shipping as test 4 (commit c416ab2d, 3800 unit tests passing), each with a regression test reproducing the exact case from the screenshot:

1. Wrong quick select. The card offered Yes and No on a which-of-two-dates question; one click would have posted a meaningless answer into a live thread. Fix: the confidence rule. Options render only when genuinely exhaustive and mutually exclusive; Yes/No only for a true auxiliary question with no or-alternative, A-or-B only when both sides are short and clean, Approve/Reject only on actual approval requests, and the numbered-list derivation removed outright for harvesting context lists that were not answers. Below the bar: no buttons, reply box only.
2. Content addressed to someone else. The card contained a section directed at Axel with three decisions in it. Fix, with its limit stated honestly: ask selection prefers second-person sentences, requires you-or-your language for non-question asks, and deprioritises sentences mentioning third parties. A preference, not a guarantee; the guarantee arrives with the declared per-person Needs line.
3. Two misclassifications. A message about tag costs badged Decision; a delivery post badged Blocked, the highest-urgency badge and therefore the most expensive direction to be wrong in. Fix: badges attach only to sentences actually shaped as asks aimed at the reader. The Blocked-on-narrative case entered the suite as a named regression case.

Plus the multi-ask safety rule shipped in its cheap true form: when more than one reader-question is detected the headline states the count ("2 questions") rather than showing one ask and hiding another. Maya's framing of why this is a safety rule and not polish: the truncated-headline card is "the worst possible outcome: you answer what you can see, believe you are done, and question two dies silently." Individually answerable sub-items with partial state ("1 of 2 answered") were deferred to the declared tier, where the split is exact rather than guessed, and were then pulled forward into test 5 by the declaration convention.

The fix pass had one deliberate cost, accepted on the record: the stricter rules correctly demoted some mention-only items to To note. That is the confidence rule working as designed, precision bought with recall, and it is what the badge-correction escape hatch and the declared tier exist to compensate for.

When Lee then asked whether Buzz agents should classify messages with AI, the answer was no, and the reasoning is the spine of the architecture. All three defects share one root: prose extraction is guessing at information the author already had. Kai knew he had two questions, knew one section was for Axel, knew his delivery post was not a blocker. A reader-side classifier reconstructs known information later, with less context, at per-message model cost, and, decisively, non-deterministically: the same message can badge differently across runs, so it cannot sit behind a regression test. The morning's defect fixes are the proof that deterministic rules can. Kai's summary on record: "Attention only works if its labels are boringly repeatable." Use the agents as authors, not as checkers. The accepted escape hatch has no AI in it: one-click local badge correction, which doubles as telemetry on which agents keep getting misread.

## 7. Roadmap

### Phase map

The phases referenced throughout this document, in one place:

| Phase | Contents | Status |
|---|---|---|
| A | Projection, screen, five posting actions, undo, derived tier, demotion, defect hardening | Shipped (tests 1 through 4) |
| A.1 | Defect fix pass from live-use screenshot | Shipped (test 4) |
| B (declared tier) | Declaration parser, per-person cards, multi-ask sub-items, declared quick select, badge correction; prompt conventions live in agent drafts | In flight (test 5 plus draft saves) |
| B (harness) | Harness parsing of responses, noted-needs-no-turn optimization, Nora codex-login end-to-end demo | Queued |
| Phase 2 | Recommended answers, local model, draft-only | Queued behind B |
| C | Tag formalisation (attn / attn-opt / attn-res) when send paths are touched; upstream spec note | Deferred by design |

### Shipped (all on 2 August)

- test 1 (~09:15Z): MyZone prototype. Projection over buildInboxItems, three tabs (Needs Me / Waiting / Done), localStorage zones, deep links, preview flag off by default, 9 unit tests plus 2 e2e, existing Inbox untouched.
- test 2: flag default-on build for Lee's daily use.
- test 3 (11:20Z, commits c7225b20 + 7bd9cce5): the action-driven pass and full rename. Ask-first cards with six-type badges, split count, staleness headers, all five posting actions with five-second undo, derived quick select, To note strip, keyboard control, Attention inside and out (route /attention, flag key attention, zero MyZone references). 3796 unit tests, both e2e green. Shipped under the QA gate: buttons on a throwaway channel only until Rex's independent live pass.
- test 4 (12:04Z, commit c416ab2d): the three defect fixes plus the multi-ask headline rule, each with a screenshot-exact regression test. 3800 unit tests.
- Prompt conventions (commit 5f921172): TL;DR line, expected-duration line, and the declaration-with-options line committed to the fork harness prompt; nine owner-reviewed per-agent drafts opened for Lee to save.

### In flight

- test 5: the declared tier. Declaration parser matching the committed convention exactly, per-person cards, multi-ask sub-items composing one reply with partial state, declared quick select, and the badge-correction escape hatch. Roughly 90 minutes of build from start.

### Next, in agreed order

- Confirm badge correction lands in test 5; if it slips, it ships in the immediate follow-up. It is the trust escape hatch for the derived tier.
- Consolidated architecture document (this document).
- Catch up, as an Inbox mode, not a surface. A control on the Inbox that re-renders the unread conversation list as substance: the unread TL;DR lines grouped by channel, chronological within groups, each line deep-linking to its message. No model anywhere; agents' own TL;DR lines are the summaries, and a message without one degrades to today's first-line preview, so nothing gets worse. Client-side only, and necessarily so, since read state is NIP-RS encrypted and the server cannot compute the boundary. One pure function, summaryLineFor: declared ask first (once Phase B lands), TL;DR marker second, first line last, the same three-tier shape as everything else built that day. Dedup rule: Attention requests never appear as Catch up lines, only as a "N need you" cross-link; two lists of the same items is how both counts stop being trusted. Catch up does not move the read boundary (you have read one-liners, not messages); an explicit Mark all as read action covers the case where the one-liners suffice. Volume cap of ten lines per channel with an honest "12 more in #channel" link rather than silent truncation.
- Work status. A replaceable per-assignment status object (state working/blocked/waiting/done, one line of what it is doing, last-updated), keyed on the assignment message. Mechanism ruled by Kai: not a new kind (the hosted relay rejects unknown kinds), but the existing agent job progress kind (43003, in the platform's 43001-43006 job-protocol range the relay already ingests and feeds), rendered client-side latest-wins per assignment, the same append-only-plus-latest idiom as pull request statuses. Never a transcript message, never a notification; blocked raises exactly one Attention request through the existing contract. Ships in two steps because the load-bearing feature, the harness touching last-updated automatically so a dead agent is distinguishable from a busy one, requires a harness change that only reaches harnesses built from the fork: step one is client rendering plus agent-posted phase-boundary statuses (imperfect, LLM compliance), step two is harness liveness. Staleness renders as elapsed time ("no update for 22 minutes") measured against the stated estimate or fifteen minutes; never a "dead" label.
- Recommended answers, phase 2. The one sanctioned model use: drafting a probable reply, generated locally, drafting into the reply box, visibly labelled, never auto-sending.

### Explicitly not building

Priority scores, due dates, snooze, analytics, kanban, task creation. Tool-call streams, dashboards, progress percentages, screen sharing. Reader-side model classification. A tldr tag (prose convention only). Thread summaries (a column of TL;DR lines already is one). Message collapse in channel transcripts (collapse belongs in lists: Attention and Inbox only).

## 8. Performance, failure modes, open questions

- Polling latency. The projection rides the home feed query cadence, roughly 30 seconds. New asks and cross-device effects surface on the next poll, not instantly. Acceptable for a human-cadence surface; worth measuring before upstream.
- localStorage bounds. The zone cache prunes Done entries after seven days (pruneZoneState, DONE_RETENTION 7d), but a long-lived high-volume account should be tested against storage limits before the cache is trusted at scale. Its demotion to cache lowers the stakes: it can be rebuilt from posted responses.
- Extractor false negatives. The confidence rule deliberately trades recall for precision: a real ask below the bar demotes to To note or renders without buttons. Test 4 already demoted some mention-only items, working as designed. The declared tier is the systemic fix; badge correction is the per-item one. Watch the miss rate once declarations are live.
- Undo race on quit. The five-second undo delays publish client-side. Quitting the app mid-window needs a defined semantic (publish on quit, or drop and resurface the card); currently unspecified.
- Multi-device zone divergence. Until derived-from-responses zone state fully lands, Waiting and Done remain per-device. Locked decision, staged implementation.
- Non-compliant and legacy messages. Human messages and pre-convention agent messages carry no declaration; they fall to the hardened derived tier permanently. That tier is a supported fallback, not a temporary shim.
- Convention adoption is manual until saved. The three prompt bullets ship as nine owner-reviewed drafts (agent system prompts live in Desktop and drafts replace the whole prompt, so per-agent review is the safe flow). Until Lee saves each one, that agent authors no declarations and its messages ride the derived tier. The fork harness prompt carries the conventions natively (commit 5f921172), but the harness Desktop ships today is not built from the fork.
- Tag filterability, deferred. When Phase C formalises attn tags, stock relay REQ cannot filter multi-letter tags; server-side containment queries and clients can. Fine for our deployment; a spec note for upstream.
- QA gate. Rex's independent live pass on a throwaway channel (one event per action, correct thread and recipient, undo genuinely prevents publication, no double-fire against the live relay) remains the gate before the buttons are used on real work. Rex still needs adding to the channel; Lee's call.

## 9. Upstream strategy

Findings from reviewing the upstream repo as a maintainer would:

- Process: no RFC process, no plugin mechanism. CONTRIBUTING lists "entirely new features with no prior discussion" under PRs-we-close, so a feature-request issue comes first, always. Small focused PRs, conventional commits required, DCO sign-off required, screenshots for UI PRs via scripts/post-screenshots.sh (never buzz upload for PR bodies, the camo proxy breaks those links). Maintainers are in polish mode, fix-to-feat roughly 4:1, so a large feature drop lands badly by default.
- The core objection, pre-answered. VISION_ACTIVITY says a polished view should be "a zoom level on the same truth, not a different feed", and precedent #3117 folded work-handling into Inbox rather than accepting a sibling surface. That is exactly the objection a MyZone screen invites. Two decisions already made resolve it: the rename (Attention is a plain capability noun in the register of Inbox and Pulse, not a brand bolted onto their app) and the packaging option below. VISION_ACTIVITY also states "Never go dark... waiting is a rendered state", which directly endorses the Waiting zone, and VISION_PROJECTS:195 says "Custom kinds only where genuinely novel", which our zero-new-kinds projection satisfies by construction.
- The corridor: the preview-flag system is the sanctioned path for experimental surfaces, and it is currently undocumented in CONTRIBUTING.

Recommended sequence:

1. Trust-builder PR: document the preview-features workflow in CONTRIBUTING. Small, useful to them regardless of us, and it paves the exact road our feature arrives on. (Alternates of similar size: a small Inbox fix, or unit tests in features/home/lib.)
2. Feature-request issue: the empty needs_action slot, the WF-08 TODO, and the attention projection as the client-side answer, framed in their own vision vocabulary. This is where the packaging conversation happens, before any feature code is in a PR.
3. PR series, small and reviewable, each independently mergeable and each behind or beneath the flag:
   - PR 1: the pure projection library (projectAttention, the extractor, option derivation) with its full unit and regression suite. No UI, no routes, nothing user-visible. Reviewers see deterministic functions with tests reproducing real field defects, which is the strongest possible first impression for this feature.
   - PR 2: the Attention rendering (cards, sections, actions) consuming the library, gated so it is unreachable without the flag.
   - PR 3: nav entry plus the preview flag, off by default, with screenshots posted via scripts/post-screenshots.sh.
   All conventional commits, all DCO signed, none introducing a new event kind or touching the relay.

Fork-only, not proposed upstream:

- The Buzz One packaging and the default-on flag. Our deployment choices, not theirs.
- The agent prompt conventions (TL;DR, expected duration, declaration line). These are authoring discipline for our fleet; upstream gets the parser, which benefits from the convention and degrades gracefully without it.
- The harness liveness change, until proven in the fork.
- Anything Nexcta-specific in operational cadence.

Upstreamable now:

- The projection library and its unit and regression tests.
- The Attention rendering behind the flag.
- The deterministic extractor and declaration parser, whose regression suite reproduces real field defects, which is exactly the kind of contribution a polish-mode maintainer team accepts.
- The CONTRIBUTING documentation of the preview-features workflow.

Upstreamable later, with evidence:

- The attn tag schema as a spec note, including the REQ filterability caveat.
- The send-path tag support the schema requires (desktop gate plus CLI flag).
- WF-08 completion, so workflow approvals finally emit kind 46010 into the needs_action slot that has been wired and empty since it was built. This is arguably the contribution upstream wants most, since it fixes their own TODO.
- The work-status rendering over the job-progress kind.

The honest open packaging question: separate Attention screen versus an Inbox mode. Lee raised Inbox-enhancement on 2 Aug 09:03Z; the standing answer (Kai, event 80253df8) is that the prototype stays a separate screen for build isolation and clean evaluation, and the decision is made with evidence after real use. Recommendation, unchanged and now reinforced by the Catch up precedent, which chose Inbox-mode over new-surface for exactly the maintainers' reason: the upstream pitch is Inbox-integrated. An Attention mode or section of Inbox is a zoom level on the same truth; a fourth sibling surface is a second front door, and their own history (#3117) says they will fold it in anyway. Better to arrive already folded.

## 10. Decision log

All times 2 August 2026, UTC. Event ids abbreviated.

| Decision | Ruled by | When / evidence |
|---|---|---|
| Build as projection over existing feed; no new kinds, no relay changes | Kai, from repo investigation | prototype delivered ~09:15Z (32b65898) |
| Ship behind preview flag; separate screen for prototype isolation | Kai | day one; open-decision log |
| Upstream pitch is Inbox-integrated; decide packaging with evidence | Kai | ~09:03Z exchange (80253df8) |
| Done is never silent; every action posts a signal; Noted button; Done = manual step complete | Lee | 10:18 (623dde4d) |
| Five actions (Reply, Quick select, Done, Noted, Waiting), all posting; three-tier options; recommended answers phase 2 draft-only | Maya spec, Lee model | 10:21 (d4396125, c1122f60) |
| Zone state derived from own posted responses; localStorage demoted to cache; NIP-ER-event lean superseded | Kai | 10:23 (fc30492e) |
| Noted = short threaded reply (reactions verified not to reach agents) | Kai | 10:23 (fc30492e) |
| attn / attn-opt / attn-res tag schema defined; multi-letter REQ caveat accepted | Kai | 10:23 (fc30492e) |
| Five-second undo before any publish | Maya, accepted Kai | 10:21 / 10:23 |
| Rename to Attention | Lee | 10:28 (d3fa97f0) |
| Full rename this pass (route, flag, types); attn tags and Buzz One name unchanged | Maya, accepted Kai | 10:30 / 10:31 (43493706, 6e2cb54f) |
| QA gate: throwaway channel only until Rex's independent live pass | Maya, accepted Kai | 10:30 / 10:31 |
| TL;DR convention, prompt-only; unified with the ask line | Lee raised, Maya spec, Kai queued | 10:37 to 11:03 (a157f668, 2766a4d9) |
| Catch up is an Inbox mode, not a surface; needs no model; tldr tag and thread summary cut | Maya under Lee's challenge | 10:47 to 10:53 (a564e914, 5aec627a); Lee approved 11:01 |
| attn-res tag cannot ship in pass (desktop send media-only tag gate); replies are clean prose | Kai | 11:12 (7681cbcd) |
| Work status: harness-liveness split (harness touches last-updated, agent writes the line) | Maya | 11:11 (ee1209aa) |
| Work-status mechanism: existing job progress kind, latest-wins; no new kind, hosted relay rejects unknown kinds; two-step ship | Kai | 11:13 (4dd57351) |
| Git artifacts announced as native Buzz objects, not pasted URLs | Maya, verified and adopted Kai | 11:11 / 11:13 |
| Three field defects accepted; deterministic fixes with screenshot-exact regression tests; multi-ask headline count rule | Maya found, Kai ruled | 11:42 / 11:43 (97727377, dd909e4d) |
| Reader-side model classification rejected (determinism, economics, guessing known information) | Maya, confirmed Kai | 11:47 (428078f4, a4252a9d) |
| Declared contract v1 = structured prose; tag schema demoted to Phase C formalisation; frozen response sentences | Maya proposed, Kai accepted | 11:47 (a4252a9d) |
| One-click local badge correction escape hatch | Maya, accepted Kai | 11:47 (a4252a9d) |
| Declaration-with-options convention (Needs-Name-type line, verbatim options, per-person per-ask); closes all four defects; multi-ask sub-items pulled forward into test 5 | Lee prompted, Maya spec, Kai accepted in full | 11:56 to 11:58 (200669d4, d8d409bb, e498ed9f) |
| Full queue executed autonomously; Nexcta cutover excluded, done together | Lee | 12:02 (b2cb4796) |
| Test 5 scope: declaration parser, per-person cards, sub-item asks, declared quick select, badge correction | Kai | 11:58 / 12:04 (e498ed9f, aa0f0bff) |

---

Prepared from the verified investigation record (RESEARCH/MYZONE_BUZZ_INVESTIGATION.md) and the #new-feature-build channel history. No facts in this document are new; every claim traces to one of those two sources.
