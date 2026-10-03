import { safeText, railgunFooter } from './formatters.js';

/**
 * Original Vietnamese Misaka Mikoto-inspired message layer for UMA Tournament Bot.
 * 
 * Rules:
 * - 100% original phrasing (NO verbatim copyrighted dialogue from anime/manga/LNs).
 * - Pronouns: bot -> user: "cậu"; bot self: "tôi".
 * - Natural gaming terminology (Check-in, Bracket, BO3, Seed, Match, Referee, BTC, UID, Stream, VOD).
 * - Respects three intensity levels:
 *   - LEVEL 0: SERIOUS (security, permissions, disputes, system errors, downstream locks)
 *   - LEVEL 1: NORMAL (default operations, registrations, check-in, matches, streams)
 *   - LEVEL 2: SHOWTIME (tournament start, bracket reveal, match start, champion ceremony)
 */

export const messages = {
  registration: {
    panelTitle: '🏆 UMA CUP — ĐĂNG KÝ THI ĐẤU ⚡',
    
    panelDescription: (activeCount: number, approvedCount: number, pendingCount: number, maxTeams: number, status: string): string => {
      const remaining = Math.max(0, maxTeams - activeCount);
      const statusText = status === 'registration_open'
        ? '🟢 **ĐANG MỞ ĐĂNG KÝ**'
        : status === 'checkin_open'
        ? '🟡 **ĐÃ KHÓA ĐĂNG KÝ — ĐANG CHECK-IN**'
        : status === 'bracket_ready'
        ? '🔵 **ĐÃ BỐC THĂM NHÁNH ĐẤU**'
        : '🔵 **ĐANG THI ĐẤU**';

      const slotText = status === 'registration_open'
        ? `• 🟢 **Còn lại:** ${remaining} suất\n\n📌 *Đội trưởng bấm nút bên dưới để mở đơn đăng ký đội. Điền cẩn thận đấy.*`
        : '• 🔒 **Đăng ký:** Đã khóa\n\n📌 *Đăng ký đã khóa. Theo dõi `/uma status` và `/uma bracket`.*';

      return 'Chào mừng các kiện tướng đến với giải đấu Liên Quân Mobile của **UMA GAMING**! ⚡\n\n' +
        '**📋 THÔNG TIN GIẢI ĐẤU:**\n' +
        '• **Bộ môn:** Liên Quân Mobile 5v5\n' +
        '• **Đội hình chuẩn:** Đúng 5 tuyển thủ chính thức (+ tối đa 2 dự bị)\n' +
        '• **Thể thức:** Single Elimination (Loại trực tiếp)\n' +
        `• **Trạng thái:** ${statusText}\n\n` +
        '**📊 TÌNH HÌNH ĐĂNG KÝ:**\n' +
        `• 👥 **Đã đăng ký:** \`${activeCount} / ${maxTeams}\`\n` +
        `• ✅ **Đã duyệt:** ${approvedCount}\n` +
        `• ⏳ **Chờ duyệt / chỉnh sửa:** ${pendingCount}\n` +
        slotText;
    },

    registrationSuccess: (teamName: string, abbr: string, starterCount: number, subCount: number): string =>
      `⚡ Ghi danh hoàn tất.\n\n` +
      `**${teamName}** [${abbr}] đã vào danh sách chờ BTC duyệt.\n\n` +
      `• **Đội hình chính thức:** ${starterCount}/5 đã ghi nhận\n` +
      `• **Dự bị:** ${subCount} tuyển thủ\n\n` +
      `Giờ thì chờ BTC kiểm tra thôi. Đừng có gửi thêm một bản nữa đấy. ⚡`,

    captainActiveExists: (teamName: string, abbr: string): string =>
      `⚡ Khoan đã. Cậu đã là đội trưởng của đội **${teamName}** [${abbr}] rồi.\n\n` +
      `Tôi không định tạo thêm một bản sao chỉ vì cậu bấm hai lần đâu. Mỗi đội trưởng chỉ được quản lý đúng 1 đội đang hoạt động trong giải đấu.`,

    capacityFull: (activeCount: number, maxTeams: number): string =>
      `⚡ Hết chỗ rồi. Giải đấu hiện đã đủ số lượng đội đăng ký (${activeCount}/${maxTeams} đội).\n\n` +
      `Cậu chịu khó theo dõi các thông báo tiếp theo từ Ban Tổ Chức nhé!`,

    registrationClosed: (): string =>
      `🔒 Đăng ký đã khóa. Theo dõi \`/uma status\` và \`/uma bracket\` để cập nhật tiến độ giải đấu.`,

    tournamentUninitialized: (): string =>
      `❌ Giải đấu đang hoạt động chưa được khởi tạo. Vui lòng liên hệ Ban Tổ Chức để thiết lập giải.`,

    notCaptain: (): string =>
      `⛔ Cậu không phải là đội trưởng của đội này. Đừng thao tác nhầm đơn của đội khác.`,

    notInCorrectionState: (status: string): string =>
      `⚠️ Đơn này hiện không ở trạng thái yêu cầu chỉnh sửa (Trạng thái hiện tại: ${status}). Không cần nộp lại lúc này.`,

    resubmitSuccess: (teamName: string, abbr: string): string =>
      `⚡ Xong rồi đấy. Bản chỉnh sửa của **${teamName}** [${abbr}] đã được chuyển lại cho Ban Tổ Chức.\n\n` +
      `Tôi đã lưu lại và gửi bên điều hành rồi. Cậu có thể kiểm tra trạng thái bất cứ lúc nào bằng lệnh \`/uma my-team\`.`,

    myTeamEmpty: (tournamentId: string): string =>
      `⚠️ Cậu chưa đăng ký đội nào trong giải đấu hiện tại (${tournamentId}) cả.\n\n` +
      `Muốn tham gia thì bấm nút "📝 Đăng ký đội" ở kênh thông báo đi đã!`,

    invalidRoster: (error?: string): string =>
      `⚡ Đăng ký không hợp lệ:\n${error ?? 'Dữ liệu không hợp lệ.'}\n\nKiểm tra lại dữ liệu từng dòng rồi thử lại đi.`,

    editPhaseClosed: (): string =>
      `🔒 Giai đoạn chỉnh sửa đơn đã kết thúc.`,

    teamNotFound: (): string =>
      `❌ Đội không tồn tại trong hệ thống.`,

    teamNotInActiveTournament: (): string =>
      `❌ Đội không thuộc giải đấu đang hoạt động.`
  },

  btc: {
    approvedDm: (teamName: string, abbr: string): string =>
      `✅ **BTC đã duyệt ${teamName} [${abbr}].**\n\n` +
      `Đội của cậu chính thức có mặt trong giải đấu UMA CUP!\n\n` +
      `Chuẩn bị cho tử tế đi — tới lúc vào bracket thì tôi không nhắc lại đâu đấy. ⚡`,

    correctionDm: (teamName: string, reason: string): string =>
      `✏️ **BTC yêu cầu chỉnh lại đăng ký.**\n\n` +
      `Đơn của đội **${teamName}** có thông tin chưa ổn:\n` +
      `> "${reason}"\n\n` +
      `Sửa xong rồi gửi lại qua lệnh \`/uma my-team\`. Tôi vẫn đang giữ slot của đội cậu đấy.`,

    rejectedDm: (teamName: string, reason: string): string =>
      `❌ **Đăng ký chưa được chấp nhận.**\n\n` +
      `Đơn của đội **${teamName}** đã bị từ chối với lý do:\n` +
      `> "${reason}"\n\n` +
      `Nếu đủ điều kiện đăng ký lại, hãy sửa đúng phần BTC yêu cầu rồi thử lại.`
  },

  checkin: {
    openSuccess: (approvedCount: number): string =>
      `🔒 Đã khóa đăng ký và kích hoạt check-in. **${approvedCount} đội đã duyệt** có thể điểm danh bằng \`/uma check-in\` ngay. Đừng để trễ giờ bốc thăm. ⚡`,

    checkinSuccess: (teamName: string): string =>
      `⚡ Check-in xác nhận.\n\n` +
      `Đội **${teamName}** đã có mặt.\n\n` +
      `Tốt. Ít nhất tôi không phải đi tìm cả đội trước giờ bốc bracket.`,

    alreadyCheckedIn: (teamName: string): string =>
      `⚡ Cậu check-in rồi.\n\n` +
      `Đội **${teamName}** đã có tên trong danh sách điểm danh, không cần bấm thêm lần nữa đâu.`,

    checkinClosed: (): string =>
      `⛔ Check-in chưa mở hoặc đã đóng.\n\n` +
      `Muộn rồi. Muốn xử lý ngoại lệ thì phải liên hệ trực tiếp với Ban Tổ Chức.`,

    noActiveTeam: (): string =>
      `⚠️ Cậu chưa có đội đang hoạt động trong giải đấu này.`
  },

  tournament: {
    drawCompleteIntro: (): string =>
      `⚡ Tất cả seed đã khóa. Bắt đầu bốc bracket.\n\n...Được rồi. Xem ai sẽ phải gặp ai nào! ⚡`,

    bracketLockedHeader: (): string =>
      `⚡ **BRACKET ĐÃ KHÓA.**\nCác cặp đấu đã được xác định. Từ giờ không còn đổi seed nữa đâu. Chuẩn bị trận của mình đi.`,

    bracketNotDrawn: (): string =>
      `⚡ Nhánh đấu chưa được bốc thăm. Chờ BTC hoàn tất khâu check-in và bấm bốc thăm nhé.`,

    tournamentStarted: (readyCount: number, waitingCount: number): string =>
      `⚡ **GIẢI ĐẤU CHÍNH THỨC BẮT ĐẦU!**\n\n` +
      `Hệ thống đã nạp: **${readyCount}** trận sẵn sàng mở phòng đấu, **${waitingCount}** trận chờ xác định đội. Vào vị trí chiến đấu đi! ⚡`
  },

  match: {
    refereeAssigned: (round: number, match: number): string =>
      `⚡ Đã gán trọng tài cho R${round}-M${match}. Mục tiêu đã khóa.`,

    refereeAlreadyAssigned: (round: number, match: number): string =>
      `Biết rồi. Trọng tài cho R${round}-M${match} đã được gán từ trước rồi.`,

    roomsBatchCreated: (result: { created: number; alreadyExisting: number; skippedWaiting: number; skippedMissingReferee: number; skippedInvalid: number; failures: number }): string =>
      `⚡ Khởi tạo phòng đấu hoàn tất:\n` +
      `• 🏠 **Phòng mới:** ${result.created}\n` +
      `• Đã có từ trước: ${result.alreadyExisting}\n` +
      `• Chờ xác định đội: ${result.skippedWaiting}\n` +
      `• Thiếu trọng tài: ${result.skippedMissingReferee}\n` +
      `• Dữ liệu chưa hợp lệ: ${result.skippedInvalid}\n` +
      `• Lỗi phát sinh: ${result.failures}\n\n` +
      `Hai đội vào đúng thread của mình. Đừng làm tôi phải kéo từng người vào đấy. ⚡`,

    matchScheduled: (round: number, match: number, timestamp: number): string =>
      `📅 R${round}-M${match} đã lên lịch: <t:${Math.floor(timestamp / 1000)}:F> (<t:${Math.floor(timestamp / 1000)}:R>). Nhớ có mặt đúng giờ, trễ là xử thua đấy.`,

    captainReadySelf: (): string =>
      `Đội cậu sẵn sàng rồi.\n\nĐối thủ thì chưa.\n\n...Tôi biết. Chờ thêm chút đi. ⚡`,

    captainAlreadyReady: (): string =>
      `⚡ Biết rồi. Đội của cậu đã xác nhận sẵn sàng từ trước rồi mà.`,

    bothTeamsReady: (): string =>
      `⚡ Hai đội đã READY.\n\nTrọng tài có thể bắt đầu trận đấu ngay bây giờ.`,

    matchStart: (teamA: string, teamB: string): string =>
      `⚡ **MATCH START.**\n\n` +
      `**${teamA}**\n` +
      `vs\n` +
      `**${teamB}**\n\n` +
      `BO3.\n\n` +
      `Không còn gì để chuẩn bị nữa đâu.\n\n` +
      `Chiến đi! ⚡`
  },

  result: {
    reported: (score: string): string =>
      `📸 Tôi nhận kết quả rồi: **${score}**.\n\n` +
      `Ảnh bằng chứng đã được lưu trữ an toàn. Giờ chờ đối thủ xác nhận và trọng tài đối soát.\n\n` +
      `Đừng có chỉnh sửa ảnh giữa chừng đấy. ⚡`,

    opponentConfirmed: (): string =>
      `✅ Đối thủ đã xác nhận kết quả.\n\nTốt.\n\nTrọng tài, tới lượt cậu chốt kết quả.`,

    disputeRecorded: (): string =>
      `⚠️ Kết quả đang có tranh chấp.\n\n` +
      `Tôi đã giữ nguyên toàn bộ bằng chứng và chưa chốt người thắng.\n\n` +
      `Hai đội chờ trọng tài xử lý.`,

    refereeApproved: (winner: string, score: string): string =>
      `⚡ Trọng tài đã chốt kết quả: **${winner} thắng ${score}**.\n\n` +
      `Kết quả chính thức đã được ghi nhận vào bracket.`,

    refereeRejected: (reason: string): string =>
      `❌ Đã yêu cầu báo lại kết quả: "${reason}".\n\n` +
      `Trận đấu vẫn ở trạng thái LIVE. Đội trưởng vui lòng chụp lại bằng chứng rõ ràng và gửi lại.`,

    disputeResolved: (): string =>
      `⚡ Đã xử lý tranh chấp và cập nhật nhánh đấu theo quyết định của trọng tài.`,

    refreshed: (): string =>
      `⚡ Đã làm mới thẻ kết quả và thẻ trận từ dữ liệu gốc đã lưu.`,

    correctionLocked: (): string =>
      `🔒 Không thể sửa kết quả này.\n\n` +
      `Một trận downstream đã có hoạt động thi đấu, vì vậy thay đổi hiện tại có thể làm sai bracket.\n\n` +
      `Ban Tổ Chức cần xử lý tình huống này theo quy trình thủ công.`,

    corrected: (round: number, match: number, score: string, revision: number): string =>
      `⚡ Kết quả chính thức R${round}-M${match} đã được hiệu chỉnh thành **${score}** (Revision #${revision}).\n\n` +
      `Tôi đã đồng bộ lại bracket và lịch sử chỉnh sửa. Chạy \`/uma publish-sync\` để cập nhật công khai. ⚡`,

    publishSyncSummary: (result: { created: number; updated: number; unchanged: number; failed: number }): string =>
      `🏆 Đồng bộ kết quả: mới ${result.created} • cập nhật ${result.updated} • không đổi ${result.unchanged} • lỗi ${result.failed}.`,

    championCardTitle: '⚡ UMA CUP — NHÀ VÔ ĐỊCH TỐI CAO ⚡',

    championCardDescription: (champion: string, runnerUp: string, finalScore: string): string =>
      `⚡━━━━━━━━━━━━━━━━━━⚡\n` +
      `        NHÀ VÔ ĐỊCH\n` +
      `⚡━━━━━━━━━━━━━━━━━━⚡\n\n` +
      `🏆 **${champion}**\n` +
      `🥈 ${runnerUp}\n\n` +
      `Trận chung kết: **${finalScore}**\n\n` +
      `Bracket đã kết thúc. Không còn đối thủ nào phía trước nữa.\n\n` +
      `Các cậu thắng rồi đấy!\n\n` +
      `...Hừm. Cũng không tệ chút nào đâu.\n\n` +
      `🎉 Chúc mừng nhà vô địch của **UMA GAMING**! ⚡`
  },

  stream: {
    streamSet: (url: string, title?: string): string =>
      `📡 Stream đã khóa mục tiêu.\n\n` +
      (title ? `**${title}**\n` : '') +
      `${url}\n\n` +
      `Giờ thì đừng để caster tới trễ đấy nhé. ⚡`,

    streamCleared: (): string =>
      `⚡ Đã xóa liên kết livestream/VOD; thông tin caster vẫn được giữ nguyên.`,

    noStream: (): string =>
      `Chưa có stream cho trận này.\n\n...Đừng nhìn tôi. BTC chưa đưa link thì tôi lấy đâu ra. ⚡`,

    casterAdded: (): string =>
      `🎙️ Đã gán caster cho trận đấu. Đường truyền mic đã sẵn sàng.`,

    casterAlreadyAdded: (): string =>
      `Biết rồi. Caster này đã được gán cho trận từ trước rồi.`,

    casterRemoved: (): string =>
      `⚡ Đã gỡ caster khỏi trận đấu.`,

    casterNotAssigned: (): string =>
      `Caster này vốn dĩ chưa từng được gán cho trận này mà?`
  },

  errors: {
    permissionDenied: (requiredRole = 'Ban Tổ Chức'): string =>
      `⛔ Cậu không có quyền dùng lệnh này. Chỉ Ban Tổ Chức mới được thực hiện thao tác này.`,

    invalidInput: (reason: string): string =>
      `⚡ Có gì đó sai rồi:\n${reason}\n\nKiểm tra lại dữ liệu rồi thử lại.`,

    internalError: (correlationId: string): string =>
      `⚠️ Tôi gặp lỗi khi xử lý thao tác này. Không có thay đổi nào được xác nhận.\n\nMã tham chiếu: \`${correlationId}\`\nHãy báo Ban Tổ Chức nếu lỗi tiếp tục xảy ra.`,

    unhandledError: (): string =>
      `⚠️ Đã xảy ra lỗi trong quá trình xử lý yêu cầu. Vui lòng thử lại sau hoặc báo cho Ban Tổ Chức.`,

    domainError: (code: string, fallbackMessage: string): string => {
      switch (code) {
        case 'NOT_STAFF':
          return `⛔ Cậu không có quyền dùng lệnh này. Chỉ Ban Tổ Chức mới được thực hiện thao tác này.`;
        case 'NOT_CAPTAIN':
          return `⛔ Chỉ đội trưởng của một trong hai đội mới được xác nhận sẵn sàng.`;
        case 'NOT_REFEREE':
          return `⛔ Chỉ trọng tài được phân công hoặc Ban Tổ Chức mới được bắt đầu trận.`;
        case 'NOT_CHECKED_IN':
          return `⚡ Khoan đã. Cậu còn chưa check-in mà định vào trận luôn à?`;
        case 'CORRECTION_LOCKED':
          return `🔒 Không thể sửa kết quả này. Một trận downstream đã có hoạt động thi đấu, vì vậy thay đổi hiện tại có thể làm sai bracket. Ban Tổ Chức cần xử lý theo quy trình thủ công.`;
        case 'INVALID_SCORE':
          return `⚡ Tỉ số đó không hợp lệ. BO3 mà cậu tính đánh tới đâu vậy? Kiểm tra lại số ván thắng/thua đi.`;
        case 'DUPLICATE_REPORT':
          return `⚡ Kết quả này đã được báo trước đó rồi. Đừng bấm liên tục.`;
        case 'WRONG_ROOM':
          return `⚡ Nút này không thuộc phòng trận hiện tại. Vào đúng phòng đấu đi chứ.`;
        case 'MATCH_NOT_READY':
          return `⚡ Cả hai đội phải sẵn sàng trước khi trọng tài có thể bấm bắt đầu trận.`;
        case 'INVALID_STATE':
        case 'INVALID_PHASE':
          return `⚡ Trạng thái trận đấu không cho phép thực hiện thao tác này. ${fallbackMessage}`;
        default:
          return `⚠️ ${fallbackMessage}`;
      }
    }
  }
};
