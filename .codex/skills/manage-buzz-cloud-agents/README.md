# Manage Buzz Cloud Agents

A reusable Codex skill for managing Buzz agents hosted on a VPS, Docker, or Docker Compose deployment.

It is intentionally generic: it does not assume a particular community, agent roster, VPS provider, database, compose layout, CLI provider, or model. It does provide a concrete operating method for:

- discovering an existing deployment before changing it;
- mapping agents, identities, harnesses, models, and channel membership;
- using SSH as the primary administration path;
- preserving private channels, volumes, identities, memories, and provider sessions;
- connecting Codex CLI or Claude CLI sessions without exposing credentials;
- restarting only the smallest affected service; and
- verifying the full Buzz-to-harness response path.

## Contents

- `SKILL.md` — the Codex skill instructions;
- `agents/openai.yaml` — optional Codex UI metadata;
- `NOTES.md` — deployment assumptions, security notes, and maintenance guidance.

## Use in Codex

Place the skill directory under the active Codex skills directory, then invoke it explicitly with `$manage-buzz-cloud-agents` or let Codex discover it from the description.

Before a live change, provide or make discoverable through local SSH configuration:

- the VPS host and user;
- the Buzz community;
- the exact agent changes;
- private-channel membership requirements; and
- the harness/model choices.

The skill will stop when those details or the access boundary are ambiguous.

## Security

Do not commit private keys, CLI session directories, OAuth tokens, API keys, auth tags, secret environment values, database URLs, or unredacted logs. Authenticate the provider CLI securely on the VPS and keep credentials in the deployment's existing protected mechanism.

## Validation

Run the Codex skill validator against the directory before publishing or installing it:

```bash
python3 "$CODEX_HOME/skills/.system/skill-creator/scripts/quick_validate.py" manage-buzz-cloud-agents
```

If `CODEX_HOME` is not set, use the equivalent path to the installed `skill-creator` scripts.
