// src/components/MatchCard.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import type { Match, MatchResult } from '../types/database';

type Props = {
  match: Match;
  onBetPress: (match: Match, prediction: MatchResult) => void;
  myPrediction?: MatchResult | null;
  disabled?: boolean;
};

const PREDICTION_LABELS: Record<MatchResult, string> = {
  home: 'Heimalið',
  draw: 'Jafntefli',
  away: 'Útlið',
};

const LEAGUE_COLORS: Record<string, string> = {
  'Premier League': '#00e5a0',
  'UEFA Champions League': '#3d8bff',
  'Besta deild karla': '#ffc940',
  'Lengjudeild karla': '#ff9f40',
  '2. deild karla': '#ff4a6e',
};

export default function MatchCard({ match, onBetPress, myPrediction, disabled }: Props) {
  const [selected, setSelected] = useState<MatchResult | null>(myPrediction ?? null);
  const accentColor = LEAGUE_COLORS[match.league_name] ?? '#00e5a0';

  const isFinished = match.status === 'finished';

  function handleSelect(prediction: MatchResult) {
    if (disabled || isFinished) return;
    setSelected(prediction);
    onBetPress(match, prediction);
  }

  function getResultLabel(): string | null {
    if (!isFinished || match.result == null) return null;
    if (match.result === 'home') return `${match.home_team?.short_name ?? ''} vann`;
    if (match.result === 'away') return `${match.away_team?.short_name ?? ''} vann`;
    return 'Jafntefli';
  }

  const resultLabel = getResultLabel();
  const homeScore = match.home_score ?? null;
  const awayScore = match.away_score ?? null;

  return (
    <View style={[s.card, { borderLeftColor: accentColor }]}>

      {/* League + time row */}
      <View style={s.topRow}>
        <View style={[s.leagueBadge, { backgroundColor: accentColor + '18' }]}>
          <Text style={[s.leagueText, { color: accentColor }]}>{match.league_name}</Text>
        </View>
        <View style={s.rightMeta}>
          {match.status === 'live' && (
            <View style={s.liveDot} />
          )}
          <Text style={s.timeText}>
            {match.status === 'live'
              ? 'LIVE'
              : match.status === 'finished'
              ? 'Lokið'
              : formatKickoff(match.kickoff_time)}
          </Text>
        </View>
      </View>

      {/* Teams row */}
      <View style={s.teamsRow}>

        {/* Home team */}
        <View style={s.teamSide}>
          <Text style={s.teamName} numberOfLines={2}>{match.home_team?.name ?? 'Heimalið'}</Text>
          <Text style={s.teamSub}>Heimalið</Text>
        </View>

        {/* Score / VS */}
        <View style={s.middle}>
          {isFinished && homeScore !== null && awayScore !== null ? (
            <View style={s.scoreBox}>
              <Text style={s.scoreText}>{homeScore}</Text>
              <Text style={s.scoreDash}>–</Text>
              <Text style={s.scoreText}>{awayScore}</Text>
            </View>
          ) : (
            <View style={s.vsBox}>
              <Text style={s.vsText}>VS</Text>
            </View>
          )}
        </View>

        {/* Away team */}
        <View style={[s.teamSide, s.teamRight]}>
          <Text style={[s.teamName, { textAlign: 'right' }]} numberOfLines={2}>
            {match.away_team?.name ?? 'Útlið'}
          </Text>
          <Text style={[s.teamSub, { textAlign: 'right' }]}>Útlið</Text>
        </View>
      </View>

      {/* Result label (finished) */}
      {resultLabel && (
        <View style={s.resultRow}>
          <Text style={s.resultText}>{resultLabel}</Text>
        </View>
      )}

      {/* Bet buttons (upcoming/live only) */}
      {!isFinished && (
        <View style={s.betBtns}>
          {(['home', 'draw', 'away'] as MatchResult[]).map((pred) => {
            const isSel = selected === pred;
            return (
              <TouchableOpacity
                key={pred}
                style={[
                  s.betBtn,
                  isSel && { backgroundColor: accentColor + '1a', borderColor: accentColor },
                  disabled && s.betBtnDisabled,
                ]}
                onPress={() => handleSelect(pred)}
                activeOpacity={0.75}
                disabled={!!disabled}
              >
                <Text
                  style={[s.betBtnText, isSel && { color: accentColor }]}
                  numberOfLines={1}
                >
                  {pred === 'home'
                    ? match.home_team?.short_name ?? 'Heim'
                    : pred === 'away'
                    ? match.away_team?.short_name ?? 'Úti'
                    : 'Jafnt'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* My prediction badge */}
      {myPrediction && !isFinished && (
        <View style={s.myPredRow}>
          <Text style={s.myPredText}>
            Spá þín: <Text style={{ color: accentColor, fontWeight: '700' }}>
              {PREDICTION_LABELS[myPrediction]}
            </Text>
          </Text>
        </View>
      )}

    </View>
  );
}

function formatKickoff(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();

  const time = d.toLocaleTimeString('is-IS', { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Í dag · ${time}`;
  if (isTomorrow) return `Á morgun · ${time}`;
  return d.toLocaleDateString('is-IS', { weekday: 'short', day: 'numeric', month: 'short' }) + ` · ${time}`;
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
  rightMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ff4a6e',
  },
  timeText: {
    fontSize: 11,
    color: '#9090aa',
    fontWeight: '600',
  },
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  teamSide: {
    flex: 1,
  },
  teamRight: {
    alignItems: 'flex-end',
  },
  teamName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#f0f0f8',
    lineHeight: 20,
  },
  teamSub: {
    fontSize: 11,
    color: '#5a5a72',
    marginTop: 2,
  },
  middle: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 52,
  },
  vsBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#22222f',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vsText: {
    fontSize: 10,
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
  resultRow: {
    alignItems: 'center',
    marginBottom: 4,
  },
  resultText: {
    fontSize: 11,
    color: '#9090aa',
    fontWeight: '600',
  },
  betBtns: {
    flexDirection: 'row',
    gap: 6,
  },
  betBtn: {
    flex: 1,
    backgroundColor: '#22222f',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 9,
    paddingVertical: 9,
    alignItems: 'center',
  },
  betBtnDisabled: {
    opacity: 0.4,
  },
  betBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9090aa',
  },
  myPredRow: {
    marginTop: 8,
    alignItems: 'center',
  },
  myPredText: {
    fontSize: 11,
    color: '#5a5a72',
  },
});
