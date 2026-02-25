# Implementation plan.

## Implementation Plan for Spots & Alerts Panel

Based on my analysis of both codebases, here's what needs to be built:

### 1. Backend: Add DELETE endpoints for spots and alerts
- `DELETE /data/api/spots/:id` - with server-side ownership check (user's callsign matches `spotter`, or user is admin)
- `DELETE /data/api/alerts/:id` - with server-side ownership check (user's callsign matches `postedby`, or user is admin)
- Enhance the existing `GET /data/api/spots` and `GET /data/api/alerts` to join summit names

### 2. Frontend API client: Add spots, alerts, and delete methods
- `getSpots()` - fetch spots
- `getAlerts()` - fetch alerts
- `deleteSpot(id)` - delete a spot
- `deleteAlert(id)` - delete an alert

### 3. New Vue component: `SpotsAlertsPanel.vue`
- Two-column layout: Alerts (left), Spots (right) - stacks on mobile
- **Spots**: Reverse chronological, filtered to today only, 30-min "recent" green highlight
- **Alerts**: Future alerts only, deduplicated by `call+wotaid+freqmode` (keep highest ID), sorted soonest-first, today's alerts get green highlight
- Each item shows: callsign (link to QRZ), datetime, WOTA tag, SOTA tag (if applicable), freqmode tag, summit name, comment, spotter/postedby
- Delete button shown for own entries or if admin, with confirmation dialog
- 60-second auto-refresh

### 4. Layout change in `App.vue`
- Add `SpotsAlertsPanel` where `StatisticsPanel` currently sits (top of Statistics tab)
- Move `StatisticsPanel` below `LeagueTablesPanel` (bottom of the tab)

**Dependencies to Install:** None

**Test Strategy:** Vitest unit tests for filtering/dedup logic and API client methods

I've prepared the above implementation plan. Please review and confirm before I proceed with execution.