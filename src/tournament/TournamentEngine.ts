/**
 * Application-owned Tournament Engine Interface
 *
 * This abstraction completely decouples the application, registration, and Discord layers
 * from any third-party bracket libraries (such as tournament-organizer).
 */

export interface EngineTeam {
  id: string;
  name: string;
  seed?: number;
}

export interface EngineMatchParticipant {
  id: string | null;
  name: string | null;
  score: number;
}

export interface EngineMatch {
  id: string;
  round: number;
  matchNumber: number;
  team1: EngineMatchParticipant;
  team2: EngineMatchParticipant;
  winnerId: string | null;
  loserId: string | null;
  isBye: boolean;
  hasEnded: boolean;
  isActive: boolean;
}

export type TournamentEngineStatus = 'setup' | 'in_progress' | 'completed';

export interface EngineBracket {
  tournamentId: string;
  name: string;
  status: TournamentEngineStatus;
  currentRound: number;
  totalRounds: number;
  matches: EngineMatch[];
  rounds: Record<number, EngineMatch[]>;
}

export interface TournamentEngineOptions {
  bestOf?: number;
  format?: 'single-elimination';
}

export interface TournamentEngine {
  createTournament(id: string, name: string, options?: TournamentEngineOptions): void;
  registerTeams(teams: EngineTeam[]): void;
  startTournament(): EngineBracket;
  getBracket(): EngineBracket;
  getMatches(round?: number): EngineMatch[];
  getMatch(matchId: string): EngineMatch | null;
  reportResult(matchId: string, team1Score: number, team2Score: number): {
    updatedMatches: EngineMatch[];
    bracket: EngineBracket;
  };
  resetResult(matchId: string): {
    updatedMatches: EngineMatch[];
    bracket: EngineBracket;
  };
  serialize(): string;
  restore(serializedState: string): void;
}
