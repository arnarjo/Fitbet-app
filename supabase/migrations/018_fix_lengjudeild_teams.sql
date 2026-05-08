-- Fix Lengjudeild karla team names and remove wrong team

-- Rename Throttur Reykjavik → Þróttur Reykjavík
UPDATE teams SET name = 'Þróttur Reykjavík', short_name = 'ÞRÓ'
WHERE name = 'Throttur Reykjavik' AND league_name = 'Lengjudeild karla';

-- Rename HK Kopavogur → HK
UPDATE teams SET name = 'HK', short_name = 'HK'
WHERE name = 'HK Kopavogur' AND league_name = 'Lengjudeild karla';

-- Remove Víkingur Ólafsvík (13th team, not in league)
-- Safe: only deletes if no season_bets reference it
DELETE FROM teams
WHERE name = 'Víkingur Ólafsvík'
  AND league_name = 'Lengjudeild karla'
  AND id NOT IN (
    SELECT challenger_pick FROM season_bets WHERE challenger_pick IS NOT NULL
    UNION
    SELECT opponent_pick FROM season_bets WHERE opponent_pick IS NOT NULL
  );
