# CORE-SCR-1 — Scoped Edit COMMAND_ONLY Runtime

## Purpose

Provide a shared deterministic lifecycle for supervised domain commands that do not originate from geometry dragging.

```text
exact scope + command allowlist
→ command envelope preparation
→ boundary authorization
→ acceptance-time scene/scope revalidation
→ append-only journal projection
→ deterministic replay
→ committed or rejected evidence
```

## Guarantees

- no drag session, drag result, pointer displacement, or zero-distance drag evidence;
- existing drag runtime remains unchanged;
- command names must be explicitly authorized by the host integration;
- target IDs are exact, unique, and boundary-checked;
- scene, scope, and boundary authority are re-read before commit;
- journal append and replay failures return rejection evidence without advancing runtime projection;
- destroyed runtimes cannot prepare or commit further commands.

## Initial qualification boundary

The runtime is exported from shared core and qualified only against synthetic and certified reference hosts.

It is not mounted into Topology or Sequential production command routing in this slice. Geometric position commands remain excluded from command-only allowlists and continue to require their established drag or native-domain authority.
