# M18 Transfer dashboard CSS and build stamp

Purpose: make Transfer and Compare progress visibly verifiable after deployment.

Delivered:
- CSS for Transfer Output Dashboard cards.
- CSS for collapsible Transfer detail groups.
- Visible app build stamp in the top brand rail.
- Cache-busted app and CSS URLs.
- Regression test for dashboard CSS and build stamp markers.

User check after deployment:
- Hard refresh the live app.
- Confirm the top brand rail shows: Build M18 transfer-dashboard-css 2026-07-07.
- Open XML Compare, then Transfer and Compare Review, then Tab 2.
- Confirm dashboard cards are styled for Stage, Apply, Patched XML, Preflight, Diff, Ledger, and Exports.
