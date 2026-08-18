# Maintainer notes

## Design decisions

- SSH is the normal control path because it is repeatable, auditable, and independent of the Buzz desktop GUI.
- An authenticated VPS web terminal is documented only as a fallback for environments where direct SSH is temporarily unavailable.
- Discovery happens before mutation so the skill works with shared workers, per-agent processes, per-agent containers, or mixed deployments.
- Display name, role, identity, harness, model, provider session, and channel membership are separate concerns.
- Private channels are protected by explicit membership and privacy verification, not by naming convention.
- The skill does not prescribe Codex versus Claude; it verifies the exact supported harness and model from the deployment.

## Required operator decisions

The operator must resolve the host, user, community, target services, agent roster, channel access, intended harness/model, and permitted mutation scope before making changes. The skill must stop rather than guess when those decisions materially affect the result.

## Secret-handling rules

Keep private keys root-only on the VPS. Register only public identity material through the supported Buzz path. Never place secrets in chat, shell history, command-line arguments, Docker build layers, screenshots, Git history, or reports. Logs should be filtered to targeted, non-sensitive lines.

## Maintenance

When Buzz changes its supported admin commands, event model, or CLI harness integration, update the relevant workflow section and re-run the skill validator. Keep provider-specific details in a focused reference file only if the skill begins supporting more than one substantial provider workflow.

## Current package intent

This package is a generic starting point, not a turnkey installer. It deliberately does not contain a VPS hostname, community identifier, agent keys, provider sessions, compose files, or application-specific secrets.
