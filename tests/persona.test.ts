import { describe, it, expect, beforeEach } from 'vitest';
import { Persona, persona } from '../src/bot/persona/index.js';
import { safeText, railgunFooter, arenaFooter } from '../src/bot/persona/formatters.js';

describe('Misaka Mikoto Persona Unit Tests', () => {
  beforeEach(() => {
    Persona.resetForTesting({ enabled: true, level: 'normal' });
  });

  describe('Core Persona Traits and Pronouns', () => {
    it('uses "cậu" for user and "tôi" for bot self-reference', () => {
      const captainActive = persona.messages.registration.captainActiveExists('Team Railgun', 'RG');
      expect(captainActive.toLowerCase()).toContain('cậu');
      expect(captainActive.toLowerCase()).toContain('tôi');
      expect(captainActive).not.toContain('mình / bạn');
      expect(captainActive).not.toContain('em / anh');

      const checkedIn = persona.messages.checkin.alreadyCheckedIn('Team Railgun');
      expect(checkedIn.toLowerCase()).toContain('cậu');
      expect(checkedIn).toContain('không cần bấm thêm lần nữa');
    });

    it('contains electric aesthetic (⚡) motifs naturally without excessive spam', () => {
      const matchStart = persona.messages.match.matchStart('Team Alpha', 'Team Beta');
      expect(matchStart).toContain('⚡');
      expect(matchStart).toContain('BO3');

      const countElectric = (matchStart.match(/⚡/g) || []).length;
      expect(countElectric).toBeLessThanOrEqual(4);
    });

    it('does not contain @everyone or @here mentions', () => {
      const allMessages = [
        persona.messages.registration.panelTitle,
        persona.messages.registration.registrationSuccess('Team A', 'TA', 5, 2),
        persona.messages.registration.captainActiveExists('Team A', 'TA'),
        persona.messages.checkin.openSuccess(8),
        persona.messages.checkin.checkinSuccess('Team A'),
        persona.messages.checkin.alreadyCheckedIn('Team A'),
        persona.messages.match.matchStart('Team A', 'Team B'),
        persona.messages.result.reported('2–1'),
        persona.messages.result.disputeRecorded(),
        persona.messages.result.championCardDescription('Team Champion', 'Team RunnerUp', '2–1'),
        persona.messages.errors.permissionDenied('Ban Tổ Chức'),
        persona.messages.errors.domainError('CORRECTION_LOCKED', 'Lỗi')
      ];

      for (const msg of allMessages) {
        expect(msg).not.toContain('@everyone');
        expect(msg).not.toContain('@here');
      }
    });

    it('does not copy verbatim copyrighted quotes from anime/manga/LN', () => {
      const sample = persona.messages.result.championCardDescription('Team Railgun', 'Team Kuroko', '2–0');
      // Verbatim catchphrases check
      expect(sample).not.toContain('watashi no railgun');
      expect(sample).not.toContain('Chōdenjihō');
      expect(sample).not.toContain('Gekota');
    });
  });

  describe('Intensity Levels', () => {
    it('LEVEL 0 (SERIOUS): Downstream locks and permissions remain serious with zero teasing', () => {
      const lockError = persona.messages.result.correctionLocked();
      expect(lockError).toContain('Không thể sửa kết quả này');
      expect(lockError).toContain('downstream');
      expect(lockError).toContain('Ban Tổ Chức');
      // No jokes or sarcastic remarks in serious error
      expect(lockError).not.toContain('bấm lại');
      expect(lockError).not.toContain('thua');

      const permDenied = persona.messages.errors.permissionDenied('Ban Tổ Chức');
      expect(permDenied).toContain('Chỉ Ban Tổ Chức mới được thực hiện thao tác này');
    });

    it('LEVEL 0 (SERIOUS): Dispute recordings remain neutral, calm, and respectful without humilation', () => {
      const dispute = persona.messages.result.disputeRecorded();
      expect(dispute).toContain('tranh chấp');
      expect(dispute).toContain('giữ nguyên toàn bộ bằng chứng');
      expect(dispute).toContain('trọng tài');
      expect(dispute).not.toContain('stupid');
      expect(dispute).not.toContain('skill issue');
    });

    it('LEVEL 1 (NORMAL): Default registration and check-in are confident and slightly tsundere', () => {
      const regSuccess = persona.messages.registration.registrationSuccess('Gamer Team', 'GMT', 5, 1);
      expect(regSuccess).toContain('Gamer Team');
      expect(regSuccess).toContain('GMT');
      expect(regSuccess).toContain('5/5 đã ghi nhận');
      expect(regSuccess).toContain('Đừng có gửi thêm một bản nữa đấy');

      const checkinSuccess = persona.messages.checkin.checkinSuccess('Gamer Team');
      expect(checkinSuccess).toContain('Gamer Team');
      expect(checkinSuccess).toContain('Ít nhất tôi không phải đi tìm cả đội');
    });

    it('LEVEL 2 (SHOWTIME): Champion ceremony is competitive, proud, and electric', () => {
      const title = persona.messages.result.championCardTitle;
      expect(title).toContain('NHÀ VÔ ĐỊCH');
      expect(title).toContain('⚡');

      const desc = persona.messages.result.championCardDescription('Team Alpha', 'Team Beta', '2–1');
      expect(desc).toContain('Team Alpha');
      expect(desc).toContain('Team Beta');
      expect(desc).toContain('2–1');
      expect(desc).toContain('Các cậu thắng rồi đấy!');
      expect(desc).toContain('Chúc mừng nhà vô địch');
    });
  });

  describe('Configuration & State', () => {
    it('supports configuring level and enabled status', () => {
      const instance = Persona.get();
      expect(instance.isEnabled()).toBe(true);
      expect(instance.getLevel()).toBe('normal');

      instance.setLevel('showtime');
      expect(instance.getLevel()).toBe('showtime');

      instance.setEnabled(false);
      expect(instance.isEnabled()).toBe(false);
    });
  });

  describe('Formatters and Safety', () => {
    it('safeText strips zero-width spaces, wraps @ mentions, and trims lines', () => {
      expect(safeText('Hello @everyone test', 50)).toBe('Hello @\u200beveryone test');
      expect(safeText('Short', 3)).toBe('Sh…');
      expect(safeText('Multi\nLine\rTest', 50)).toBe('Multi Line Test');
    });

    it('railgunFooter formats with electric aesthetic and optional context', () => {
      const defaultFooter = railgunFooter();
      expect(defaultFooter).toContain('UMA Tournament Bot');
      expect(defaultFooter).toContain('⚡');

      const contextFooter = railgunFooter('Round 1 Match 2');
      expect(contextFooter).toContain('Round 1 Match 2');
      expect(contextFooter).toContain('⚡');
    });

    it('arenaFooter formats with arena status', () => {
      const arena = arenaFooter('Arena Hub');
      expect(arena).toContain('UMA GAMING ARENA');
      expect(arena).toContain('Arena Hub');
      expect(arena).toContain('⚡');
    });
  });
});
