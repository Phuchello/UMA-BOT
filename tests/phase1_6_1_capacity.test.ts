import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDatabase } from '../src/database/Database.js';
import { getConfig, resetConfigForTesting } from '../src/config/env.js';
import { TeamRepository } from '../src/registration/TeamRepository.js';
import { RegistrationHandler } from '../src/bot/handlers/RegistrationHandler.js';

const originalMaxTeams = process.env.MAX_TEAMS;
const originalTournamentId = process.env.ACTIVE_TOURNAMENT_ID;

afterEach(() => {
  if (originalMaxTeams === undefined) delete process.env.MAX_TEAMS;
  else process.env.MAX_TEAMS = originalMaxTeams;
  if (originalTournamentId === undefined) delete process.env.ACTIVE_TOURNAMENT_ID;
  else process.env.ACTIVE_TOURNAMENT_ID = originalTournamentId;
  resetConfigForTesting();
});

describe('Phase 1.6.1 persisted tournament capacity', () => {
  it('keeps capacity 3 through config drift in panel, status, button, and registration', async () => {
    const db = createDatabase(':memory:');
    const repo = new TeamRepository(db);
    const tournamentId = 'capacity-drift-test';
    process.env.ACTIVE_TOURNAMENT_ID = tournamentId;
    process.env.MAX_TEAMS = '3';
    resetConfigForTesting();
    repo.ensureTournament(tournamentId, 'Original tournament', getConfig().MAX_TEAMS);

    process.env.MAX_TEAMS = '15';
    resetConfigForTesting();
    expect(getConfig().MAX_TEAMS).toBe(15);
    repo.ensureTournament(tournamentId, 'Changed config name', getConfig().MAX_TEAMS);
    expect(repo.getTournament(tournamentId)).toMatchObject({
      name: 'Original tournament',
      maxTeams: 3
    });

    for (let i = 1; i <= 3; i++) {
      const result = repo.registerTeam({
        tournamentId,
        name: `Team ${i}`,
        abbreviation: `T${i}`,
        captainDiscordId: `captain_${i}`,
        captainContact: `contact_${i}`,
        starters: Array.from({ length: 5 }, (_, slot) => ({
          ingameName: `Player ${i}-${slot}`,
          gameUid: `uid_${i}_${slot}`,
          isSubstitute: false,
          slotNumber: slot + 1
        })),
        substitutes: []
      });
      expect(result.success).toBe(true);
    }

    const handler = new RegistrationHandler(repo, {} as any);
    const slashInteraction = (subcommand: string) => ({
      commandName: 'uma',
      options: { getSubcommand: () => subcommand },
      inGuild: () => true,
      member: { permissions: { has: () => true } },
      reply: vi.fn(async () => undefined)
    });

    const panel = slashInteraction('panel');
    await handler.handleSlashCommand(panel as any);
    const panelDescription = (panel.reply.mock.calls[0] as any)[0].embeds[0].toJSON().description;
    expect(panelDescription).toContain('3 / 3');
    expect(panelDescription).toContain('Còn lại:** 0 suất');
    expect(panelDescription).not.toContain('15');

    const status = slashInteraction('status');
    await handler.handleSlashCommand(status as any);
    const statusContent = (status.reply.mock.calls[0] as any)[0].content as string;
    expect(statusContent).toContain('Đã duyệt chính thức:** 0 / 3 đội');
    expect(statusContent).toContain('Đang chờ BTC duyệt:** 3 đội');
    expect(statusContent).toContain('Tối đa 3 đội');
    expect(statusContent).not.toContain('15');

    const button = {
      customId: 'btn_register_team',
      user: { id: 'captain_4' },
      reply: vi.fn(async () => undefined),
      showModal: vi.fn(async () => undefined)
    };
    await handler.handleButton(button as any);
    expect((button.reply.mock.calls[0] as any)[0].content).toContain('3/3 đội');
    expect(button.showModal).not.toHaveBeenCalled();

    const fourth = repo.registerTeam({
      tournamentId,
      name: 'Team 4',
      abbreviation: 'T4',
      captainDiscordId: 'captain_4',
      captainContact: 'contact_4',
      starters: Array.from({ length: 5 }, (_, slot) => ({
        ingameName: `Player 4-${slot}`,
        gameUid: `uid_4_${slot}`,
        isSubstitute: false,
        slotNumber: slot + 1
      })),
      substitutes: []
    });
    expect(fourth.code).toBe('REGISTRATION_FULL');
  });

  it('shows a clear error when the active tournament is missing', async () => {
    const db = createDatabase(':memory:');
    const repo = new TeamRepository(db);
    const handler = new RegistrationHandler(repo, {} as any);
    process.env.ACTIVE_TOURNAMENT_ID = 'missing-capacity-test';
    resetConfigForTesting();

    for (const subcommand of ['panel', 'status']) {
      const interaction = {
        commandName: 'uma',
        options: { getSubcommand: () => subcommand },
        inGuild: () => true,
        member: { permissions: { has: () => true } },
        reply: vi.fn(async () => undefined)
      };
      await handler.handleSlashCommand(interaction as any);
      expect((interaction.reply.mock.calls[0] as any)[0]).toMatchObject({
        content: expect.stringContaining('chưa được khởi tạo'),
        ephemeral: true
      });
    }

    const button = {
      customId: 'btn_register_team',
      user: { id: 'captain' },
      reply: vi.fn(async () => undefined),
      showModal: vi.fn(async () => undefined)
    };
    await handler.handleButton(button as any);
    expect((button.reply.mock.calls[0] as any)[0].content).toContain('chưa được khởi tạo');
    expect(button.showModal).not.toHaveBeenCalled();
  });
});
