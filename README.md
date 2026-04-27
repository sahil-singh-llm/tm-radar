# tm-radar — Trademark Squatting Detector

Real-time brand protection through Certificate Transparency log monitoring.

**▶ Live demo:** https://sahil-singh-llm.github.io/tm-radar/ — runs entirely in your browser. The
"Try demo" button gives you a full pipeline walkthrough without an API key.

A purely client-side React application that watches every TLS certificate issued anywhere on the
public internet, scores each new domain against a brand name you care about, and — for the truly
suspicious ones — fetches the live website and asks an LLM for a structured legal assessment.

## What is Trademark Squatting?

Trademark squatting is the bad-faith registration of domains that are confusingly similar to an
established trademark. Variants include:

- **Typosquatting** — `nikee.com`, `paypa1.com`
- **Homoglyph attacks** — `nіke.com` (Cyrillic `і` instead of Latin `i`)
- **Combosquatting** — `nike-support.xyz`, `get-nike.top`
- **Keyword injection** — `paypal-secure-login.com`
- **Suspicious-TLD variants** — `nike.tk`, `spotify.click`

Squatters typically use these domains to phish customers, distribute counterfeit goods, or extort
the legitimate brand owner. Catching the registration on day one — before the domain is ever
served to a real user — is the difference between a quick UDRP takedown and a costly enforcement
campaign.

## How it works

1. **Stream** — Connects to [Certstream](https://certstream.calidog.io/) via WebSocket, which
   mirrors Google's and Cloudflare's public Certificate Transparency logs. Every new HTTPS
   certificate, every domain, every CA — typically 200–500 domains per minute.
2. **Score** — Each new domain is run through a multi-signal detection engine:
   - Normalized Levenshtein distance against the brand name
   - Homoglyph character substitution (Cyrillic, accented Latin, digit lookalikes)
   - Combosquatting (brand as substring with affixes)
   - Suspicious-keyword injection (`support`, `login`, `secure`, …)
   - Suspicious-TLD bonus (`.tk`, `.xyz`, `.click`, …)
3. **Fetch** — Domains scoring above the threshold trigger a website fetch via CORS proxy. Most
   freshly issued certificates point to nothing yet — that's expected and handled gracefully.
4. **Analyze** — An LLM is asked for a structured assessment covering:
   - Sign similarity and squatting technique
   - Goods & services similarity (when the website is reachable)
   - Likelihood of confusion for the average consumer
   - Legal assessment under UDRP bad-faith criteria and EUTMR Art. 9
   - Recommended action (UDRP filing, Cease & Desist, WHOIS investigation, …)

   The current implementation uses **Anthropic Claude Sonnet 4.6**
   (`claude-sonnet-4-6`, balanced flagship as of April 2026). Equivalent-quality models from
   other providers — **OpenAI GPT-5.5**, **Google Gemini 3.1 Pro**, **DeepSeek V4** — should
   produce comparable output and are on the roadmap as drop-in alternatives. For maximum
   legal-reasoning depth, **Claude Opus 4.7** (`claude-opus-4-7`) is a one-line swap. A benchmark
   comparing these four flagship models on labeled UDRP cases is planned.

The analysis runs in two stages: an immediate domain-only assessment as soon as the domain is
flagged, automatically refined with goods & services data once the website is fetched.

## Detection Algorithms

| Signal | Description | Score range |
| --- | --- | --- |
| Levenshtein | Normalized edit distance on the leftmost label | up to 95 |
| Homoglyph | Reverse-mapping of Cyrillic / digit / accent variants to Latin | 80–98 |
| Combosquatting | Brand as substring; score decays with extra characters | 70–95 |
| Keyword injection | Brand + a high-risk keyword like `support` or `login` | 95 |
| Suspicious TLD | `+20` bonus when paired with another signal | additive |

Severity bands: `low` 50–64, `medium` 65–79, `high` 80–91, `critical` 92+.

## Legal Framework

The Claude prompt explicitly references:

- **UDRP** — ICANN Uniform Domain-Name Dispute-Resolution Policy
- **EUTMR Art. 9** — EU Trademark Regulation
- **WIPO Arbitration** criteria for bad-faith registration

> ⚠ This tool identifies *potential* infringements for investigative purposes only.
> It does not constitute legal advice. Always consult a qualified trademark attorney before
> initiating any enforcement action.

## Setup

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Two ways to use it:

- **Live mode** — enter a brand name plus an [Anthropic API key](https://console.anthropic.com)
  (key is stored only in `sessionStorage`, never transmitted anywhere except to Anthropic). Pick a
  similarity threshold (default 80). Real CT-log stream, real LLM analysis.
- **Demo mode** — click "Try demo (no API key required)" on the setup screen. Simulated
  certificate stream + canned legal analyses for each detection technique. Full UX walkthrough
  without an account anywhere.

If the Certstream WebSocket can't be reached in live mode (corporate firewall, etc.), the app
automatically falls back to the simulated demo feed.

## Deploy to GitHub Pages

```bash
npm install gh-pages --save-dev
npm run build
npm run deploy
```

The `vite.config.ts` already sets `base: '/trademark-squatting-detector/'` for GitHub Pages.

## Architecture

```
src/
├── App.tsx              — top-level state machine: setup ↔ monitor
├── components/
│   ├── SetupScreen.tsx  — onboarding form + explainer
│   ├── Monitor.tsx      — orchestrates stream → detection → analysis
│   ├── DomainAlert.tsx  — single flagged domain card
│   ├── LiveFeed.tsx     — scrolling feed of all observed domains
│   └── StatsBar.tsx     — counters + connection status
└── lib/
    ├── certstream.ts    — WebSocket client w/ exponential backoff + demo mode
    ├── detection.ts     — Levenshtein, combosquatting, keyword, TLD scoring
    ├── homoglyphs.ts    — character substitution map + normalization
    ├── fetcher.ts       — multi-proxy CORS website fetch
    └── claude.ts        — two-stage rate-limited Anthropic API client
```

## Performance Notes

Certstream emits 200–500 domains per minute. The Monitor buffers incoming domains and flushes
state every 100 ms, keeping React re-renders cheap even at peak throughput. The live-feed list is
capped at 24 entries; the alerts list at 60.

Claude calls are serialized with a 2-second minimum gap to stay within free-tier rate limits.

## License

MIT
