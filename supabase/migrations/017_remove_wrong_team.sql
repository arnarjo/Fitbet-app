-- Remove Víkingur Ólafsfirði from Lengjudeild karla (wrong team/division)
-- Safe delete: only if no season_bets reference this team
DELETE FROM teams
WHERE name = 'Víkingur Ólafsfirði'
  AND league_name = 'Lengjudeild karla'
  AND id NOT IN (
    SELECT challenger_pick FROM season_bets WHERE challenger_pick IS NOT NULL
    UNION
    SELECT opponent_pick FROM season_bets WHERE opponent_pick IS NOT NULL
  );
