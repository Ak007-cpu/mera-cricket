import { MatchState, BallEvent } from '../types/cricket';

export type CommentatorRole = 'female' | 'male';

export interface CommentarySettings {
  enabled: boolean;              // Master ON/OFF
  femaleVoiceEnabled: boolean;  // Female Voice ON/OFF
  maleVoiceEnabled: boolean;    // Male Voice ON/OFF
  autoSwitching: boolean;       // Automatic Voice Switching ON/OFF
  femaleVolume: number;         // 0 to 100
  maleVolume: number;           // 0 to 100
  language: 'urdu_english' | 'english' | 'urdu'; // Urdu + English / English / Urdu
}

export interface CommentaryEntry {
  id: string;
  speaker: CommentatorRole;
  speakerName: string;
  roleTitle: string;
  text: string;
  eventType?: string;
  timestamp: number;
}

const DEFAULT_SETTINGS: CommentarySettings = {
  enabled: true,
  femaleVoiceEnabled: true,
  maleVoiceEnabled: true,
  autoSwitching: true,
  femaleVolume: 90,
  maleVolume: 95,
  language: 'urdu_english'
};

class VoiceCommentaryService {
  private settings: CommentarySettings = DEFAULT_SETTINGS;
  private commentaryHistory: CommentaryEntry[] = [];
  private isSpeaking: boolean = false;
  private currentSpeaker: CommentatorRole = 'male';
  private timer: NodeJS.Timeout | null = null;
  private lastBallId: string | null = null;
  private lastSpokenText: string = '';
  private recentPhrases: Set<string> = new Set();
  private subscribers: Set<(entry: CommentaryEntry, isSpeaking: boolean) => void> = new Set();
  private stateSubscribers: Set<(isSpeaking: boolean, currentSpeaker: CommentatorRole) => void> = new Set();
  private settingsSubscribers: Set<(settings: CommentarySettings) => void> = new Set();

  private synth: SpeechSynthesis | null = null;
  private femaleVoice: SpeechSynthesisVoice | null = null;
  private maleVoice: SpeechSynthesisVoice | null = null;
  private voicesLoaded: boolean = false;

  constructor() {
    this.loadSettings();
    if (typeof window !== 'undefined') {
      this.synth = window.speechSynthesis || null;
      this.initVoices();
    }
  }

