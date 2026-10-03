/**
 * Persona formatting utilities for Discord presentation
 */

export function safeText(value: string, limit = 80): string {
  const clipped = value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
  return clipped
    .replace(/[\r\n\t]/g, ' ')
    .replace(/@/g, '@\u200b')
    .replace(/[`*_~|]/g, '\\$&');
}

export function railgunFooter(context?: string): string {
  if (!context) {
    return 'UMA Tournament Bot ⚡ • Railgun Protocol';
  }
  return `UMA Tournament Bot ⚡ • Railgun Protocol • ${context}`;
}

export function arenaFooter(context?: string): string {
  if (!context) {
    return 'UMA GAMING ARENA ⚡ • Railgun Protocol';
  }
  return `UMA GAMING ARENA ⚡ • ${context}`;
}
