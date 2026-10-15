# Endpoint checkpoint — EP-SUPPORT-PRIMARY-1222-0026

Chain: `SUPPORT-PRIMARY-1222`  
Issue: #1222  
Related typicality issue: #1179  
PR: #1223  
Branch: `feature/support-primary-assembly-graph`  
Observed live head entering leg: `8a31bf808719e1ff227e830aedb7f10b6c0931d8`  
Main/base: `242fc1b1df7e398b64e15a1fd3e2f87d1ff5b581`  
Merge authority: OWNER_ONLY  
Merge authorized: FALSE

## LEG-014 — independent executable qualification

Purpose: obtain real execution evidence without changing Support Report product semantics.

Frozen scope:
- do not modify matcher/count/orphan/publication logic;
- build a disposable qualification workspace from exact PR-head repository content;
- execute focused Node controls and the real `benchmarks/1885.zip` path outside the currently non-allocating GitHub Actions runner;
- preserve the current Actions result (`runner_id=0`, `steps=[]`) as infrastructure evidence, not product failure;
- real 1835 Clash-within-Supports qualification remains separate and cannot be synthesized if the authoritative XML is absent.

Protected oracles:
- PS-11167 = 6;
- PS-11236 = 4;
- PS-12060 = 1;
- PS-12877 = 4;
- PS-12860 = 6;
- PS-12120 = 14;
- PS-11168 -> PS-14168 structural positive control.

Authority boundaries unchanged:
- #1216 remains Support/Steel producer authority;
- explicit support-member topology may outrank geometry only at the Primary Support Assembly seam;
- geometry-only recovery cannot override known traversal separation for final count;
- Column 22 publishes final `TYPICAL` only.

Exact next action: materialize the exact-head qualification inputs/source into a disposable container workspace, run executable Node/1885 controls, then close the leg with evidence. No ready-for-review or merge transition in this leg.