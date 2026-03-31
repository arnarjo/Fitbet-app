import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import type { Match } from '../types/database';

type Props = {
  match: Match;
  onOpenBet: (match: Match) => void;
};

const LEAGUE_COLORS: Record<string, string> = {
  'Premier League': '#00e5a0',
  'UEFA Champions League': '#3d8bff',
  'Besta deild karla': '#ffc940',
  'Lengjudeild karla': '#ff9f40',
};

export default function MatchCard({ match, onOpenBet }: Props) {
  const accentColor = LEAGUE_COLORS[match.league_name] ?? '#00e5a0';

  const isFinished =
    match.status === 'finished' ||
    match.status === 'FT' ||
    match.status === 'AET' ||
    match.status === 'PEN';

  const homeScore = match.home_score ?? null;
  const awayScore = match.away_score ?? null;

  return (
    <View style={[s.card, { borderLeftColor: accentColor }]}>
      <View style={s.topRow}>
        <View style={[s.leagueBadge, { backgroundColor: accentColor + '18' }]}>
          <Text style={[s.leagueText, { color: accentColor }]}>
            {match.league_name}
          </Text>
        </View>

        <Text style={s.timeText}>
          {isFinished ? 'Lokið' : formatKickoff(match.kickoff_time)}
        </Text>
      </View>

      <View style={s.teamsRow}>
        <Text style={s.teamName}>{match.home_team?.name ?? 'Heimalið'}</Text>

        <View style={s.middle}>
          {isFinished && homeScore !== null && awayScore !== null ? (
            <View style={s.scoreBox}>
              <Text style={s.scoreText}>{homeScore}</Text>
              <Text style={s.scoreDash}>–</Text>
              <Text style={s.scoreText}>{awayScore}</Text>
            </View>
          ) : (
            <Text style={s.vsText}>VS</Text>
          )}
        </View>

        <Text style={[s.teamName, s.teamRight]}>
          {match.away_team?.name ?? 'Útlið'}
        </Text>
      </View>

      {isFinished ? (
        <View style={s.finishedBanner}>
          <Text style={s.finishedBannerText}>Leikur lokinn — ekki hægt að veðja</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[s.challengeBtn, { backgroundColor: accentColor }]}
          onPress={() => onOpenBet(match)}
          activeOpacity={0.85}
        >
          <Text style={[s.challengeBtnText, s.challengeBtnTextActive]}>
            Setja veðmál
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function formatKickoff(iso: string) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString('is-IS', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }) +
    ' · ' +
    d.toLocaleTimeString('is-IS', {
      hour: '2-digit',
      minute: '2-digit',
    })
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#1a1a24',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderLeftWidth: 3,
    padding: 14,
    marginBottom: 10,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  leagueBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 20,
  },
  leagueText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  timeText: {
    fontSize: 11,
    color: '#9090aa',
    fontWeight: '600',
  },
  teamsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    gap: 8,
  },
  teamName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: '#f0f0f8',
  },
  teamRight: {
    textAlign: 'right',
  },
  middle: {
    width: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vsText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#5a5a72',
  },
  scoreBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scoreText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#f0f0f8',
  },
  scoreDash: {
    fontSize: 16,
    color: '#5a5a72',
    fontWeight: '700',
  },
  challengeBtn: {
    marginTop: 10,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  challengeBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
  challengeBtnTextActive: {
    color: '#000',
  },
  finishedBanner: {
    marginTop: 10,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  finishedBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5a5a72',
  },
});