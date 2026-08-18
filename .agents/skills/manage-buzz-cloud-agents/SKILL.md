---
name: manage-buzz-cloud-agents
description: Inspect, configure, activate, troubleshoot, and verify Buzz cloud agents hosted on a VPS or Docker deployment. Use SSH and the existing deployment conventions to manage agent identities, CLI harnesses, private-channel membership, restarts, and runtime health without exposing secrets.
---

# Manage Buzz Cloud Agents

## Scope and routing

Use this skill when a Buzz installation runs on a remote VPS, Docker, or Docker Compose. SSH is the primary control path. Use a desktop Buzz skill only for an operation that the remote deployment does not expose; use a local GUI skill only for local Mac actions.

Treat the installation as production-like:

- Discover the actual architecture before changing it. Do not assume one container per agent.
- Preserve compose files, volumes, networks, identities, channel memberships, memories, and provider sessions.
- Use the supported Buzz admin path, CLI, service command, or repository convention. Do not invent API endpoints or edit the database directly.
- Keep private channels private through explicit membership; a channel name is not an access boundary.
- Never print, copy, upload, or place private keys, auth tags, tokens, CLI session files, or secret environment values in chat, logs, screenshots, or reports.

## Required inputs and stop conditions

Before changing the VPS, resolve:

- VPS host and SSH user from the existing secure session or local SSH configuration;
- Buzz community and exact agent names or role changes;
- private-channel status and intended membership;
- intended harness and exact model for each agent, when specified;
- whether the request permits creation, update, restart, or only inspection.

Stop and request direction when the host, community, target service, or access boundary is ambiguous. Stop before deleting agents, replacing keypairs, removing volumes, running Docker cleanup, or taking the stack down.

## SSH execution contract

Use the user's existing SSH configuration, agent, or approved secure session. Never ask the user to paste a private key into chat and never create a replacement key merely to make a connection work.

When operating over SSH:

- Resolve the host and user before running a command.
- Run narrow, read-only discovery first.
- Pass only non-secret arguments on the command line. Read sensitive values from the deployment's protected files or environment mechanism without printing them.
- Capture and report only redacted output: host identity, service names, status, health, non-secret labels, and exit status.
- Reuse the same SSH session when working-directory or environment state matters.
- Verify that each command completed on the VPS; a locally accepted command is not proof of remote state.

Safe discovery commands, run in the deployment directory where needed:

    hostname
    docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
    docker compose ls
    docker compose config --services

If direct SSH is unavailable but an authenticated VPS web terminal is already open, use it only as a temporary fallback and record that limitation. Do not make the web terminal the normal administration path.

## Workflow

### 1. Inspect the deployment

Identify the service boundaries without exposing values:

- Buzz web or gateway service;
- agent worker, relay, or harness service;
- database or queue service;
- reverse proxy or TLS service;
- provider CLI runtime and mounted home/session directory;
- persistent volumes and configuration directory.

Inspect container names, image tags, status, health, labels, mounts, and restart policy. Do not dump raw container configuration or environment variables. Record a safe pre-change inventory containing only agent names, stable non-secret IDs, roles, harness/model labels, channel names, service names, and health state.

### 2. Map the runtime model

Determine whether agents are application records consumed by a shared worker, one process per agent, one container per agent, a shared gateway plus per-agent services, or another arrangement defined by the deployment.

Map each agent as:

    display name -> stable ID -> role/instructions -> harness -> model -> provider session -> channels -> runtime status

Keep identities distinct. Do not reuse a public key, private identity, provider home directory, or agent ID across agents unless the product explicitly defines shared identity semantics.

### 3. Define the agent plan

Write one row per agent before creating or modifying anything:

| Field | Decision |
|---|---|
| Name | Exact display name |
| Role | Narrow mandate and owned outcomes |
| Instructions | Boundaries, handoffs, completion evidence, and output style |
| Harness | Codex CLI, Claude CLI, or supported alternative |
| Model | Exact configured model label; do not guess aliases |
| Channels | Explicit private-channel membership |
| Runtime | Shared worker or targeted service |

Keep display name, role, harness, and model as separate fields. Never infer a model or provider from an agent name.

### 4. Create or update agents safely

Prefer the existing Buzz admin CLI, service command, repository script, or supported application path.

For a new agent:

