import fs from 'node:fs';
import path from 'node:path';
import { ReactionCatalog, ReactionItem, ReactionMood } from './types.js';

const MOOD_FALLBACKS: Partial<Record<ReactionMood, ReactionMood>> = {
  smug: 'confident',
  embarrassed: 'annoyed'
};

const VALID_MOODS: readonly ReactionMood[] = [
  'confident',
  'annoyed',
  'smug',
  'waiting',
  'surprised',
  'electric',
  'hype',
  'victory',
  'checking',
  'embarrassed'
];

export class ReactionMedia {
  private mediaDir: string | null = null;
  private catalog: ReactionCatalog = {};

  constructor(customMediaDir?: string) {
    this.init(customMediaDir);
  }

  public init(customMediaDir?: string): void {
    this.mediaDir = this.resolveMediaDir(customMediaDir);
    this.loadCatalog();
  }

  public getMediaDir(): string | null {
    return this.mediaDir;
  }

  public getCatalog(): ReactionCatalog {
    return { ...this.catalog };
  }

  public hasMood(mood: ReactionMood): boolean {
    return this.getItems(mood).length > 0;
  }

  public getItems(mood: ReactionMood): ReactionItem[] {
    const directItems = this.catalog[mood];
    if (directItems && directItems.length > 0) {
      return directItems;
    }
    const fallbackMood = MOOD_FALLBACKS[mood];
    if (fallbackMood) {
      const fallbackItems = this.catalog[fallbackMood];
      if (fallbackItems && fallbackItems.length > 0) {
        return fallbackItems;
      }
    }
    return [];
  }

  public resolveFilePath(item: ReactionItem): string | null {
    if (!this.mediaDir) return null;
    if (this.isTraversalPath(item.file)) return null;

    const absolute = path.resolve(this.mediaDir, item.file);
    const root = path.resolve(this.mediaDir);
    if (!absolute.startsWith(root + path.sep)) {
      return null;
    }
    if (!fs.existsSync(absolute)) {
      return null;
    }
    return absolute;
  }

  public isTraversalPath(filePath: string): boolean {
    if (filePath.includes('..')) return true;
    if (path.isAbsolute(filePath)) return true;
    if (filePath.startsWith('/') || filePath.startsWith('\\')) return true;
    return false;
  }

  private resolveMediaDir(customMediaDir?: string): string | null {
    if (customMediaDir !== undefined) {
      try {
        const catalogPath = path.join(customMediaDir, 'catalog.json');
        if (fs.existsSync(customMediaDir) && fs.existsSync(catalogPath)) {
          return path.resolve(customMediaDir);
        }
      } catch {
        // In case of invalid path syntax
      }
      return null;
    }

    const candidates = [
      process.env.BOT_PERSONA_MEDIA_DIR,
      '/var/lib/uma-bot/media/misaka',
      '/tmp/misaka_staging',
      path.resolve(process.cwd(), 'media/misaka')
    ].filter((dir): dir is string => typeof dir === 'string' && dir.trim().length > 0);

    for (const candidate of candidates) {
      try {
        const catalogPath = path.join(candidate, 'catalog.json');
        if (fs.existsSync(candidate) && fs.existsSync(catalogPath)) {
          return path.resolve(candidate);
        }
      } catch {
        // Continue to next candidate
      }
    }

    return null;
  }


  private loadCatalog(): void {
    this.catalog = {};
    if (!this.mediaDir) return;

    const catalogPath = path.join(this.mediaDir, 'catalog.json');
    if (!fs.existsSync(catalogPath)) return;

    try {
      const raw = fs.readFileSync(catalogPath, 'utf-8');
      const parsed = JSON.parse(raw) as Record<string, unknown>;

      const root = path.resolve(this.mediaDir);

      for (const mood of VALID_MOODS) {
        const rawList = parsed[mood];
        if (!Array.isArray(rawList)) continue;

        const validItems: ReactionItem[] = [];
        for (const rawItem of rawList) {
          if (!this.isValidRawItem(rawItem)) continue;

          // Security check: Directory traversal
          if (this.isTraversalPath(rawItem.file)) continue;

          const resolved = path.resolve(root, rawItem.file);
          if (!resolved.startsWith(root + path.sep)) continue;

          // File existence and Discord size limit (<= 8 MiB)
          if (!fs.existsSync(resolved)) continue;
          if (rawItem.size > 8 * 1024 * 1024) continue;

          validItems.push({
            file: rawItem.file,
            sha256: rawItem.sha256,
            source: rawItem.source,
            description: rawItem.description,
            size: rawItem.size,
            width: rawItem.width,
            height: rawItem.height,
            frames: rawItem.frames
          });
        }

        if (validItems.length > 0) {
          this.catalog[mood] = validItems;
        }
      }
    } catch (err) {
      console.warn(`[ReactionMedia] Warning: Unable to parse catalog at ${catalogPath}:`, err);
      this.catalog = {};
    }
  }

  private isValidRawItem(item: unknown): item is ReactionItem {
    if (typeof item !== 'object' || item === null) return false;
    const obj = item as Record<string, unknown>;
    return (
      typeof obj.file === 'string' &&
      typeof obj.sha256 === 'string' &&
      typeof obj.description === 'string' &&
      typeof obj.size === 'number' &&
      typeof obj.width === 'number' &&
      typeof obj.height === 'number' &&
      typeof obj.frames === 'number'
    );
  }
}
