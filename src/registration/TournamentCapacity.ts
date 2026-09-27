import { TeamRepository } from './TeamRepository.js';

/** Read the active tournament's persisted capacity for runtime UI guards and displays. */
export function getTournamentCapacity(repo: TeamRepository, tournamentId: string) {
  const tournament = repo.getTournament(tournamentId);
  if (!tournament) return null;

  return {
    maxTeams: tournament.maxTeams,
    activeCount: repo.getActiveTeamsCount(tournamentId)
  };
}
