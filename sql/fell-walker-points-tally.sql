-- Fell Walker Points Tally
-- Calculates unique fells (summits) activated by a callsign for a specified year
--
-- Usage:
--   Replace @callsign with the activator's callsign
--   Replace @year with the year to calculate points for

-- Set parameters (modify these values)
SET @callsign = 'M5TEA';
SET @year = 2025;

-- Summary: Total unique fells activated
SELECT
    @callsign AS activator,
    @year AS year,
    COUNT(DISTINCT wotaid) AS fell_walker_points,
    COUNT(*) AS total_activations,
    MIN(date) AS first_activation,
    MAX(date) AS last_activation
FROM activator_log
WHERE activatedby = @callsign
  AND year = @year
GROUP BY activatedby, year;

-- Detailed list: Show each unique fell activated with first activation date
SELECT
    al.wotaid,
    CASE
        WHEN al.wotaid <= 214 THEN CONCAT('LDW-', LPAD(al.wotaid, 3, '0'))
        ELSE CONCAT('LDO-', LPAD(al.wotaid - 214, 3, '0'))
    END AS wota_ref,
    COALESCE(s.name, 'Unknown') AS summit_name,
    MIN(al.date) AS first_activation_date,
    COUNT(*) AS activation_count
FROM activator_log al
LEFT JOIN summits s ON al.wotaid = s.wotaid
WHERE al.activatedby = @callsign
  AND al.year = @year
GROUP BY al.wotaid, s.name
ORDER BY first_activation_date, al.wotaid;

-- Alternative: Show all activations with QSO counts
SELECT
    al.date,
    CASE
        WHEN al.wotaid <= 214 THEN CONCAT('LDW-', LPAD(al.wotaid, 3, '0'))
        ELSE CONCAT('LDO-', LPAD(al.wotaid - 214, 3, '0'))
    END AS wota_ref,
    COALESCE(s.name, 'Unknown') AS summit_name,
    COUNT(*) AS qso_count,
    GROUP_CONCAT(DISTINCT al.stncall ORDER BY al.time SEPARATOR ', ') AS stations_worked
FROM activator_log al
LEFT JOIN summits s ON al.wotaid = s.wotaid
WHERE al.activatedby = @callsign
  AND al.year = @year
GROUP BY al.date, al.wotaid, s.name
ORDER BY al.date, al.wotaid;

-- All-time fell walker points (for comparison)
SELECT
    @callsign AS activator,
    'All-time' AS period,
    COUNT(DISTINCT wotaid) AS fell_walker_points,
    COUNT(*) AS total_activations,
    MIN(year) AS first_year,
    MAX(year) AS last_year
FROM activator_log
WHERE activatedby = @callsign
GROUP BY activatedby;

-- Year-by-year breakdown
SELECT
    year,
    COUNT(DISTINCT wotaid) AS unique_fells,
    COUNT(*) AS total_activations,
    COUNT(DISTINCT DATE(date)) AS activation_days
FROM activator_log
WHERE activatedby = @callsign
GROUP BY year
ORDER BY year DESC;
