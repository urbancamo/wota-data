# Implementation Plan - Delete Contacts

## Changes Required

### 1. Backend: Add DELETE endpoint (`server/api.ts`)
- `POST /data/api/contacts/delete` - accepts `{ type: 'activator' | 'chaser', ids: number[] }`
- Requires auth via `requireAuth` middleware
- Validates ownership: user can only delete their own contacts (admin can delete any)
- Uses `$executeRaw` with parameterized query for bulk delete
- Returns count of deleted records

### 2. Frontend API client (`src/services/api.ts`)
- Add `deleteContacts(type, ids)` method

### 3. Frontend Component (`src/components/ContactsView.vue`)
- Add selection state: `selectedIds` ref (Set of contact IDs)
- Add toolbar above table with: Select All / Select None buttons, Action dropdown (Delete), Apply button
- Add checkbox column at the end of each row
- Confirmation dialog using Vant's `showConfirmDialog`
- On confirmed delete: call API, show success notification, refresh contacts
- Clear selection when page/filters change

## Implementation Order
1. Backend endpoint
2. API client method
3. ContactsView UI changes
