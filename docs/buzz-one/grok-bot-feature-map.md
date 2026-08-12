# Grok Bot feature map for Buzz One

Grok Bot is xAI's always-on "AI coworker": each Bot is a persistent agent with
its own dedicated cloud computer that signs into your existing apps, works
multi-step jobs end to end, and returns only when it needs a human decision or
is done. This document reverse-engineers what makes it compelling and maps each
winning idea onto seams that already exist in the Buzz One customization of the
Buzz workspace — so we can ship the same supervision ergonomics while keeping
the relay's signed events, not a private per-machine VM, as the shared source of
truth.

This is a companion to [`README.md`](./README.md) (the Team Table
implementation guide) and reuses its vocabulary — work object, decision card,
Agent-at-work pane, Computer Session, Routines, execution profiles, connector
catalogue. Where the two overlap, this doc defers to the README and adds the
Grok-Bot-specific framing.

> A note on sourcing. x.ai and its docs are unreachable from this environment,
> and every mainstream outlet page (VentureBeat, Unite.AI, InterestingEngineering,
> Digital Trends, TrendingTopics, kingy.ai, and others) is blocked by the egress
> proxy for direct fetch. The facts below were verified against search-engine
> summaries of that secondary coverage; the article URLs are listed under
> [Sources](#sources). No claim is sourced to x.ai.

---

## What Grok Bot does

xAI launched Grok Bot in early beta on 11 August 2026, bundled into the
SuperGrok Heavy, Cursor Ultra, and Cursor Teams Premium tiers, on macOS,
Windows, Linux, and iOS (Android listed as coming soon). Some outlets brand the
launching division "SpaceXAI"; the product is the same.

| Feature | What it achieves | Source |
| --- | --- | --- |
| Dedicated cloud computer per Bot | Each Bot runs on its own persistent cloud VM (browser, filesystem, terminal) and keeps working while the user's laptop is closed | [Unite.AI](https://www.unite.ai/xai-launches-grok-bot-always-on-ai-teammates-with-their-own-cloud-computers/), [VentureBeat](https://venturebeat.com/orchestration/spacexais-grok-bot-turns-agents-into-persistent-digital-coworkers-that-can-operate-your-apps-for-120-per-month) |
| Signs into your apps and finishes real work | Uses connectors/MCP where available and computer use for apps without a clean API, so work lands in the real tools rather than as chat drafts | [VentureBeat](https://venturebeat.com/orchestration/spacexais-grok-bot-turns-agents-into-persistent-digital-coworkers-that-can-operate-your-apps-for-120-per-month), [Glitchwire](https://glitchwire.com/news/spacexai-launches-grok-bot-an-ai-that-logs-into-your-tools-and-does-the-actual-w/) |
| Returns only when it needs approval | The Bot works autonomously and checks in only in the final phase, when a step needs human judgment or the assignment is done | [InterestingEngineering](https://interestingengineering.com/ai-robotics/xai-grok-bot-computer-agent), [kingy.ai](https://kingy.ai/blog/what-is-grok-bot/) |
| Auto Review of sensitive actions | Sensitive actions are routed through an "Auto Review" layer before they execute | [kingy.ai — price & security](https://kingy.ai/blog/grok-bot-ai-teammate-price-security/) |
| Persistent memory | Named Bots keep memory, files, browser sessions, and preferences across turns; context compounds instead of resetting each task; Bots learn writing voice and edge cases | [VentureBeat](https://venturebeat.com/orchestration/spacexais-grok-bot-turns-agents-into-persistent-digital-coworkers-that-can-operate-your-apps-for-120-per-month), [kingy.ai](https://kingy.ai/blog/what-is-grok-bot/) |
| Continuity and proactivity | Resumes dropped threads, nudges stalled hand-offs, picks up work from earlier conversations, and over time spots work before it is asked for | [TrendingTopics](https://www.trendingtopics.eu/grok-bot-spacexai/), [VentureBeat](https://venturebeat.com/orchestration/spacexais-grok-bot-turns-agents-into-persistent-digital-coworkers-that-can-operate-your-apps-for-120-per-month) |
| Multi-agent in one thread | Several Bots sit in one group chat, coordinate on their own, pass work and assign ownership between each other, and pull the human in only for judgment calls (a "chief of staff" over specialist Bots) | [InterestingEngineering](https://interestingengineering.com/ai-robotics/xai-grok-bot-computer-agent), [kingy.ai](https://kingy.ai/blog/what-is-grok-bot/) |
| Streaming activity | The user can watch a Bot's steps while it works rather than reading raw logs | [Unite.AI](https://www.unite.ai/xai-launches-grok-bot-always-on-ai-teammates-with-their-own-cloud-computers/) |
| Demonstrate-once routines | A user can show a workflow once and save it as a repeatable routine | [VentureBeat](https://venturebeat.com/orchestration/spacexais-grok-bot-turns-agents-into-persistent-digital-coworkers-that-can-operate-your-apps-for-120-per-month) |
| Security and training opt-out | The cloud computer is encrypted in transit and at rest; Cursor auth/SSO and a privacy mode are used, and customers can opt out of training | [kingy.ai — price & security](https://kingy.ai/blog/grok-bot-ai-teammate-price-security/) |
| Pricing | Bundled into SuperGrok Heavy, Cursor Ultra, and Cursor Teams Premium; entry around $120/month, with the fuller individual bundle (Cursor Ultra) reported at $200/month | [VentureBeat](https://venturebeat.com/orchestration/spacexais-grok-bot-turns-agents-into-persistent-digital-coworkers-that-can-operate-your-apps-for-120-per-month), [kingy.ai](https://kingy.ai/blog/what-is-grok-bot/) |

The pattern behind the feature list: a Bot is a durable identity with private
state (memory + a computer), it acts inside your real tools, and the human is a
supervisor who is interrupted only for consequential decisions. Everything else
is designed to keep that supervision cheap — visible activity, one clear review
action, and continuity across sessions.

---

## How Buzz One already has the substrate

Buzz One is not starting from zero on any of these. The relay already models
agents as identities, streams their activity as encrypted events, stores their
memory as encrypted records, and gates their consequential actions behind signed
approvals. The table maps each Grok Bot capability to the Buzz seam it lands on.

| Grok Bot capability | Buzz One substrate that already exists |
| --- | --- |
| Always-on Bot with its own identity | Managed agents (`KIND_MANAGED_AGENT` 30177) and personas (`KIND_PERSONA` 30175) in [`crates/buzz-core/src/kind.rs`](../../crates/buzz-core/src/kind.rs); the ACP harness in `crates/buzz-acp` runs the agent process |
| Signs into apps and finishes multi-step work | Connectors/tools via MCP (`crates/buzz-dev-mcp`), the agent job protocol (`KIND_JOB_REQUEST` 43001 … `KIND_JOB_RESULT` 43004), and the workflow engine (`crates/buzz-workflow`, `KIND_WORKFLOW_DEF` 30620) |
| Returns only when it needs approval | Workflow approval kinds `KIND_WORKFLOW_APPROVAL_REQUESTED` (46010) / `_GRANTED` (46011) / `_DENIED` (46012) and the generic `KIND_APPROVAL_GRANT` (46030) / `KIND_APPROVAL_DENY` (46031), surfaced by [`WorkflowApprovalCard.tsx`](../../desktop/src/features/workflows/ui/WorkflowApprovalCard.tsx) and resolved by `useApprovalMutation` → `grantApproval`/`denyApproval` in [`desktop/src/features/workflows/hooks.ts`](../../desktop/src/features/workflows/hooks.ts) |
| Auto Review of sensitive actions | The approval request is the gate; observer **control** frames (`frame=control`) on `KIND_AGENT_OBSERVER_FRAME` (24200) already carry owner→agent commands. A sensitivity class on the approval request is the only missing field, not a new pipeline |
| Persistent memory (voice, preferences, edge cases) | NIP-AE Agent Engrams: `KIND_AGENT_ENGRAM` (30174), NIP-44 encrypted, addressed by a `core` + `mem/…` slug grammar ([`crates/buzz-core/src/engram.rs`](../../crates/buzz-core/src/engram.rs)). Already rendered, owner-gated and decrypted, by [`MemorySection.tsx`](../../desktop/src/features/agent-memory/ui/MemorySection.tsx); written via `buzz mem` (`crates/buzz-cli`) and injected at session start by `crates/buzz-acp` |
| Resume dropped threads, nudge stalled hand-offs | Owner→agent observer control frames ([`crates/buzz-core/src/observer.rs`](../../crates/buzz-core/src/observer.rs)), agent job protocol, and encrypted event reminders (`KIND_EVENT_REMINDER` 30300) |
| Becomes proactive | Workflow triggers (`KIND_WORKFLOW_TRIGGER` 46020) + the `buzz-workflow` scheduler, reminders, and engram-derived context |
| Multiple agents in one thread | Channels are already multi-party and agents are members; teams (`KIND_TEAM` 30176, `KIND_TEAM_CATALOG` 30178) group personas; the job protocol carries hand-offs; observer frames are per-agent (`agent` tag) |
| Streaming activity while it works | Observer **telemetry** frames (`frame=telemetry`), surfaced by [`BotActivityBar.tsx`](../../desktop/src/features/channels/ui/BotActivityBar.tsx), [`AgentSessionThreadPanel.tsx`](../../desktop/src/features/channels/ui/AgentSessionThreadPanel.tsx), and [`ManagedAgentSessionPanel.tsx`](../../desktop/src/features/agents/ui/ManagedAgentSessionPanel.tsx) |
| Presence / always-on status | `KIND_PRESENCE_UPDATE` (20001), `KIND_PRESENCE_SNAPSHOT` (40902), and the `useAgentWorking` signal (`desktop/src/features/agents/agentWorkingSignal.ts`) |
| Per-agent model | [`ModelPicker.tsx`](../../desktop/src/features/agents/ui/ModelPicker.tsx) with `getAgentModels` / `updateManagedAgent` / `switchManagedAgentModel` (live switch via observer control frames) |
| Encrypted in transit and at rest; training opt-out | Relay TLS plus NIP-44 encryption of both observer frames and engrams; observer, engram, DM, and turn-metric kinds are p-gated / owner-only (`P_GATED_KINDS`, `AUTHOR_ONLY_KINDS` in `kind.rs`), so agent state is not world-readable — the structural equivalent of "encrypted + not used for training" |
| Own cloud computer | The `mesh-compute` feature ([`MeshComputeSettingsCard.tsx`](../../desktop/src/features/mesh-compute/ui/MeshComputeSettingsCard.tsx)) plus the observer/media pipeline is the seam for a provider-neutral Computer Session |
| Stop control | `cancelManagedAgentTurn` (`desktop/src/shared/api/agentControl.ts`), already wired into the Agent-at-work pane's "Stop current turn" |

### The critical adaptation

Grok Bot's unit of state is a **private cloud computer per Bot**: memory, files,
and browser sessions live inside a VM that only that Bot (and, through it, its
owner) can see. That is the right design for a single-user desktop product, but
it is strictly weaker than what Buzz already has. **Buzz's signed relay events
are a better shared source of truth than a per-machine cloud computer.** The
relay is authoritative; the desktop app is a view; every teammate in a channel
can see, search, react to, and audit the same record.

So the discipline for Buzz One is: **reuse Grok Bot's interaction patterns —
return-only-for-approval, Auto Review, compounding memory, multi-agent hand-off,
proactive nudges — but express every resulting piece of state as a Buzz event,
not as private VM state.** Concretely:

- Activity is an observer telemetry frame, not a screen the owner alone watches.
- Memory is an encrypted engram addressed on the relay, not a file in a VM.
- A hand-off is a signed job event in the channel, not an inter-VM message.
- A "computer" is a Computer Session whose frames and snapshots are normalized
  into observer frames + media, so any provider (sandbox, cloud, local) yields
  the same in-channel UI and the same audit trail.
- No agent "owns" a port, VM, or memory store the rest of the workspace cannot
  see or govern.

This is the same posture the README takes toward the OpenMausBot local-HTTP
model, applied to Grok Bot's cloud-computer model.

---

## Winning features to implement

Three tiers. Effort is a delivery estimate after design and acceptance criteria
are agreed (S = small, M = medium, L = large), matching the README's convention.

### Low-hanging fruit (ship this week)

| Feature | Why it wins | Buzz seams to touch | Effort | Acceptance test |
| --- | --- | --- | --- | --- |
| Return-only-for-approval decision card in-channel | This is Grok Bot's signature supervision loop, and the substrate is ~90% present; it makes agent work steerable in one click without leaving the room | Extract [`WorkflowApprovalCard.tsx`](../../desktop/src/features/workflows/ui/WorkflowApprovalCard.tsx) into a message-embeddable component keyed on a typed `ApprovalRequest`; keep `useApprovalMutation` → `grantApproval`/`denyApproval` ([`hooks.ts`](../../desktop/src/features/workflows/hooks.ts)); reuse `KIND_WORKFLOW_APPROVAL_REQUESTED/_GRANTED/_DENIED` and `KIND_APPROVAL_GRANT/_DENY` | S–M | A pending approval renders inside the timeline; keyboard choices work; the resolved choice becomes a signed, searchable channel message and resumes only the correlated run |
| Auto Review sensitivity policy on the card | Grok Bot's guardrail; makes "which actions are consequential" explicit and defaults an unanswered request to stop | Add a sensitivity class (e.g. `reads` / `changes-data` / `contacts-people` / `spends-money`) to the approval-request payload emitted by `crates/buzz-workflow`; render it as a badge on the card; keep `approverSpec` / `token` / `expiresAt` as-is | S | A high-sensitivity action shows an orange Review badge and cannot execute before an explicit grant; a low-sensitivity action renders on the neutral surface; deny and timeout both stop |
| Agent roster group with presence | Turns agents into legible teammates instead of a hidden fleet; the fastest mental-model win | [`AppSidebar.tsx`](../../desktop/src/features/sidebar/ui/AppSidebar.tsx) for the Agents group; `ManagedAgent` data; `KIND_PRESENCE_UPDATE` (20001) + `useAgentWorking`; the working set already computed by [`BotActivityBar.tsx`](../../desktop/src/features/channels/ui/BotActivityBar.tsx) | S | The roster reflects live active / idle / needs-you state; the row context menu (pin, mute, pause, open work, settings) works |
| Resume-a-dropped-thread affordance | Grok Bot resumes dropped threads and nudges stalled hand-offs; this is the continuity that makes an agent feel dependable | On an interrupted/idle work object, add a Resume control that re-enters the correlated session via an owner→agent control frame ([`observer.rs`](../../crates/buzz-core/src/observer.rs), `agentControl.ts`); Stop already exists via `cancelManagedAgentTurn` in [`AgentSessionThreadPanel.tsx`](../../desktop/src/features/channels/ui/AgentSessionThreadPanel.tsx) | M | An interrupted work object shows Resume; clicking it re-enters only the correlated run; no other work resumes; reduced motion respected |
| Per-agent model chip | Grok Bot's Bots have intentional, per-role capability; a reviewer should always know what produced a result | [`ModelPicker.tsx`](../../desktop/src/features/agents/ui/ModelPicker.tsx) already resolves and switches the effective model; surface it as a small chip on the work object and the roster row | S | Every work object shows the effective model chip; changing the model in `ModelPicker` updates the chip on the next produced object |

### Super-powerful (platform bets)

| Feature | Why it wins | Buzz seams to touch | Effort | Acceptance test |
| --- | --- | --- | --- | --- |
| Persistent memory surfaced as "what I remember about you" | Compounding context is Grok Bot's real moat, and Buzz already stores encrypted engrams — this promotes them from a debug viewer to a product surface | Promote [`MemorySection.tsx`](../../desktop/src/features/agent-memory/ui/MemorySection.tsx) (via `useAgentMemoryGraph`) into a first-class "what I remember" panel with add/forget affordances; writes land as `KIND_AGENT_ENGRAM` (30174) through `buzz mem` / the ACP engram path; keep owner-gated decryption | M–L | An owner sees a readable memory list (voice, preferences, edge cases); an in-channel "remember this" writes a new engram that decrypts back into the list; "forget" removes it; non-owners see nothing |
| Multi-agent hand-off in one thread | Grok Bot's several-Bots-in-a-thread, chief-of-staff pattern — parallelism without the human as middleman | Channels are already multi-party; use teams (`KIND_TEAM` 30176 / `KIND_TEAM_CATALOG` 30178) to group specialists; carry hand-offs as signed job events (`KIND_JOB_REQUEST` 43001 / `_ACCEPTED` 43002 / `_RESULT` 43004); render each agent's observer frames per `agent` tag | L | Agent A finishes a step and hands to agent B via a signed job event visible in-channel; B picks it up; the human is pulled in only for a decision card; every hand-off is auditable |
| Provider-neutral Computer Session | Grok Bot's "own cloud computer," made shared and auditable — the relay sees the work a private VM would hide | `mesh-compute` ([`MeshComputeSettingsCard.tsx`](../../desktop/src/features/mesh-compute/ui/MeshComputeSettingsCard.tsx)), the Tauri layer, observer frames, and `buzz-media` (Blossom) for immutable snapshots; follow the README's Computer Session safety contract; targets `none` / `sandbox` / `cloud` / `local`, default `none` | L | A sandbox streams preview frames into the Agent-at-work pane, posts a final snapshot as evidence, and enforces a working stop button; the same UI renders regardless of provider |
| Connector catalogue | Turns a generic agent into a coworker that signs into your apps — the difference between a chatbot and a Bot | MCP config boundary (`crates/buzz-dev-mcp`), personas (`crates/buzz-persona`) for grants, OS-keychain / relay-side encrypted secret storage; start with three connectors a user can explain (Gmail, GitHub, Salesforce) | L | Each connector can be connected via OAuth, scoped, attached to a persona, and revoked; the profile shows account + scopes + last use; no secret value renders in the DOM, logs, or a copied work object |

### More / longer tail

| Feature | Why it wins | Buzz seams to touch | Effort | Acceptance test |
| --- | --- | --- | --- | --- |
| Proactive nudges | Grok Bot becomes proactive over time; a low-key "I noticed X — want me to handle it?" is high value and low risk when it proposes rather than acts | `KIND_WORKFLOW_TRIGGER` (46020) + the `buzz-workflow` scheduler, engram-derived context, observer telemetry | M | A trigger produces a proactive suggestion card the human can accept or dismiss; the agent never acts before acceptance |
| Learned interrupt thresholds | Reduces approval fatigue while staying safe — the Auto Review policy adapts from prior decisions instead of asking every time | Persist per-mission grants as engrams (`KIND_AGENT_ENGRAM`); read them in the approval gate; execution-profile approval policy (ask-once / per-mission / always-ask) per the README's Phase 3 | M | After "Allow for mission," the same sensitivity class within that mission auto-proceeds and is logged; a new class still stops and asks |
| Scheduled Routines | Grok Bot's demonstrate-once routines; makes recurring operational value obvious to non-technical users | `crates/buzz-workflow` cron/interval scheduler, `KIND_WORKFLOW_DEF` (30620), `KIND_EVENT_REMINDER` (30300); user-facing "Create routine" flow | M | A non-technical user creates "weekday 08:30 pipeline brief," sees the next run, pauses it, and reviews run history in the owning channel |
| Evidence packs | Converts "trust me" into inspectable claims — the counterweight to autonomous execution | Messages / media / canvas, `KIND_STREAM_MESSAGE_DIFF` (40008), `KIND_CANVAS` (40100), and the observer transcript | M | A completed action posts evidence (sources, screenshots, diffs, data) plus a concise rationale — not only prose; every artifact link respects the viewer's permission scope |

---

## Look and feel

Steal Grok Bot's supervision *ergonomics*, not its aesthetic. What is worth
copying: the return-only-for-approval rhythm, the always-visible "who is working
on what," exactly one clear review action per decision, and calm resume/nudge
affordances. What to reject: the dark cockpit, the dashboard of KPI tiles, and
the floating agent control panel. Buzz One's home is the room, not a console.

Honor the Team Table contract from [`README.md`](./README.md):

- **The centre pane stays the channel.** Agent work is a bordered work object
  attached beneath the message that introduced it, and supervision happens in
  the right-pane Agent-at-work mode — never a separate cockpit.
- **Forest is the only accent.** The single collaboration accent (chosen-state,
  the one primary action) is forest green. Keep at most one "loud" action in
  view.
- **Orange is for risk only.** Reserve orange strictly for the Auto Review /
  consequential-decision path — the sensitivity badge and the decision card's
  fill. Routine agent activity never uses it.
- **Calm rhythm.** Work objects expand with the 160–200ms transition; the
  activity line cross-fades rather than reflowing the timeline; a resolved
  approval compresses in place and emits a normal channel message. Respect
  `prefers-reduced-motion`.

### Implement with semantic tokens, not the prototype's hexes

The prototype ([`design/index.html`](./design/index.html)) is a deliberately
committed **light** Team Table. But the shipping desktop app's real theme is
**Catppuccin — Latte (light) and Macchiato (dark)** — driven by semantic tokens
(`primary`, `warning`, `destructive`, `muted-foreground`, `accent`, `border`,
`ring`, `background`, `foreground`). So when building these features in the
actual app, do **not** hardcode the prototype's hex values or one-off palette
classes; map the Team Table roles onto the existing semantic tokens so both
light and dark render correctly and zoom stays safe (rem-based text tokens per
the desktop guide).

There is a concrete instance to fix while doing this. Today
[`WorkflowApprovalCard.tsx`](../../desktop/src/features/workflows/ui/WorkflowApprovalCard.tsx)
hardcodes `border-amber-500/30 bg-amber-500/5` and a `bg-green-600` confirm
button — palette literals that freeze the card to one look and drift from the
token system that the rest of the agent surfaces (`MemorySection`,
`BotActivityBar`, `AgentSessionThreadPanel`) already use. As the card is
extracted into the in-channel decision card, move risk styling to the `warning`
token (the Auto Review path) and the confirm action to the `primary`
(forest) token, and keep everything non-consequential on neutral `muted` /
`border` surfaces. The result reads as Team Table in light and stays coherent in
Catppuccin dark, with orange carrying meaning rather than decoration.

---

## Recommended first build

Build the **Decision and Approval card** first: the in-channel,
return-only-for-approval card with an Auto Review sensitivity badge. It is the
highest-leverage first implementation for three reasons.

1. **It is Grok Bot's signature loop.** Autonomous work that returns only for a
   human decision is the whole product thesis; delivering it in-channel makes
   Buzz One visibly different with almost no new backend surface.
2. **The substrate already exists.** The approval kinds
   (`KIND_WORKFLOW_APPROVAL_REQUESTED/_GRANTED/_DENIED`, `KIND_APPROVAL_GRANT/_DENY`),
   the card ([`WorkflowApprovalCard.tsx`](../../desktop/src/features/workflows/ui/WorkflowApprovalCard.tsx)),
   and the resolution path (`useApprovalMutation` → `grantApproval`/`denyApproval`
   → relay, in [`hooks.ts`](../../desktop/src/features/workflows/hooks.ts)) are
   all present. The work is extraction and adaptation, not new plumbing.
3. **Everything else leans on it.** Auto Review, learned interrupt thresholds,
   multi-agent hand-off, and the Computer Session all depend on a trustworthy,
   auditable decision gate. Building it first de-risks the rest.

This card is being implemented now, against `WorkflowApprovalCard` and
`useApprovalMutation`. The concrete slice: extract the card into a
message-embeddable component keyed on a typed `ApprovalRequest`; add the Auto
Review sensitivity class and its orange badge; render the choices as **Allow
once / Allow for mission / Deny** plus a reply-with-context affordance, each
bound to the run's correlation id; wire grant/deny through the existing mutation
(with "Allow for mission" recording a scoped policy grant); and emit the
resolved decision as a signed channel message that resumes only the correlated
run and defaults an unanswered request to stop.

---

## Sources

Direct article pages were unreachable from this environment (egress-blocked);
the facts above were verified against search-engine summaries of this secondary
coverage. No claim is sourced to x.ai.

- VentureBeat — [SpaceXAI's Grok Bot turns agents into persistent digital coworkers that can operate your apps](https://venturebeat.com/orchestration/spacexais-grok-bot-turns-agents-into-persistent-digital-coworkers-that-can-operate-your-apps-for-120-per-month)
- Unite.AI — [xAI Launches Grok Bot, Always-On AI Teammates With Their Own Cloud Computers](https://www.unite.ai/xai-launches-grok-bot-always-on-ai-teammates-with-their-own-cloud-computers/)
- InterestingEngineering — [Grok Bot is xAI's new 24/7 coworker that keeps working while you sleep](https://interestingengineering.com/ai-robotics/xai-grok-bot-computer-agent)
- kingy.ai — [What Is Grok Bot? Features, Pricing & Availability](https://kingy.ai/blog/what-is-grok-bot/)
- kingy.ai — [Grok Bot Explained: Price, Access and Security](https://kingy.ai/blog/grok-bot-ai-teammate-price-security/)
- TrendingTopics — [Grok Bot: SpaceXAI launches AI Agent to Counter Claude Cowork's Success](https://www.trendingtopics.eu/grok-bot-spacexai/)
- Digital Trends — [Grok Bot wants to take work off your plate, not just answer your queries](https://www.digitaltrends.com/computing/grok-bot-wants-to-take-work-off-your-plate-not-just-answer-your-queries/)
- Glitchwire — [SpaceXAI Launches Grok Bot, an AI That Logs Into Your Tools and Does the Actual Work](https://glitchwire.com/news/spacexai-launches-grok-bot-an-ai-that-logs-into-your-tools-and-does-the-actual-w/)
- AI Weekly — [SpaceXAI and Cursor ship Grok Bot beta on Mac, iOS, PC, Linux](https://aiweekly.co/node/9806)
- Ground News — [AI colleagues in a Slack channel: what happens when AI agents become team members](https://ground.news/article/ai-colleagues-in-slack-channel-what-happens-when-ai-agents-become-team-members)