  private loadSettings() {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('cricket_commentary_settings');
        if (saved) {
          this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
        }
      }
    } catch {
      this.settings = DEFAULT_SETTINGS;
    }
  }

  public saveSettings(newSettings: Partial<CommentarySettings>) {
    this.settings = { ...this.settings, ...newSettings };
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('cricket_commentary_settings', JSON.stringify(this.settings));
      }
    } catch {}
    this.notifySettingsChanged();
  }

  public getSettings(): CommentarySettings {
    return { ...this.settings };
  }

  private initVoices() {
    if (!this.synth) return;
    const populate = () => {
      const voices = this.synth?.getVoices() || [];
      if (voices.length > 0) {
        this.voicesLoaded = true;
        this.selectOptimalVoices(voices);
      }
    };
    populate();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = populate;
    }
  }

  private selectOptimalVoices(voices: SpeechSynthesisVoice[]) {
    // Look for Urdu / Hindi voices first, or clean English voices
    const urduVoices = voices.filter((v) => v.lang.startsWith('ur') || v.lang.startsWith('hi'));
    
    // Female voice search
    const femaleCandidates = voices.filter((v) => {
      const name = v.name.toLowerCase();
      return (
        name.includes('female') ||
        name.includes('zira') ||
        name.includes('samantha') ||
        name.includes('victoria') ||
        name.includes('karen') ||
        name.includes('moira') ||
        name.includes('serena') ||
        name.includes('swara') ||
        name.includes('ananya')
      );
    });

    // Male voice search
    const maleCandidates = voices.filter((v) => {
      const name = v.name.toLowerCase();
      return (
        name.includes('male') ||
        name.includes('david') ||
        name.includes('george') ||
        name.includes('daniel') ||
        name.includes('oliver') ||
        name.includes('neerja') === false && (name.includes('madhav') || name.includes('rishi') || name.includes('guy'))
      );
    });

    this.femaleVoice = femaleCandidates[0] || urduVoices.find((v) => v.name.toLowerCase().includes('female')) || voices[0] || null;
    this.maleVoice = maleCandidates[0] || urduVoices.find((v) => !v.name.toLowerCase().includes('female')) || voices[1] || voices[0] || null;
  }

  public subscribe(cb: (entry: CommentaryEntry, isSpeaking: boolean) => void): () => void {
    this.subscribers.add(cb);
    return () => this.subscribers.delete(cb);
  }

  public subscribeState(cb: (isSpeaking: boolean, currentSpeaker: CommentatorRole) => void): () => void {
    this.stateSubscribers.add(cb);
    return () => this.stateSubscribers.delete(cb);
  }

  public subscribeSettings(cb: (settings: CommentarySettings) => void): () => void {
    this.settingsSubscribers.add(cb);
    return () => this.settingsSubscribers.delete(cb);
  }

  private notify(entry: CommentaryEntry) {
    this.subscribers.forEach((cb) => {
      try {
        cb(entry, this.isSpeaking);
      } catch {}
    });
  }

  private notifyState() {
    this.stateSubscribers.forEach((cb) => {
      try {
        cb(this.isSpeaking, this.currentSpeaker);
      } catch {}
    });
  }

  private notifySettingsChanged() {
    this.settingsSubscribers.forEach((cb) => {
      try {
        cb(this.settings);
      } catch {}
    });
  }

  public getHistory(): CommentaryEntry[] {
    return [...this.commentaryHistory];
  }

  /**
   * Starts the 7-second intelligent commentary loop
   */
  public start(getMatch: () => MatchState | null) {
    this.stop();
    // Immediate initial observation after 1 second
    setTimeout(() => {
      const m = getMatch();
      if (m) this.generateIdleObservation(m);
    }, 1200);

    // Dynamic 7-second interval
    this.timer = setInterval(() => {
      const m = getMatch();
      if (m && m.gameState === 'live' && !this.isSpeaking) {
        this.generateIdleObservation(m);
      }
    }, 7000);
  }

  public stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.stopAudio();
  }

  public stopAudio() {
    if (this.synth) {
      try {
        this.synth.cancel();
      } catch {}
    }
    this.isSpeaking = false;
    this.notifyState();
  }

  /**
   * Reacts immediately to important live match events (Wicket, 4, 6, 50, 100, Maiden)
   */
  public onLiveMatchEvent(match: MatchState, ball: BallEvent) {
    if (!this.settings.enabled) return;
    if (ball.id === this.lastBallId) return;
    this.lastBallId = ball.id;

    // Male commentator reacts to boundaries and exciting events as requested
    // Female commentator explains tactical wickets and milestones
    let speaker: CommentatorRole = 'male';
    if (ball.isWicket) {
      // Alternates naturally: Male yells the wicket, Female follows up with dismissal review
      speaker = this.currentSpeaker === 'male' ? 'female' : 'male';
    } else if (ball.isFour || ball.isSix) {
      speaker = 'male'; // Energetic male reaction
    } else {
      speaker = this.getNextSpeaker();
    }

    const text = this.generateEventCommentary(match, ball, speaker);
    this.speak(speaker, text, ball.isWicket ? 'wicket' : ball.isSix ? 'six' : ball.isFour ? 'four' : 'run');
  }

  /**
   * Generates idle situational commentary every ~7 seconds
   */
  public generateIdleObservation(match: MatchState) {
    if (!this.settings.enabled) return;
    if (this.isSpeaking) return;

    // Pick next alternating speaker
    const speaker = this.getNextSpeaker();
    const text = this.generateSituationalCommentary(match, speaker);
    this.speak(speaker, text, 'situational');
  }

  private getNextSpeaker(): CommentatorRole {
    if (!this.settings.autoSwitching) {
      if (this.settings.femaleVoiceEnabled && !this.settings.maleVoiceEnabled) return 'female';
      if (this.settings.maleVoiceEnabled && !this.settings.femaleVoiceEnabled) return 'male';
      return this.currentSpeaker;
    }

    if (this.settings.femaleVoiceEnabled && this.settings.maleVoiceEnabled) {
      this.currentSpeaker = this.currentSpeaker === 'male' ? 'female' : 'male';
      return this.currentSpeaker;
    }

    if (this.settings.femaleVoiceEnabled) return 'female';
    return 'male';
  }

  /**
   * Natural conversational Urdu + English commentary for live events
   */
  private generateEventCommentary(match: MatchState, ball: BallEvent, speaker: CommentatorRole): string {
    const bat = ball.batsmanName || match.striker.name;
    const bowl = ball.bowlerName || match.currentBowler.name;
    const lang = this.settings.language;

    if (ball.isWicket) {
      if (speaker === 'male') {
        const urduOptions = [
          `OUT! Clean bowled! ${bowl} ne kya shaandar yorker daali hai! Middle stump ukhad gaya! ${bat} out hokar wapas jaate hue!`,
          `WICKET! Bada jhatka! ${bat} ne hawa mein shot khela aur boundary par aasan catch! ${bowl} ki kamal ki bowling!`,
          `GONE! Edge laga aur wicketkeeper ne koi ghalti nahi ki! ${bowl} ko mili bohot badi kamyabi! Massive breakthrough!`,
          `OUT! LBW ki zabardast appeal aur umpire ki ungli upar! ${bowl} ne bilkul line pe ball phenki thi!`
        ];
        return lang === 'english'
          ? `OUT! What a sensational delivery from ${bowl}! Clean bowled, the middle stump is out of the ground! ${bat} has to walk back!`
          : urduOptions[Math.floor(Math.random() * urduOptions.length)];
      } else {
        const femaleUrduOptions = [
          `Bilkul, bohot hi critical wicket! ${bat} set lag rahe thay lekin ${bowl} ne planning ke sath dismissal kiya. Team ab mushkil mein hai.`,
          `Zabardast bowling change! ${bowl} ne batsman ki weakness ko target kiya aur partnership break kar di. Very smart cricket.`,
          `Yeh wicket match ka turning point sabit ho sakti hai. Ab naye batsman par bohot bara pressure hoga crease par settle hone ka.`
        ];
        return lang === 'english'
          ? `A massive breakthrough indeed! ${bowl} bowled with surgical precision, breaking this dangerous partnership. Game-changing moment!`
          : femaleUrduOptions[Math.floor(Math.random() * femaleUrduOptions.length)];
      }
    }

    if (ball.isSix) {
      if (speaker === 'male') {
        const urduOptions = [
          `BOOM! Yeh gaya boundary ke paar! 95 meter ka massive six! ${bat} ne front leg nikaal kar stadium ke bahar phenk diya!`,
          `SIX! Enormous hit! ${bat} ne full delivery ko pick kiya aur long-on ke upar se zabardast chakka! Crowd dewana ho gaya!`,
          `Kamaal ka shot! Stand and deliver! ${bat} ki power hitting lajawab hai! Pure maximum!`
        ];
        return lang === 'english'
          ? `BOOM! That is huge! A towering 95-meter maximum from ${bat}! Launched high into the top tier!`
          : urduOptions[Math.floor(Math.random() * urduOptions.length)];
      } else {
        const femaleUrduOptions = [
          `Superb timing aur bat speed! ${bat} ne ball ki length ko bohot jaldi read kiya aur middle of the bat se connect kiya.`,
          `Incredible execution! ${bowl} ne thodi si flight di aur ${bat} ne pura faida uthaya. Run rate tezi se upar ja raha hai.`
        ];
        return lang === 'english'
          ? `Exquisite timing and pure elegance! ${bat} judged the length early and executed the lofted shot to perfection.`
          : femaleUrduOptions[Math.floor(Math.random() * femaleUrduOptions.length)];
      }
    }

    if (ball.isFour) {
      if (speaker === 'male') {
        const urduOptions = [
          `FOUR! Khoobsurat cover drive! Gap dhoonda aur ball rocket ki tarah boundary rope ke paar chaar run ke liye!`,
          `CHOKA! Classic stroke play from ${bat}! Fielder ke paas koi mauka nahi tha rokne ka! Beautifully timed!`,
          `Cracking shot! Short ball ko pull kiya aur square leg boundary ke paar char run! Pure class!`
        ];
        return lang === 'english'
          ? `FOUR! Pierced the gap with laser precision! Superb boundary through the covers from ${bat}!`
          : urduOptions[Math.floor(Math.random() * urduOptions.length)];
      } else {
        const femaleUrduOptions = [
          `Textbook cricket! ${bat} ne body ke paas se khela aur placement bilkul accurate thi. Fielder siraf dekhte reh gaye.`,
          `Bowler ne width di aur ${bat} ne pounce kiya. Bowling team ko apni line tight rakhni hogi.`
        ];
        return lang === 'english'
          ? `Textbook stroke play! Beautiful presentation of the full face of the bat, finding the boundary with ease.`
          : femaleUrduOptions[Math.floor(Math.random() * femaleUrduOptions.length)];
      }
    }

    // Default runs / dot
    if (speaker === 'female') {
      return lang === 'english'
        ? `Sensible batting here. Rotated the strike with a quick single, keeping the scoreboard ticking nicely.`
        : `Achhi running between the wickets. Single le kar strike rotate ki, pressure release karne ka behtareen tareeqa.`;
    } else {
      return lang === 'english'
        ? `Dot ball! Tight delivery on a good length from ${bowl}, giving the batsman no room to free his arms.`
        : `Dot ball! ${bowl} ki tight line aur length, batsman ko khul kar khelne ka koi mauqa nahi diya.`;
    }
  }

  /**
   * Situational & tactical observations when no new ball is bowled (~every 7 seconds)
   */
  private generateSituationalCommentary(match: MatchState, speaker: CommentatorRole): string {
    const s = match.striker;
    const b = match.currentBowler;
    const batTeam = match.battingTeam;
    const bowlTeam = match.bowlingTeam;
    const part = match.currentPartnership;
    const lang = this.settings.language;

    // Female commentator focuses on match situation, bowler strategies, player performances
    if (speaker === 'female') {
      const femaleUrduObservations = [
        `${s.name} is waqt ${s.runs} runs par khel rahe hain aur unka strike rate ${s.strikeRate.toFixed(1)} kaafi controlled hai. Unhein apni innings ko lamba le kar jaana hoga.`,
        `${bowlTeam.name} ke captain ko chahiye ke thodi aggressive fielding set karein. ${b.name} ne abhi tak ${b.overs} overs mein ${b.wickets} wickets li hain aur econ ${b.economy.toFixed(1)} bohot tight hai.`,
        `Dono batsmen ke darmiyan ${part ? `${part.runs} runs ki partnership` : 'achhi understanding'} ho chuki hai. Strike rotation bohot regular hai jo bowlers ko settle nahi hone de rahi.`,
        `Pitch ka mizaaj dekhein to ball thoda ruk kar aa raha hai. Spinners ke liye grip maujood hai jabke fast bowlers ko seam movement mil sakti hai.`,
        `${batTeam.name} ka current run rate ${match.currentRunRate.toFixed(2)} hai. Agar yeh rate barqarar raha to score aik challenging total tak pohanch sakta hai.`
      ];

      const femaleEnglishObservations = [
        `${s.name} is batting sensibly on ${s.runs} with a solid strike rate of ${s.strikeRate.toFixed(1)}. Anchoring the innings exceptionally well.`,
        `${b.name} has maintained a disciplined line throughout, conceding just ${b.runs} runs in ${b.overs} overs with ${b.wickets} wickets. Top class spell.`,
        `The partnership is flourishing nicely. Running hard between the wickets puts persistent pressure on the fielding unit.`,
        `The current run rate stands at ${match.currentRunRate.toFixed(2)}. Both batters are executing their game plan with utmost clarity.`
      ];

      const list = lang === 'english' ? femaleEnglishObservations : femaleUrduObservations;
      return this.pickNonRepeating(list);
    }

    // Male commentator focuses on exciting highlights, boundaries expectation, tactical banter
    const maleUrduObservations = [
      `Bilkul Ayesha! ${s.name} kaafi dangerous batsman hain aur jab aik baar set ho jaate hain to boundary lagana unke liye aasan ho jata hai!`,
      `Crowd bohot energetic hai stadium mein! Har ball par shor mach raha hai, match ka mahol bohot exciting ho chuka hai!`,
      `${b.name} run-up par wapas jaate hue. Dekhna hoga ke agla over kis strategy ke sath bowl karte hain! Short pitch aayegi ya yorker?`,
      `Match bohot thrilling phase mein dakhil ho chuka hai! Kisi bhi waqt koi bada hit ya wicket match ka naqsha badal sakti hai!`,
      `Fielders bilkul on their toes hain 30-yard circle ke andar. Extra cover aur mid-wicket dono active hain.`
    ];

    const maleEnglishObservations = [
      `Spot on analysis! ${s.name} has tremendous boundary potential once set. The bowling side cannot afford any loose deliveries here!`,
      `The atmosphere in the stadium is absolutely electric! Every run and dot ball is being cheered passionately!`,
      `${b.name} heading back to the bowling mark. Expecting a change of pace or a sharp bouncer in this upcoming sequence!`,
      `What an intense contest between bat and ball! Tension building up with every single delivery!`
    ];

    const list = lang === 'english' ? maleEnglishObservations : maleUrduObservations;
    return this.pickNonRepeating(list);
  }

  private pickNonRepeating(list: string[]): string {
    const unvisited = list.filter((p) => !this.recentPhrases.has(p));
    const chosen = (unvisited.length > 0 ? unvisited : list)[Math.floor(Math.random() * (unvisited.length > 0 ? unvisited.length : list.length))];
    
    this.recentPhrases.add(chosen);
    if (this.recentPhrases.size > 8) {
      const first = Array.from(this.recentPhrases)[0];
      this.recentPhrases.delete(first);
    }
    return chosen;
  }

  /**
   * Synthesizes and plays the spoken audio with pitch/rate configured for realistic gender voice
   */
  public speak(speaker: CommentatorRole, text: string, eventType?: string) {
    if (!this.settings.enabled) return;

    // Check individual voice enablement
    if (speaker === 'female' && !this.settings.femaleVoiceEnabled) return;
    if (speaker === 'male' && !this.settings.maleVoiceEnabled) return;

    if (!text || text === this.lastSpokenText) return;
    this.lastSpokenText = text;

    const entry: CommentaryEntry = {
      id: `comm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      speaker,
      speakerName: speaker === 'female' ? 'Ayesha Khan' : 'Tariq Mehmood',
      roleTitle: speaker === 'female' ? 'Lead Match Analyst' : 'Senior Commentator',
      text,
      eventType,
      timestamp: Date.now()
    };

    this.commentaryHistory.unshift(entry);
    if (this.commentaryHistory.length > 40) {
      this.commentaryHistory.pop();
    }

    if (!this.synth) {
      this.notify(entry);
      return;
    }

    // Cancel any previous speech so voices never overlap or speak simultaneously
    try {
      this.synth.cancel();
    } catch {}

    const utterance = new SpeechSynthesisUtterance(text);

    // Apply specific voice, pitch, rate, and volume
    if (speaker === 'female') {
      if (this.femaleVoice) utterance.voice = this.femaleVoice;
      utterance.pitch = 1.2;  // Natural, energetic female tone
      utterance.rate = 1.04;   // Fluent broadcast cadence
      utterance.volume = Math.max(0.1, Math.min(1.0, this.settings.femaleVolume / 100));
    } else {
      if (this.maleVoice) utterance.voice = this.maleVoice;
      utterance.pitch = 0.85;  // Deep, resonant, confident sports commentator voice
      utterance.rate = 0.98;   // Authoritative cadence
      utterance.volume = Math.max(0.1, Math.min(1.0, this.settings.maleVolume / 100));
    }

    utterance.onstart = () => {
      this.isSpeaking = true;
      this.currentSpeaker = speaker;
      this.notifyState();
      this.notify(entry);
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      this.notifyState();
    };

    utterance.onerror = () => {
      this.isSpeaking = false;
      this.notifyState();
    };

    try {
      this.synth.speak(utterance);
    } catch (e) {
      console.warn('SpeechSynthesis speak notice:', e);
      this.isSpeaking = false;
      this.notify(entry);
    }
  }

  /**
   * Manual test trigger for testing the female voice
   */
  public testFemaleVoice() {
    const text = this.settings.language === 'english'
      ? "Welcome to Live Cricket HD! I'm Ayesha Khan, analyzing the pitch conditions, bowler lengths, and game strategies for today's match."
      : "Assalam-o-Alaikum aur khush-aamdeed! Main hoon Ayesha Khan. Aaj ke is aham match mein hum pitch conditions, bowler strategies aur batsmen ki performance ka jaiza lenge.";
    this.speak('female', text, 'test');
  }

  /**
   * Manual test trigger for testing the male voice
   */
  public testMaleVoice() {
    const text = this.settings.language === 'english'
      ? "Hello cricket fans! Tariq Mehmood with you for ball-by-ball excitement, blistering boundaries, and electrifying wickets!"
      : "Welcome cricket ke deewano! Main hoon Tariq Mehmood, live commentary box se har ball ka haal, zabardast chokay, chakkay aur exciting wickets ke sath!";
    this.speak('male', text, 'test');
  }
}

export const voiceCommentaryService = new VoiceCommentaryService();