1. Check for an existing name, role, or stable ID.
2. Create a unique identity and complete instructions from the role plan.
3. Select the exact harness and model supported by the runtime.
4. Register the agent with the intended community and explicit channels.
5. Start or restart only the service required by the deployment convention.

For an existing agent:

1. Record its current name, role, harness/model, channel list, identity fingerprint, and runtime state without exposing secrets.
2. Change only the requested fields.
3. Preserve identity, memories, provider sessions, and unrelated memberships.
4. Restart only when the platform requires it or the runtime is stale.

If keypairs are required, generate them on the VPS with a restrictive umask in a root-only directory. Register only the public half through the supported path. Report only the stable ID and non-secret fingerprint. Do not put private material in chat, shell history, Docker build arguments, image layers, or world-readable volumes.

If the deployment uses Codex or Claude CLI rather than APIs, connect each runtime to its already authenticated CLI session. Use the installed CLI's non-secret status check. Do not create an API key as a substitute, copy a session directory between agents, or reveal login output. If interactive login is required, hand that secure step to the user.

### 5. Configure private channels

Treat privacy and membership as separate checks:

1. Confirm the channel is private.
2. Add only the agents required by the plan.
3. Confirm each agent is added once and unrelated memberships remain unchanged.
4. Verify named membership and member count through the supported path.
5. Restart the affected worker when subscriptions are loaded only at startup.

Do not make a private channel public to simplify testing. Use only a harmless readiness check when a live message is needed.

### 6. Apply Docker changes conservatively

- Update version-controlled compose or configuration only when required.
- Keep secrets in the existing secret store or environment-file mechanism.
- Recreate or restart only the affected service.
- Preserve named volumes and network names.
- Do not run Docker cleanup or remove containers/volumes without explicit approval and a recoverability check.
- Avoid unrequested image upgrades, registry changes, compose-project renames, or broad stack restarts.

State expected interruption before a change that may affect the community.

### 7. Verify the full path

Verify all applicable layers, not configuration alone:

- exact agent name appears once;
- role and instructions begin with the intended mandate;
- harness and exact model are unambiguous;
- provider CLI session is usable without exposing credentials;
- worker/service is running and healthy;
- expected agent and channel count are discovered;
- private channels remain private with correct membership;
- no setup, authentication, restart-required, or harness error remains;
- a harmless readiness check succeeds when a live response is required.

Inspect only targeted log lines for readiness, discovery, connection, provider-auth status, and errors. Filter or redact before reporting.

### 8. Troubleshoot incomplete responses

Classify the failure before changing configuration:

1. Confirm the Buzz event reached the intended agent and channel.
2. Check whether the worker stayed alive and whether the harness exited.
3. Check the provider CLI's safe authentication/status command.
4. Check outbound network, DNS, proxy, timeout, and resource limits inside the relevant container.
5. Check that the configured harness/model is installed and matches the provider session.
6. Check channel subscription and restart state.
7. Inspect the narrow time window around the failed request for a non-secret error.

Interpret symptoms carefully:

- reaction without completion usually means event handling worked but the harness or provider call failed;
- typing that stops usually points to a provider stream, timeout, process exit, or response-persistence failure;
- no reaction usually points to membership, subscription, stale runtime, or event-routing failure;
- an online agent that cannot be mentioned usually points to identity registration, community membership, or mention-index synchronization.

Apply the least invasive fix, restart the smallest affected service, and repeat verification.

## Security and data handling

Never expose or persist private keys, auth tags, OAuth tokens, API keys, session cookies, CLI credential stores, secret environment values, database URLs, or complete credential-bearing compose files. Do not paste full logs when they may contain prompts, tokens, environment values, private message content, or key material.

Do not use raw database edits, broad permission changes, Docker-in-Docker escape paths, or unreviewed scripts from the internet. Do not run Docker prune, recursive deletion, database reset, or compose down without explicit approval and a recoverability check.

## Completion report

Report concisely:

- VPS/community and services changed;
- agents created or updated, with exact names and roles;
- harness/model assignments verified;
- private channels and membership changes;
- runtime and health result;
- credential or environment-variable names that still require manual setup, never values;
- remaining manual steps, uncertainty, or deliberate limitations.

Do not include keys, tokens, auth tags, secret paths, or credential contents.
