# SQL Scripts

This directory contains SQL maintenance scripts for the WOTA database.

## Script Versions

There are three versions of the update script to choose from:

### update-last-activated.sql (Standard - Uses Temporary Tables)

**Purpose**: Updates the `summits` table with the latest activation date and activator callsign from the `activator_log` table.

**Approach**: Uses a temporary table to store intermediate results, then updates.

**Pros**:
- Easier to read and debug
- Better performance on very large datasets
- Can inspect intermediate results

**Cons**:
- Requires CREATE TEMPORARY TABLE permission

### update-last-activated-no-temp.sql (No Temporary Tables)

**Purpose**: Same functionality as the standard version, but without temporary tables.

**Approach**: Uses a single UPDATE statement with nested subqueries.

**Pros**:
- No special permissions needed
- Works in restricted database environments
- Simpler execution (one statement)

**Cons**:
- Slightly harder to debug if issues occur
- May be marginally slower on very large datasets

**Recommended when**:
- Your database user doesn't have temporary table permissions
- Running in a managed/restricted database environment
- You prefer a single-statement approach

### update-last-activated-detailed.sql (Comprehensive Reporting)

**Purpose**: Enhanced version with comprehensive reporting and validation.

**Approach**: Uses temporary tables with extensive before/after reporting.

**Pros**:
- Detailed visibility into changes
- Creates backup before updating
- Shows never-activated summits
- Validates success

**Cons**:
- Takes slightly longer due to reporting
- Requires temporary table permissions

## How to Run Any Version

**Using MySQL Command Line:**
```bash
# Standard version
mysql -h hostname -u username -p database_name < sql/update-last-activated.sql

# No-temp version
mysql -h hostname -u username -p database_name < sql/update-last-activated-no-temp.sql

# Detailed version
mysql -h hostname -u username -p database_name < sql/update-last-activated-detailed.sql
```

**Using Environment Variables:**
```bash
mysql -h hosting09.layerip.com \
      -u wotaorgu_wotadb_adif \
      -p \
      wotaorgu_wotadb < sql/update-last-activated-no-temp.sql
```

**Using MySQL Workbench or Similar Tool:**
1. Open the SQL file in your database tool
2. Execute the script

## What They Do

For each summit in the database:
1. Finds the most recent activation date from `activator_log`
2. Gets the callsign of the activator from that activation
3. Updates `last_act_by` and `last_act_date` in the `summits` table

## When to Use

Run these scripts when:
- You've imported a large batch of historical activator logs
- The `last_act_by` or `last_act_date` fields in the `summits` table are out of sync
- You want to rebuild the "last activated" information from scratch

## Output

### Standard and No-Temp Versions
- Number of summits updated
- Sample of the 10 most recently activated summits

### Detailed Version

In addition to the basic update, this script:
- Creates a backup of current data before updating
- Shows before/after statistics
- Reports on what changed
- Displays recently activated summits
- Shows summits that were never activated
- Validates the update was successful

**Output Sections:**
1. BEFORE UPDATE - Current state of the database
2. ACTIVATION COUNTS - Statistics about activations
3. LATEST ACTIVATIONS FOUND - How many latest activations were identified
4. UPDATE COMPLETED - Confirmation message
5. AFTER UPDATE - State after the update
6. CHANGES DETECTED - Summary of changes made
7. RECENTLY ACTIVATED SUMMITS - Top 20 recently activated
8. CHANGED SUMMITS - Sample of summits that were updated
9. NEVER ACTIVATED SUMMITS - Summits with no activations

## Which Version Should I Use?

**Quick Decision Guide:**

| Scenario | Recommended Version |
|----------|---------------------|
| First time running the update | `update-last-activated-detailed.sql` |
| Regular maintenance | `update-last-activated.sql` |
| Restricted database permissions | `update-last-activated-no-temp.sql` |
| Need to verify what changed | `update-last-activated-detailed.sql` |
| Running via automated script | `update-last-activated-no-temp.sql` |
| Debugging issues | `update-last-activated-detailed.sql` |
| Production quick fix | `update-last-activated-no-temp.sql` |

## Notes

### Safe to Re-run

Both scripts are safe to run multiple times. They will:
- Find the current latest activation each time
- Update only if the data has changed
- Not duplicate or corrupt existing data

### Performance

- The scripts create temporary tables for efficiency
- On a database with thousands of activations, expect runtime of 1-5 seconds
- The detailed version takes slightly longer due to additional reporting

### Edge Cases Handled

1. **Multiple activations on same date**: Picks the activation with the highest ID
2. **Summits with no activations**: Leaves `last_act_by` and `last_act_date` as NULL
3. **Portable suffixes**: Uses the `callused` field which has /P and /M suffixes stripped

## Schema Reference

### activator_log table
- `wotaid` - Summit ID
- `callused` - Activator callsign (cleaned, no /P or /M)
- `date` - Activation date
- `id` - Unique log entry ID

### summits table
- `wotaid` - Summit ID (primary key)
- `name` - Summit name
- `last_act_by` - Most recent activator callsign
- `last_act_date` - Most recent activation date

## Troubleshooting

### "Table doesn't exist" error
Make sure you're connected to the correct database (wotaorgu_wotadb).

### No summits updated
Check that the `activator_log` table has data:
```sql
SELECT COUNT(*) FROM activator_log;
```

### Permissions error
Ensure your database user has UPDATE permissions on the `summits` table.

### Want to undo changes?
The detailed script creates a backup in a temporary table during execution, but it's dropped at the end. To keep a permanent backup:
```sql
CREATE TABLE summits_backup_20260109 AS
SELECT * FROM summits;
```
