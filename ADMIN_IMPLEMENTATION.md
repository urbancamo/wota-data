# Admin User Implementation

## Overview

This document describes the admin user implementation that adds role-based access control with two user types: **user** and **admin**.

## Features

- **Admin User Detection**: Users whose usernames match entries in the `ADMIN_USERS` environment variable are automatically promoted to admin
- **Admin Menu**: Separate "Admin" menu button alongside the "Actions" menu (only visible to admins)
- **View Logs**: Admin-only functionality to view system logs from the database in a paginated table

## Backend Changes

### 1. Environment Configuration

**File**: `.env`

Added `ADMIN_USERS` environment variable:
```env
ADMIN_USERS="M5TEA"
```

- Comma-separated list of usernames (case-insensitive)
- Multiple admins can be specified: `ADMIN_USERS="admin,m6msw,m5tea"`

### 2. Session Type Updates

**File**: `server/types/express-session.d.ts`

Added `isAdmin` flag to session data:
```typescript
interface SessionData {
  userId?: number
  username?: string
  isAdmin?: boolean  // New field
}
```

### 3. Login Endpoint

**File**: `server/api.ts` (lines 98-114)

Updated login endpoint to check if user is admin:
```typescript
// Check if user is admin
const adminUsers = process.env.ADMIN_USERS?.split(',').map(u => u.trim().toUpperCase()) || []
const isAdmin = adminUsers.includes(user.username.toUpperCase())

// Set session data
req.session.userId = user.id
req.session.username = user.username
req.session.isAdmin = isAdmin

res.json({
  success: true,
  user: {
    id: user.id,
    username: user.username,
    isAdmin: isAdmin  // Included in response
  }
})
```

### 4. Session Endpoint

**File**: `server/api.ts` (lines 146-159)

Updated session check endpoint to return admin status:
```typescript
app.get('/data/api/auth/session', (req, res) => {
  if (req.session && req.session.userId) {
    res.json({
      authenticated: true,
      user: {
        id: req.session.userId,
        username: req.session.username,
        isAdmin: req.session.isAdmin || false  // Included in response
      }
    })
  } else {
    res.json({ authenticated: false })
  }
})
```

### 5. Admin Logs API Endpoint

**File**: `server/api.ts` (lines 1392-1436)

Created new admin-only endpoint to fetch logs:
```typescript
app.get('/data/api/admin/logs', requireAuth, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.session.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' })
    }

    // Parse pagination parameters
    const page = parseInt(req.query.page as string) || 1
    const pageSize = parseInt(req.query.pageSize as string) || 50
    const level = req.query.level as string | undefined
    const skip = (page - 1) * pageSize

    // Build where clause
    const whereClause: any = {}
    if (level) {
      whereClause.level = level
    }

    // Get total count
    const total = await prisma.log.count({ where: whereClause })

    // Get logs
    const logs = await prisma.log.findMany({
      where: whereClause,
      orderBy: { timestamp: 'desc' },
      skip,
      take: pageSize
    })

    res.json({
      logs,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    })
  } catch (error) {
    logger.error({ error, path: req.path, method: req.method, username: req.session?.username }, 'Error fetching logs')
    res.status(500).json({ error: 'Failed to fetch logs' })
  }
})
```

**Features**:
- Requires authentication (`requireAuth` middleware)
- Checks `isAdmin` flag in session
- Returns 403 Forbidden if user is not admin
- Supports pagination (page, pageSize)
- Supports filtering by log level
- Orders logs by timestamp (most recent first)

## Frontend Changes

### 1. User Interface Update

**File**: `src/composables/useAuth.ts`

Updated User interface and composable:
```typescript
interface User {
  id: number
  username: string
  isAdmin?: boolean  // New field
}

export function useAuth() {
  const isAuthenticated = computed(() => currentUser.value !== null)
  const username = computed(() => currentUser.value?.username || '')
  const isAdmin = computed(() => currentUser.value?.isAdmin || false)  // New computed

  return {
    currentUser,
    isAuthenticated,
    isChecking,
    error,
    username,
    isAdmin,  // Exported
    login,
    logout,
    checkSession,
  }
}
```

### 2. LogsView Component

**File**: `src/components/LogsView.vue`

Created new component to display logs in a table format:

