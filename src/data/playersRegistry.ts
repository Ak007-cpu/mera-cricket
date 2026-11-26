export interface PlayerProfile {
  id: string;
  name: string;
  shortName: string;
  teamCode: string;
  role: 'Batter' | 'Bowler' | 'All-rounder' | 'Wicketkeeper';
  jerseyNumber: number;
  imageUrl?: string;
  battingStyle?: string;
  bowlingStyle?: string;
}

// Verified player registry with authentic high-definition photographs from CREX Akamai CDN and Wikimedia Commons
export const VERIFIED_PLAYERS: Record<string, PlayerProfile> = {
  // ==========================================
  // WEST INDIES
  // ==========================================
  'wi_ajangoo': {
    id: 'wi_ajangoo',
    name: 'Amir Jangoo',
    shortName: 'A Jangoo',
    teamCode: 'WI',
    role: 'Wicketkeeper',
    jerseyNumber: 18,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/2X9.png',
    battingStyle: 'Left-hand bat',
    bowlingStyle: 'Right-arm medium'
  },
  'wi_khodge': {
    id: 'wi_khodge',
    name: 'Kavem Hodge',
    shortName: 'K Hodge',
    teamCode: 'WI',
    role: 'All-rounder',
    jerseyNumber: 7,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/265.png',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Slow left-arm orthodox'
  },
  'wi_kwickham': {
    id: 'wi_kwickham',
    name: 'Kevin Wickham',
    shortName: 'K Wickham',
    teamCode: 'WI',
    role: 'Batter',
    jerseyNumber: 87,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/87A.png',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm offbreak'
  },
  'wi_bking': {
    id: 'wi_bking',
    name: 'Brandon King',
    shortName: 'B King',
    teamCode: 'WI',
    role: 'Batter',
    jerseyNumber: 53,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/1CQ.png',
    battingStyle: 'Right-hand bat'
  },
  'wi_shope': {
    id: 'wi_shope',
    name: 'Shai Hope',
    shortName: 'S Hope',
    teamCode: 'WI',
    role: 'Wicketkeeper',
    jerseyNumber: 4,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/1C9.png',
    battingStyle: 'Right-hand bat'
  },
  'wi_npooran': {
    id: 'wi_npooran',
    name: 'Nicholas Pooran',
    shortName: 'N Pooran',
    teamCode: 'WI',
    role: 'Wicketkeeper',
    jerseyNumber: 29,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/2S.png',
    battingStyle: 'Left-hand bat'
  },
  'wi_jholder': {
    id: 'wi_jholder',
    name: 'Jason Holder',
    shortName: 'J Holder',
    teamCode: 'WI',
    role: 'All-rounder',
    jerseyNumber: 98,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/2Z.png',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm fast-medium'
  },
  'wi_arussell': {
    id: 'wi_arussell',
    name: 'Andre Russell',
    shortName: 'A Russell',
    teamCode: 'WI',
    role: 'All-rounder',
    jerseyNumber: 12,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/30.png',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm fast'
  },
  'wi_rpowell': {
    id: 'wi_rpowell',
    name: 'Rovman Powell',
    shortName: 'R Powell',
    teamCode: 'WI',
    role: 'Batter',
    jerseyNumber: 52,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/1Q8.png',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm medium'
  },
  'wi_shetmyer': {
    id: 'wi_shetmyer',
    name: 'Shimron Hetmyer',
    shortName: 'S Hetmyer',
    teamCode: 'WI',
    role: 'Batter',
    jerseyNumber: 2,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/1R4.png',
    battingStyle: 'Left-hand bat'
  },
  'wi_ajoseph': {
    id: 'wi_ajoseph',
    name: 'Alzarri Joseph',
    shortName: 'A Joseph',
    teamCode: 'WI',
    role: 'Bowler',
    jerseyNumber: 8,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/1W5.png',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm fast'
  },
  'wi_kbrathwaite': {
    id: 'wi_kbrathwaite',
    name: 'Kraigg Brathwaite',
    shortName: 'K Brathwaite',
    teamCode: 'WI',
    role: 'Batter',
    jerseyNumber: 21,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/10J.png',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm offbreak'
  },
  'wi_sjoseph': {
    id: 'wi_sjoseph',
    name: 'Shamar Joseph',
    shortName: 'S Joseph',
    teamCode: 'WI',
    role: 'Bowler',
    jerseyNumber: 70,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/7XQ.png',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm fast'
  },
  'wi_gmotie': {
    id: 'wi_gmotie',
    name: 'Gudakesh Motie',
    shortName: 'G Motie',
    teamCode: 'WI',
    role: 'Bowler',
    jerseyNumber: 64,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/3H4.png',
    battingStyle: 'Left-hand bat',
    bowlingStyle: 'Slow left-arm orthodox'
  },
  'wi_rshepherd': {
    id: 'wi_rshepherd',
    name: 'Romario Shepherd',
    shortName: 'R Shepherd',
    teamCode: 'WI',
    role: 'All-rounder',
    jerseyNumber: 16,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/38B.png',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm fast-medium'
  },
  'wi_jgreaves': {
    id: 'wi_jgreaves',
    name: 'Justin Greaves',
    shortName: 'J Greaves',
    teamCode: 'WI',
    role: 'All-rounder',
    jerseyNumber: 67,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/265.png',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm medium'
  },
  'wi_jdasilva': {
    id: 'wi_jdasilva',
    name: 'Joshua Da Silva',
    shortName: 'J Da Silva',
    teamCode: 'WI',
    role: 'Wicketkeeper',
    jerseyNumber: 99,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/2X9.png',
    battingStyle: 'Right-hand bat'
  },

  // ==========================================
  // BANGLADESH
  // ==========================================
  'ban_nhasan': {
    id: 'ban_nhasan',
    name: 'Nayeem Hasan',
    shortName: 'N Hasan',
    teamCode: 'BAN',
    role: 'Bowler',
    jerseyNumber: 37,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/I7.png',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm offbreak'
  },
  'ban_mhasan_miraz': {
    id: 'ban_mhasan_miraz',
    name: 'Mehidy Hasan Miraz',
    shortName: 'M Hasan Miraz',
    teamCode: 'BAN',
    role: 'All-rounder',
    jerseyNumber: 53,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/1CP.png',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm offbreak'
  },
  'ban_tislam': {
    id: 'ban_tislam',
    name: 'Taijul Islam',
    shortName: 'T Islam',
    teamCode: 'BAN',
    role: 'Bowler',
    jerseyNumber: 12,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/HZ.png',
    battingStyle: 'Left-hand bat',
    bowlingStyle: 'Slow left-arm orthodox'
  },
  'ban_nrana': {
    id: 'ban_nrana',
    name: 'Nahid Rana',
    shortName: 'N Rana',
    teamCode: 'BAN',
    role: 'Bowler',
    jerseyNumber: 28,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/B8G.png',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm fast'
  },
  'ban_shakib': {
    id: 'ban_shakib',
    name: 'Shakib Al Hasan',
    shortName: 'Shakib',
    teamCode: 'BAN',
    role: 'All-rounder',
    jerseyNumber: 75,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/2Y.png',
    battingStyle: 'Left-hand bat',
    bowlingStyle: 'Slow left-arm orthodox'
  },
  'ban_ldas': {
    id: 'ban_ldas',
    name: 'Litton Das',
    shortName: 'L Das',
    teamCode: 'BAN',
    role: 'Wicketkeeper',
    jerseyNumber: 16,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/I9.png',
    battingStyle: 'Right-hand bat'
  },
  'ban_nshanto': {
    id: 'ban_nshanto',
    name: 'Najmul Hossain Shanto',
    shortName: 'N Shanto',
    teamCode: 'BAN',
    role: 'Batter',
    jerseyNumber: 99,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/1CU.png',
    battingStyle: 'Left-hand bat'
  },
  'ban_tahmed': {
    id: 'ban_tahmed',
    name: 'Taskin Ahmed',
    shortName: 'T Ahmed',
    teamCode: 'BAN',
    role: 'Bowler',
    jerseyNumber: 3,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/I1.png',
    battingStyle: 'Left-hand bat',
    bowlingStyle: 'Right-arm fast'
  },
  'ban_mrahman': {
    id: 'ban_mrahman',
    name: 'Mustafizur Rahman',
    shortName: 'M Rahman',
    teamCode: 'BAN',
    role: 'Bowler',
    jerseyNumber: 90,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/HY.png',
    battingStyle: 'Left-hand bat',
    bowlingStyle: 'Left-arm fast-medium'
  },
  'ban_mrahim': {
    id: 'ban_mrahim',
    name: 'Mushfiqur Rahim',
    shortName: 'M Rahim',
    teamCode: 'BAN',
    role: 'Wicketkeeper',
    jerseyNumber: 15,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/2B.png',
    battingStyle: 'Right-hand bat'
  },
  'ban_thridoy': {
    id: 'ban_thridoy',
    name: 'Towhid Hridoy',
    shortName: 'T Hridoy',
    teamCode: 'BAN',
    role: 'Batter',
    jerseyNumber: 77,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/42A.png',
    battingStyle: 'Right-hand bat'
  },
  'ban_hmahmud': {
    id: 'ban_hmahmud',
    name: 'Hasan Mahmud',
    shortName: 'H Mahmud',
    teamCode: 'BAN',
    role: 'Bowler',
    jerseyNumber: 91,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/3P9.png',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm fast-medium'
  },
  'ban_mhaque': {
    id: 'ban_mhaque',
    name: 'Mominul Haque',
    shortName: 'M Haque',
    teamCode: 'BAN',
    role: 'Batter',
    jerseyNumber: 7,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/IB.png',
    battingStyle: 'Left-hand bat',
    bowlingStyle: 'Slow left-arm orthodox'
  },

  // ==========================================
  // INDIA
  // ==========================================
  'ind_vkohli': {
    id: 'ind_vkohli',
    name: 'Virat Kohli',
    shortName: 'V Kohli',
    teamCode: 'IND',
    role: 'Batter',
    jerseyNumber: 18,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/4I.png',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm medium'
  },
  'ind_rsharma': {
    id: 'ind_rsharma',
    name: 'Rohit Sharma',
    shortName: 'R Sharma',
    teamCode: 'IND',
    role: 'Batter',
    jerseyNumber: 45,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/2X.png',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm offbreak'
  },
  'ind_jbumrah': {
    id: 'ind_jbumrah',
    name: 'Jasprit Bumrah',
    shortName: 'J Bumrah',
    teamCode: 'IND',
    role: 'Bowler',
    jerseyNumber: 93,
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Jasprit%20Bumrah%20in%20PMO%20New%20Delhi.jpg?width=400',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm fast'
  },
  'ind_hpandya': {
    id: 'ind_hpandya',
    name: 'Hardik Pandya',
    shortName: 'H Pandya',
    teamCode: 'IND',
    role: 'All-rounder',
    jerseyNumber: 33,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/C3.png',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm fast-medium'
  },
  'ind_syadav': {
    id: 'ind_syadav',
    name: 'Suryakumar Yadav',
    shortName: 'SA Yadav',
    teamCode: 'IND',
    role: 'Batter',
    jerseyNumber: 63,
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Suryakumar%20Yadav%20(1).jpg?width=400',
    battingStyle: 'Right-hand bat'
  },
  'ind_rpant': {
    id: 'ind_rpant',
    name: 'Rishabh Pant',
    shortName: 'R Pant',
    teamCode: 'IND',
    role: 'Wicketkeeper',
    jerseyNumber: 17,
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Rishabh%20Pant%20in%20PMO%20New%20Delhi.jpg?width=400',
    battingStyle: 'Left-hand bat'
  },
  'ind_ssiraj': {
    id: 'ind_ssiraj',
    name: 'Mohammed Siraj',
    shortName: 'M Siraj',
    teamCode: 'IND',
    role: 'Bowler',
    jerseyNumber: 13,
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Mohammed%20Siraj%20in%20PMO%20New%20Delhi.jpg?width=400',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm fast'
  },
  'ind_sgill': {
    id: 'ind_sgill',
    name: 'Shubman Gill',
    shortName: 'S Gill',
    teamCode: 'IND',
    role: 'Batter',
    jerseyNumber: 77,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/O5.png',
    battingStyle: 'Right-hand bat'
  },
  'ind_yjaiswal': {
    id: 'ind_yjaiswal',
    name: 'Yashasvi Jaiswal',
    shortName: 'Y Jaiswal',
    teamCode: 'IND',
    role: 'Batter',
    jerseyNumber: 64,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/42B.png',
    battingStyle: 'Left-hand bat'
  },
  'ind_klrahul': {
    id: 'ind_klrahul',
    name: 'KL Rahul',
    shortName: 'KL Rahul',
    teamCode: 'IND',
    role: 'Wicketkeeper',
    jerseyNumber: 1,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/2T.png',
    battingStyle: 'Right-hand bat'
  },
  'ind_rjadeja': {
    id: 'ind_rjadeja',
    name: 'Ravindra Jadeja',
    shortName: 'R Jadeja',
    teamCode: 'IND',
    role: 'All-rounder',
    jerseyNumber: 8,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/2W.png',
    battingStyle: 'Left-hand bat',
    bowlingStyle: 'Slow left-arm orthodox'
  },
  'ind_apatel': {
    id: 'ind_apatel',
    name: 'Axar Patel',
    shortName: 'A Patel',
    teamCode: 'IND',
    role: 'All-rounder',
    jerseyNumber: 20,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/2V.png',
    battingStyle: 'Left-hand bat',
    bowlingStyle: 'Slow left-arm orthodox'
  },
  'ind_kyadav': {
    id: 'ind_kyadav',
    name: 'Kuldeep Yadav',
    shortName: 'K Yadav',
    teamCode: 'IND',
    role: 'Bowler',
    jerseyNumber: 23,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/1C7.png',
    battingStyle: 'Left-hand bat',
    bowlingStyle: 'Left-arm wrist spin'
  },
  'ind_mshami': {
    id: 'ind_mshami',
    name: 'Mohammed Shami',
    shortName: 'M Shami',
    teamCode: 'IND',
    role: 'Bowler',
    jerseyNumber: 11,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/2G.png',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm fast'
  },
  'ind_arshdeep': {
    id: 'ind_arshdeep',
    name: 'Arshdeep Singh',
    shortName: 'A Singh',
    teamCode: 'IND',
    role: 'Bowler',
    jerseyNumber: 2,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/3H5.png',
    battingStyle: 'Left-hand bat',
    bowlingStyle: 'Left-arm fast-medium'
  },
  'ind_ssamson': {
    id: 'ind_ssamson',
    name: 'Sanju Samson',
    shortName: 'S Samson',
    teamCode: 'IND',
    role: 'Wicketkeeper',
    jerseyNumber: 9,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/H8.png',
    battingStyle: 'Right-hand bat'
  },
  'ind_siyer': {
    id: 'ind_siyer',
    name: 'Shreyas Iyer',
    shortName: 'S Iyer',
    teamCode: 'IND',
    role: 'Batter',
    jerseyNumber: 96,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/1CR.png',
    battingStyle: 'Right-hand bat'
  },
  'ind_rinkusingh': {
    id: 'ind_rinkusingh',
    name: 'Rinku Singh',
    shortName: 'R Singh',
    teamCode: 'IND',
    role: 'Batter',
    jerseyNumber: 35,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/2W8.png',
    battingStyle: 'Left-hand bat'
  },
  'ind_kpandya': {
    id: 'ind_kpandya',
    name: 'Krunal Pandya',
    shortName: 'K Pandya',
    teamCode: 'IND',
    role: 'All-rounder',
    jerseyNumber: 24,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/CW.png',
    battingStyle: 'Left-hand bat',
    bowlingStyle: 'Slow left-arm orthodox'
  },

  // ==========================================
  // PAKISTAN
  // ==========================================
  'pak_bazam': {
    id: 'pak_bazam',
    name: 'Babar Azam',
    shortName: 'B Azam',
    teamCode: 'PAK',
    role: 'Batter',
    jerseyNumber: 56,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/F2.png',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm offbreak'
  },
  'pak_mrizwan': {
    id: 'pak_mrizwan',
    name: 'Mohammad Rizwan',
    shortName: 'M Rizwan',
    teamCode: 'PAK',
    role: 'Wicketkeeper',
    jerseyNumber: 16,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/F3.png',
    battingStyle: 'Right-hand bat'
  },
  'pak_safridi': {
    id: 'pak_safridi',
    name: 'Shaheen Afridi',
    shortName: 'S Afridi',
    teamCode: 'PAK',
    role: 'Bowler',
    jerseyNumber: 10,
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Shaheen%20Afridi%20(2).jpg?width=400',
    battingStyle: 'Left-hand bat',
    bowlingStyle: 'Left-arm fast'
  },
  'pak_nshah': {
    id: 'pak_nshah',
    name: 'Naseem Shah',
    shortName: 'N Shah',
    teamCode: 'PAK',
    role: 'Bowler',
    jerseyNumber: 71,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/3H7.png',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm fast'
  },
  'pak_hrauf': {
    id: 'pak_hrauf',
    name: 'Haris Rauf',
    shortName: 'H Rauf',
    teamCode: 'PAK',
    role: 'Bowler',
    jerseyNumber: 97,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/2U5.png',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm fast'
  },
  'pak_fzaman': {
    id: 'pak_fzaman',
    name: 'Fakhar Zaman',
    shortName: 'F Zaman',
    teamCode: 'PAK',
    role: 'Batter',
    jerseyNumber: 39,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/1CS.png',
    battingStyle: 'Left-hand bat'
  },
  'pak_skhan': {
    id: 'pak_skhan',
    name: 'Shadab Khan',
    shortName: 'S Khan',
    teamCode: 'PAK',
    role: 'All-rounder',
    jerseyNumber: 7,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/1CT.png',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm legbreak'
  },
  'pak_sayub': {
    id: 'pak_sayub',
    name: 'Saim Ayub',
    shortName: 'S Ayub',
    teamCode: 'PAK',
    role: 'Batter',
    jerseyNumber: 63,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/5M8.png',
    battingStyle: 'Left-hand bat'
  },

  // ==========================================
  // AUSTRALIA
  // ==========================================
  'aus_pcummins': {
    id: 'aus_pcummins',
    name: 'Pat Cummins',
    shortName: 'P Cummins',
    teamCode: 'AUS',
    role: 'Bowler',
    jerseyNumber: 30,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/2R.png',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm fast'
  },
  'aus_thead': {
    id: 'aus_thead',
    name: 'Travis Head',
    shortName: 'T Head',
    teamCode: 'AUS',
    role: 'Batter',
    jerseyNumber: 62,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/1CW.png',
    battingStyle: 'Left-hand bat',
    bowlingStyle: 'Right-arm offbreak'
  },
  'aus_mstarc': {
    id: 'aus_mstarc',
    name: 'Mitchell Starc',
    shortName: 'M Starc',
    teamCode: 'AUS',
    role: 'Bowler',
    jerseyNumber: 56,
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Mitchell%20Starc%20at%20Perth%20Stadium%2C%20First%20Test%20Australia%20versus%20West%20Indies%2C%202%20December%202022%2002%20(cropped).jpg?width=400',
    battingStyle: 'Left-hand bat',
    bowlingStyle: 'Left-arm fast'
  },
  'aus_gmaxwell': {
    id: 'aus_gmaxwell',
    name: 'Glenn Maxwell',
    shortName: 'G Maxwell',
    teamCode: 'AUS',
    role: 'All-rounder',
    jerseyNumber: 32,
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Glenn%20Maxwell%203.jpg?width=400',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm offbreak'
  },
  'aus_ssmith': {
    id: 'aus_ssmith',
    name: 'Steve Smith',
    shortName: 'SPD Smith',
    teamCode: 'AUS',
    role: 'Batter',
    jerseyNumber: 49,
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Steve%20Smith%20at%20Perth%20Stadium%2C%20First%20Test%20Australia%20versus%20West%20Indies%2C%202%20December%202022%2001%20(cropped).jpg?width=400',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm legbreak'
  },
  'aus_jhazlewood': {
    id: 'aus_jhazlewood',
    name: 'Josh Hazlewood',
    shortName: 'J Hazlewood',
    teamCode: 'AUS',
    role: 'Bowler',
    jerseyNumber: 38,
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Josh%20Hazlewood%20at%20Perth%20Stadium%2C%20First%20Test%20Australia%20versus%20West%20Indies%2C%202%20December%202022%2001%20(cropped).jpg?width=400',
    battingStyle: 'Left-hand bat',
    bowlingStyle: 'Right-arm fast-medium'
  },
  'aus_mmarsh': {
    id: 'aus_mmarsh',
    name: 'Mitchell Marsh',
    shortName: 'M Marsh',
    teamCode: 'AUS',
    role: 'All-rounder',
    jerseyNumber: 8,
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Mitchell%20Marsh%202023.jpg?width=400',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm medium'
  },
  'aus_azampa': {
    id: 'aus_azampa',
    name: 'Adam Zampa',
    shortName: 'A Zampa',
    teamCode: 'AUS',
    role: 'Bowler',
    jerseyNumber: 88,
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Adam%20Zampa%20(cropped).jpg?width=400',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm legbreak'
  },

  // ==========================================
  // ENGLAND
  // ==========================================
  'eng_jbuttler': {
    id: 'eng_jbuttler',
    name: 'Jos Buttler',
    shortName: 'J Buttler',
    teamCode: 'ENG',
    role: 'Wicketkeeper',
    jerseyNumber: 63,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/2E.png',
    battingStyle: 'Right-hand bat'
  },
  'eng_bstokes': {
    id: 'eng_bstokes',
    name: 'Ben Stokes',
    shortName: 'B Stokes',
    teamCode: 'ENG',
    role: 'All-rounder',
    jerseyNumber: 55,
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Ben%20Stokes%20August%202023%20(cropped).jpg?width=400',
    battingStyle: 'Left-hand bat',
    bowlingStyle: 'Right-arm fast-medium'
  },
  'eng_jroot': {
    id: 'eng_jroot',
    name: 'Joe Root',
    shortName: 'J Root',
    teamCode: 'ENG',
    role: 'Batter',
    jerseyNumber: 66,
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Joe%20Root%20August%202023%20(cropped).jpg?width=400',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm offbreak'
  },
  'eng_hbrook': {
    id: 'eng_hbrook',
    name: 'Harry Brook',
    shortName: 'H Brook',
    teamCode: 'ENG',
    role: 'Batter',
    jerseyNumber: 88,
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Harry%20Brook%20September%202023.jpg?width=400',
    battingStyle: 'Right-hand bat'
  },
  'eng_jarcher': {
    id: 'eng_jarcher',
    name: 'Jofra Archer',
    shortName: 'J Archer',
    teamCode: 'ENG',
    role: 'Bowler',
    jerseyNumber: 22,
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Jofra%20Archer%20May%202019.jpg?width=400',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm fast'
  },
  'eng_psalt': {
    id: 'eng_psalt',
    name: 'Phil Salt',
    shortName: 'P Salt',
    teamCode: 'ENG',
    role: 'Wicketkeeper',
    jerseyNumber: 28,
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Phil%20Salt%20June%202022.jpg?width=400',
    battingStyle: 'Right-hand bat'
  },

  // ==========================================
  // SOUTH AFRICA
  // ==========================================
  'sa_hklaasen': {
    id: 'sa_hklaasen',
    name: 'Heinrich Klaasen',
    shortName: 'H Klaasen',
    teamCode: 'SA',
    role: 'Wicketkeeper',
    jerseyNumber: 45,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/K0.png',
    battingStyle: 'Right-hand bat'
  },
  'sa_qdekock': {
    id: 'sa_qdekock',
    name: 'Quinton de Kock',
    shortName: 'Q de Kock',
    teamCode: 'SA',
    role: 'Wicketkeeper',
    jerseyNumber: 12,
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Quinton%20de%20Kock.jpg?width=400',
    battingStyle: 'Left-hand bat'
  },
  'sa_krabada': {
    id: 'sa_krabada',
    name: 'Kagiso Rabada',
    shortName: 'K Rabada',
    teamCode: 'SA',
    role: 'Bowler',
    jerseyNumber: 25,
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Kagiso%20Rabada%20(cropped).jpg?width=400',
    battingStyle: 'Left-hand bat',
    bowlingStyle: 'Right-arm fast'
  },
  'sa_amarkram': {
    id: 'sa_amarkram',
    name: 'Aiden Markram',
    shortName: 'A Markram',
    teamCode: 'SA',
    role: 'Batter',
    jerseyNumber: 4,
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Aiden%20Markram%20(cropped).jpg?width=400',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm offbreak'
  },
  'sa_dmiller': {
    id: 'sa_dmiller',
    name: 'David Miller',
    shortName: 'D Miller',
    teamCode: 'SA',
    role: 'Batter',
    jerseyNumber: 10,
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/David%20Miller%20(cricketer)%20(cropped).jpg?width=400',
    battingStyle: 'Left-hand bat'
  },

  // ==========================================
  // NEW ZEALAND
  // ==========================================
  'nz_kwilliamson': {
    id: 'nz_kwilliamson',
    name: 'Kane Williamson',
    shortName: 'K Williamson',
    teamCode: 'NZ',
    role: 'Batter',
    jerseyNumber: 22,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/31.png',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm offbreak'
  },
  'nz_tboult': {
    id: 'nz_tboult',
    name: 'Trent Boult',
    shortName: 'T Boult',
    teamCode: 'NZ',
    role: 'Bowler',
    jerseyNumber: 18,
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Trent%20Boult%20(cropped).jpg?width=400',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Left-arm fast-medium'
  },
  'nz_rravindra': {
    id: 'nz_rravindra',
    name: 'Rachin Ravindra',
    shortName: 'R Ravindra',
    teamCode: 'NZ',
    role: 'All-rounder',
    jerseyNumber: 8,
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Rachin%20Ravindra%202023.jpg?width=400',
    battingStyle: 'Left-hand bat',
    bowlingStyle: 'Slow left-arm orthodox'
  },
  'nz_dmitchell': {
    id: 'nz_dmitchell',
    name: 'Daryl Mitchell',
    shortName: 'D Mitchell',
    teamCode: 'NZ',
    role: 'All-rounder',
    jerseyNumber: 75,
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Daryl%20Mitchell%20(cricketer)%20(cropped).jpg?width=400',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm medium'
  },

  // ==========================================
  // AFGHANISTAN
  // ==========================================
  'afg_rkhan': {
    id: 'afg_rkhan',
    name: 'Rashid Khan',
    shortName: 'R Khan',
    teamCode: 'AFG',
    role: 'Bowler',
    jerseyNumber: 19,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/1D4.png',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm legbreak'
  },
  'afg_rgurbaz': {
    id: 'afg_rgurbaz',
    name: 'Rahmanullah Gurbaz',
    shortName: 'R Gurbaz',
    teamCode: 'AFG',
    role: 'Wicketkeeper',
    jerseyNumber: 21,
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Rahmanullah%20Gurbaz%202023.jpg?width=400',
    battingStyle: 'Right-hand bat'
  },
  'afg_mnabi': {
    id: 'afg_mnabi',
    name: 'Mohammad Nabi',
    shortName: 'M Nabi',
    teamCode: 'AFG',
    role: 'All-rounder',
    jerseyNumber: 7,
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Mohammad%20Nabi%20(cropped).jpg?width=400',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm offbreak'
  },

  // ==========================================
  // SRI LANKA
  // ==========================================
  'sl_pnissanka': {
    id: 'sl_pnissanka',
    name: 'Pathum Nissanka',
    shortName: 'P Nissanka',
    teamCode: 'SL',
    role: 'Batter',
    jerseyNumber: 18,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/2L8.png',
    battingStyle: 'Right-hand bat'
  },
  'sl_kmendis': {
    id: 'sl_kmendis',
    name: 'Kusal Mendis',
    shortName: 'K Mendis',
    teamCode: 'SL',
    role: 'Wicketkeeper',
    jerseyNumber: 13,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/1E6.png',
    battingStyle: 'Right-hand bat'
  },
  'sl_casalanka': {
    id: 'sl_casalanka',
    name: 'Charith Asalanka',
    shortName: 'C Asalanka',
    teamCode: 'SL',
    role: 'Batter',
    jerseyNumber: 21,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/29N.png',
    battingStyle: 'Left-hand bat',
    bowlingStyle: 'Right-arm offbreak'
  },
  'sl_whasaranga': {
    id: 'sl_whasaranga',
    name: 'Wanindu Hasaranga',
    shortName: 'W Hasaranga',
    teamCode: 'SL',
    role: 'All-rounder',
    jerseyNumber: 49,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/26C.png',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Legbreak'
  },
  'sl_mtheekshana': {
    id: 'sl_mtheekshana',
    name: 'Maheesh Theekshana',
    shortName: 'M Theekshana',
    teamCode: 'SL',
    role: 'Bowler',
    jerseyNumber: 61,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/34Q.png',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm offbreak'
  },
  'sl_mpathirana': {
    id: 'sl_mpathirana',
    name: 'Matheesha Pathirana',
    shortName: 'M Pathirana',
    teamCode: 'SL',
    role: 'Bowler',
    jerseyNumber: 99,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/8A7.png',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm fast'
  },
  'sl_dshanaka': {
    id: 'sl_dshanaka',
    name: 'Dasun Shanaka',
    shortName: 'D Shanaka',
    teamCode: 'SL',
    role: 'All-rounder',
    jerseyNumber: 7,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/1E5.png',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm medium'
  },
  'sl_dsilva': {
    id: 'sl_dsilva',
    name: 'Dhananjaya de Silva',
    shortName: 'D de Silva',
    teamCode: 'SL',
    role: 'All-rounder',
    jerseyNumber: 75,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/19B.png',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm offbreak'
  },
  'sl_dmadushanka': {
    id: 'sl_dmadushanka',
    name: 'Dilshan Madushanka',
    shortName: 'D Madushanka',
    teamCode: 'SL',
    role: 'Bowler',
    jerseyNumber: 98,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/49K.png',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Left-arm fast-medium'
  },
  'sl_nthushara': {
    id: 'sl_nthushara',
    name: 'Nuwan Thushara',
    shortName: 'N Thushara',
    teamCode: 'SL',
    role: 'Bowler',
    jerseyNumber: 47,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/3AK.png',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm fast-medium'
  },

  // ==========================================
  // IPL (CHENNAI SUPER KINGS, MUMBAI INDIANS, RCB, KKR)
  // ==========================================
  'csk_rgaikwad': {
    id: 'csk_rgaikwad',
    name: 'Ruturaj Gaikwad',
    shortName: 'R Gaikwad',
    teamCode: 'CSK',
    role: 'Batter',
    jerseyNumber: 31,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/297.png',
    battingStyle: 'Right-hand bat'
  },
  'csk_mdhoni': {
    id: 'csk_mdhoni',
    name: 'MS Dhoni',
    shortName: 'MS Dhoni',
    teamCode: 'CSK',
    role: 'Wicketkeeper',
    jerseyNumber: 7,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/2.png',
    battingStyle: 'Right-hand bat'
  },
  'kkr_siyer': {
    id: 'kkr_siyer',
    name: 'Shreyas Iyer',
    shortName: 'S Iyer',
    teamCode: 'KKR',
    role: 'Batter',
    jerseyNumber: 41,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/1CS.png',
    battingStyle: 'Right-hand bat'
  },
  'kkr_rsingh': {
    id: 'kkr_rsingh',
    name: 'Rinku Singh',
    shortName: 'R Singh',
    teamCode: 'KKR',
    role: 'Batter',
    jerseyNumber: 35,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/24X.png',
    battingStyle: 'Left-hand bat'
  },
  'kkr_snarine': {
    id: 'kkr_snarine',
    name: 'Sunil Narine',
    shortName: 'S Narine',
    teamCode: 'KKR',
    role: 'All-rounder',
    jerseyNumber: 74,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/8T.png',
    battingStyle: 'Left-hand bat',
    bowlingStyle: 'Right-arm offbreak'
  },
  'mi_tvarma': {
    id: 'mi_tvarma',
    name: 'Tilak Varma',
    shortName: 'T Varma',
    teamCode: 'MI',
    role: 'Batter',
    jerseyNumber: 9,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/38R.png',
    battingStyle: 'Left-hand bat',
    bowlingStyle: 'Right-arm offbreak'
  },

  // ==========================================
  // BBL (SYDNEY SIXERS & PERTH SCORCHERS)
  // ==========================================
  'bbl_jphilippe': {
    id: 'bbl_jphilippe',
    name: 'Josh Philippe',
    shortName: 'J Philippe',
    teamCode: 'SIX',
    role: 'Wicketkeeper',
    jerseyNumber: 22,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/2O3.png',
    battingStyle: 'Right-hand bat'
  },
  'bbl_mhenriques': {
    id: 'bbl_mhenriques',
    name: 'Moises Henriques',
    shortName: 'M Henriques',
    teamCode: 'SIX',
    role: 'All-rounder',
    jerseyNumber: 21,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/7.png',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm fast-medium'
  },
  'bbl_sabbott': {
    id: 'bbl_sabbott',
    name: 'Sean Abbott',
    shortName: 'S Abbott',
    teamCode: 'SIX',
    role: 'Bowler',
    jerseyNumber: 77,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/105.png',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm fast-medium'
  },
  'bbl_aturner': {
    id: 'bbl_aturner',
    name: 'Ashton Turner',
    shortName: 'A Turner',
    teamCode: 'SCO',
    role: 'All-rounder',
    jerseyNumber: 70,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/14Y.png',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm offbreak'
  },

  // ==========================================
  // SRI LANKA (SL)
  // ==========================================
  'sl_ddesilva': {
    id: 'sl_ddesilva',
    name: 'Dhananjaya de Silva',
    shortName: 'D de Silva',
    teamCode: 'SL',
    role: 'All-rounder',
    jerseyNumber: 75,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/FM.png',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm offbreak'
  },
  'sl_kamindumendis': {
    id: 'sl_kamindumendis',
    name: 'Kamindu Mendis',
    shortName: 'K Mendis',
    teamCode: 'SL',
    role: 'All-rounder',
    jerseyNumber: 21,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/LN.png',
    battingStyle: 'Left-hand bat',
    bowlingStyle: 'Right-arm offbreak'
  },
  'sl_dchandimal': {
    id: 'sl_dchandimal',
    name: 'Dinesh Chandimal',
    shortName: 'LD Chandimal',
    teamCode: 'SL',
    role: 'Wicketkeeper',
    jerseyNumber: 36,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/49.png',
    battingStyle: 'Right-hand bat'
  },
  'sl_amathews': {
    id: 'sl_amathews',
    name: 'Angelo Mathews',
    shortName: 'AD Mathews',
    teamCode: 'SL',
    role: 'All-rounder',
    jerseyNumber: 69,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/E9.png',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm medium'
  },
  'sl_pjayasuriya': {
    id: 'sl_pjayasuriya',
    name: 'Prabath Jayasuriya',
    shortName: 'P Jayasuriya',
    teamCode: 'SL',
    role: 'Bowler',
    jerseyNumber: 77,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/2G8.png',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Slow left-arm orthodox'
  },
  'sl_afernando': {
    id: 'sl_afernando',
    name: 'Asitha Fernando',
    shortName: 'A Fernando',
    teamCode: 'SL',
    role: 'Bowler',
    jerseyNumber: 78,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/2X2.png',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm fast-medium'
  },

  // ==========================================
  // PAKISTAN ACTIVE SQUAD (PAK)
  // ==========================================
  'pak_aminhas': {
    id: 'pak_aminhas',
    name: 'Arafat Minhas',
    shortName: 'A Minhas',
    teamCode: 'PAK',
    role: 'All-rounder',
    jerseyNumber: 32,
    imageUrl: 'https://cricketvectors.akamaized.net/players/org/9ME.png',
    battingStyle: 'Left-hand bat',
    bowlingStyle: 'Slow left-arm orthodox'
  }
};

