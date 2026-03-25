// src/lib/i18n.ts
// FitBet internationalisation system
// Supports: Icelandic (is) and English (en)
// Usage: import { t, useLanguage } from '../lib/i18n'

import { useState, useEffect, createContext, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Language = 'is' | 'en';

// ── All translations ─────────────────────────────────────────
const translations = {

  // ── Navigation ──────────────────────────────────────────
  nav: {
    home:       { is: 'Heim',        en: 'Home'        },
    matches:    { is: 'Leikir',      en: 'Matches'     },
    bets:       { is: 'Veðmál',      en: 'Bets'        },
    season:     { is: 'Tímabil',     en: 'Season'      },
    leagues:    { is: 'Deildir',     en: 'Leagues'     },
    friends:    { is: 'Vinir',       en: 'Friends'     },
    profile:    { is: 'Prófíll',     en: 'Profile'     },
  },

  // ── Common ───────────────────────────────────────────────
  common: {
    save:         { is: 'Vista',          en: 'Save'          },
    cancel:       { is: 'Hætta við',      en: 'Cancel'        },
    confirm:      { is: 'Staðfesta',      en: 'Confirm'       },
    delete:       { is: 'Eyða',           en: 'Delete'        },
    back:         { is: 'Til baka',       en: 'Back'          },
    next:         { is: 'Áfram',          en: 'Next'          },
    done:         { is: 'Lokið',          en: 'Done'          },
    loading:      { is: 'Hleður...',      en: 'Loading...'    },
    error:        { is: 'Villa',          en: 'Error'         },
    success:      { is: 'Tókst!',         en: 'Success!'      },
    yes:          { is: 'Já',             en: 'Yes'           },
    no:           { is: 'Nei',            en: 'No'            },
    or:           { is: 'eða',            en: 'or'            },
    search:       { is: 'Leita...',       en: 'Search...'     },
    points:       { is: 'stig',           en: 'points'        },
    wins:         { is: 'Sigrar',         en: 'Wins'          },
    losses:       { is: 'Töp',            en: 'Losses'        },
    winRate:      { is: 'Hlutfall',       en: 'Win Rate'      },
    today:        { is: 'Í dag',          en: 'Today'         },
    tomorrow:     { is: 'Á morgun',       en: 'Tomorrow'      },
    send:         { is: 'Senda',          en: 'Send'          },
    live:         { is: 'BEINT',          en: 'LIVE'          },
  },

  // ── Auth ─────────────────────────────────────────────────
  auth: {
    login:            { is: 'Innskráning',          en: 'Sign In'             },
    signup:           { is: 'Nýskráning',            en: 'Sign Up'             },
    logout:           { is: 'Útskrá',                en: 'Sign Out'            },
    email:            { is: 'Netfang',               en: 'Email'               },
    password:         { is: 'Lykilorð',              en: 'Password'            },
    confirmPassword:  { is: 'Staðfesta lykilorð',    en: 'Confirm Password'    },
    fullName:         { is: 'Fullt nafn',             en: 'Full Name'           },
    username:         { is: 'Notandanafn',            en: 'Username'            },
    forgotPassword:   { is: 'Gleymt lykilorð?',      en: 'Forgot password?'    },
    noAccount:        { is: 'Á ekki reikning?',       en: 'No account yet?'     },
    hasAccount:       { is: 'Á nú reikning?',         en: 'Already have one?'   },
    createAccount:    { is: 'Búa til aðgang',         en: 'Create Account'      },
    welcomeBack:      { is: 'Velkominn aftur',        en: 'Welcome back'        },
    step1of2:         { is: 'Skref 1 af 2',           en: 'Step 1 of 2'         },
    step2of2:         { is: 'Skref 2 af 2',           en: 'Step 2 of 2'         },
    whatIsYourName:   { is: 'Hvað heitir þú?',        en: 'What is your name?'  },
    finishAccount:    { is: 'Kláraðu aðganginn',      en: 'Finish your account' },
  },

  // ── Onboarding ───────────────────────────────────────────
  onboarding: {
    skip:     { is: 'Sleppa',           en: 'Skip'              },
    getStarted: { is: 'Búa til aðgang 🚀', en: 'Get Started 🚀' },
    slide1Title: { is: 'Veðjaðu við vini',   en: 'Bet with friends'  },
    slide1Sub:   { is: 'Spáðu fyrir um niðurstöður leikja í Premier League, Bestu deild og Champions League.', en: 'Predict match outcomes in Premier League, Icelandic leagues and Champions League.' },
    slide2Title: { is: 'Tapi = Þjálfun',     en: 'Lose = Train'      },
    slide2Sub:   { is: 'Enginn peningur á í leik. Sá sem tapar þarf að klára líkamsþjálfunaráskorun.', en: 'No money involved. The loser must complete a fitness challenge.' },
    slide3Title: { is: 'Safnaðu stigum',      en: 'Collect points'    },
    slide3Sub:   { is: 'Kepptu við vini og vinnufélaga. Vertu efst á stigatöflunni.', en: 'Compete with friends and colleagues. Top the leaderboard.' },
    slide4Title: { is: 'Sannaðu þig',         en: 'Prove yourself'    },
    slide4Sub:   { is: 'Hlaðu upp mynd eða myndskeiði sem sönnun. Vinurinn staðfestir.', en: 'Upload a photo or video as proof. Your friend approves it.' },
  },

  // ── Home ─────────────────────────────────────────────────
  home: {
    greeting_morning: { is: 'Góðan daginn,',  en: 'Good morning,'   },
    greeting_afternoon:{ is: 'Góðan dag,',    en: 'Good afternoon,' },
    greeting_evening: { is: 'Gott kvöld,',    en: 'Good evening,'   },
    greeting_night:   { is: 'Góða nótt,',     en: 'Good night,'     },
    upcomingMatches:  { is: 'Næstu leikir',    en: 'Upcoming Matches'},
    activityFeed:     { is: 'Virknistraumur',  en: 'Activity Feed'   },
    betNow:           { is: 'Veðja núna →',    en: 'Bet now →'       },
    seeAll:           { is: 'Sjá alla →',      en: 'See all →'       },
    liveNow:          { is: 'Í gangi núna',    en: 'Live now'        },
    featuredMatch:    { is: 'Leikur kvöldsins', en: 'Match of the day'},
    emptyFeed:        { is: 'Straumurinn er tómur', en: 'Feed is empty' },
    emptyFeedSub:     { is: 'Bíddu þar til vinir fara að veðja!', en: 'Wait for friends to start betting!' },
    challengeAlert:   { is: 'áskorun bíður!',  en: 'challenge waiting!' },
    betAlert:         { is: 'veðmál bíður svars!', en: 'bet waiting for reply!' },
  },

  // ── Matches ───────────────────────────────────────────────
  matches: {
    title:      { is: 'Leikir',        en: 'Matches'      },
    all:        { is: 'Allir',         en: 'All'          },
    homeTeam:   { is: 'Heimalið',      en: 'Home'         },
    awayTeam:   { is: 'Útlið',         en: 'Away'         },
    vs:         { is: 'VS',            en: 'VS'           },
    finished:   { is: 'Lokið',         en: 'Finished'     },
    upcoming:   { is: 'Ókominn',       en: 'Upcoming'     },
    noMatches:  { is: 'Engir leikir í boði', en: 'No matches available' },
    noMatchesSub: { is: 'Admin bætir við leikjum í stjórnborðinu', en: 'Admin adds matches in the dashboard' },
  },

  // ── Bets ─────────────────────────────────────────────────
  bets: {
    title:          { is: 'Veðmál mín',         en: 'My Bets'           },
    open:           { is: 'Opin',                en: 'Open'              },
    settled:        { is: 'Lokið',               en: 'Settled'           },
    challenges:     { is: 'Áskoranir',           en: 'Challenges'        },
    prediction:     { is: 'Spá þín',             en: 'Your prediction'   },
    against:        { is: 'Gegn',                en: 'Against'           },
    homeWins:       { is: 'Heimalið vinnur',     en: 'Home wins'         },
    draw:           { is: 'Jafntefli',           en: 'Draw'              },
    awayWins:       { is: 'Útlið vinnur',        en: 'Away wins'         },
    pending:        { is: 'Í bið',               en: 'Pending'           },
    accepted:       { is: 'Virkt',               en: 'Active'            },
    won:            { is: 'Vann!',               en: 'Won!'              },
    lost:           { is: 'Tapaði',              en: 'Lost'              },
    rematch:        { is: 'Endurleikur',         en: 'Rematch'           },
    double:         { is: 'Tvöfalda',            en: 'Double or nothing' },
    sendBet:        { is: 'Senda veðmál 🏆',     en: 'Send bet 🏆'       },
    whoAgainst:     { is: 'Gegn hverjum?',       en: 'Who to bet against?'},
    yourPrediction: { is: 'Hvað heldur þú?',     en: 'What do you think?'},
  },

  // ── BetModal ──────────────────────────────────────────────
  betModal: {
    step1: { is: 'Spá',           en: 'Prediction'  },
    step2: { is: 'Andstæðingur',  en: 'Opponent'    },
    step3: { is: 'Áskorun',       en: 'Challenge'   },
    step4: { is: 'Staðfesta',     en: 'Confirm'     },
    whatDoYouThink:   { is: 'Hvað heldur þú?',      en: 'What do you think?'     },
    pickOpponent:     { is: 'Veðjaðu við hinn',      en: 'Bet with someone'        },
    pickChallenge:    { is: 'Velja áskorun',          en: 'Pick a challenge'        },
    confirmBet:       { is: 'Staðfesta veðmál',       en: 'Confirm bet'             },
    checkCarefully:   { is: 'Athugaðu vel áður en þú sendir', en: 'Check carefully before sending' },
    noFriends:        { is: 'Engir vinir ennþá',      en: 'No friends yet'          },
    addFriendsFirst:  { is: 'Bættu við vinum í Vinir flipanum', en: 'Add friends in the Friends tab' },
    loserMust:        { is: 'Ef þú tapar þarftu að', en: 'If you lose you must'     },
  },

  // ── Challenges ────────────────────────────────────────────
  challenges: {
    title:        { is: 'Áskoranir',        en: 'Challenges'      },
    mine:         { is: 'Mínar',            en: 'Mine'            },
    approve:      { is: 'Yfirferð',         en: 'Review'          },
    assigned:     { is: 'Óklárað',          en: 'Incomplete'      },
    submitted:    { is: 'Í yfirferð',       en: 'Under review'    },
    approved:     { is: 'Klárað ✓',         en: 'Complete ✓'      },
    rejected:     { is: 'Hafnað',           en: 'Rejected'        },
    uploadProof:  { is: 'Hlaða upp sönnun', en: 'Upload proof'    },
    takePhoto:    { is: 'Taka mynd núna',   en: 'Take photo now'  },
    choosePhoto:  { is: 'Velja mynd úr safni', en: 'Choose from library' },
    uploadVideo:  { is: 'Hlaða upp myndband', en: 'Upload video'  },
    stravaAuto:   { is: 'Tengja Strava æfingu', en: 'Link Strava activity' },
    isProofValid: { is: 'Er sönnunin gild?', en: 'Is the proof valid?' },
    accept:       { is: '✓ Samþykkja',      en: '✓ Accept'        },
    reject:       { is: '✕ Hafna',          en: '✕ Reject'        },
    waitingApproval: { is: 'Bíður samþykkis', en: 'Waiting for approval' },
    wellDone:     { is: '🎉 Áskorun kláruð! Vel gert!', en: '🎉 Challenge complete! Well done!' },
    dueToday:     { is: 'Í dag!',           en: 'Due today!'      },
    overdue:      { is: 'Liðinn tími!',     en: 'Overdue!'        },
  },

  // ── Exercises ─────────────────────────────────────────────
  exercises: {
    hlaup:       { is: 'Hlaup',       en: 'Running'     },
    armbeygjur:  { is: 'Armbeygjur',  en: 'Push-ups'    },
    hnébeygjur:  { is: 'Hnébeygjur',  en: 'Squats'      },
    burpees:     { is: 'Burpees',     en: 'Burpees'     },
    hjólreiðar:  { is: 'Hjólreiðar',  en: 'Cycling'     },
    planki:      { is: 'Planki',      en: 'Plank'       },
  },

  // ── Season ────────────────────────────────────────────────
  season: {
    title:        { is: 'Tímabilsveðmál',     en: 'Season Bets'       },
    openMarkets:  { is: 'Opnir markaðir',      en: 'Open Markets'      },
    myBets:       { is: 'Veðmál mín',          en: 'My Bets'           },
    champion:     { is: '🏆 Meistari',          en: '🏆 Champion'       },
    relegated:    { is: '⬇ Fellur',             en: '⬇ Relegated'       },
    promoted:     { is: '⬆ Fer upp',            en: '⬆ Promoted'        },
    headToHead:   { is: '⚔ Hvort lið endar ofar', en: '⚔ Head to Head'  },
    pickTeam:     { is: 'Veldu lið',            en: 'Pick a team'       },
    locked:       { is: '🔒 Læstur',            en: '🔒 Locked'         },
    open:         { is: 'Opinn',                en: 'Open'              },
    settled:      { is: 'Gert upp',             en: 'Settled'           },
    noMarkets:    { is: 'Engir markaðir opnir', en: 'No open markets'   },
    noMarketsSub: { is: 'Admin bætir við tímabilsveðmálum þegar keppnin hefst', en: 'Admin adds season bets when competition starts' },
  },

  // ── Leaderboard ───────────────────────────────────────────
  leaderboard: {
    title:    { is: 'Stigatafla',   en: 'Leaderboard'   },
    world:    { is: 'Heimur',       en: 'World'         },
    leagues:  { is: 'Deildir',      en: 'Leagues'       },
    myRank:   { is: 'staður',       en: 'place'         },
    empty:    { is: 'Engar færslur ennþá', en: 'No entries yet' },
    emptySub: { is: 'Farðu og veðjaðu!', en: 'Go place some bets!' },
  },

  // ── Leagues ───────────────────────────────────────────────
  leagues: {
    title:        { is: 'Deildir',           en: 'Leagues'           },
    create:       { is: '+ Ný deild',        en: '+ New League'      },
    join:         { is: 'Ganga í',           en: 'Join'              },
    newLeague:    { is: 'Ný deild',          en: 'New League'        },
    joinLeague:   { is: 'Ganga í deild',     en: 'Join League'       },
    leagueName:   { is: 'Nafn deildar',      en: 'League name'       },
    type:         { is: 'Tegund',            en: 'Type'              },
    friendGroup:  { is: 'Vinahópur',         en: 'Friend Group'      },
    workplace:    { is: 'Vinnustaður',       en: 'Workplace'         },
    members:      { is: 'Meðlimir',          en: 'Members'           },
    board:        { is: 'Stigatafla',        en: 'Leaderboard'       },
    invite:       { is: '🔗 Boða',           en: '🔗 Invite'         },
    inviteCode:   { is: 'Boðkóði',           en: 'Invite code'       },
    leaveLeague:  { is: 'Fara úr deild',     en: 'Leave league'      },
    admin:        { is: '★ Admin',           en: '★ Admin'           },
    member:       { is: 'Meðlimur',          en: 'Member'            },
    noLeagues:    { is: 'Engar deildir',     en: 'No leagues'        },
    noLeaguesSub: { is: 'Búðu til deild eða gakktu í með boðkóða', en: 'Create a league or join with an invite code' },
  },

  // ── Friends ───────────────────────────────────────────────
  friends: {
    title:        { is: 'Vinir',              en: 'Friends'           },
    searchUsers:  { is: 'Leita að notendum...', en: 'Search users...'  },
    requests:     { is: 'Vinarbeiðnir',       en: 'Friend Requests'   },
    myFriends:    { is: 'Vinir mínir',        en: 'My Friends'        },
    addFriend:    { is: '+ Bæta við',         en: '+ Add'             },
    friendAdded:  { is: 'Vinur ✓',            en: 'Friend ✓'          },
    pending:      { is: 'Bíður svars',        en: 'Pending'           },
    accept:       { is: '✓ Samþykkja',        en: '✓ Accept'          },
    decline:      { is: '✕',                  en: '✕'                 },
    noFriends:    { is: 'Engir vinir ennþá',  en: 'No friends yet'    },
    noFriendsSub: { is: 'Leitaðu að vinum hér að ofan og bættu þeim við', en: 'Search for friends above and add them' },
    remove:       { is: 'Fjarlægja',          en: 'Remove'            },
    searchResults:{ is: 'Leitarniðurstöður',  en: 'Search results'    },
    noResults:    { is: 'Enginn notandi fannst', en: 'No user found'   },
  },

  // ── Profile ───────────────────────────────────────────────
  profile: {
    title:          { is: 'Prófíll',              en: 'Profile'             },
    achievements:   { is: 'Verðlaun',             en: 'Achievements'        },
    settings:       { is: 'Stillingar',           en: 'Settings'            },
    strava:         { is: 'Strava',               en: 'Strava'              },
    stravaConnected:{ is: 'Tengt — æfingar staðfestar sjálfkrafa', en: 'Connected — activities auto-verified' },
    stravaConnect:  { is: 'Tengdu til að staðfesta sjálfkrafa', en: 'Connect to auto-verify challenges' },
    notifications:  { is: 'Push tilkynningar',    en: 'Push notifications'  },
    privacy:        { is: 'Persónuverndarstefna',  en: 'Privacy Policy'      },
    terms:          { is: 'Notkunarskilmálar',     en: 'Terms of Service'    },
    contact:        { is: 'Hafa samband',          en: 'Contact us'          },
    signOut:        { is: 'Útskrá',               en: 'Sign Out'            },
    deleteAccount:  { is: 'Eyða reikningi',        en: 'Delete Account'      },
    language:       { is: 'Tungumál',              en: 'Language'            },
    recentResults:  { is: 'Nýlegar niðurstöður',   en: 'Recent Results'      },
    version:        { is: 'FitBet v1.0.0',         en: 'FitBet v1.0.0'       },
  },

  // ── Premium / Paywall ─────────────────────────────────────
  premium: {
    title:          { is: 'FitBet Premium',        en: 'FitBet Premium'      },
    getAll:         { is: 'Fáðu allt það besta úr FitBet', en: 'Get the best of FitBet' },
    includes:       { is: 'PREMIUM INNIHELDUR',    en: 'PREMIUM INCLUDES'    },
    unlimitedLeagues: { is: 'Ótakmarkaðar deildir', en: 'Unlimited leagues'  },
    unlimitedLeaguesSub: { is: 'Ókeypis: 2 deildir', en: 'Free: 2 leagues'  },
    stravaAuto:     { is: 'Strava tenging',        en: 'Strava connection'   },
    stravaAutoSub:  { is: 'Sjálfvirk staðfesting', en: 'Auto-verification'   },
    customChallenges: { is: 'Sérsniðnar áskoranir', en: 'Custom challenges'  },
    customChallengesSub: { is: 'Hvaða æfing sem er', en: 'Any exercise you want' },
    stats:          { is: 'Ítarleg tölfræði',      en: 'Detailed stats'      },
    perMonth:       { is: '/ mánuð',               en: '/ month'             },
    cancelAnytime:  { is: 'Hægt að segja upp hvenær sem er', en: 'Cancel anytime' },
    getPremium:     { is: 'Fá Premium',            en: 'Get Premium'         },
    restore:        { is: 'Endurheimta fyrri kaup', en: 'Restore purchases'  },
    needsPremium:   { is: 'Þú þarft Premium til að nota', en: 'You need Premium to use' },
  },

  // ── Notifications ─────────────────────────────────────────
  notifications: {
    betWon:           { is: 'Þú vannst! 🏆',        en: 'You won! 🏆'           },
    betLost:          { is: 'Þú tapaðir 😅',         en: 'You lost 😅'           },
    betReceived:      { is: 'Ný veðmálsbeiðni! 🎯',  en: 'New bet request! 🎯'   },
    betAccepted:      { is: 'Veðmál samþykkt! ✅',   en: 'Bet accepted! ✅'      },
    challengeAssigned:{ is: 'Áskorun úthlutað 💪',   en: 'Challenge assigned 💪' },
    challengeSubmitted:{ is: 'Sönnun móttekin! 📸',  en: 'Proof received! 📸'    },
    challengeApproved:{ is: 'Sönnun samþykkt! 🎉',   en: 'Proof approved! 🎉'    },
    friendRequest:    { is: 'Vinarbeiðni! 👋',        en: 'Friend request! 👋'    },
    friendAccepted:   { is: 'Vinarbeiðni samþykkt! 🤝', en: 'Friend accepted! 🤝'},
  },

  // ── Feed messages ─────────────────────────────────────────
  feed: {
    wonBet:       { is: 'vannst veðmál 🏆',         en: 'won a bet 🏆'           },
    lostBet:      { is: 'tapaðir veðmáli',           en: 'lost a bet'             },
    completedChallenge: { is: 'kláraði áskorun ✓',  en: 'completed challenge ✓'  },
    sentProof:    { is: 'sendi sönnun 📸',           en: 'sent proof 📸'          },
    newFriend:    { is: 'er nú vinur þinn 🤝',       en: 'is now your friend 🤝'  },
    youPrefix:    { is: 'Þú',                        en: 'You'                    },
    justNow:      { is: 'Rétt í þessu',              en: 'Just now'               },
    minutesAgo:   { is: 'mín síðan',                 en: 'min ago'                },
    hoursAgo:     { is: 'klst síðan',                en: 'hrs ago'                },
    daysAgo:      { is: 'd síðan',                   en: 'd ago'                  },
  },
} as const;

// ── Type helpers ─────────────────────────────────────────────
type TranslationKey = keyof typeof translations;
type SubKey<T extends TranslationKey> = keyof typeof translations[T];

// ── Global language state ────────────────────────────────────
let currentLang: Language = 'is';
const listeners: Set<() => void> = new Set();

export function getCurrentLanguage(): Language {
  return currentLang;
}

export async function setLanguage(lang: Language) {
  currentLang = lang;
  await AsyncStorage.setItem('fitbet_language', lang);
  listeners.forEach(fn => fn());
}

export async function loadSavedLanguage() {
  const saved = await AsyncStorage.getItem('fitbet_language');
  if (saved === 'is' || saved === 'en') {
    currentLang = saved;
  }
}

// ── Translation function ──────────────────────────────────────
export function t<S extends TranslationKey>(
  section: S,
  key: SubKey<S>
): string {
  const entry = (translations[section] as any)[key];
  if (!entry) return `${String(section)}.${String(key)}`;
  return entry[currentLang] ?? entry['is'] ?? String(key);
}

// ── React hook ───────────────────────────────────────────────
export function useLanguage() {
  const [lang, setLang] = useState<Language>(currentLang);

  useEffect(() => {
    const update = () => setLang(currentLang);
    listeners.add(update);
    loadSavedLanguage().then(() => setLang(currentLang));
    return () => { listeners.delete(update); };
  }, []);

  return {
    lang,
    setLanguage: async (l: Language) => {
      await setLanguage(l);
      setLang(l);
    },
    t,
    isIcelandic: lang === 'is',
    isEnglish:   lang === 'en',
  };
}
