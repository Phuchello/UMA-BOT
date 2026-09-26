import Manager from 'tournament-organizer';
import type {
  TournamentEngine,
  EngineTeam,
  EngineMatch,
  EngineBracket,
  TournamentEngineOptions,
  TournamentEngineStatus
} from './TournamentEngine.js';

export class TournamentOrganizerAdapter implements TournamentEngine {
  private manager: any;
  private tourney: any = null;
  private teamNameMap: Map<string, string> = new Map();

  constructor() {
    this.manager = new Manager();
  }

  public createTournament(
    id: string,
    name: string,
    options: TournamentEngineOptions = {}
  ): void {
    const bestOf = options.bestOf ?? 3;
    this.tourney = this.manager.createTournament(
      name,
      {
        stageOne: { format: 'single-elimination' },
        scoring: { bestOf },
        sorting: 'ascending'
      },
      id
    );
    this.teamNameMap.clear();
  }

  public registerTeams(teams: EngineTeam[]): void {
    if (!this.tourney) {
      throw new Error('Tournament has not been initialized. Call createTournament first.');
    }

    for (const team of teams) {
      this.teamNameMap.set(team.id, team.name);
      const player = this.tourney.createPlayer(team.name, team.id);
      if (team.seed !== undefined) {
        player.set({ value: team.seed });
      }
    }
  }

  public startTournament(): EngineBracket {
    if (!this.tourney) {
      throw new Error('Tournament has not been initialized.');
    }
    this.tourney.startTournament();
    return this.getBracket();
  }

  public getBracket(): EngineBracket {
    if (!this.tourney) {
      throw new Error('Tournament has not been initialized.');
    }

    const matches = this.getMatches();
    const rounds: Record<number, EngineMatch[]> = {};
    let maxRound = 1;

    for (const m of matches) {
      if (!rounds[m.round]) rounds[m.round] = [];
      rounds[m.round].push(m);
      if (m.round > maxRound) maxRound = m.round;
    }

    // Determine status
    let status: TournamentEngineStatus = 'setup';
    const rawStatus = this.tourney.getStatus();
    if (rawStatus === 'complete') {
      status = 'completed';
    } else if (rawStatus === 'stage-one' || rawStatus === 'stage-two') {
      // Check if all matches have ended
      const allEnded = matches.length > 0 && matches.every(m => m.hasEnded);
      status = allEnded ? 'completed' : 'in_progress';
    }

    return {
      tournamentId: this.tourney.getId(),
      name: this.tourney.getName(),
      status,
      currentRound: this.tourney.getRoundNumber(),
      totalRounds: maxRound,
      matches,
      rounds
    };
  }

  public getMatches(round?: number): EngineMatch[] {
    if (!this.tourney) {
      throw new Error('Tournament has not been initialized.');
    }

    const rawMatches: any[] = round
      ? this.tourney.getMatchesByRound(round)
      : this.tourney.getMatches();

    return rawMatches.map((m: any) => this.mapMatch(m));
  }

  public getMatch(matchId: string): EngineMatch | null {
    if (!this.tourney) {
      throw new Error('Tournament has not been initialized.');
    }

    try {
      const raw = this.tourney.getMatch(matchId);
      return raw ? this.mapMatch(raw) : null;
    } catch {
      return null;
    }
  }

  public reportResult(
    matchId: string,
    team1Score: number,
    team2Score: number
  ): { updatedMatches: EngineMatch[]; bracket: EngineBracket } {
    if (!this.tourney) {
      throw new Error('Tournament has not been initialized.');
    }

    const updatedRaw = this.tourney.enterResult(matchId, team1Score, team2Score);
    const updatedMatches = (updatedRaw || []).map((m: any) => this.mapMatch(m));

    return {
      updatedMatches,
      bracket: this.getBracket()
    };
  }

  public resetResult(matchId: string): {
    updatedMatches: EngineMatch[];
    bracket: EngineBracket;
  } {
    if (!this.tourney) {
      throw new Error('Tournament has not been initialized.');
    }

    const updatedRaw = this.tourney.clearResult(matchId);
    const updatedMatches = (updatedRaw || []).map((m: any) => this.mapMatch(m));

    return {
      updatedMatches,
      bracket: this.getBracket()
    };
  }

  public serialize(): string {
    if (!this.tourney) {
      throw new Error('Tournament has not been initialized.');
    }

    const exported = this.tourney.getValues();
    const payload = {
      exported,
      teamNames: Object.fromEntries(this.teamNameMap.entries())
    };
    return JSON.stringify(payload);
  }

  public restore(serializedState: string): void {
    const parsed = JSON.parse(serializedState);
    if (!parsed || !parsed.exported) {
      throw new Error('Invalid serialized tournament state.');
    }

    this.manager = new Manager();
    this.tourney = this.manager.loadTournament(parsed.exported);

    this.teamNameMap.clear();
    if (parsed.teamNames) {
      for (const [id, name] of Object.entries(parsed.teamNames)) {
        this.teamNameMap.set(id, name as string);
      }
    }
  }

  private mapMatch(rawMatch: any): EngineMatch {
    const p1 = rawMatch.getPlayer1();
    const p2 = rawMatch.getPlayer2();
    const winner = rawMatch.getWinner();
    const loser = rawMatch.getLoser();

    const p1Id = p1?.id ?? null;
    const p2Id = p2?.id ?? null;

    return {
      id: rawMatch.getId(),
      round: rawMatch.getRoundNumber(),
      matchNumber: rawMatch.getMatchNumber(),
      team1: {
        id: p1Id,
        name: p1Id ? (this.teamNameMap.get(p1Id) ?? `Team ${p1Id}`) : null,
        score: p1?.win ?? 0
      },
      team2: {
        id: p2Id,
        name: p2Id ? (this.teamNameMap.get(p2Id) ?? `Team ${p2Id}`) : null,
        score: p2?.win ?? 0
      },
      winnerId: winner?.id ?? null,
      loserId: loser?.id ?? null,
      isBye: rawMatch.isBye() ?? false,
      hasEnded: rawMatch.hasEnded() ?? false,
      isActive: rawMatch.isActive() ?? false
    };
  }
}
