# Misaka Mikoto Reaction GIF Catalog & Media Policy

- **Component:** UMA Tournament Bot — Character UX Layer (`feat/misaka-persona`)
- **Verification Date:** 2026-10-03
- **Status:** Curated & Verified (23 GIFs, 55 MiB total)
- **Host Storage Path:** `/var/lib/uma-bot/media/misaka/` (Fallback/Staging: `/tmp/misaka_staging/`)


---

## 1. Reaction Media Policy

### Zero-Binary Git Repository Policy
- Reaction GIF binaries are **never committed into this Git repository**.
- `.gitignore` explicitly ignores `media/`, `data/media/`, `*.gif`, `*.mp4`, `*.webm`.
- Media assets are curated, verified, and stored locally on the deployment host.
- The repository only tracks code, configuration schemas, and catalog metadata.

### Serious Flows — Absolute Zero GIF Policy (0%)
Clarity and professional tournament adjudication strictly supersede visual flair. Under no circumstances may a reaction GIF be attached to:
- Dispute filings or referee dispute adjudication (`/uma result-resolve`, dispute modal)
- Disciplinary actions or team sanctions
- Evidence rejections or correction locks (`CORRECTION_LOCKED`)
- Destructive result correction confirmations (`/uma result-correct`)
- Database errors, backup failures, or data corruption alerts
- Security failures, unauthorized access, or permission denials (`permissionDenied`)
- Production readiness doctor failures (`/uma doctor`)
- Internal unhandled exceptions

### Non-Serious Flow Frequency Targets
- **Normal Interactions:** Roughly **25–40%** (default baseline `0.35`).
- **Showtime Interactions:** Roughly **60–80%** (default baseline `0.75`).
- **Configurable Control:**
  - `BOT_PERSONA_GIFS_ENABLED`: boolean (`true`/`false`)
  - `BOT_PERSONA_GIF_LEVEL`: `'off'` (0%), `'normal'` (35% / 75%), `'high'` (50% / 90%)
  - `BOT_PERSONA_MEDIA_DIR`: local filesystem path to media directory containing `catalog.json`

### Fail-Safe & Non-Blocking Invariant
Reaction GIF loading is strictly auxiliary:
- If a GIF file is missing from disk, unreadable, corrupt, or exceeds limits, the reaction system returns `null`.
- The bot completes the tournament interaction seamlessly with text and embeds only.
- Missing media never aborts, rolls back, or errors out any tournament operation.

---

## 2. Technical Validation Criteria

All 23 assets underwent programmatic and visual verification:
1. **Magic Header:** Must match `GIF89a` animated GIF standard.
2. **Resolution:** Minimum $100 \times 100$ pixels (range: $178\text{px}$ to $498\text{px}$ width).
3. **Animation:** Verified frame count $> 1$ (range: 1,094 to 33,749 data frames/blocks).
4. **Discord Size Limit:** Strictly $\le 8\text{ MiB}$ (largest file is 7.37 MiB).
5. **Character Accuracy:** Verified depiction of Misaka Mikoto from *Toaru Kagaku no Railgun* / *Toaru Majutsu no Index*.
6. **Path Traversal Safety:** Canonical relative paths only; no `..`, leading slashes, or symbolic link escapes.

---

## 3. Curated Reaction Catalog (23 GIFs)

### Category: `confident` (3 GIFs)
Used for successful registration, smooth check-in, confident confirmations.