**Features**:
- Fetches logs from `/data/api/admin/logs`
- Paginated view (50 logs per page by default)
- Filter by log level (All, Error, Warn, Info, Debug, Trace)
- Displays log information in columns:
  - Timestamp (formatted)
  - Level (color-coded tags)
  - Message
  - Username
  - Path
  - Method
  - Status Code
- Shows error messages inline for error logs
- Responsive design for mobile and desktop
- Empty state when no logs found

### 3. App.vue Updates

**File**: `src/App.vue`

#### Added Admin Button
```vue
<template #left>
  <div style="display: flex; gap: 8px;">
    <van-button
      size="small"
      type="primary"
      @click="showActions = true"
    >
      Actions
    </van-button>
    <van-button
      v-if="isAdmin"
      size="small"
      type="warning"
      @click="showAdminActions = true"
    >
      Admin
    </van-button>
  </div>
</template>
```

#### Added Admin Action Sheet
```typescript
const adminActions: ActionSheetAction[] = [
  { name: 'View Logs', subname: 'View system logs' },
]

function handleAdminActionSelect(action: ActionSheetAction, index: number) {
  showAdminActions.value = false

  switch (index) {
    case 0:
      // Navigate to Logs tab (tab index 3)
      activeView.value = 3
      break
  }
}
```

#### Added Logs Tab
```vue
<van-tab v-if="isAdmin" title="Logs">
  <LogsView />
</van-tab>
```

## Usage

### 1. Setting Up Admins

Edit `.env` file and add admin usernames:
```env
ADMIN_USERS="M5TEA,admin,user2"
```

- Usernames are case-insensitive
- Comma-separated for multiple admins
- Changes require server restart

### 2. Admin Access

When an admin user logs in:
1. They see an orange "Admin" button next to the "Actions" button in the navbar
2. Clicking "Admin" opens the admin action sheet
3. Selecting "View Logs" navigates to the Logs tab
4. The Logs tab is only visible to admin users

### 3. Viewing Logs

The Logs view provides:
- **Filter by Level**: Dropdown to filter by log level
- **Pagination**: Navigate through pages of logs
- **Stats Bar**: Shows total logs and current page
- **Log Table**: Displays log details in columns
  - Color-coded level tags
  - Formatted timestamps
  - Username, path, method, status code
  - Error messages highlighted in red

## Security Notes

1. **Server-Side Validation**: Admin status is checked on the server for every request to `/data/api/admin/logs`
2. **Session-Based**: Admin status is stored in the session and verified against the database user
3. **403 Forbidden**: Non-admin users receive a 403 error if they try to access admin endpoints
4. **UI Hidden**: Admin UI elements are hidden for non-admin users, but security is enforced server-side

## API Endpoints

### GET /data/api/admin/logs

**Authentication**: Required (session-based)
**Authorization**: Admin only
**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `pageSize` (optional): Logs per page (default: 50)
- `level` (optional): Filter by log level (error, warn, info, debug, trace)

**Response**:
```json
{
  "logs": [
    {
      "id": "123456789",
      "timestamp": "2026-01-09T17:59:21.050Z",
      "level": "info",
      "message": "User logged in",
      "context": {...},
      "hostname": "server-01",
      "pid": 12345,
      "request_id": "req-abc-123",
      "user_id": "1",
      "username": "M5TEA",
      "path": "/data/api/auth/login",
      "method": "POST",
      "status_code": 200,
      "error_message": null,
      "error_stack": null
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 50,
    "total": 1234,
    "totalPages": 25
  }
}
```

**Error Responses**:
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not an admin user
- `500 Internal Server Error`: Server error

## Testing

1. **Test Admin Access**:
   - Login with username "M5TEA" (or your configured admin)
   - Verify "Admin" button appears in navbar
   - Click "Admin" and select "View Logs"
   - Verify logs are displayed

2. **Test Non-Admin**:
   - Login with a non-admin username
   - Verify "Admin" button does NOT appear
   - Verify Logs tab is NOT visible
   - Try accessing `/data/api/admin/logs` directly (should get 403)

3. **Test Log Filtering**:
   - Select different log levels from dropdown
   - Verify filtered results
   - Test pagination with large log datasets

## Future Enhancements

Potential improvements:
- Additional admin actions (user management, system settings)
- More advanced log filtering (date range, username, path)
- Log export functionality
- Real-time log streaming
- Log search functionality
- Dashboard with log analytics and charts
