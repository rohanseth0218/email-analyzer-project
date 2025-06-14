-- Revenue Band Analysis: Number of brands with at least 1 email by revenue band
-- Joins marketing emails with storeleads data and groups by estimated revenue ranges

WITH revenue_bands AS (
  SELECT 
    platform_domain,
    estimated_sales_yearly / 100 AS estimated_revenue_dollars,
    CASE 
      WHEN estimated_sales_yearly / 100 < 100000 THEN '< $100K'
      WHEN estimated_sales_yearly / 100 < 500000 THEN '$100K - $500K'
      WHEN estimated_sales_yearly / 100 < 1000000 THEN '$500K - $1M'
      WHEN estimated_sales_yearly / 100 < 5000000 THEN '$1M - $5M'
      WHEN estimated_sales_yearly / 100 < 10000000 THEN '$5M - $10M'
      WHEN estimated_sales_yearly / 100 < 50000000 THEN '$10M - $50M'
      WHEN estimated_sales_yearly / 100 >= 50000000 THEN '$50M+'
      ELSE 'Unknown'
    END AS revenue_band
  FROM `instant-ground-394115.email_analytics.storeleads`
  WHERE estimated_sales_yearly IS NOT NULL
    AND estimated_sales_yearly > 0
),

brands_with_emails AS (
  SELECT DISTINCT
    REGEXP_EXTRACT(sender_email, r'@(.+)') AS domain
  FROM `instant-ground-394115.email_analytics.marketing_emails_clean_20250612_082945`
  WHERE sender_email IS NOT NULL
    AND sender_email != ''
    AND REGEXP_CONTAINS(sender_email, r'@.+\..+')
)

SELECT 
  rb.revenue_band,
  COUNT(DISTINCT rb.platform_domain) AS brands_with_emails,
  MIN(rb.estimated_revenue_dollars) AS min_revenue,
  MAX(rb.estimated_revenue_dollars) AS max_revenue,
  AVG(rb.estimated_revenue_dollars) AS avg_revenue
FROM revenue_bands rb
INNER JOIN brands_with_emails bwe 
  ON LOWER(rb.platform_domain) = LOWER(bwe.domain)
  OR LOWER(rb.platform_domain) = LOWER(CONCAT('www.', bwe.domain))
  OR LOWER(CONCAT('www.', rb.platform_domain)) = LOWER(bwe.domain)
GROUP BY rb.revenue_band
ORDER BY 
  CASE rb.revenue_band
    WHEN '< $100K' THEN 1
    WHEN '$100K - $500K' THEN 2
    WHEN '$500K - $1M' THEN 3
    WHEN '$1M - $5M' THEN 4
    WHEN '$5M - $10M' THEN 5
    WHEN '$10M - $50M' THEN 6
    WHEN '$50M+' THEN 7
    ELSE 8
  END; 