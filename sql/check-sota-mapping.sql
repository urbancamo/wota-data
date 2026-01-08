-- Check SOTA to WOTA mapping for G/LD-053
-- The issue is: G/LD-053 is mapping to wotaid 165 instead of 297

-- Find what's currently mapped to sotaid = 53
SELECT
    wotaid,
    sotaid,
    name,
    CASE
        WHEN wotaid <= 214 THEN CONCAT('LDW-', LPAD(wotaid, 3, '0'))
        ELSE CONCAT('LDO-', LPAD(wotaid - 214, 3, '0'))
    END AS wota_ref
FROM summits
WHERE sotaid = 53;

-- Find what summit has wotaid = 297 (the expected WOTA ID)
SELECT
    wotaid,
    sotaid,
    name,
    CASE
        WHEN wotaid <= 214 THEN CONCAT('LDW-', LPAD(wotaid, 3, '0'))
        ELSE CONCAT('LDO-', LPAD(wotaid - 214, 3, '0'))
    END AS wota_ref
FROM summits
WHERE wotaid = 297;

-- Find what summit has wotaid = 165 (the incorrect mapping)
SELECT
    wotaid,
    sotaid,
    name,
    CASE
        WHEN wotaid <= 214 THEN CONCAT('LDW-', LPAD(wotaid, 3, '0'))
        ELSE CONCAT('LDO-', LPAD(wotaid - 214, 3, '0'))
    END AS wota_ref
FROM summits
WHERE wotaid = 165;
