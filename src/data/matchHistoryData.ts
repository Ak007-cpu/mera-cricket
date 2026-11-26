import { CompletedMatchItem } from '../types/cricket';

// Cached Last 5 Completed Matches (Official CREX Records & Player of the Match)
export const CACHED_LAST_5_MATCHES: CompletedMatchItem[] = [
  {
    id: 'crex_hist_1',
    series: "ICC Men's T20 World Cup 2024 - Super 8",
    matchTitle: 'India vs Australia',
    format: 'T20',
    dateStr: '24 Jun 2024',
    venue: 'Daren Sammy National Cricket Stadium, Gros Islet, St Lucia',
    crexMatchId: 'm88291',
    team1: {
      name: 'India',
      code: 'IND',
      logoUrl: '/api/team/flag/IND',
      scoreStr: '205/5',
      oversStr: '20.0 ov',
      isWinner: true
    },
    team2: {
      name: 'Australia',
      code: 'AUS',
      logoUrl: '/api/team/flag/AUS',
      scoreStr: '181/7',
      oversStr: '20.0 ov',
      isWinner: false
    },
    resultSummary: 'India won by 24 runs',
    playerOfMatch: {
      id: 'ind_rsharma',
      name: 'Rohit Sharma',
      role: 'Batter',
      teamCode: 'IND',
      stats: '92 off 41 balls (7x4, 8x6, SR 224.39)',
      imageUrl: '/api/player/photo?name=Rohit%20Sharma&team=IND',
      impactSummary: "Blistering captain's knock smashing fastest fifty of tournament in 19 balls"
    },
    highlights: [
      'Rohit Sharma 92 (41) - 8 towering maximums into Caribbean wind',
      'Arshdeep Singh 3/37 in 4 overs to stifle Australia chase',
      'Travis Head 76 (43) valiant resistance for Australia'
    ]
  },
  {
    id: 'crex_hist_2',
    series: "ICC Men's T20 World Cup 2024 - Grand Final",
    matchTitle: 'India vs South Africa - Final',
    format: 'T20',
    dateStr: '29 Jun 2024',
    venue: 'Kensington Oval, Bridgetown, Barbados',
    crexMatchId: 'm88350',
    team1: {
      name: 'India',
      code: 'IND',
      logoUrl: '/api/team/flag/IND',
      scoreStr: '176/7',
      oversStr: '20.0 ov',
      isWinner: true
    },
    team2: {
      name: 'South Africa',
      code: 'SA',
      logoUrl: '/api/team/flag/SA',
      scoreStr: '169/8',
      oversStr: '20.0 ov',
      isWinner: false
    },
    resultSummary: 'India won by 7 runs (Champions 🏆)',
    playerOfMatch: {
      id: 'ind_vkohli',
      name: 'Virat Kohli',
      role: 'Batter',
      teamCode: 'IND',
      stats: '76 off 59 balls (6x4, 2x6, SR 128.81)',
      imageUrl: '/api/player/photo?name=Virat%20Kohli&team=IND',
      impactSummary: 'Masterclass anchor innings rescuing India from 34/3 to post winning total'
    },
    highlights: [
      'Virat Kohli 76 (59) anchor masterpiece in World Cup Final',
      'Jasprit Bumrah sensational 2/18 in 4 overs (Econ: 4.50)',
      'Suryakumar Yadav iconic boundary catch to dismiss David Miller'
    ]
  },
  {
    id: 'crex_hist_3',
    series: 'England Tour of Pakistan 2024 - 2nd Test',
    matchTitle: 'Pakistan vs England',
    format: 'TEST',
    dateStr: '24 Oct 2024',
    venue: 'Rawalpindi Cricket Stadium, Rawalpindi',
    crexMatchId: 'm77290',
    team1: {
      name: 'Pakistan',
      code: 'PAK',
      logoUrl: '/api/team/flag/PAK',
      scoreStr: '344 & 77/1',
      oversStr: '13.4 ov',
      isWinner: true
    },
    team2: {
      name: 'England',
      code: 'ENG',
      logoUrl: '/api/team/flag/ENG',
      scoreStr: '267 & 153',
      oversStr: '37.2 ov',
      isWinner: false
    },
    resultSummary: 'Pakistan won by 9 wickets (Series Levelled 1-1)',
    playerOfMatch: {
      id: 'pak_snoman',
      name: 'Noman Ali',
      role: 'Bowler',
      teamCode: 'PAK',
      stats: '11/134 (8/46 & 3/88 in 38.2 ov)',
      imageUrl: '/api/player/photo?name=Noman%20Ali&team=PAK',
      impactSummary: 'Sensational 11-wicket haul dismantling England on turning Rawalpindi deck'
    },
    highlights: [
      'Noman Ali 8/46 career-best Test bowling figures',
      'Sajid Khan 9 wickets in match spinning in tandem',
      'Shan Masood 43* off 32 balls sealing the chase'
    ]
  },
  {
    id: 'crex_hist_4',
    series: 'Australia vs Pakistan ODI Series 2024 - 3rd ODI',
    matchTitle: 'Australia vs Pakistan',
    format: 'ODI',
    dateStr: '10 Nov 2024',
    venue: 'Perth Stadium, Perth',
    crexMatchId: 'm66110',
    team1: {
      name: 'Australia',
      code: 'AUS',
      logoUrl: '/api/team/flag/AUS',
      scoreStr: '140',
      oversStr: '31.5 ov',
      isWinner: false
    },
    team2: {
      name: 'Pakistan',
      code: 'PAK',
      logoUrl: '/api/team/flag/PAK',
      scoreStr: '143/2',
      oversStr: '26.5 ov',
      isWinner: true
    },
    resultSummary: 'Pakistan won by 8 wickets (PAK won series 2-1)',
    playerOfMatch: {
      id: 'pak_hauf',
      name: 'Haris Rauf',
      role: 'Bowler',
      teamCode: 'PAK',
      stats: '2/24 in 7.0 overs (Econ: 3.42) • Series: 10 wickets',
      imageUrl: '/api/player/photo?name=Haris%20Rauf&team=PAK',
      impactSummary: 'Fiery 150km/h express pace ripping through Australia middle order'
    },
    highlights: [
      'Haris Rauf awarded Player of the Match and Player of the Series',
      'Shaheen Afridi 3/32 & Naseem Shah 3/54',
      'Saim Ayub 42 (52) & Abdullah Shafique 37 (53) opening stand'
    ]
  },
  {
    id: 'crex_hist_5',
    series: "ICC Men's T20 World Cup 2024 - Super 8",
    matchTitle: 'South Africa vs USA',
    format: 'T20',
    dateStr: '19 Jun 2024',
    venue: 'Sir Vivian Richards Stadium, North Sound, Antigua',
    crexMatchId: 'm55198',
    team1: {
      name: 'South Africa',
      code: 'SA',
      logoUrl: '/api/team/flag/SA',
      scoreStr: '194/4',
      oversStr: '20.0 ov',
      isWinner: true
    },
    team2: {
      name: 'USA',
      code: 'USA',
      logoUrl: '/api/team/flag/USA',
      scoreStr: '176/6',
      oversStr: '20.0 ov',
      isWinner: false
    },
    resultSummary: 'South Africa won by 18 runs',
    playerOfMatch: {
      id: 'sa_qdekock',
      name: 'Quinton de Kock',
      role: 'Wicketkeeper Batter',
      teamCode: 'SA',
      stats: '74 off 40 balls (7x4, 5x6, SR 185.00)',
      imageUrl: '/api/player/photo?name=Quinton%20de%20Kock&team=SA',
      impactSummary: 'Blistering powerplay hitting setting the foundation for South Africa victory'
    },
    highlights: [
      'Quinton de Kock 74 off 40 with 5 maximums',
      'Kagiso Rabada 3/18 in 4 overs stopping USA comeback',
      'Andries Gous 80* (47) magnificent counter-attack for USA'
    ]
  }
];
