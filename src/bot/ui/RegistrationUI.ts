import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import type { TeamEntity } from '../../registration/TeamRepository.js';

export class RegistrationUI {
  /**
   * Main registration portal panel for #đăng-ký-thi-đấu
   * Shows full capacity breakdown: active (PENDING+APPROVED+NEEDS_CORRECTION),
   * approved-only, pending/correction, and remaining slots.
   */
  public static createRegistrationPanelEmbed(
    activeCount: number,
    approvedCount: number,
    pendingOrCorrectionCount: number,
    maxTeams: number
  ): EmbedBuilder {
    const remaining = Math.max(0, maxTeams - activeCount);
    return new EmbedBuilder()
      .setColor(0x00A8FF)
      .setTitle('🏆 UMA CUP — ĐĂNG KÝ THI ĐẤU')
      .setDescription(
        'Chào mừng các kiện tướng đến với giải đấu Liên Quân Mobile thường niên của **UMA Club**!\n\n' +
        '**📋 THÔNG TIN GIẢI ĐẤU:**\n' +
        '• **Bộ môn:** Liên Quân Mobile 5v5\n' +
        '• **Đội hình chuẩn:** Đúng 5 tuyển thủ chính thức (+ tối đa 2 dự bị)\n' +
        '• **Thể thức:** Single Elimination (Loại trực tiếp)\n' +
        '• **Trạng thái:** 🟢 **ĐANG MỞ ĐĂNG KÝ**\n\n' +
        '**📊 TÌNH HÌNH ĐĂNG KÝ:**\n' +
        `• 👥 **Đã đăng ký:** \`${activeCount} / ${maxTeams}\`\n` +
        `• ✅ **Đã duyệt:** ${approvedCount}\n` +
        `• ⏳ **Chờ duyệt / chỉnh sửa:** ${pendingOrCorrectionCount}\n` +
        `• 🟢 **Còn lại:** ${remaining} suất\n\n` +
        '📌 *Đội trưởng vui lòng bấm nút bên dưới để mở đơn đăng ký đội.*'
      )
      .setFooter({ text: 'UMA Tournament System • Vietnamese-First Esports UX' })
      .setTimestamp();
  }

