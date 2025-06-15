-- SQL script to merge newsletter signup data from v3 table into v2 table
-- Run this in BigQuery console at: https://console.cloud.google.com/bigquery?project=instant-ground-394115

-- First, check current row counts
SELECT 'v2_before_merge' as table_name, COUNT(*) as row_count 
FROM `instant-ground-394115.email_analytics.newsletter_signup_results_v2`
UNION ALL
SELECT 'v3_current' as table_name, COUNT(*) as row_count 
FROM `instant-ground-394115.email_analytics.newsletter_signup_results_v3`;

-- Check for any potential schema differences
SELECT 'v2_schema' as table_name, column_name, data_type 
FROM `instant-ground-394115.email_analytics.INFORMATION_SCHEMA.COLUMNS` 
WHERE table_name = 'newsletter_signup_results_v2'
UNION ALL
SELECT 'v3_schema' as table_name, column_name, data_type 
FROM `instant-ground-394115.email_analytics.INFORMATION_SCHEMA.COLUMNS` 
WHERE table_name = 'newsletter_signup_results_v3'
ORDER BY table_name, column_name;

-- Check for potential duplicates before merge
SELECT 
  COUNT(*) as potential_duplicates
FROM `instant-ground-394115.email_analytics.newsletter_signup_results_v3` v3
WHERE EXISTS (
  SELECT 1 
  FROM `instant-ground-394115.email_analytics.newsletter_signup_results_v2` v2
  WHERE v2.domain = v3.domain 
  AND v2.timestamp = v3.timestamp
);

-- First, let's see what columns each table has
SELECT 'v2_columns' as table_name, column_name, ordinal_position, data_type 
FROM `instant-ground-394115.email_analytics.INFORMATION_SCHEMA.COLUMNS` 
WHERE table_name = 'newsletter_signup_results_v2'
ORDER BY ordinal_position;

SELECT 'v3_columns' as table_name, column_name, ordinal_position, data_type 
FROM `instant-ground-394115.email_analytics.INFORMATION_SCHEMA.COLUMNS` 
WHERE table_name = 'newsletter_signup_results_v3'
ORDER BY ordinal_position;

-- Merge v3 data into v2 (mapping columns explicitly and providing NULLs for missing ones)
-- V2 has: domain, success, email_used, signup_timestamp, error_message, batch_id, industry, country, employee_count, run_id
-- V3 has: domain, success, email_used, signup_timestamp (perfect match for first 4 columns!)

INSERT INTO `instant-ground-394115.email_analytics.newsletter_signup_results_v2`
(domain, success, email_used, signup_timestamp, error_message, batch_id, industry, country, employee_count, run_id)
SELECT 
  domain,                       -- Direct match from v3
  success,                      -- Direct match from v3
  email_used,                   -- Direct match from v3
  signup_timestamp,             -- Direct match from v3
  NULL as error_message,        -- Not available in v3
  NULL as batch_id,             -- Not available in v3
  NULL as industry,             -- Not available in v3
  NULL as country,              -- Not available in v3
  NULL as employee_count,       -- Not available in v3
  NULL as run_id                -- Not available in v3
FROM `instant-ground-394115.email_analytics.newsletter_signup_results_v3`
WHERE NOT EXISTS (
  SELECT 1 
  FROM `instant-ground-394115.email_analytics.newsletter_signup_results_v2` v2
  WHERE v2.domain = `instant-ground-394115.email_analytics.newsletter_signup_results_v3`.domain
  AND v2.signup_timestamp = `instant-ground-394115.email_analytics.newsletter_signup_results_v3`.signup_timestamp
);

-- Check final row count after merge
SELECT 'v2_after_merge' as table_name, COUNT(*) as row_count 
FROM `instant-ground-394115.email_analytics.newsletter_signup_results_v2`;

-- After confirming successful merge, optionally drop the v3 table:
-- DROP TABLE `instant-ground-394115.email_analytics.newsletter_signup_results_v3`; 