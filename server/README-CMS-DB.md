# CMS Database Integration Guide

This guide explains how to work with the CMS database in the WOTA ADIF application.

## Database Setup

The application uses two separate MySQL databases:

1. **WOTA Spotter Database** - Managed by Prisma ORM
   - Environment variable: `WOTA_DATABASE_URL`
   - Used for: Spots, Alerts, Summits, and log data

2. **CMS Database** - Accessed via mysql2 driver
   - Environment variable: `CMS_DATABASE_URL`
   - Used for: Main WOTA website data

## Using the CMS Database

### Import the Database Connection

```typescript
import { getCmsDb } from './db'
```

### Basic Query Example

```typescript
app.get('/api/cms/some-data', async (req, res) => {
  try {
    const cmsDb = getCmsDb()
    const [rows] = await cmsDb.query('SELECT * FROM your_table LIMIT 10')
    res.json(rows)
  } catch (error) {
    console.error('Error querying CMS database:', error)
    res.status(500).json({ error: 'Database query failed' })
  }
})
```

### Parameterized Query (Recommended)

Always use parameterized queries to prevent SQL injection:

```typescript
app.get('/api/cms/user/:id', async (req, res) => {
  try {
    const cmsDb = getCmsDb()
    const [rows] = await cmsDb.query(
      'SELECT * FROM users WHERE id = ?',
      [req.params.id]
    )
    res.json(rows)
  } catch (error) {
    console.error('Error querying CMS database:', error)
    res.status(500).json({ error: 'Database query failed' })
  }
})
```

### Insert Data

```typescript
app.post('/api/cms/create-record', async (req, res) => {
  try {
    const cmsDb = getCmsDb()
    const { name, value } = req.body

    const [result] = await cmsDb.query(
      'INSERT INTO your_table (name, value) VALUES (?, ?)',
      [name, value]
    )

    res.json({
      success: true,
      insertId: result.insertId
    })
  } catch (error) {
    console.error('Error inserting into CMS database:', error)
    res.status(500).json({ error: 'Insert failed' })
  }
})
```

### Update Data

```typescript
app.put('/api/cms/update/:id', async (req, res) => {
  try {
    const cmsDb = getCmsDb()
    const { name, value } = req.body

    const [result] = await cmsDb.query(
      'UPDATE your_table SET name = ?, value = ? WHERE id = ?',
      [name, value, req.params.id]
    )

    res.json({
      success: true,
      affectedRows: result.affectedRows
    })
  } catch (error) {
    console.error('Error updating CMS database:', error)
    res.status(500).json({ error: 'Update failed' })
  }
})
```

### Transaction Example

For operations that need to be atomic:

```typescript
app.post('/api/cms/transaction-example', async (req, res) => {
  const cmsDb = getCmsDb()
  const connection = await cmsDb.getConnection()

  try {
    await connection.beginTransaction()

    // First query
    await connection.query(
      'INSERT INTO table1 (data) VALUES (?)',
      [req.body.data1]
    )

    // Second query
    await connection.query(
      'INSERT INTO table2 (data) VALUES (?)',
      [req.body.data2]
    )

    await connection.commit()
    res.json({ success: true })

  } catch (error) {
    await connection.rollback()
    console.error('Transaction failed:', error)
    res.status(500).json({ error: 'Transaction failed' })
  } finally {
    connection.release()
  }
})
```

## Connection Pooling

The CMS database uses connection pooling by default:
- **Connection Limit**: 10 concurrent connections
- **Wait for Connections**: Yes
- **Queue Limit**: Unlimited

You can adjust these settings in `server/db.ts` if needed.

## TypeScript Types

For better type safety, define interfaces for your CMS data:

```typescript
interface CmsUser {
  id: number
  username: string
  email: string
  created_at: Date
}

app.get('/api/cms/users', async (req, res) => {
  try {
    const cmsDb = getCmsDb()
    const [rows] = await cmsDb.query<CmsUser[]>('SELECT * FROM users')
    res.json(rows)
  } catch (error) {
    console.error('Error:', error)
    res.status(500).json({ error: 'Query failed' })
  }
})
```

## Best Practices

1. **Always use parameterized queries** to prevent SQL injection
2. **Handle errors gracefully** with try/catch blocks
3. **Release connections** when using manual connection management
4. **Use transactions** for operations that must be atomic
5. **Define TypeScript interfaces** for your database tables
6. **Log errors** but don't expose internal details to clients

## Testing the Connection

Test the CMS database connection:

```bash
curl http://localhost:3001/api/cms/test
```

Expected response:
```json
{
  "status": "CMS database connected",
  "data": [{ "test": 1 }]
}
```

## Troubleshooting

### Connection Errors

If you see connection errors:

1. Check your `CMS_DATABASE_URL` in `.env`
2. Verify the database host is accessible
3. Ensure database credentials are correct
4. Check firewall settings if connecting to remote database

### Query Errors

- Verify table names and column names exist
- Check SQL syntax
- Ensure proper data types in queries
- Review error logs for specific issues