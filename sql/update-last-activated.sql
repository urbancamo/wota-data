-- Update summits table with the latest activation date and activator from activator_log
-- This script finds the most recent activation for each summit and updates the last_act_by and last_act_date fields

-- Step 1: Create a temporary table with the latest activation per summit
-- This handles cases where there might be multiple activations on the same date by selecting one arbitrarily
DROP TEMPORARY TABLE IF EXISTS latest_activations;

CREATE TEMPORARY TABLE latest_activations AS
SELECT
    al.wotaid,
    al.callused,
    al.date
FROM activator_log al
INNER JOIN (
    -- Find the latest date for each summit
    SELECT
        wotaid,
        MAX(date) as max_date
    FROM activator_log
    GROUP BY wotaid
) latest ON al.wotaid = latest.wotaid AND al.date = latest.max_date
GROUP BY al.wotaid, al.callused, al.date;

-- Step 2: Update the summits table using the temporary table
UPDATE summits s
INNER JOIN latest_activations la ON s.wotaid = la.wotaid
SET
    s.last_act_by = la.callused,
    s.last_act_date = la.date;

-- Step 3: Report on the updates
SELECT
    COUNT(*) as summits_updated
FROM summits
WHERE last_act_by IS NOT NULL;

-- Optional: Show some examples of updated summits
SELECT
    s.wotaid,
    s.name,
    s.last_act_by,
    s.last_act_date
FROM summits s
WHERE s.last_act_by IS NOT NULL
ORDER BY s.last_act_date DESC
LIMIT 10;

-- Clean up
DROP TEMPORARY TABLE IF EXISTS latest_activations;
