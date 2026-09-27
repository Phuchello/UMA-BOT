import { describe, expect, it } from 'vitest';
import { TextInputStyle } from 'discord.js';
import { RegistrationUI } from '../src/bot/ui/RegistrationUI.js';
import type { TeamEntity } from '../src/registration/TeamRepository.js';

const teamId = `team_${'a'.repeat(36)}`;
const now = Date.now();
const team: TeamEntity = {
  id: teamId,
  tournamentId: 'uma-smoke-test',
  name: 'UMA Smoke Test',
  abbreviation: 'SMK',
  captainDiscordId: '100000000000000001',
  captainContact: 'TEST-CONTACT',
  status: 'NEEDS_CORRECTION',
  rejectionReason: 'Verify the fake roster',
  btcReviewMessageId: null,
  createdAt: now,
  updatedAt: now,
  players: [
    ...Array.from({ length: 5 }, (_, index) => ({
      id: `player_${index}`,
      teamId,
      tournamentId: 'uma-smoke-test',
      discordId: null,
      ingameName: `SMK_Player_${index + 1}`,
      gameUid: `TEST_UID_00${index + 1}`,
      isSubstitute: false,
      slotNumber: index + 1,
      createdAt: now
    })),
    {
      id: 'player_sub',
      teamId,
      tournamentId: 'uma-smoke-test',
      discordId: null,
      ingameName: 'SMK_Sub',
      gameUid: 'TEST_UID_006',
      isSubstitute: true,
      slotNumber: 1,
      createdAt: now
    }
  ]
};

describe('RegistrationUI Discord builder constraints', () => {
  it('constructs and serializes the five-row registration modal', () => {
    expect(() => RegistrationUI.createRegistrationModal()).not.toThrow();
    const modal = RegistrationUI.createRegistrationModal().toJSON();
    expect(modal.custom_id).toBe('modal_register_team');
    expect(modal.title).toBe('Đăng ký Đội — Liên Quân Mobile');
    expect(modal.components).toHaveLength(5);

    const inputs = modal.components.map(row => row.components[0]);
    expect(inputs.map(input => input.custom_id)).toEqual([
      'txt_team_name',
      'txt_team_abbr',
      'txt_captain_contact',
      'txt_starters',
      'txt_subs'
    ]);
    expect(inputs[3]).toMatchObject({ style: TextInputStyle.Paragraph, required: true });
    expect(inputs[4]).toMatchObject({ style: TextInputStyle.Paragraph, required: false });
    for (const input of inputs) {
      if ('placeholder' in input && input.placeholder) {
        expect(input.placeholder.length).toBeLessThanOrEqual(100);
      }
    }
  });

  it('serializes edit modals with and without an optional substitute', () => {
    const withSubstitute = RegistrationUI.createEditRegistrationModal(team).toJSON();
    expect(withSubstitute.custom_id).toBe(`modal_edit_team_${teamId}`);
    expect(withSubstitute.components).toHaveLength(5);

    const withoutSubstitute: TeamEntity = {
      ...team,
      players: team.players!.filter(player => !player.isSubstitute)
    };
    expect(() => RegistrationUI.createEditRegistrationModal(withoutSubstitute).toJSON()).not.toThrow();
  });

  it('serializes correction and rejection reason modals', () => {
    expect(RegistrationUI.createRejectionReasonModal(teamId, true).toJSON().custom_id)
      .toBe(`modal_correction_${teamId}`);
    expect(RegistrationUI.createRejectionReasonModal(teamId, false).toJSON().custom_id)
      .toBe(`modal_reject_${teamId}`);
  });

  it('serializes every button row used by Phase 1', () => {
    expect(RegistrationUI.createRegistrationPanelButtons().toJSON().components).toHaveLength(3);
    expect(RegistrationUI.createBtcReviewButtons(teamId).toJSON().components).toHaveLength(3);
    expect(RegistrationUI.createBtcReviewButtons(teamId, true).toJSON().components).toHaveLength(3);
    expect(RegistrationUI.createMyTeamButtons(team)?.toJSON().components).toHaveLength(1);
    expect(RegistrationUI.createMyTeamButtons({ ...team, status: 'APPROVED' })).toBeNull();
  });

  it('serializes the Phase 1 embeds', () => {
    expect(RegistrationUI.createRegistrationPanelEmbed(1, 0, 1, 3).toJSON().description).toContain('1 / 3');
    expect(RegistrationUI.createBtcReviewEmbed(team).toJSON().title).toContain(team.name);
    expect(RegistrationUI.createTeamListEmbed([], [team]).toJSON().fields).toHaveLength(2);
    expect(RegistrationUI.createMyTeamEmbed(team).toJSON().title).toContain(team.name);
    expect(RegistrationUI.createGuideEmbed().toJSON().description).toContain('UMA_Top | 100000001');
  });
});
