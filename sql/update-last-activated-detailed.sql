-- Enhanced script to update summits table with latest activation information
-- Includes backup, validation, and detailed reporting

-- ============================================================================
-- PART 1: PRE-UPDATE VALIDATION AND BACKUP
-- ============================================================================

-- Show current state before update
SELECT 'BEFORE UPDATE - Summary' as report_section;
SELECT
    COUNT(*) as total_summits,
    COUNT(last_act_by) as summits_with_activator,
    COUNT(last_act_date) as summits_with_date
FROM summits;

-- Create backup of current last activation data
DROP TEMPORARY TABLE IF EXISTS summits_backup;
CREATE TEMPORARY TABLE summits_backup AS
SELECT
    wotaid,
    last_act_by,
    last_act_date
FROM summits;

SELECT 'Backup created' as status;

-- Show how many activations exist per summit
SELECT 'ACTIVATION COUNTS' as report_section;
SELECT
    COUNT(DISTINCT wotaid) as summits_with_activations,
    COUNT(*) as total_activations,
    AVG(activation_count) as avg_activations_per_summit
FROM (
    SELECT
        wotaid,
        COUNT(*) as activation_count
    FROM activator_log
    GROUP BY wotaid
) counts;

-- ============================================================================
-- PART 2: FIND LATEST ACTIVATIONS
-- ============================================================================

DROP TEMPORARY TABLE IF EXISTS latest_activations;

CREATE TEMPORARY TABLE latest_activations AS
SELECT
    al.wotaid,
    al.callused as latest_activator,
    al.date as latest_date,
    al.id as log_id
FROM activator_log al
INNER JOIN (
    -- Find the latest date for each summit
    SELECT
        wotaid,
        MAX(date) as max_date
    FROM activator_log
    GROUP BY wotaid
) latest ON al.wotaid = latest.wotaid AND al.date = latest.max_date
-- If multiple activations on same date, pick the one with highest ID
INNER JOIN (
    SELECT
        wotaid,
        date,
        MAX(id) as max_id
    FROM activator_log al2
    INNER JOIN (
        SELECT wotaid, MAX(date) as max_date
        FROM activator_log
        GROUP BY wotaid
    ) latest2 ON al2.wotaid = latest2.wotaid AND al2.date = latest2.max_date
    GROUP BY wotaid, date
) latest_with_id ON al.wotaid = latest_with_id.wotaid
                  AND al.date = latest_with_id.date
                  AND al.id = latest_with_id.max_id;

-- Show statistics about what we found
SELECT 'LATEST ACTIVATIONS FOUND' as report_section;
SELECT COUNT(*) as summits_with_latest_activation FROM latest_activations;

-- ============================================================================
-- PART 3: UPDATE SUMMITS TABLE
-- ============================================================================

UPDATE summits s
INNER JOIN latest_activations la ON s.wotaid = la.wotaid
SET
    s.last_act_by = la.latest_activator,
    s.last_act_date = la.latest_date;

SELECT 'UPDATE COMPLETED' as status;

-- ============================================================================
-- PART 4: POST-UPDATE VALIDATION AND REPORTING
-- ============================================================================

-- Show current state after update
SELECT 'AFTER UPDATE - Summary' as report_section;
SELECT
    COUNT(*) as total_summits,
    COUNT(last_act_by) as summits_with_activator,
    COUNT(last_act_date) as summits_with_date
FROM summits;

-- Show changes made
SELECT 'CHANGES DETECTED' as report_section;
SELECT
    COUNT(*) as total_changes,
    SUM(CASE WHEN sb.last_act_by IS NULL AND s.last_act_by IS NOT NULL THEN 1 ELSE 0 END) as new_activations,
    SUM(CASE WHEN sb.last_act_by IS NOT NULL AND sb.last_act_by != s.last_act_by THEN 1 ELSE 0 END) as activator_changed,
    SUM(CASE WHEN sb.last_act_date IS NOT NULL AND sb.last_act_date != s.last_act_date THEN 1 ELSE 0 END) as date_changed
FROM summits s
LEFT JOIN summits_backup sb ON s.wotaid = sb.wotaid
WHERE s.last_act_by IS NOT NULL;

-- Show recently activated summits (top 20)
SELECT 'RECENTLY ACTIVATED SUMMITS' as report_section;
SELECT
    s.wotaid,
    s.name,
    s.last_act_by as activator,
    s.last_act_date as last_activation,
    DATEDIFF(CURDATE(), s.last_act_date) as days_ago
FROM summits s
WHERE s.last_act_date IS NOT NULL
ORDER BY s.last_act_date DESC
LIMIT 20;

-- Show summits that had their data changed
SELECT 'CHANGED SUMMITS (SAMPLE)' as report_section;
SELECT
    s.wotaid,
    s.name,
    sb.last_act_by as old_activator,
    s.last_act_by as new_activator,
    sb.last_act_date as old_date,
    s.last_act_date as new_date
FROM summits s
INNER JOIN summits_backup sb ON s.wotaid = sb.wotaid
WHERE (sb.last_act_by IS NULL AND s.last_act_by IS NOT NULL)
   OR (sb.last_act_by != s.last_act_by)
   OR (sb.last_act_date != s.last_act_date)
LIMIT 20;

-- Show summits never activated
SELECT 'NEVER ACTIVATED SUMMITS' as report_section;
SELECT
    s.wotaid,
    s.name,
    s.height,
    s.reference
FROM summits s
WHERE s.last_act_by IS NULL
ORDER BY s.height DESC
LIMIT 10;

-- ============================================================================
-- PART 5: CLEANUP
-- ============================================================================

DROP TEMPORARY TABLE IF EXISTS latest_activations;
DROP TEMPORARY TABLE IF EXISTS summits_backup;

SELECT 'Script completed successfully' as status;