| File | Size | SHA-256 (prefix) | Source CDN | Dimensions | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `confident/confident-01.gif` | 345.1 KiB | `7c019b20cd` | [Tenor](https://media.tenor.com/NS3RvKFHmZIAAAAM/a-certain-scientific-railgun-a-certain-magical-index.gif) | 220x329 | Misaka confident smile & salute |
| `confident/confident-02.gif` | 2.18 MiB | `68926e83e3` | [Tenor](https://media.tenor.com/Yu4saQQTBvIAAAAC/smug.gif) | 498x277 | Misaka confident/smug look |
| `confident/confident-03.gif` | 1.83 MiB | `356c871c52` | [Tenor](https://media.tenor.com/OZPRYnXWH44AAAAC/nelward-misaka-mikoto.gif) | 437x498 | Misaka stylish confident turn |

### Category: `annoyed` (4 GIFs)
Used for duplicate check-in, repeated button clicks, existing team registration attempts.

| File | Size | SHA-256 (prefix) | Source CDN | Dimensions | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `annoyed/annoyed-01.gif` | 2.27 MiB | `21a8eb4fca` | [Tenor](https://media.tenor.com/Fcflqii5Qv8AAAAC/misaka-mikoto-railgun-t.gif) | 498x361 | Misaka mildly annoyed head shake |
| `annoyed/annoyed-02.gif` | 1.02 MiB | `909bb46a39` | [Tenor](https://media.tenor.com/1_Qr8rZqHQ8AAAAC/anime-girl-blush-anime.gif) | 498x278 | Misaka flustered tsundere reaction |
| `annoyed/annoyed-03.gif` | 251.1 KiB | `b294db3cda` | [Tenor](https://media.tenor.com/jKXm28YMxPEAAAAC/misaka-mikoto-angry.gif) | 178x230 | Misaka irritated pout |
| `annoyed/annoyed-04.gif` | 4.37 MiB | `557c203c52` | [Tenor](https://media.tenor.com/ht_8KZrnd_8AAAAC/koffee-pick-a-number.gif) | 498x279 | Misaka sighing at user's repeated action |

### Category: `waiting` (2 GIFs)
Used when waiting for opponent check-in, waiting for match readiness, or idle queue.

| File | Size | SHA-256 (prefix) | Source CDN | Dimensions | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `waiting/waiting-01.gif` | 2.68 MiB | `03599a7f8b` | [Tenor](https://media.tenor.com/GVzdov64gygAAAAC/sleep-misaka-mikoto.gif) | 498x278 | Misaka resting/waiting patiently |
| `waiting/waiting-02.gif` | 1.78 MiB | `0d5768fc80` | [Tenor](https://media.tenor.com/Kr0VS-P6sw4AAAAC/misaka-mikoto-railgun-t.gif) | 498x427 | Misaka looking around waiting |

### Category: `surprised` (2 GIFs)
Used for unexpected inputs or surprising capacity milestones.

| File | Size | SHA-256 (prefix) | Source CDN | Dimensions | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `surprised/surprised-01.gif` | 1.68 MiB | `fc760d95e6` | [Tenor](https://media.tenor.com/Vl6NuWIvprUAAAAC/anime-shocked.gif) | 498x239 | Misaka wide-eyed surprise |
| `surprised/surprised-02.gif` | 4.47 MiB | `4cb6353955` | [Tenor](https://media.tenor.com/a_T2L7fRqQwAAAAC/misaka-mikoto-shirai-kuroko.gif) | 498x375 | Misaka comical shock reaction |

### Category: `electric` (4 GIFs)
Used for match start, ready-to-start state, check-in phase opening.

| File | Size | SHA-256 (prefix) | Source CDN | Dimensions | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `electric/electric-01.gif` | 953.9 KiB | `39256bccd4` | [Tenor](https://media.tenor.com/X0KXVQa25kQAAAAC/%E5%BE%A1%E5%9D%82%E7%BE%8E%E7%90%B4-mikoto-misaka.gif) | 498x471 | Misaka electric spark charge |
| `electric/electric-02.gif` | 3.31 MiB | `3c77a5c9ac` | [Tenor](https://media.tenor.com/jWq_oaU2Q5oAAAAC/railgun-only.gif) | 498x278 | Misaka signature coin flick prep |
| `electric/electric-03.gif` | 7.37 MiB | `d89ed9cfc4` | [Tenor](https://media.tenor.com/bImzgsZm1pAAAAAC/misaka-mikoto-misaka.gif) | 498x280 | Misaka full Railgun discharge |
| `electric/electric-04.gif` | 4.54 MiB | `fe5ab81853` | [Tenor](https://media.tenor.com/wfma4CqwxCwAAAAC/railgun-misaka-mikoto.gif) | 498x280 | Misaka electricity aura surge |

### Category: `hype` (3 GIFs)
Used for tournament start, bracket draw reveal, tournament stage transitions.

| File | Size | SHA-256 (prefix) | Source CDN | Dimensions | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `hype/hype-01.gif` | 1.06 MiB | `db7c5545fc` | [Tenor](https://media.tenor.com/7dfj-EMTNLYAAAAC/touma-kamijo.gif) | 498x378 | Misaka high-energy combat readiness |
| `hype/hype-02.gif` | 2.57 MiB | `53fbb483f9` | [Tenor](https://media.tenor.com/lLnJQM2RzisAAAAC/misaka-mikoto.gif) | 498x280 | Misaka determined battle focus |
| `hype/hype-03.gif` | 706.6 KiB | `8802bbe9b2` | [Tenor](https://media.tenor.com/gCejCcaZlY0AAAAM/toaru-kagaku-no-railgun-t-anime.gif) | 220x122 | Misaka electric dynamic charge |

### Category: `victory` (3 GIFs)
Used for referee approval of winning team, match win, champion announcement.

| File | Size | SHA-256 (prefix) | Source CDN | Dimensions | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `victory/victory-01.gif` | 1.65 MiB | `1bfea01883` | [Tenor](https://media.tenor.com/LNfYOIrdwqgAAAAC/prp-bb.gif) | 498x277 | Misaka cheerful victory nod |
| `victory/victory-02.gif` | 785.9 KiB | `f598506ad1` | [Tenor](https://media.tenor.com/Zh4Owr3mZ8gAAAAC/hello-van-misaka-mikoto.gif) | 498x278 | Misaka proud wave & smile |
| `victory/victory-03.gif` | 6.02 MiB | `fd18794679` | [Tenor](https://media.tenor.com/hF1HM4A2jjAAAAAC/anime-mikoto-misaka.gif) | 498x280 | Misaka celebratory energetic pose |

### Category: `checking` (2 GIFs)
Used for score submission receipt, evidence verification underway.

| File | Size | SHA-256 (prefix) | Source CDN | Dimensions | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `checking/checking-01.gif` | 1.23 MiB | `5500dbed0d` | [Tenor](https://media.tenor.com/rB8KrGcDATgAAAAC/anime-anime-girl.gif) | 498x269 | Misaka analyzing/inspecting closely |
| `checking/checking-02.gif` | 1.82 MiB | `020acd08c0` | [Tenor](https://media.tenor.com/HByMJq25pzcAAAAC/misaka-railgun.gif) | 400x226 | Misaka focusing intently on task |

---

## 4. Local Preview

A standalone, CSS-styled HTML gallery is generated locally for asset inspection:
```bash
# View in browser:
file:///tmp/misaka_staging/index.html
```

To sync the assets to the production system directory when granted sudo access:
```bash
sudo mkdir -p /var/lib/uma-bot/media/misaka
sudo cp -r /tmp/misaka_staging/* /var/lib/uma-bot/media/misaka/
```
