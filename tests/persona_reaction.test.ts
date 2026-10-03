import { describe, it, expect, beforeEach } from 'vitest';
import path from 'node:path';
import {
  ReactionMedia,
  ReactionPicker,
  Persona,
  persona,
  ReactionMood
} from '../src/bot/persona/index.js';
import { AttachmentBuilder } from 'discord.js';

describe('Misaka Reaction Media & Picker Tests', () => {
  const stagingDir = '/tmp/misaka_staging';

  beforeEach(() => {
    Persona.resetForTesting({
      enabled: true,
      level: 'normal',
      gifsEnabled: true,
      gifLevel: 'normal',
      mediaDir: stagingDir
    });
  });

  describe('ReactionMedia Catalog & Safety Checks', () => {
    it('discovers and loads valid curated catalog from staging directory', () => {
      const media = new ReactionMedia(stagingDir);
      const catalog = media.getCatalog();

      expect(media.getMediaDir()).toBe(path.resolve(stagingDir));
      expect(catalog.confident?.length).toBe(3);
      expect(catalog.annoyed?.length).toBe(4);
      expect(catalog.electric?.length).toBe(4);
      expect(catalog.hype?.length).toBe(3);
      expect(catalog.victory?.length).toBe(3);
      expect(catalog.waiting?.length).toBe(2);
      expect(catalog.surprised?.length).toBe(2);
      expect(catalog.checking?.length).toBe(2);

      const totalGifs = Object.values(catalog).reduce((sum, list) => sum + (list?.length ?? 0), 0);
      expect(totalGifs).toBe(23);
    });

    it('handles mood aliases for unpopulated moods gracefully', () => {
      const media = new ReactionMedia(stagingDir);
      expect(media.hasMood('smug')).toBe(true);
      expect(media.getItems('smug').length).toBe(3); // Falls back to confident

      expect(media.hasMood('embarrassed')).toBe(true);
      expect(media.getItems('embarrassed').length).toBe(4); // Falls back to annoyed
    });

    it('rejects directory traversal attacks strictly', () => {
      const media = new ReactionMedia(stagingDir);

      expect(media.isTraversalPath('../etc/passwd')).toBe(true);
      expect(media.isTraversalPath('/var/lib/secret.gif')).toBe(true);
      expect(media.isTraversalPath('\\windows\\system32')).toBe(true);
      expect(media.isTraversalPath('confident/../../etc/shadow')).toBe(true);
      expect(media.isTraversalPath('confident/confident-01.gif')).toBe(false);

      const traversalItem = {
        file: '../test.gif',
        sha256: 'abc',
        description: 'Attack',
        size: 100,
        width: 100,
        height: 100,
        frames: 10
      };
      expect(media.resolveFilePath(traversalItem)).toBeNull();
    });

    it('handles non-existent media directories without throwing', () => {
      const media = new ReactionMedia('/non/existent/path/for/reactions');
      expect(media.getCatalog()).toEqual({});
      expect(media.hasMood('confident')).toBe(false);
      expect(media.getItems('confident')).toEqual([]);
    });
  });

  describe('Serious Flow Invariant (Strict 0% GIF Guarantee)', () => {
    it('returns null for serious intensity under all circumstances', () => {
      const media = new ReactionMedia(stagingDir);
      const picker = new ReactionPicker(media, {
        enabled: true,
        gifsEnabled: true,
        gifLevel: 'high'
      });

      const moods: ReactionMood[] = [
        'confident',
        'annoyed',
        'electric',
        'hype',
        'victory',
        'waiting',
        'surprised',
        'checking'
      ];

      for (const mood of moods) {
        // RNG forced to 0.00 (which normally guarantees a hit)
        const result = picker.pick(mood, 'serious', { rng: () => 0.0001 });
        expect(result).toBeNull();
      }
    });

    it('even with force=true, serious intensity STRICTLY returns null', () => {
      const media = new ReactionMedia(stagingDir);
      const picker = new ReactionPicker(media, {
        enabled: true,
        gifsEnabled: true,
        gifLevel: 'high'
      });

      const forcedSerious = picker.pick('annoyed', 'serious', { force: true });
      expect(forcedSerious).toBeNull();

      const personaSerious = persona.pickReaction('confident', 'serious', { force: true });
      expect(personaSerious).toBeNull();

      const attachmentSerious = persona.reactionAttachment('victory', 'serious', { force: true });
      expect(attachmentSerious).toBeNull();
    });
  });

  describe('Probability and Rate Limits', () => {
    it('respects probability threshold for normal interactions (35%)', () => {
      const media = new ReactionMedia(stagingDir);
      const picker = new ReactionPicker(media, {
        enabled: true,
        gifsEnabled: true,
        gifLevel: 'normal'
      });

      // Roll 0.30 is under 0.35 -> should trigger
      const hit = picker.pick('confident', 'normal', { rng: () => 0.30 });
      expect(hit).not.toBeNull();
      expect(hit?.mood).toBe('confident');

      // Roll 0.40 is above 0.35 -> should NOT trigger
      const miss = picker.pick('confident', 'normal', { rng: () => 0.40 });
      expect(miss).toBeNull();
    });

    it('respects probability threshold for showtime interactions (75%)', () => {
      const media = new ReactionMedia(stagingDir);
      const picker = new ReactionPicker(media, {
        enabled: true,
        gifsEnabled: true,
        gifLevel: 'normal'
      });

      // Roll 0.70 is under 0.75 -> should trigger
      const hit = picker.pick('hype', 'showtime', { rng: () => 0.70 });
      expect(hit).not.toBeNull();

      // Roll 0.80 is above 0.75 -> should NOT trigger
      const miss = picker.pick('hype', 'showtime', { rng: () => 0.80 });
      expect(miss).toBeNull();
    });

    it('returns null when gifsEnabled is false or gifLevel is off', () => {
      const media = new ReactionMedia(stagingDir);
      const picker = new ReactionPicker(media, {
        enabled: true,
        gifsEnabled: false,
        gifLevel: 'normal'
      });

      expect(picker.pick('confident', 'normal', { force: true })).toBeNull();

      picker.setConfig({ gifsEnabled: true, gifLevel: 'off' });
      expect(picker.pick('confident', 'normal', { force: true })).toBeNull();
    });
  });

  describe('Anti-Repetition Deduplication', () => {
    it('avoids immediately repeating the same GIF when alternatives exist', () => {
      const media = new ReactionMedia(stagingDir);
      const picker = new ReactionPicker(media, {
        enabled: true,
        gifsEnabled: true,
        gifLevel: 'normal'
      });

      const first = picker.pick('confident', 'normal', { force: true, rng: () => 0.0 });
      expect(first).not.toBeNull();

      const second = picker.pick('confident', 'normal', { force: true, rng: () => 0.0 });
      expect(second).not.toBeNull();
      expect(second?.sha256).not.toBe(first?.sha256);

      const third = picker.pick('confident', 'normal', { force: true, rng: () => 0.0 });
      expect(third).not.toBeNull();
      expect(third?.sha256).not.toBe(first?.sha256);
      expect(third?.sha256).not.toBe(second?.sha256);
    });

    it('does not stall or fail when history fills up; resets gracefully', () => {
      const media = new ReactionMedia(stagingDir);
      const picker = new ReactionPicker(media, {
        enabled: true,
        gifsEnabled: true,
        gifLevel: 'normal'
      });

      // Pick 10 times consecutively for a 2-item mood (e.g. waiting)
      for (let i = 0; i < 10; i++) {
        const item = picker.pick('waiting', 'normal', { force: true });
        expect(item).not.toBeNull();
      }
    });
  });

  describe('Discord AttachmentBuilder & Persona Facade', () => {
    it('creates valid AttachmentBuilder with reaction.gif name', () => {
      const media = new ReactionMedia(stagingDir);
      const picker = new ReactionPicker(media, {
        enabled: true,
        gifsEnabled: true,
        gifLevel: 'normal'
      });

      const reaction = picker.pick('victory', 'normal', { force: true });
      expect(reaction).not.toBeNull();

      const attachment = picker.createAttachment(reaction!);
      expect(attachment).toBeInstanceOf(AttachmentBuilder);
      expect(attachment.name).toBe('reaction.gif');
      expect(attachment.description).toBe(reaction!.description);
    });

    it('provides ergonomic facade methods via Persona singleton', () => {
      const reaction = persona.pickReaction('electric', 'normal', { force: true });
      expect(reaction).not.toBeNull();
      expect(reaction?.mood).toBe('electric');

      const attachment = persona.reactionAttachment('electric', 'normal', { force: true });
      expect(attachment).toBeInstanceOf(AttachmentBuilder);
      expect(attachment?.name).toBe('reaction.gif');
    });
  });
});
