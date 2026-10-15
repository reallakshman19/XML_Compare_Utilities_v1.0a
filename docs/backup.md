# Local Backup and Recovery

The backup utility preserves a file immediately before an edit. It is a local
recovery aid, not a replacement for a Git branch and commit.

## Save and inspect

Run the command from the repository root and provide a concrete planned action:

```powershell
node utils/backup.cjs save src/example.js "Plan to simplify validation errors"
node utils/backup.cjs list src/example.js
node utils/backup.cjs verify 123
node utils/backup.cjs diff 123
```

`save` copies bytes without text conversion and records:

- a unique filename containing the source path and local `dd_MM_yy_HH_mm` timestamp;
- a row in `.backups/plan-log_dd_MM_yy_HH_mm.md` beginning with `Plan to`;
- source path, byte size, timestamp, and SHA-256 checksum in `.backups/log.json`.

The utility rejects directories, missing files, paths outside this repository,
and backup paths that escape `.backups`. It never silently replaces a corrupt
log or an earlier backup.

## Restore

Inspect and verify before restoring:

```powershell
node utils/backup.cjs verify 123
node utils/backup.cjs diff 123
node utils/backup.cjs restore 123
```

Restore verifies the recorded checksum. If the current file differs, the
utility first creates another timestamped safety backup and plan-log entry. If
the file is already identical, restore makes no change.

Do not manually edit `.backups/log.json`. If it is damaged, preserve the whole
`.backups` directory and repair the log deliberately instead of resetting it.

## Pull or merge remote work safely

Backups are ignored by Git and remain only in this workspace. Before integrating
remote changes, preserve all intentional product changes in Git:

```powershell
git fetch --prune origin
git status --short --branch
git switch -c codex/<work>-main-sync-YYYYMMDD
git add <intentional-files>
git commit -m "chore: preserve local work before main sync"
git merge origin/main
```

Resolve conflicts deliberately, run the relevant real-data smoke or integration
tests, and review `git --no-pager diff origin/main...HEAD`. A fresh clone will
not contain `.backups`; retain the workspace separately if those recovery files
are needed.
