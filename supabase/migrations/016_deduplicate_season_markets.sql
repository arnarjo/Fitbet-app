-- Remove duplicate open season_markets, keep the oldest per (league_name, market_type)
DELETE FROM season_markets
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY league_name, market_type, status
        ORDER BY created_at ASC
      ) AS rn
    FROM season_markets
    WHERE status = 'open'
  ) ranked
  WHERE rn > 1
);

-- Prevent future duplicates: only one open market per league+type
CREATE UNIQUE INDEX IF NOT EXISTS season_markets_open_unique
  ON season_markets (league_name, market_type)
  WHERE status = 'open';
