// src/hooks/useLanguage.ts
import { useState, useEffect } from 'react';

// Simple translation mock
const translations: Record<string, Record<string, string>> = {
  is: {
    common_error: 'Villa',
    common_cancel: 'Hætta við',
    challenges_title: 'Áskoranir',
    challenges_header_sub: 'Sjáðu virk veðmál og áskoranir',
    challenges_active: 'Virkt',
    challenges_finished: 'Lokið',
    challenges_empty_active: 'Engar virkar áskoranir',
    challenges_empty_active_sub: 'Veðjaðu á leiki til að byrja!',
    challenges_empty_finished: 'Engar búnar áskoranir',
    challenges_empty_finished_sub: 'Kláraðu áskorun til að sjá hana hér.',
    challenges_pending: 'Í bið',
    challenges_accepted: 'Samþykkt',
    challenges_declined: 'Hafnað',
    challenges_settled: 'Gert upp',
    challenges_unknown: 'Óþekktur',
    challenges_opp_pred_label: 'Spá vinar',
    challenges_opp_pred_mine: 'Mín spá',
    challenges_bet_on: 'Veðja á móti',
    challenges_bet_accepted_msg: 'Veðmál í gangi! ⚔️',
    challenges_bet_declined_msg: 'Þú hafnaðir þessu veðmáli.',
    challenges_my_pred: 'Mín spá',
    challenges_awaiting_friend: 'Bíður eftir vini...',
    challenges_cancel_bet: 'Hætta við veðmál',
    challenges_cancel_q: 'Hætta við?',
    challenges_sure: 'Ertu viss?',
    challenges_accepted_waiting: 'Samþykkt! Bíðum eftir leiklokum.',
    challenges_friend_declined: 'Vinur hafnaði veðmálinu.',
    challenges_season_win: 'Þú vannst! 🏆',
    challenges_season_loss: 'Þú tapaðir 😅',
    challenges_pick_your_pred: 'Veldu þína spá',
    challenges_pick_sub: 'Þú getur ekki valið sömu niðurstöðu og vinur þinn.',
    challenges_accept_bet_btn: 'Samþykkja veðmál',
    challenges_opp_pick_taken: 'Frátekið',
    challenges_decline: 'Hafna',
    challenges_decline_q: 'Hafna veðmáli?',
    challenges_accept: 'Samþykkja',
    challenges_accept_season_q: 'Viltu samþykkja þetta tímabilsveðmál?',
    challenges_awaiting_status: 'Eftir að klára',
    challenges_proof_submitted: 'Sönnun send',
    challenges_proof_rejected: 'Sönnun hafnað',
    challenges_complete_for: 'Klára fyrir',
    challenges_must_complete: 'þarf að klára',
    challenges_due: 'Skilafrestur',
    challenges_proof_strava: 'Strava staðfesting móttekin ⚡',
    challenges_reject: 'Hafna',
    challenges_reject_q: 'Hafna sönnun?',
    challenges_reject_msg: 'Ertu viss um að þú viljir hafna þessari sönnun?',
    challenges_approve: 'Samþykkja',
    challenges_approve_q: 'Samþykkja sönnun?',
    challenges_approve_msg: 'Vel gert! Þú færð stig fyrir þetta.',
    challenges_resend_proof: 'Endursenda sönnun',
    challenges_send_proof: 'Senda sönnun',
    challenges_proof_pending_v: 'Sönnun í skoðun hjá vini...',
    challenges_you_won: 'Vannst!',
    challenges_you_lost: 'Tapaðir!',
    bet_modal_home_team: 'Heimalið',
    bet_modal_away_team: 'Útlið',
    bet_modal_err_msg: 'Eitthvað fór úrskeiðis. Reyndu aftur.',
    matches_predict_draw: 'Jafntefli',
    lb_season_bets: 'Tímabilsveðmál',
  }
};

export function useLanguage() {
  const [lang, setLang] = useState('is');

  const t = (key: string) => {
    return translations[lang]?.[key] ?? key;
  };

  return { lang, setLang, t };
}

export const LanguageProvider = ({ children }: any) => {
  return children;
};
