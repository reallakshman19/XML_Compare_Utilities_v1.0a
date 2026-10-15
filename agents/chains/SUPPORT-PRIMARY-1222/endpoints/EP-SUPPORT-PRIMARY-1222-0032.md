<!-- ENG-PR-V2:ENDPOINT
CHAIN_ID=SUPPORT-PRIMARY-1222
ENDPOINT_ID=EP-SUPPORT-PRIMARY-1222-0032
-->
# Endpoint checkpoint — EP-SUPPORT-PRIMARY-1222-0032

Agent instance: `ChatGPT GPT-5.6 Sol`  
Predecessor: `EP-SUPPORT-PRIMARY-1222-0031`  
Material leg: `LEG-019`  
Main observed: `242fc1b1df7e398b64e15a1fd3e2f87d1ff5b581`  
Branch: `feature/support-primary-assembly-graph`  
Product material head retained: `afcbc421006a50fbcf55b69a5292c0e1b49cf27d`  
Qualification workflow head retained: `4e2b845f5fa44f14bb7efaebeb145194c80afc53`

## Delta

LEG-019 is execution/bookkeeping only. No production runtime, test, benchmark, Playwright, package, or workflow definition changed.

## Hosted retry evidence

Run attempt 3 was explicitly triggered on the hardened workflows:

- qualification run `35062584413`, attempt 3: focused-node `104723112573`, browser `104723112746`;
- ZIP run `35062584337`, attempt 3: benchmark `104723159327`.

Every job completed before executing a repository step. The focused-node step endpoint is empty, its job log blob does not exist, and the workflow runs have no artifacts. Classification remains **infrastructure NOT_RUN**.

The qualification source head remains applicable to current governed code: compare `4e2b845f5fa44f14bb7efaebeb145194c80afc53` -> pre-LEG-019 PR head `33a284d23600fffb3b0dcb1f675fda953154efe7` changes only chain documentation/bookkeeping plus the external runbook; no governed product/test/workflow material changed.

## Infrastructure isolation

GitHub public status reported Actions operational and no incident at the retry time. That rules out no specific account cause, but provides no evidence of a platform-wide outage. Repository/account Actions administration, billing and runner settings are not exposed through the available connector, so the exact zero-step cause remains **UNOBSERVED** rather than guessed.

## Retained evidence

- high-risk product logic: LEG-014 **27/27 pass**;
- LEG-017 partial independent execution: **13/13 pass** with documented caveats;
- external execution contract: LEG-018 `QUALIFICATION-RUNBOOK.md` **READY**;
- full focused Node / real ZIP / Playwright: **NOT_RUN**;
- real 1835 relationship input: **absent / NOT_RUN**.

## Disposition

Known production/source blocker: **NONE**.  
Hosted Actions execution blocker: **PRESENT / ROOT CAUSE UNOBSERVED**.  
PR #1223: **HOLD_DRAFT**.

Exact next action: restore/enable an allocating GitHub runner or use another trusted clean checkout to execute `QUALIFICATION-RUNBOOK.md`; separately supply/pin the authoritative 1835 relationship XML. Do not mark ready or merge without separate fresh Owner authorization.