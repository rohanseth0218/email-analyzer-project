-- Find email domains that are NOT in storeleads database
-- Run this in BigQuery console at: https://console.cloud.google.com/bigquery?project=instant-ground-394115
-- NOTE: Handles domain normalization (removes www., https://, http://) to fix matching issues

-- Main query: Email domains not in storeleads, ordered by email count
WITH email_domains AS (
    SELECT 
        DISTINCT LOWER(TRIM(sender_domain)) as sender_domain,
        -- Normalize domain: remove www., https://, http://
        REGEXP_REPLACE(
            REGEXP_REPLACE(
                REGEXP_REPLACE(
                    LOWER(TRIM(sender_domain)), 
                    r'^https?://', ''
                ), 
                r'^www\.', ''
            ),
            r'/$', ''
        ) as normalized_domain,
        COUNT(*) as email_count
    FROM `instant-ground-394115.email_analytics.marketing_emails_clean_20250612_082945`
    WHERE sender_domain IS NOT NULL AND sender_domain != ''
    GROUP BY LOWER(TRIM(sender_domain))
),
storeleads_domains AS (
    SELECT 
        DISTINCT LOWER(TRIM(store_id)) as store_id,
        -- Normalize domain: remove www., https://, http://
        REGEXP_REPLACE(
            REGEXP_REPLACE(
                REGEXP_REPLACE(
                    LOWER(TRIM(store_id)), 
                    r'^https?://', ''
                ), 
                r'^www\.', ''
            ),
            r'/$', ''
        ) as normalized_domain
    FROM `instant-ground-394115.email_analytics.storeleads`
    WHERE store_id IS NOT NULL AND store_id != ''
),
domains_not_in_storeleads AS (
    SELECT 
        e.sender_domain,
        e.normalized_domain as email_normalized_domain,
        e.email_count
    FROM email_domains e
    LEFT JOIN storeleads_domains s ON e.normalized_domain = s.normalized_domain
    WHERE s.normalized_domain IS NULL
)
SELECT 
    sender_domain,
    email_normalized_domain,
    email_count,
    -- Add rank for easy filtering
    ROW_NUMBER() OVER (ORDER BY email_count DESC) as rank_by_emails
FROM domains_not_in_storeleads
ORDER BY email_count DESC;

-- Summary stats (with domain normalization)
SELECT 
    'SUMMARY' as metric,
    COUNT(*) as total_domains_not_in_storeleads,
    SUM(email_count) as total_emails_from_these_domains,
    ROUND(AVG(email_count), 1) as avg_emails_per_domain,
    MAX(email_count) as max_emails_from_single_domain
FROM (
    WITH email_domains AS (
        SELECT 
            DISTINCT LOWER(TRIM(sender_domain)) as sender_domain,
            REGEXP_REPLACE(
                REGEXP_REPLACE(
                    REGEXP_REPLACE(
                        LOWER(TRIM(sender_domain)), 
                        r'^https?://', ''
                    ), 
                    r'^www\.', ''
                ),
                r'/$', ''
            ) as normalized_domain,
            COUNT(*) as email_count
        FROM `instant-ground-394115.email_analytics.marketing_emails_clean_20250612_082945`
        WHERE sender_domain IS NOT NULL AND sender_domain != ''
        GROUP BY LOWER(TRIM(sender_domain))
    ),
    storeleads_domains AS (
        SELECT 
            DISTINCT LOWER(TRIM(store_id)) as store_id,
            REGEXP_REPLACE(
                REGEXP_REPLACE(
                    REGEXP_REPLACE(
                        LOWER(TRIM(store_id)), 
                        r'^https?://', ''
                    ), 
                    r'^www\.', ''
                ),
                r'/$', ''
            ) as normalized_domain
        FROM `instant-ground-394115.email_analytics.storeleads`
        WHERE store_id IS NOT NULL AND store_id != ''
    )
    SELECT 
        e.sender_domain,
        e.email_count
    FROM email_domains e
    LEFT JOIN storeleads_domains s ON e.normalized_domain = s.normalized_domain
    WHERE s.normalized_domain IS NULL
);

-- Top 50 domains by email count (most valuable) - with domain normalization
WITH email_domains AS (
    SELECT 
        DISTINCT LOWER(TRIM(sender_domain)) as sender_domain,
        REGEXP_REPLACE(
            REGEXP_REPLACE(
                REGEXP_REPLACE(
                    LOWER(TRIM(sender_domain)), 
                    r'^https?://', ''
                ), 
                r'^www\.', ''
            ),
            r'/$', ''
        ) as normalized_domain,
        COUNT(*) as email_count
    FROM `instant-ground-394115.email_analytics.marketing_emails_clean_20250612_082945`
    WHERE sender_domain IS NOT NULL AND sender_domain != ''
    GROUP BY LOWER(TRIM(sender_domain))
),
storeleads_domains AS (
    SELECT 
        DISTINCT LOWER(TRIM(store_id)) as store_id,
        REGEXP_REPLACE(
            REGEXP_REPLACE(
                REGEXP_REPLACE(
                    LOWER(TRIM(store_id)), 
                    r'^https?://', ''
                ), 
                r'^www\.', ''
            ),
            r'/$', ''
        ) as normalized_domain
    FROM `instant-ground-394115.email_analytics.storeleads`
    WHERE store_id IS NOT NULL AND store_id != ''
)
SELECT 
    ROW_NUMBER() OVER (ORDER BY e.email_count DESC) as rank,
    e.sender_domain,
    e.normalized_domain as email_normalized_domain,
    e.email_count
FROM email_domains e
LEFT JOIN storeleads_domains s ON e.normalized_domain = s.normalized_domain
WHERE s.normalized_domain IS NULL
ORDER BY e.email_count DESC
LIMIT 50;

-- BONUS: Show examples of domain normalization in action
SELECT 
    'DOMAIN_EXAMPLES' as info,
    'Original vs Normalized' as description;

-- Show some examples of how domains get normalized
WITH examples AS (
    SELECT sender_domain as original_domain,
           REGEXP_REPLACE(
               REGEXP_REPLACE(
                   REGEXP_REPLACE(
                       LOWER(TRIM(sender_domain)), 
                       r'^https?://', ''
                   ), 
                   r'^www\.', ''
               ),
               r'/$', ''
           ) as normalized_domain
    FROM `instant-ground-394115.email_analytics.marketing_emails_clean_20250612_082945`
    WHERE sender_domain IS NOT NULL 
    AND (LOWER(sender_domain) LIKE '%www.%' 
         OR LOWER(sender_domain) LIKE 'http%')
    LIMIT 10
)
SELECT 
    original_domain,
    normalized_domain,
    CASE 
        WHEN original_domain != normalized_domain THEN 'CHANGED'
        ELSE 'NO_CHANGE'
    END as status
FROM examples; 