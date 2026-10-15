# PR1231 work report

## Mission

Provide a checked-in `docs/` GitHub Pages publication tree so `reallaksh19/XML_Compare_Utilities` can use **Settings > Pages > Deploy from a branch > main > /docs**.

This is a release-plane change only. No XML/CAD/topology engineering semantics are changed.

## Identity and live basis

- PR: #1231
- Head branch: `pages-docs-build-20260927`
- Base branch: `main`
- Baseline main SHA: `af688aada9f1a1491c650a0a229b43e37a6382b0`
- Generated publication commit: `9a8195c49c1db92c6bfb7c42f91ea07f97a791d9`
- Existing Pages workflow inspected: `.github/workflows/deploy.yml`
- Existing Pages artifact contract inspected: `tests/deploy-workflow-pages-artifact.test.js`

## Coordination

Open-PR inspection found no competing open PR specifically claiming the Pages/`docs` deployment paths. PR #1219 records the existing Pages artifact upload route as a release-plane blocker.

Classification: `SAFE` for this isolated alternate publication path. Any later release-plane PR touching `docs/`, Pages settings, or the deployment workflow must be reconciled before merge.

## Implementation

### New build script

`scripts/build-pages-docs.mjs`:

- preserves authored `docs/` content;
- excludes source `docs/` from recursive copying;
- mirrors the existing Pages artifact staging exclusions for Git/GitHub metadata, dotfiles, tests, node_modules, README/package manifests, and Python cache files;
- uses `docs/.pages-build-manifest.json` as the deletion authority for previously generated files;
- refuses to overwrite an authored docs file that is not in the prior generated manifest;
- writes `docs/.nojekyll` and `docs/pages-deployment.json`;
- validates the shared app-build token between `index.html` and `tabs/psnm-utility-pages-entry.js`.

### Generated branch publication snapshot

- 2,997 repository source files copied into `docs/`.
- 3 metadata files added: `.nojekyll`, `.pages-build-manifest.json`, `pages-deployment.json`.
- Generated manifest tracks 2,999 generated files (all copied files plus `.nojekyll` and `pages-deployment.json`).
- Current shared build token: `standalone-20260903-ciiw-ms-compare-action-refresh-1`.
- Existing authored docs collision count before generation: 0.

## Validation

| Check | Status | Observation | Oracle |
|---|---|---|---|
| Existing Pages workflow/contract inspection | PASS | Current staging policy and required files/build token inspected | Existing repository deployment contract |
| Generated target collision check | PASS | 0 collisions with authored `docs/` files | Current main recursive tree |
| `docs/index.html` exists | PASS | Connector fetch from PR head | Required Pages root |
| `docs/index.html` has shared build token | PASS | Connector content inspection | Existing build token |
| `docs/main-rhbg-fitguard.js` exists/build token | PASS | Connector content inspection | Existing runtime graph |
| `docs/tabs/psnm-utility-pages-entry.js` exists/build token | PASS | Connector content inspection | Existing Pages entry contract |
| `docs/.nojekyll` exists | PASS | Connector fetch from PR head | Branch Pages static-serving requirement |
| Generated manifest integrity | PASS | 2,999 entries; includes index, Pages entry, .nojekyll | Build-script contract |
| Local Node execution of build script | NOT_RUN | Connector-only repository access | Runtime execution |
| Deployed browser smoke | NOT_RUN | PR is not merged/deployed | Deployed site |

## Risks

1. The repository is private while the GitHub Pages site is public. Branch/`docs` publication exposes every committed file under `docs/`.
2. The existing `.github/workflows/deploy.yml` remains unchanged. After switching Pages source to branch/`docs`, that Actions deployment route may become redundant or produce non-authoritative/failing runs; workflow cleanup is intentionally outside this PR because workflow mutation was not requested.
3. Branch-source publication cannot embed its own final commit SHA in a committed marker without a post-commit generation mechanism. `pages-deployment.json` therefore records the source snapshot SHA used to create the generated tree rather than claiming a self-referential deployed commit SHA.

## Merge authority

OWNER_ONLY. Do not merge without explicit owner authorization.

## EXACT_NEXT_ACTION

Owner reviews and merges PR #1231. Then in repository **Settings > Pages**, select **Deploy from a branch**, choose **main** and **/docs**, click **Save**, wait for the Pages build/deployment to complete, and perform a deployed-browser smoke check of the project Pages URL and runtime build token.
