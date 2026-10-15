# Compatibility planning note — superseded

This bootstrap-era plan is no longer authoritative.

Current canonical execution state is held in:

- `agents/relay/REPO_STATE.yaml`
- `agents/relay/roadmap/OVERALL_ROADMAP.yaml` (`RM-0003`)
- `agents/relay/roadmap/PROGRESS.yaml` (`PB-0003`)
- `agents/relay/checkpoints/CP-CII-W2-NB-R1-V25-0001.yaml`
- `agents/relay/execution-packages/EP-CII-W2-NB-R1-V25-0002.yaml`

Current frontier: retained executable validation for draft PR #1228. Product implementation is applied but unexecuted; production files are read-only under EP-0002. The earlier preimplementation qualification gap is explicitly recorded and has not been retroactively certified.

Mandatory pending commands are the source-subgraph focused Node test, retained Auto Anchor mixed benchmark, and PB-0003 benchmark in a byte-faithful checkout or functioning runner. GitHub Actions runs `35266182142` and `35266754547` executed zero steps because no runner was assigned.
