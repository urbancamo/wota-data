-- Check for existing activations for M5TEA on LDO-093 on 2025-11-26
-- This helps debug duplicate detection issues

-- Find wotaid for LDO-093 (should be 307 = 214 + 93)
SELECT wotaid, name FROM summits WHERE wotaid = 307;

-- Check all activations by M5TEA on 2025-11-26 for this summit
SELECT
    id,
    activatedby,
    callused,
    wotaid,
    date,
    time,
    stncall,
    band,
    mode,
    confirmed
FROM activator_log
WHERE activatedby = 'M5TEA'
  AND date = '2025-11-26'
  AND wotaid = 307
ORDER BY time;

-- Check if there are any G8CPZ contacts
SELECT
    id,
    activatedby,
    callused,
    wotaid,
    date,
    time,
    stncall,
    band,
    mode,
    confirmed
FROM activator_log
WHERE activatedby = 'M5TEA'
  AND date = '2025-11-26'
  AND wotaid = 307
  AND stncall = 'G8CPZ'
ORDER BY time;