  public static createRegistrationPanelButtons(): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_register_team')
        .setLabel('📝 Đăng ký đội')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('btn_team_list')
        .setLabel('👥 Danh sách đội')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('btn_guide')
        .setLabel('📘 Hướng dẫn')
        .setStyle(ButtonStyle.Success)
    );
  }

  /**
   * Discord Modal for Team Registration (fits cleanly in 5 Action Rows)
   */
  public static createRegistrationModal(): ModalBuilder {
    const modal = new ModalBuilder()
      .setCustomId('modal_register_team')
      .setTitle('Đăng ký Đội — Liên Quân Mobile');

    const nameInput = new TextInputBuilder()
      .setCustomId('txt_team_name')
      .setLabel('1. Tên đội thi đấu')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('VD: UMA Phoenix')
      .setMinLength(3)
      .setMaxLength(32)
      .setRequired(true);

    const abbrInput = new TextInputBuilder()
      .setCustomId('txt_team_abbr')
      .setLabel('2. Tên viết tắt (TAG đội)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('VD: PNX (2 đến 5 ký tự)')
      .setMinLength(2)
      .setMaxLength(5)
      .setRequired(true);

    const contactInput = new TextInputBuilder()
      .setCustomId('txt_captain_contact')
      .setLabel('3. SĐT / Zalo Đội trưởng')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('VD: 0912345678 (Bảo mật, chỉ BTC xem để liên lạc)')
      .setMinLength(6)
      .setMaxLength(30)
      .setRequired(true);

    const startersInput = new TextInputBuilder()
      .setCustomId('txt_starters')
      .setLabel('4. 5 Tuyển thủ chính (Tên | UID)')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder(
        'Đúng 5 dòng, định dạng: [Tên Ingame | Game UID]\n' +
        'VD:\n' +
        'UMA_Captain | 100000001\n' +
        'UMA_Mid | 100000002\n' +
        'UMA_Adc | 100000003\n' +
        'UMA_Sp | 100000004\n' +
        'UMA_Jungle | 100000005'
      )
      .setRequired(true);

    const subsInput = new TextInputBuilder()
      .setCustomId('txt_subs')
      .setLabel('5. Dự bị (Tùy chọn, tối đa 2 dòng: Tên | UID)')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder(
        'Tùy chọn (0-2 dòng): [Tên Ingame | Game UID]\n' +
        'VD:\n' +
        'UMA_Sub1 | 100000006'
      )
      .setRequired(false);

    return modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(abbrInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(contactInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(startersInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(subsInput)
    );
  }

  /**
   * Discord Modal for Editing / Correcting an Existing Team Registration
   */
  public static createEditRegistrationModal(team: TeamEntity): ModalBuilder {
    const modal = new ModalBuilder()
      .setCustomId(`modal_edit_team_${team.id}`)
      .setTitle(`Sửa Đơn — ${team.name}`);

    const starters = (team.players || []).filter(p => !p.isSubstitute);
    const substitutes = (team.players || []).filter(p => p.isSubstitute);

    const startersValue = starters.map(p => `${p.ingameName} | ${p.gameUid}`).join('\n');
    const subsValue = substitutes.map(p => `${p.ingameName} | ${p.gameUid}`).join('\n');

    const nameInput = new TextInputBuilder()
      .setCustomId('txt_team_name')
      .setLabel('1. Tên đội thi đấu')
      .setStyle(TextInputStyle.Short)
      .setValue(team.name)
      .setMinLength(3)
      .setMaxLength(32)
      .setRequired(true);

    const abbrInput = new TextInputBuilder()
      .setCustomId('txt_team_abbr')
      .setLabel('2. Tên viết tắt (TAG đội)')
      .setStyle(TextInputStyle.Short)
      .setValue(team.abbreviation)
      .setMinLength(2)
      .setMaxLength(5)
      .setRequired(true);

    const contactInput = new TextInputBuilder()
      .setCustomId('txt_captain_contact')
      .setLabel('3. SĐT / Zalo Đội trưởng')
      .setStyle(TextInputStyle.Short)
      .setValue(team.captainContact)
      .setMinLength(6)
      .setMaxLength(30)
      .setRequired(true);

    const startersInput = new TextInputBuilder()
      .setCustomId('txt_starters')
      .setLabel('4. 5 Tuyển thủ chính (Tên | UID)')
      .setStyle(TextInputStyle.Paragraph)
      .setValue(startersValue)
      .setRequired(true);

    const subsInput = new TextInputBuilder()
      .setCustomId('txt_subs')
      .setLabel('5. Dự bị (Tùy chọn, tối đa 2 dòng: Tên | UID)')
      .setStyle(TextInputStyle.Paragraph)
      .setValue(subsValue)
      .setRequired(false);

    return modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(abbrInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(contactInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(startersInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(subsInput)
    );
  }

  /**
   * BTC Review Card in #ban-tổ-chức
   */
  public static createBtcReviewEmbed(team: TeamEntity): EmbedBuilder {
    const starters = (team.players || []).filter(p => !p.isSubstitute);
    const substitutes = (team.players || []).filter(p => p.isSubstitute);

    let statusHeader = '🟡 ĐƠN ĐĂNG KÝ CHỜ DUYỆT';
    let color = 0xF59E0B; // Amber

    if (team.status === 'APPROVED') {
      statusHeader = '🟢 ĐƠN ĐÃ ĐƯỢC DUYỆT';
      color = 0x10B981; // Green
    } else if (team.status === 'REJECTED') {
      statusHeader = '🔴 ĐƠN ĐÃ TỪ CHỐI';
      color = 0xEF4444; // Red
    } else if (team.status === 'NEEDS_CORRECTION' || team.status === 'DRAFT') {
      statusHeader = '✏️ ĐANG CHỜ ĐỘI CHỈNH SỬA';
      color = 0xF59E0B; // Amber
    } else if (team.status === 'WITHDRAWN') {
      statusHeader = '⚪ ĐƠN ĐÃ RÚT LUI';
      color = 0x6B7280; // Gray
    }

    const startersText = starters
      .map((p, idx) => `\`${idx + 1}.\` **${p.ingameName}** — UID: \`${p.gameUid}\``)
      .join('\n');

    const subsText = substitutes.length > 0
      ? substitutes.map((p, idx) => `\`DB${idx + 1}.\` **${p.ingameName}** — UID: \`${p.gameUid}\``).join('\n')
      : '*Không có dự bị*';

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`${statusHeader} — ${team.name} [${team.abbreviation}]`)
      .addFields(
        { name: '👑 Đội trưởng', value: `<@${team.captainDiscordId}> (\`${team.captainDiscordId}\`)`, inline: true },
        { name: '📞 Liên hệ BTC', value: `\`${team.captainContact}\``, inline: true },
        { name: '📊 Trạng thái', value: `**${team.status}**`, inline: true },
        { name: `👥 Đội hình chính thức (${starters.length}/5)`, value: startersText || '*Trống*', inline: false },
        { name: `🔄 Dự bị (${substitutes.length})`, value: subsText, inline: false }
      )
      .setFooter({ text: `Team ID: ${team.id}` })
      .setTimestamp(team.createdAt);

    if (team.rejectionReason) {
      embed.addFields({ name: '⚠️ Lý do từ chối / yêu cầu chỉnh sửa', value: team.rejectionReason, inline: false });
    }

    return embed;
  }

  public static createBtcReviewButtons(teamId: string, disabled: boolean = false): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`btc_approve_${teamId}`)
        .setLabel('✅ Duyệt Đội')
        .setStyle(ButtonStyle.Success)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId(`btc_correction_${teamId}`)
        .setLabel('✏️ Yêu Cầu Sửa')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId(`btc_reject_${teamId}`)
        .setLabel('❌ Từ Chối')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(disabled)
    );
  }

  public static createRejectionReasonModal(teamId: string, isCorrection: boolean = false): ModalBuilder {
    const actionName = isCorrection ? 'Yêu cầu sửa đơn' : 'Từ chối đơn';
    const modal = new ModalBuilder()
      .setCustomId(isCorrection ? `modal_correction_${teamId}` : `modal_reject_${teamId}`)
      .setTitle(`${actionName} — UMA Tournament`);

    const reasonInput = new TextInputBuilder()
      .setCustomId('txt_reason')
      .setLabel('Lý do gửi tới Đội trưởng')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder(
        isCorrection
          ? 'VD: UID của tuyển thủ thứ 3 không tồn tại, vui lòng kiểm tra lại.'
          : 'VD: Thành viên vi phạm điều lệ giải hoặc trùng lịch thi đấu.'
      )
      .setMinLength(5)
      .setMaxLength(300)
      .setRequired(true);

    return modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput));
  }

  public static createTeamListEmbed(approvedTeams: TeamEntity[], pendingTeams: TeamEntity[]): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setColor(0x00A8FF)
      .setTitle('👥 DANH SÁCH ĐỘI TUYỂN — UMA CUP')
      .setDescription('Tổng hợp các đội tuyển đăng ký tham dự giải đấu Liên Quân Mobile.')
      .setTimestamp();

    if (approvedTeams.length === 0) {
      embed.addFields({ name: '🟢 Đội đã duyệt (0)', value: '*Chưa có đội nào được duyệt chính thức.*', inline: false });
    } else {
      const list = approvedTeams
        .map((t, i) => `\`${i + 1}.\` **${t.name}** [${t.abbreviation}] — Đội trưởng: <@${t.captainDiscordId}>`)
        .join('\n');
      embed.addFields({ name: `🟢 Đội đã duyệt (${approvedTeams.length})`, value: list, inline: false });
    }

    if (pendingTeams.length > 0) {
      const list = pendingTeams
        .map((t, i) => `\`${i + 1}.\` **${t.name}** [${t.abbreviation}] — <@${t.captainDiscordId}> *(Đang chờ BTC)*`)
        .join('\n');
      embed.addFields({ name: `🟡 Đang chờ duyệt (${pendingTeams.length})`, value: list, inline: false });
    }

    return embed;
  }

  public static createMyTeamEmbed(team: TeamEntity): EmbedBuilder {
    const starters = (team.players || []).filter(p => !p.isSubstitute);
    const substitutes = (team.players || []).filter(p => p.isSubstitute);

    let statusHeader = '🟡 ĐANG CHỜ DUYỆT';
    let color = 0xF59E0B;

    if (team.status === 'APPROVED') {
      statusHeader = '🟢 ĐÃ ĐƯỢC DUYỆT';
      color = 0x10B981;
    } else if (team.status === 'REJECTED') {
      statusHeader = '🔴 ĐÃ BỊ TỪ CHỐI';
      color = 0xEF4444;
    } else if (team.status === 'NEEDS_CORRECTION') {
      statusHeader = '✏️ YÊU CẦU CHỈNH SỬA';
      color = 0xF59E0B;
    } else if (team.status === 'WITHDRAWN') {
      statusHeader = '⚪ ĐÃ RÚT LUI';
      color = 0x6B7280;
    }

    const startersText = starters
      .map((p, idx) => `\`${idx + 1}.\` **${p.ingameName}** — UID: \`${p.gameUid}\``)
      .join('\n');

    const subsText = substitutes.length > 0
      ? substitutes.map((p, idx) => `\`DB${idx + 1}.\` **${p.ingameName}** — UID: \`${p.gameUid}\``).join('\n')
      : '*Không có dự bị*';

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`ĐỘI CỦA BẠN: ${team.name} [${team.abbreviation}]`)
      .addFields(
        { name: '📊 Trạng thái', value: `**${statusHeader}**`, inline: true },
        { name: '📞 SĐT Đội trưởng', value: `\`${team.captainContact}\``, inline: true },
        { name: `👥 Đội hình chính (${starters.length}/5)`, value: startersText || '*Trống*', inline: false },
        { name: `🔄 Dự bị (${substitutes.length})`, value: subsText, inline: false }
      )
      .setFooter({ text: `Mã đội: ${team.id}` })
      .setTimestamp(team.updatedAt);

    if (team.status === 'NEEDS_CORRECTION' && team.rejectionReason) {
      embed.addFields({
        name: '⚠️ Yêu cầu từ Ban Tổ Chức',
        value: `**${team.rejectionReason}**\n\n👉 *Vui lòng bấm nút "Chỉnh sửa đơn" bên dưới để sửa đổi và gửi lại.*`,
        inline: false
      });
    }

    return embed;
  }

  public static createMyTeamButtons(team: TeamEntity): ActionRowBuilder<ButtonBuilder> | null {
    if (team.status === 'NEEDS_CORRECTION') {
      return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`btn_edit_team_${team.id}`)
          .setLabel('✏️ Chỉnh sửa đơn')
          .setStyle(ButtonStyle.Primary)
      );
    }
    return null;
  }

  /**
   * Accurate User Guide describing ONLY verified Phase 1 functionality
   */
  public static createGuideEmbed(): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(0x3B82F6)
      .setTitle('📘 HƯỚNG DẪN ĐĂNG KÝ THI ĐẤU — UMA CUP')
      .setDescription(
        '**1. QUY TRÌNH ĐĂNG KÝ VÀ DUYỆT ĐƠN:**\n' +
        '1️⃣ **Đăng ký:** Đội trưởng bấm `[📝 Đăng ký đội]` và nhập đúng 5 dòng tuyển thủ chính thức (`Tên | UID`).\n' +
        '2️⃣ **BTC Kiểm tra:** Ban tổ chức đối soát thông tin tuyển thủ và UID thi đấu.\n' +
        '3️⃣ **Kết quả duyệt:**\n' +
        '   • `✅ Phê duyệt`: Đội được chính thức ghi nhận vào danh sách thi đấu.\n' +
        '   • `✏️ Yêu cầu sửa`: Đội trưởng nhận thông báo lý do, dùng lệnh `/uma my-team` để sửa lại thông tin.\n' +
        '   • `❌ Từ chối`: Đơn vi phạm điều lệ sẽ bị từ chối với lý do rõ ràng.\n' +
        '4️⃣ **Theo dõi:** Dùng lệnh `/uma teams` hoặc nút `[👥 Danh sách đội]` để xem các đội đã được duyệt.\n\n' +
        '**2. QUY ĐỊNH ĐỘI HÌNH BẮT BUỘC:**\n' +
        '• Bắt buộc **đúng 5 tuyển thủ chính thức**.\n' +
        '• Tối đa **2 tuyển thủ dự bị** (tùy chọn).\n' +
        '• Mỗi tuyển thủ (Game UID) chỉ được đăng ký cho duy nhất 1 đội trong suốt giải đấu.\n' +
        '• Mỗi đội trưởng chỉ được quản lý 1 đội đang hoạt động.\n\n' +
        '*Lưu ý: Các tính năng điểm danh trước trận, bốc thăm nhánh đấu và tạo phòng riêng thi đấu sẽ được bổ sung ở giai đoạn tiếp theo (Phase 2).*'
      )
      .setFooter({ text: 'UMA GAMING ARENA • Tôn vinh tinh thần đồng đội' });
  }
}
