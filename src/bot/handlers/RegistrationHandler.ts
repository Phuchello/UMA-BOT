import {
  ButtonInteraction,
  ModalSubmitInteraction,
  ChatInputCommandInteraction,
  GuildMember,
  TextChannel,
  Client
} from 'discord.js';
import { TeamRepository } from '../../registration/TeamRepository.js';
import { getTournamentCapacity } from '../../registration/TournamentCapacity.js';
import { RegistrationParser } from '../../registration/RegistrationParser.js';
import { RegistrationUI } from '../ui/RegistrationUI.js';
import { getConfig, isStaffMember } from '../../config/env.js';
import { persona } from '../persona/index.js';

export class RegistrationHandler {
  constructor(
    private teamRepo: TeamRepository,
    private client: Client
  ) {}

  public async handleButton(interaction: ButtonInteraction): Promise<void> {
    const { customId } = interaction;
    const config = getConfig();
    const tournamentId = config.ACTIVE_TOURNAMENT_ID;

    // 1. Register Team Button
    if (customId === 'btn_register_team') {
      const capacity = getTournamentCapacity(this.teamRepo, tournamentId);
      if (!capacity) {
        await interaction.reply({ content: persona.messages.registration.tournamentUninitialized(), ephemeral: true });
        return;
      }
      if (this.teamRepo.getTournament(tournamentId)?.status !== 'registration_open') {
        await interaction.reply({ content: persona.messages.registration.registrationClosed(), ephemeral: true });
        return;
      }

      const activeCaptainTeam = this.teamRepo.getCaptainActiveTeam(tournamentId, interaction.user.id);

      if (activeCaptainTeam) {
        const reaction = persona.reactionAttachment('annoyed', 'normal');
        const files = reaction ? [reaction] : [];
        await interaction.reply({
          content: persona.messages.registration.captainActiveExists(activeCaptainTeam.name, activeCaptainTeam.abbreviation),
          files,
          ephemeral: true
        });
        return;
      }


      if (capacity.activeCount >= capacity.maxTeams) {
        await interaction.reply({
          content: persona.messages.registration.capacityFull(capacity.activeCount, capacity.maxTeams),
          ephemeral: true
        });
        return;
      }

      await interaction.showModal(RegistrationUI.createRegistrationModal());
      return;
    }

    // 2. View Team List Button
    if (customId === 'btn_team_list') {
      const approved = this.teamRepo.listTeams(tournamentId, 'APPROVED');
      const pending = this.teamRepo.listTeams(tournamentId, 'PENDING');
      const embed = RegistrationUI.createTeamListEmbed(approved, pending);
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // 3. View Guide Button
    if (customId === 'btn_guide') {
      const embed = RegistrationUI.createGuideEmbed();
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // 4. Edit Corrected Team Button (Captain action)
    if (customId.startsWith('btn_edit_team_')) {
      if (this.teamRepo.getTournament(tournamentId)?.status !== 'registration_open') {
        await interaction.reply({ content: persona.messages.registration.editPhaseClosed(), ephemeral: true });
        return;
      }
      const teamId = customId.replace('btn_edit_team_', '');
      const team = this.teamRepo.getTeam(teamId);

      if (!team) {
        await interaction.reply({ content: persona.messages.registration.teamNotFound(), ephemeral: true });
        return;
      }

      if (team.tournamentId !== tournamentId) {
        await interaction.reply({ content: persona.messages.registration.teamNotInActiveTournament(), ephemeral: true });
        return;
      }

      if (team.captainDiscordId !== interaction.user.id) {
        await interaction.reply({ content: persona.messages.registration.notCaptain(), ephemeral: true });
        return;
      }

      if (team.status !== 'NEEDS_CORRECTION') {
        await interaction.reply({
          content: persona.messages.registration.notInCorrectionState(team.status),
          ephemeral: true
        });
        return;
      }

      await interaction.showModal(RegistrationUI.createEditRegistrationModal(team));
      return;
    }

    // 5. Staff Approval Actions in #ban-tổ-chức
    if (customId.startsWith('btc_')) {
      if (!this.checkStaffPermission(interaction)) {
        await interaction.reply({
          content: persona.messages.errors.permissionDenied('Ban Tổ Chức'),
          ephemeral: true
        });
        return;
      }

      const parts = customId.split('_');
      const action = parts[1]; // 'approve' | 'correction' | 'reject'
      const teamId = parts.slice(2).join('_');

      if (action === 'approve') {
        const result = this.teamRepo.approveTeam(teamId, interaction.user.id);
        if (!result.success) {
          await interaction.reply({ content: `⚠️ ${result.error}`, ephemeral: true });
          return;
        }

        const team = result.team!;
        const updatedEmbed = RegistrationUI.createBtcReviewEmbed(team);
        const disabledButtons = RegistrationUI.createBtcReviewButtons(team.id, true);

        await interaction.update({ embeds: [updatedEmbed], components: [disabledButtons] });

        // Notify captain via DM if permitted
        try {
          const captainUser = await this.client.users.fetch(team.captainDiscordId);
          await captainUser.send({
            content: persona.messages.btc.approvedDm(team.name, team.abbreviation)
          });
        } catch {
          // Ignore DM block
        }
        return;
      }

      if (action === 'correction') {
        await interaction.showModal(RegistrationUI.createRejectionReasonModal(teamId, true));
        return;
      }

      if (action === 'reject') {
        await interaction.showModal(RegistrationUI.createRejectionReasonModal(teamId, false));
        return;
      }
    }
  }

  public async handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
    const { customId } = interaction;
    const config = getConfig();
    const tournamentId = config.ACTIVE_TOURNAMENT_ID;

    // 1. Team Registration Modal Submission
    if (customId === 'modal_register_team') {
      const teamName = interaction.fields.getTextInputValue('txt_team_name');
      const teamAbbr = interaction.fields.getTextInputValue('txt_team_abbr');
      const captainContact = interaction.fields.getTextInputValue('txt_captain_contact');
      const startersRaw = interaction.fields.getTextInputValue('txt_starters');
      const subsRaw = interaction.fields.getTextInputValue('txt_subs') || undefined;

      const parseResult = RegistrationParser.parseRoster(startersRaw, subsRaw, config.MAX_SUBSTITUTES);
      if (!parseResult.success) {
        await interaction.reply({
          content: persona.messages.registration.invalidRoster(parseResult.error),
          ephemeral: true
        });
        return;
      }

      const regResult = this.teamRepo.registerTeam({
        tournamentId,
        name: teamName,
        abbreviation: teamAbbr,
        captainDiscordId: interaction.user.id,
        captainContact: captainContact,
        starters: parseResult.starters,
        substitutes: parseResult.substitutes
      });

      if (!regResult.success) {
        await interaction.reply({
          content: `❌ **Không thể ghi nhận đơn đăng ký:**\n${regResult.error}`,
          ephemeral: true
        });
        return;
      }

      const team = regResult.team!;

      // Dispatch to BTC Review Channel
      try {
        const btcChannel = (await this.client.channels.fetch(config.BTC_CHANNEL_ID)) as TextChannel | null;
        if (btcChannel && btcChannel.isTextBased()) {
          const reviewEmbed = RegistrationUI.createBtcReviewEmbed(team);
          const reviewButtons = RegistrationUI.createBtcReviewButtons(team.id);
          const reviewMessage = await btcChannel.send({
            embeds: [reviewEmbed],
            components: [reviewButtons]
          });
          this.teamRepo.setBtcReviewMessageId(team.id, reviewMessage.id);
        }
      } catch (err) {
        console.error('Failed to post to BTC review channel:', err);
      }

      const reaction = persona.reactionAttachment('confident', 'normal');
      const files = reaction ? [reaction] : [];
      await interaction.reply({
        content: persona.messages.registration.registrationSuccess(
          team.name,
          team.abbreviation,
          5,
          (team.players || []).filter(p => p.isSubstitute).length
        ),
        files,
        ephemeral: true
      });
      return;
    }


    // 2. Captain Resubmission of Corrected Team
    if (customId.startsWith('modal_edit_team_')) {
      const teamId = customId.replace('modal_edit_team_', '');
      const teamName = interaction.fields.getTextInputValue('txt_team_name');
      const teamAbbr = interaction.fields.getTextInputValue('txt_team_abbr');
      const captainContact = interaction.fields.getTextInputValue('txt_captain_contact');
      const startersRaw = interaction.fields.getTextInputValue('txt_starters');
      const subsRaw = interaction.fields.getTextInputValue('txt_subs') || undefined;

      const parseResult = RegistrationParser.parseRoster(startersRaw, subsRaw, config.MAX_SUBSTITUTES);
      if (!parseResult.success) {
        await interaction.reply({
          content: persona.messages.registration.invalidRoster(parseResult.error),
          ephemeral: true
        });
        return;
      }

      const resubmitResult = this.teamRepo.resubmitCorrectedTeam({
        teamId,
        tournamentId,
        captainDiscordId: interaction.user.id,
        name: teamName,
        abbreviation: teamAbbr,
        captainContact,
        starters: parseResult.starters,
        substitutes: parseResult.substitutes
      });

      if (!resubmitResult.success) {
        await interaction.reply({
          content: `❌ **Không thể cập nhật đơn đăng ký:**\n${resubmitResult.error}`,
          ephemeral: true
        });
        return;
      }

      const updatedTeam = resubmitResult.team!;

      // Refresh / Resend BTC Review Card
      try {
        const btcChannel = (await this.client.channels.fetch(config.BTC_CHANNEL_ID)) as TextChannel | null;
        if (btcChannel && btcChannel.isTextBased()) {
          const reviewEmbed = RegistrationUI.createBtcReviewEmbed(updatedTeam);
          const reviewButtons = RegistrationUI.createBtcReviewButtons(updatedTeam.id, false);

          let updatedExisting = false;
          if (updatedTeam.btcReviewMessageId) {
            try {
              const msg = await btcChannel.messages.fetch(updatedTeam.btcReviewMessageId);
              if (msg) {
                await msg.edit({ embeds: [reviewEmbed], components: [reviewButtons] });
                updatedExisting = true;
              }
            } catch {
              // Message fetch failed, send fresh message below
            }
          }

          if (!updatedExisting) {
            const newMsg = await btcChannel.send({ embeds: [reviewEmbed], components: [reviewButtons] });
            this.teamRepo.setBtcReviewMessageId(updatedTeam.id, newMsg.id);
          }
        }
      } catch (err) {
        console.error('Failed to refresh BTC review message on resubmit:', err);
      }

      await interaction.reply({
        content: persona.messages.registration.resubmitSuccess(updatedTeam.name, updatedTeam.abbreviation),
        ephemeral: true
      });
      return;
    }

    // 3. BTC Correction / Rejection Modal Submission
    if (customId.startsWith('modal_correction_') || customId.startsWith('modal_reject_')) {
      if (!this.checkStaffPermission(interaction)) {
        await interaction.reply({
          content: persona.messages.errors.permissionDenied('Ban Tổ Chức'),
          ephemeral: true
        });
        return;
      }

      const isCorrection = customId.startsWith('modal_correction_');
      const teamId = customId.replace(isCorrection ? 'modal_correction_' : 'modal_reject_', '');
      const reason = interaction.fields.getTextInputValue('txt_reason');

      const result = isCorrection
        ? this.teamRepo.requestCorrection(teamId, interaction.user.id, reason)
        : this.teamRepo.rejectTeam(teamId, interaction.user.id, reason);

      if (!result.success) {
        await interaction.reply({ content: `⚠️ ${result.error}`, ephemeral: true });
        return;
      }

      const team = result.team!;
      const updatedEmbed = RegistrationUI.createBtcReviewEmbed(team);
      const disabledButtons = RegistrationUI.createBtcReviewButtons(team.id, true);

      if (interaction.isFromMessage()) {
        await interaction.update({ embeds: [updatedEmbed], components: [disabledButtons] });
      } else {
        await interaction.reply({ embeds: [updatedEmbed], components: [disabledButtons], ephemeral: true });
      }

      // Notify captain via DM
      try {
        const captainUser = await this.client.users.fetch(team.captainDiscordId);
        const actionMsg = isCorrection
          ? persona.messages.btc.correctionDm(team.name, reason)
          : persona.messages.btc.rejectedDm(team.name, reason);
        await captainUser.send({ content: actionMsg });
      } catch {
        // Ignore DM block
      }
      return;
    }
  }

  public async handleSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const config = getConfig();
    const tournamentId = config.ACTIVE_TOURNAMENT_ID;
    const { commandName } = interaction;

    if (commandName === 'uma') {
      const subcommand = interaction.options.getSubcommand();

      if (subcommand === 'panel') {
        if (!this.checkStaffPermission(interaction)) {
          await interaction.reply({
            content: persona.messages.errors.permissionDenied('Chỉ Ban Tổ Chức hoặc Quản trị viên mới được xuất bảng đăng ký.'),
            ephemeral: true
          });
          return;
        }

        const capacity = getTournamentCapacity(this.teamRepo, tournamentId);
        if (!capacity) {
          await interaction.reply({ content: persona.messages.registration.tournamentUninitialized(), ephemeral: true });
          return;
        }

        const approved = this.teamRepo.listTeams(tournamentId, 'APPROVED');
        const pending = this.teamRepo.listTeams(tournamentId, 'PENDING');
        const correction = this.teamRepo.listTeams(tournamentId, 'NEEDS_CORRECTION');
        const approvedCount = approved.length;
        const pendingOrCorrectionCount = pending.length + correction.length;
        const status = this.teamRepo.getTournament(tournamentId)!.status;
        const embed = RegistrationUI.createRegistrationPanelEmbed(capacity.activeCount, approvedCount, pendingOrCorrectionCount, capacity.maxTeams, status);
        const buttons = RegistrationUI.createRegistrationPanelButtons(status);

        await interaction.reply({ embeds: [embed], components: [buttons] });
        return;
      }

      if (subcommand === 'teams') {
        const approved = this.teamRepo.listTeams(tournamentId, 'APPROVED');
        const pending = this.teamRepo.listTeams(tournamentId, 'PENDING');
        const embed = RegistrationUI.createTeamListEmbed(approved, pending);
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      if (subcommand === 'my-team') {
        const team = this.teamRepo.getCaptainActiveTeam(tournamentId, interaction.user.id);
        if (!team) {
          await interaction.reply({
            content: persona.messages.registration.myTeamEmpty(tournamentId),
            ephemeral: true
          });
          return;
        }

        const embed = RegistrationUI.createMyTeamEmbed(team);
        const reaction = persona.reactionAttachment('confident', 'normal');
        const files = reaction ? [reaction] : [];
        if (reaction) {
          embed.setThumbnail('attachment://reaction.gif');
        }
        const buttons = RegistrationUI.createMyTeamButtons(team, this.teamRepo.getTournament(tournamentId)?.status);

        await interaction.reply({
          embeds: [embed],
          files,
          components: buttons ? [buttons] : [],
          ephemeral: true
        });
        return;
      }


      if (subcommand === 'status') {
        const capacity = getTournamentCapacity(this.teamRepo, tournamentId);
        if (!capacity) {
          await interaction.reply({ content: persona.messages.registration.tournamentUninitialized(), ephemeral: true });
          return;
        }

        const approved = this.teamRepo.listTeams(tournamentId, 'APPROVED');
        const pending = this.teamRepo.listTeams(tournamentId, 'PENDING');
        const rejected = this.teamRepo.listTeams(tournamentId, 'REJECTED');
        const correction = this.teamRepo.listTeams(tournamentId, 'NEEDS_CORRECTION');

        await interaction.reply({
          content:
            `📊 **TRẠNG THÁI GIẢI ĐẤU UMA CUP (${tournamentId}):**\n` +
            `• **Đã duyệt chính thức:** ${approved.length} / ${capacity.maxTeams} đội\n` +
            `• **Đang chờ BTC duyệt:** ${pending.length} đội\n` +
            `• **Yêu cầu chỉnh sửa:** ${correction.length} đội\n` +
            `• **Đã từ chối:** ${rejected.length} đội\n` +
            `• **Hạn ngạch:** Tối đa ${capacity.maxTeams} đội (5 tuyển thủ chính/đội)`,
          ephemeral: true
        });
        return;
      }
    }
  }

  private checkStaffPermission(interaction: ButtonInteraction | ModalSubmitInteraction | ChatInputCommandInteraction): boolean {
    if (!interaction.inGuild() || !interaction.member) {
      return false;
    }

    const member = interaction.member as GuildMember;
    if (member.permissions.has('Administrator')) {
      return true;
    }

    const roleIds = Array.from(member.roles.cache.keys());
    return isStaffMember(roleIds);
  }
}