/**
 * Normalizes team name or code into canonical 3-4 character code
 * Enforces franchise priority so franchise teams (e.g. Mumbai Indians) are NEVER confused with national teams (e.g. India)
 */
export function normalizeTeamCode(team?: string): string {
  if (!team) return '';

  // 1. Strip scores, overs, parentheses, numbers, and status text from the raw team string
  // e.g. "Sl 301 4 (75 5) (dhananjaya De Silva 115(173)..." -> "SL"
  // e.g. "Pakistan 434-9 ((106.3))" -> "Pakistan"
  let clean = team
    .replace(/\s*\d+[-\/]\d+\s*(\(\s*[\d\.]+\s*\))?/g, '')
    .replace(/\s*\(\s*[\d\.]+\s*\)/g, '')
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/[-_]/g, ' ')
    .trim();

  const upper = clean.toUpperCase().trim();

  // 2. Exact match check first
  if (upper === 'MI' || upper === 'CSK' || upper === 'RCB' || upper === 'KKR' || upper === 'DC' ||
      upper === 'RR' || upper === 'SRH' || upper === 'GT' || upper === 'LSG' || upper === 'PBKS' ||
      upper === 'PK' || upper === 'LQ' || upper === 'KK' || upper === 'MS' || upper === 'IU' ||
      upper === 'PZ' || upper === 'QG' || upper === 'SIX' || upper === 'SCO') {
    return upper === 'PK' ? 'PBKS' : upper;
  }

  // 3. Franchise Teams Check (PRIORITY BEFORE NATIONAL TEAMS to prevent "Indians" matching "IND")
  if (upper.includes('MUMBAI') || upper.includes('MI NY') || upper.includes('MI CAPE')) return 'MI';
  if (upper.includes('CHENNAI') || upper.includes('SUPER KINGS') || upper.includes('CSK')) return 'CSK';
  if (upper.includes('ROYAL CHALLENGERS') || upper.includes('BENGALURU') || upper.includes('BANGALORE') || upper.includes('RCB')) return 'RCB';
  if (upper.includes('KNIGHT RIDERS') || upper.includes('KOLKATA') || upper.includes('KKR')) return 'KKR';
  if (upper.includes('DELHI') || upper.includes('CAPITALS') || upper.includes('DAREDEVILS')) return 'DC';
  if (upper.includes('RAJASTHAN') || upper.includes('ROYALS') && !upper.includes('CHALLENGERS')) return 'RR';
  if (upper.includes('SUNRISERS') || upper.includes('HYDERABAD') || upper.includes('SRH')) return 'SRH';
  if (upper.includes('GUJARAT') || upper.includes('TITANS') || upper.includes('GT')) return 'GT';
  if (upper.includes('LUCKNOW') || upper.includes('SUPER GIANTS') || upper.includes('LSG')) return 'LSG';
  if (upper.includes('PUNJAB') || upper.includes('KINGS XI') || upper.includes('PBKS')) return 'PBKS';

  // PSL Franchises
  if (upper.includes('LAHORE') || upper.includes('QALANDARS')) return 'LQ';
  if (upper.includes('KARACHI') || upper.includes('KINGS') && !upper.includes('CHENNAI') && !upper.includes('PUNJAB')) return 'KK';
  if (upper.includes('ISLAMABAD') || upper.includes('UNITED') && !upper.includes('STATES')) return 'IU';
  if (upper.includes('PESHAWAR') || upper.includes('ZALMI')) return 'PZ';
  if (upper.includes('MULTAN') || upper.includes('SULTANS')) return 'MS';
  if (upper.includes('QUETTA') || upper.includes('GLADIATORS')) return 'QG';

  // BBL Franchises
  if (upper.includes('SIXERS')) return 'SIX';
  if (upper.includes('SCORCHERS')) return 'SCO';
  if (upper.includes('BRISBANE') || upper.includes('HEAT')) return 'HEA';
  if (upper.includes('STRIKERS') && !upper.includes('NON')) return 'STR';
  if (upper.includes('THUNDER')) return 'THU';
  if (upper.includes('RENEGADES')) return 'REN';
  if (upper.includes('STARS')) return 'STA';
  if (upper.includes('HURRICANES')) return 'HUR';

  // 4. National Teams Check
  if (upper === 'SL' || upper.startsWith('SL ') || upper.includes('SRI LANKA') || upper.includes('LANKA')) return 'SL';
  if (upper === 'PAK' || upper.startsWith('PAK ') || upper.includes('PAKISTAN')) return 'PAK';
  if (upper === 'AUS' || upper.startsWith('AUS ') || upper.includes('AUSTRALIA')) return 'AUS';
  if (upper === 'ENG' || upper.startsWith('ENG ') || upper.includes('ENGLAND')) return 'ENG';
  if (upper === 'SA' || upper === 'RSA' || upper.includes('SOUTH AFRICA')) return 'SA';
  if (upper === 'NZ' || upper.includes('NEW ZEALAND')) return 'NZ';
  if (upper === 'WI' || upper.includes('WEST INDIES') || upper.includes('WINDIES')) return 'WI';
  if (upper === 'BAN' || upper.startsWith('BAN ') || upper.includes('BANGLADESH')) return 'BAN';
  if (upper === 'AFG' || upper.startsWith('AFG ') || upper.includes('AFGHANISTAN')) return 'AFG';
  if (upper === 'IRE' || upper.includes('IRELAND')) return 'IRE';
  if (upper === 'ZIM' || upper.includes('ZIMBABWE')) return 'ZIM';
  if (upper === 'NED' || upper.includes('NETHERLANDS')) return 'NED';
  if (upper === 'SCO' || upper.includes('SCOTLAND')) return 'SCO';
  if (upper === 'USA' || upper.includes('UNITED STATES')) return 'USA';
  if (upper === 'NEP' || upper.includes('NEPAL')) return 'NEP';
  if (upper === 'OMA' || upper.includes('OMAN')) return 'OMA';
  if (upper === 'CAN' || upper.includes('CANADA')) return 'CAN';
  if (upper === 'NAM' || upper.includes('NAMIBIA')) return 'NAM';
  if (upper === 'UAE') return 'UAE';

  // India national team check (ONLY match India if not Indians)
  if (upper === 'IND' || upper.startsWith('IND ') || (upper.includes('INDIA') && !upper.includes('INDIAN'))) {
    return 'IND';
  }

  // Fallback: take leading alpha letters (up to 4 chars)
  const lettersOnly = upper.replace(/[^A-Z]/g, '');
  return lettersOnly.slice(0, 4) || 'CRX';
}

