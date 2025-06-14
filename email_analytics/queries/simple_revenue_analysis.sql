-- Simple Revenue Band Analysis
-- Count brands with emails by revenue ranges

SELECT 
  CASE 
    WHEN s.estimated_sales_yearly / 100 < 100000 THEN '< $100K'
    WHEN s.estimated_sales_yearly / 100 < 500000 THEN '$100K - $500K'
    WHEN s.estimated_sales_yearly / 100 < 1000000 THEN '$500K - $1M'
    WHEN s.estimated_sales_yearly / 100 < 5000000 THEN '$1M - $5M'
    WHEN s.estimated_sales_yearly / 100 < 10000000 THEN '$5M - $10M'
    WHEN s.estimated_sales_yearly / 100 < 50000000 THEN '$10M - $50M'
    WHEN s.estimated_sales_yearly / 100 >= 50000000 THEN '$50M+'
    ELSE 'Unknown'
  END AS revenue_band,
  COUNT(DISTINCT s.platform_domain) AS brands_with_emails,
  ROUND(AVG(s.estimated_sales_yearly / 100), 0) AS avg_revenue
FROM `instant-ground-394115.email_analytics.storeleads` s
WHERE s.estimated_sales_yearly IS NOT NULL 
  AND s.estimated_sales_yearly > 0
  AND EXISTS (
    SELECT 1 
    FROM `instant-ground-394115.email_analytics.marketing_emails_clean_20250612_082945` e
    WHERE REGEXP_EXTRACT(e.sender_email, r'@(.+)') = s.platform_domain
       OR REGEXP_EXTRACT(e.sender_email, r'@(.+)') = REGEXP_REPLACE(s.platform_domain, r'^www\.', '')
       OR REGEXP_EXTRACT(e.sender_email, r'@(.+)') = CONCAT('www.', s.platform_domain)
  )
GROUP BY revenue_band
ORDER BY 
  CASE revenue_band
    WHEN '< $100K' THEN 1
    WHEN '$100K - $500K' THEN 2
    WHEN '$500K - $1M' THEN 3
    WHEN '$1M - $5M' THEN 4
    WHEN '$5M - $10M' THEN 5
    WHEN '$10M - $50M' THEN 6
    WHEN '$50M+' THEN 7
    ELSE 8
  END; 