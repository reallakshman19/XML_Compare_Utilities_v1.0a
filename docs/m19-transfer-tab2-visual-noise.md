# M19 Transfer Tab 2 visual noise reduction

Purpose: reduce the boxed and striped appearance in Transfer and Compare Tab 2.

Delivered:
- Added a small override stylesheet loaded after the M18 dashboard CSS.
- Flattened dashboard cards into compact status pills.
- Hidden verbose dashboard card detail text from the top view.
- Removed sticky output strip behavior.
- Reduced action buttons to compact pills.
- Removed action icon circles.
- Kept detailed evidence available in collapsible sections.

User check:
- Hard refresh the app.
- Open XML Compare, then Transfer and Compare Review, then Tab 2.
- The top view should show a compact status strip, not many small boxes.