/**
 * Normalizes player name for matching
 */
export function normalizePlayerName(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\s*\(c\s*&\s*wk\)/gi, '')
    .replace(/\s*\(c\)/gi, '')
    .replace(/\s*\(wk\)/gi, '')
    .replace(/\s*\d+\(\d+\)/g, '') // remove score like 115(173)
    .replace(/[*#]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Gets all verified players for a specific team code
 */
export function getTeamRoster(teamCodeOrName: string): PlayerProfile[] {
  const targetCode = normalizeTeamCode(teamCodeOrName);
  if (!targetCode) return [];
  return Object.values(VERIFIED_PLAYERS).filter(
    (p) => normalizeTeamCode(p.teamCode) === targetCode
  );
}

/**
 * Resolves a player profile either by stable ID or name alias.
 * If teamCode is provided, strictly enforces that the player belongs to that team!
 */
export function resolvePlayerProfile(
  playerId?: string,
  playerName?: string,
  teamCodeOrName?: string
): PlayerProfile | null {
  const filterTeam = teamCodeOrName ? normalizeTeamCode(teamCodeOrName) : null;

  // 1. Match by stable ID
  if (playerId && VERIFIED_PLAYERS[playerId]) {
    const candidate = VERIFIED_PLAYERS[playerId];
    if (!filterTeam || normalizeTeamCode(candidate.teamCode) === filterTeam) {
      return candidate;
    }
  }

  if (playerName) {
    const clean = normalizePlayerName(playerName);
    if (!clean || clean.length < 2) return null;

    // Filter candidate list by team if team is known
    const candidates = filterTeam
      ? Object.values(VERIFIED_PLAYERS).filter((p) => normalizeTeamCode(p.teamCode) === filterTeam)
      : Object.values(VERIFIED_PLAYERS);

    // 2. Exact match on registered name or shortName
    for (const profile of candidates) {
      const pName = normalizePlayerName(profile.name);
      const pShort = normalizePlayerName(profile.shortName);
      if (pName === clean || pShort === clean) {
        return profile;
      }
    }

    // 3. Normalized slug comparison (e.g. "dhananjaya-de-silva" -> "Dhananjaya de Silva")
    const cleanSlug = clean.replace(/[^a-z0-9]/g, '');
    for (const profile of candidates) {
      const pSlug = normalizePlayerName(profile.name).replace(/[^a-z0-9]/g, '');
      if (pSlug === cleanSlug) {
        return profile;
      }
    }

    // 4. Initials + surname matching (e.g. "D de Silva" or "Dhananjaya de Silva", "K Mendis" or "Kusal Mendis")
    const cleanParts = clean.split(' ').filter(Boolean);
    const surname = cleanParts[cleanParts.length - 1];
    const initial = cleanParts[0][0];

    if (surname && surname.length > 2) {
      for (const profile of candidates) {
        const profileParts = normalizePlayerName(profile.name).split(' ').filter(Boolean);
        const profileSurname = profileParts[profileParts.length - 1];
        const profileInitial = profileParts[0][0];

        if (profileSurname === surname) {
          if (cleanParts.length === 1 || profileInitial === initial) {
            return profile;
          }
        }
      }
    }
  }

  return null;
}
