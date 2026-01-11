-- Update summits table with the latest activation date and activator from activator_log
-- This version uses a direct UPDATE with subqueries instead of temporary tables
-- Useful for environments where temporary table creation is restricted

-- Single UPDATE statement with subquery to find latest activation per summit
UPDATE summits s
INNER JOIN (
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
    -- If multiple activations on same date, pick the one with highest ID
    INNER JOIN (
        SELECT
            al2.wotaid,
            al2.date,
            MAX(al2.id) as max_id
        FROM activator_log al2
        INNER JOIN (
            SELECT wotaid, MAX(date) as max_date
            FROM activator_log
            GROUP BY wotaid
        ) latest2 ON al2.wotaid = latest2.wotaid AND al2.date = latest2.max_date
        GROUP BY al2.wotaid, al2.date
    ) latest_with_id ON al.wotaid = latest_with_id.wotaid
                      AND al.date = latest_with_id.date
                      AND al.id = latest_with_id.max_id
) latest_activations ON s.wotaid = latest_activations.wotaid
SET
    s.last_act_by = latest_activations.callused,
    s.last_act_date = latest_activations.date;

-- Report on the results
SELECT
    'Update completed' as status,
    COUNT(*) as summits_with_last_activation
FROM summits
WHERE last_act_by IS NOT NULL;

-- Show some examples of updated summits
SELECT
    s.wotaid,
    s.name,
    s.last_act_by,
    s.last_act_date,
    DATEDIFF(CURDATE(), s.last_act_date) as days_ago
FROM summits s
WHERE s.last_act_by IS NOT NULL
ORDER BY s.last_act_date DESC
LIMIT 10;
