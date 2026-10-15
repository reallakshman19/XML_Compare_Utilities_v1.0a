<!-- ENG-PR-V2:ENDPOINT
CHAIN_ID=SUPPORT-PRIMARY-1222
ENDPOINT_ID=EP-SUPPORT-PRIMARY-1222-0031
-->
# Endpoint checkpoint — EP-SUPPORT-PRIMARY-1222-0031

Agent instance: `ChatGPT GPT-5.6 Sol`  
Predecessor: `EP-SUPPORT-PRIMARY-1222-0030`  
Material leg: `LEG-018`  
Main observed: `242fc1b1df7e398b64e15a1fd3e2f87d1ff5b581`  
Branch: `feature/support-primary-assembly-graph`  
Product material head retained: `afcbc421006a50fbcf55b69a5292c0e1b49cf27d`  
Qualification workflow head retained: `4e2b845f5fa44f14bb7efaebeb145194c80afc53`

## Delta

LEG-018 adds only the operator-facing `QUALIFICATION-RUNBOOK.md` and chain bookkeeping. There is no production runtime mutation and no qualification-definition mutation.

## External qualification contract

The runbook stages four unresolved gates:

1. execute the hardened focused Node surface on Node 22 from a clean exact PR checkout;
2. execute the real repository `benchmarks/1884.zip` -> `benchmarks/1885.zip` benchmark and preserve the canonical workflow RCA assertions plus direct protected 1885 family-count evidence;
3. execute the full Playwright browser suite and preserve JSON/report/test-result artifacts, including current/reference relationship scoping and multi-popup orphan-config behavior;
4. pin and execute the separate authoritative Owner 1835 Clash-within-Supports relationship XML, preserving file identity, parse/scope diagnostics, and real PS-11167/PS-11236 count evidence.

PASS/FAIL/NOT_RUN classification is explicit: a gate can pass or fail only after its governed command actually executes against the pinned real input; unavailable runner/dependency/input remains NOT_RUN.

## Retained evidence

- LEG-014 actual high-risk production logic: **27/27 pass**.
- LEG-017 narrower independent slices: **13/13 pass** with documented caveats.
- Latest hosted hardened Node/browser/ZIP attempts: **infrastructure NOT_RUN** before Checkout/runner allocation.
- Real 1835 relationship XML: **absent / NOT_RUN**.

## Protected invariants

- PS-11167=6;
- PS-11236=4;
- PS-12060=1;
- PS-12877=4;
- PS-12860=6;
- PS-12120=14;
- PS-11168 -> PS-14168 positive structural control;
- #1216 Support/Steel production relationship authority remains untouched;
- Column 22 remains final-`TYPICAL` only;
- no product algorithm is reopened for infrastructure/input failures.

## Disposition

Qualification handoff: **READY**.  
Known production/source blocker: **NONE**.  
Full governed qualification: **PARTIAL / EXTERNAL GATES REMAIN**.  
PR #1223: **HOLD_DRAFT**.

Exact next action is to execute `agents/chains/SUPPORT-PRIMARY-1222/QUALIFICATION-RUNBOOK.md` on a trusted checkout/runner and separately supply/pin the real 1835 relationship XML. Do not mark ready or merge without separate fresh Owner authorization.