# TM Radar

**Real-time trademark squatting detection through Certificate Transparency logs + AI-powered legal analysis.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Live Demo](https://img.shields.io/badge/▶-Live_Demo-2563EB)](https://sahil-singh-llm.github.io/tm-radar/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Claude](https://img.shields.io/badge/Claude-Sonnet_4.6-D97757?logo=anthropic&logoColor=white)](https://www.anthropic.com)
[![100% Client-Side](https://img.shields.io/badge/100%25-Client--Side-22C55E)](#)
[![Deployed on GitHub Pages](https://img.shields.io/badge/Deploy-GitHub_Pages-181717?logo=github&logoColor=white)](https://sahil-singh-llm.github.io/tm-radar/)

---

TM Radar is a purely client-side React application that watches every TLS certificate issued
anywhere on the public internet, scores each new domain against a brand name you care about, and —
for the truly suspicious ones — fetches the live website and produces a structured pre-triage memo
mapping the observed signals to UDRP §4 and EUTMR Art. 9 elements for attorney review.

**▶ Live demo:** https://sahil-singh-llm.github.io/tm-radar/ — runs entirely in your browser. The
"Try demo" button gives you a full pipeline walkthrough without an API key.

## What this tool detects: cybersquatting

> **Terminology note.** *Trademark squatting* in strict legal usage refers to the bad-faith
> registration of a **trademark** by someone other than the legitimate brand owner. What this tool
> detects is the bad-faith registration of **domain names** that mimic an existing mark — the
> precise term is **cybersquatting** (per ICANN's UDRP), with typosquatting, homoglyph attacks,
> combosquatting, and keyword injection as recognized subtypes. The repo title "TM Radar" frames
> the use case from the brand-protection perspective; the technical detection runs on domain
> identifiers.

Common variants:

- **Typosquatting** — `nikee.com`, `paypa1.com`
- **Homoglyph attacks** — `nіke.com` (Cyrillic `і` instead of Latin `i`)
- **Combosquatting** — `nike-support.xyz`, `get-nike.top`
- **Keyword injection** — `paypal-secure-login.com`
- **Suspicious-TLD variants** — `nike.tk`, `spotify.click`

Cybersquatters typically use these domains to phish customers, distribute counterfeit goods, or
extort the legitimate brand owner. Catching the registration on day one — before the domain is
ever served to a real user — is the difference between a routine UDRP filing and a costly
enforcement campaign.

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
4. **Analyze** — An LLM produces a structured pre-triage memo covering:
   - **Sign similarity** — squatting technique observed (typo / homoglyph / combo / TLD / keyword / mixed)
   - **Goods & services indicators** — apparent operating market, when the site is reachable
   - **Likelihood of confusion** — high / medium / low / cannot be assessed
   - **UDRP §4(a) elements** — explicit mapping to §4(a)(i)–(iii), with §4(b)(i)–(iv) bad-faith
     circumstances referenced where applicable
   - **EUTMR Art. 9(2) elements** — explicit mapping to 9(2)(a)–(c)
   - **Indicators for legal review** — investigative steps for the reviewing attorney
     (registrant identity via WHOIS/RDAP, prior use, registrant's portfolio, registrar
     jurisdiction)

   The output is framed as decision support for a qualified trademark attorney, not as legal
   advice or an enforcement recommendation. The current implementation uses
   **Anthropic Claude Sonnet 4.6** (`claude-sonnet-4-6`, balanced flagship as of April 2026).
   Equivalent-quality models from other providers — **OpenAI GPT-5.5**, **Google Gemini 3.1
   Pro**, **DeepSeek V4** — should produce comparable output and are on the roadmap as drop-in
   alternatives. For maximum legal-reasoning depth, **Claude Opus 4.7** (`claude-opus-4-7`) is a
   one-line swap. A benchmark comparing these four flagship models on labeled UDRP cases is
   planned.

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

The prompt structures the LLM output around concrete provisions rather than asking the model to
free-associate "bad faith":

- **UDRP §4(a)(i)–(iii)** — the three elements complainants must prove (confusing similarity,
  no legitimate interest, registration and use in bad faith)
- **UDRP §4(b)(i)–(iv)** — non-exhaustive bad-faith circumstances (offer for sale, blocking
  pattern, competitor disruption, commercial gain via confusion)
- **EUTMR Art. 9(2)(a)–(c)** — identical / similar / reputation-based infringement limbs
- **WIPO Arbitration** as the principal forum for UDRP proceedings

The output is framed as a *pre-triage memo*: structured observations and indicators for review
by a qualified trademark attorney. See "Deliberate Simplifications" below for what is and is
not modeled.

> ⚠ This tool identifies *potential* indicators of cybersquatting for investigative purposes
> only. It does not constitute legal advice. Always consult a qualified trademark attorney
> before initiating any enforcement action.

## Deliberate Simplifications

The following are intentionally **out of scope**. A production brand-protection product would
need to address each of them; this tool deliberately stops short to keep the demonstration
focused on the detection-plus-structured-analysis pipeline.

- **Nice classification** — class similarity (Art. 9(2)(b) EUTMR) is not assessed. The tool
  cannot tell whether the registrant operates in goods/services classes that conflict with the
  protected mark.
- **Reputation protection** — Art. 9(2)(c) EUTMR (well-known marks) is not modeled. The
  reputation status of the input mark is assumed unknown.
- **Priority and geographic scope** — first-to-file dates, EU vs. national vs. Madrid scopes,
  and prior-use defenses are all ignored.
- **Multi-brand portfolios** — single-brand monitoring only. A real IP department typically
  watches dozens to hundreds of marks simultaneously.
- **Mark register verification** — existence, status, and ownership of the input mark are
  assumed, not checked against EUIPO, USPTO, WIPO Madrid, or any national register.
- **WHOIS / RDAP enrichment** — registrant identity, prior registrations, and pattern of bad
  faith would all require integration with WHOIS APIs (most paid or rate-limited).
- **Persistent case management** — alerts vanish on page refresh. A production product needs a
  database, audit trail, and evidence packaging for legal proceedings.
- **UPL / RDG positioning** — the prompt is framed as pre-triage; jurisdiction-specific
  unauthorized-practice-of-law disclaimers would need to be added before any commercial
  deployment, particularly in DE/AT under the RDG.
- **Cross-provider evaluation** — output quality is currently measured anecdotally. A labeled
  UDRP-decision fixture set comparing Claude / GPT / Gemini / DeepSeek is on the roadmap.

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
