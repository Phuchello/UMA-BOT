export interface ParsedPlayerInput {
  ingameName: string;
  gameUid: string;
  isSubstitute: boolean;
  slotNumber: number;
}

export interface ParseRosterResult {
  success: boolean;
  starters: ParsedPlayerInput[];
  substitutes: ParsedPlayerInput[];
  error?: string;
}

export class RegistrationParser {
  /**
   * Parses and validates raw lines for starters and optional substitutes.
   * Required: Exactly 5 starters.
   * Optional: 0 to maxSubstitutes substitutes.
   */
  public static parseRoster(
    startersText: string,
    substitutesText?: string,
    maxSubstitutes: number = 2
  ): ParseRosterResult {
    const starterLines = startersText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    if (starterLines.length !== 5) {
      return {
        success: false,
        starters: [],
        substitutes: [],
        error: `Đội hình chính thức phải có đúng 5 thành viên (hiện tại có ${starterLines.length} dòng).`
      };
    }

    const starters: ParsedPlayerInput[] = [];
    const seenUidsInSubmission = new Set<string>();

    for (let i = 0; i < starterLines.length; i++) {
      const line = starterLines[i];
      const parsed = this.parseLine(line, i + 1, false);
      if (!parsed) {
        return {
          success: false,
          starters: [],
          substitutes: [],
          error: `Dòng ${i + 1} ở đội hình chính không đúng định dạng. Vui lòng nhập: [Tên Ingame | Game UID]. Dòng bị lỗi: "${line}"`
        };
      }

      if (seenUidsInSubmission.has(parsed.gameUid)) {
        return {
          success: false,
          starters: [],
          substitutes: [],
          error: `UID "${parsed.gameUid}" bị trùng lặp trong nội bộ đội hình bạn vừa gửi.`
        };
      }

      seenUidsInSubmission.add(parsed.gameUid);
      starters.push(parsed);
    }

    const substitutes: ParsedPlayerInput[] = [];
    if (substitutesText && substitutesText.trim().length > 0) {
      const subLines = substitutesText
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0);

      if (subLines.length > maxSubstitutes) {
        return {
          success: false,
          starters: [],
          substitutes: [],
          error: `Số lượng dự bị tối đa là ${maxSubstitutes} thành viên (hiện tại có ${subLines.length} dòng).`
        };
      }

      for (let i = 0; i < subLines.length; i++) {
        const line = subLines[i];
        const parsed = this.parseLine(line, i + 1, true);
        if (!parsed) {
          return {
            success: false,
            starters: [],
            substitutes: [],
            error: `Dòng ${i + 1} ở danh sách dự bị không đúng định dạng. Vui lòng nhập: [Tên Ingame | Game UID]. Dòng bị lỗi: "${line}"`
          };
        }

        if (seenUidsInSubmission.has(parsed.gameUid)) {
          return {
            success: false,
            starters: [],
            substitutes: [],
            error: `UID dự bị "${parsed.gameUid}" bị trùng với tuyển thủ khác trong đội.`
          };
        }

        seenUidsInSubmission.add(parsed.gameUid);
        substitutes.push(parsed);
      }
    }

    return {
      success: true,
      starters,
      substitutes
    };
  }

  private static parseLine(line: string, slotNumber: number, isSubstitute: boolean): ParsedPlayerInput | null {
    // Delimiters supported: '|', '-', ',', ':'
    let parts: string[] = [];
    if (line.includes('|')) {
      parts = line.split('|');
    } else if (line.includes('-')) {
      parts = line.split('-');
    } else if (line.includes(',')) {
      parts = line.split(',');
    } else if (line.includes(':')) {
      parts = line.split(':');
    } else {
      // Fallback: split by multiple spaces
      parts = line.trim().split(/\s{2,}/);
    }

    if (parts.length < 2) {
      return null;
    }

    const ingameName = parts[0].trim();
    const gameUid = parts.slice(1).join(' ').trim().replace(/\s+/g, '');

    if (ingameName.length === 0 || gameUid.length === 0) {
      return null;
    }

    return {
      ingameName,
      gameUid,
      isSubstitute,
      slotNumber
    };
  }
}
