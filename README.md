# TM Radar

**Real-time cybersquatting detection through Certificate Transparency logs + AI-powered legal analysis.**

[![Live Demo](https://img.shields.io/badge/▶-Live_Demo-2563EB)](https://sahil-singh-llm.github.io/tm-radar/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Legal Tech](https://img.shields.io/badge/Legal_Tech-UDRP_%2B_EUTMR-7C3AED)](#what-this-tool-detects-cybersquatting)
[![100% Client-Side](https://img.shields.io/badge/100%25-Client--Side-22C55E)](#)
[![Deployed on GitHub Pages](https://img.shields.io/badge/Deploy-GitHub_Pages-181717?logo=github&logoColor=white)](https://sahil-singh-llm.github.io/tm-radar/)

---

TM Radar is a purely client-side React application that polls public Certificate Transparency
logs for newly issued TLS certificates matching a watched brand, scores each domain against
cybersquatting heuristics, and — for the truly suspicious ones — fetches the live website and
produces a structured pre-triage memo mapping the observed signals to UDRP §4 and EUTMR Art. 9
elements for attorney review.

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

1. **Poll** — Queries [crt.sh](https://crt.sh) (Sectigo's public Certificate Transparency log
   index) every 30 seconds for entries whose Subject Alternative Names contain the watched
   brand string. crt.sh's monotonic `id` cursor lets the client emit only newly-inserted
   certificates on each subsequent poll. This is brand-targeted polling rather than a
   firehose — drastically lower noise, and resilient (Calidog's public Certstream WebSocket has
   been intermittently down since 2023).
2. **Brand context** — On startup, the app does a single Wikidata SPARQL lookup against the
   brand string and, if a matching business/brand entity exists, surfaces its industry,
   inception year, and country to the LLM prompt as community-curated background context —
   explicitly not a register-verified right.
3. **Score** — Each new domain is run through a multi-signal detection engine:
   - Normalized Levenshtein distance against the brand name
   - Homoglyph character substitution (Cyrillic, accented Latin, digit lookalikes)
   - Combosquatting (brand as substring with affixes)
   - Suspicious-keyword injection (`support`, `login`, `secure`, …)
   - Suspicious-TLD bonus (`.tk`, `.xyz`, `.click`, …)
4. **Fetch** — Domains scoring above the threshold trigger a website-content fetch via CORS
   proxy and a homepage screenshot via [microlink.io](https://microlink.io)'s free tier (server-
   side headless-Chrome rendering). Most freshly issued certificates point to nothing yet —
   that's expected; both fetches handle null gracefully.
5. **Analyze** — An LLM produces a structured pre-triage memo covering:
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
   advice or an enforcement recommendation. The current implementation uses **Anthropic Claude
   Sonnet 4.6**; the LLM client is provider-agnostic, with Claude Opus 4.7, GPT-5.5, Gemini 3.1
   Pro, and DeepSeek V4 as drop-in alternatives.

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

The prompt anchors the LLM output to concrete provisions — UDRP §4(a)(i)–(iii) elements,
§4(b)(i)–(iv) bad-faith circumstances, EUTMR Art. 9(2)(a)–(c) infringement limbs, with WIPO as
the principal UDRP forum — rather than free-associating around "bad faith". See "Deliberate
Simplifications" for what is *not* modeled.

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
- **Mark register verification** — Wikidata is queried only for soft brand context (industry,
  inception year, country); no official register (EUIPO, USPTO, WIPO Madrid, DPMA) is consulted.
  Register verification — existence, status, ownership, classes, priority — remains attorney
  work.
- **WHOIS / RDAP enrichment** — registrant identity, prior registrations, and pattern of bad
  faith would all require integration with WHOIS APIs (most paid or rate-limited).
- **Persistent case management** — alerts vanish on page refresh. A production product needs a
  database, audit trail, and evidence packaging for legal proceedings.
- **UPL / RDG positioning** — the prompt is framed as pre-triage; jurisdiction-specific
  unauthorized-practice-of-law disclaimers would need to be added before any commercial
  deployment, particularly in DE/AT under the RDG.
- **Cross-provider evaluation** — output quality is currently measured anecdotally. A labeled
  UDRP-decision fixture set comparing Claude / GPT / Gemini / DeepSeek is on the roadmap.
- **Evidence-grade screenshot capture** — homepage thumbnails come from microlink.io's free
  tier (~50 requests/day, watermarked CDN URLs). For UDRP/WIPO submissions the registrar
  expects timestamped, hash-anchored, full-page captures of every visited path; that requires
  a self-hosted Puppeteer cluster (Cloudflare Workers Browser Rendering or similar) plus a
  crawl strategy and is explicitly out of scope here.
- **EU GDPR — Google Fonts in-line loading** — *Inter* and *JetBrains Mono* are loaded
  directly from Google's CDN, which transmits visitor IPs to Google. The Landgericht München I
  ruled in *3 O 17493/20* (20 January 2022) that this constitutes an unlawful transfer of
  personal data without consent. For EU/EEA deployment, fonts should be self-hosted or loaded
  behind a consent gate. Documented in [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md#web-fonts).

## Roadmap

- **RDAP enrichment** — registrant identity, registrar, and creation date pulled per alert via the standardized RDAP protocol.
- **Wayback first-archive timestamp** — earliest Internet Archive capture of the suspicious domain as a registration-age signal.
- **URLhaus reputation flag** — cross-check each flagged domain against abuse.ch's URLhaus malware/phishing feed.
- **DNS / MX active-mailflow indicator** — surface MX-record presence and resolver liveness as a "weaponized vs. parked" signal.
- Official trademark register integration (TMview / EUIPO eSearch / USPTO TSDR) — pending stable public APIs with CORS support.

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

If crt.sh is unreachable in live mode (corporate firewall, CORS-proxy outage, etc.), the app
automatically falls back to the simulated demo feed after three consecutive failed polls.

## Architecture

```
src/
├── App.tsx              — top-level state machine: setup ↔ monitor
├── components/
│   ├── SetupScreen.tsx  — onboarding form + explainer
│   ├── Monitor.tsx      — orchestrates stream → detection → analysis
│   ├── DomainAlert.tsx  — single flagged domain card
│   ├── Radar.tsx        — animated radar visualization of observed + flagged domains
│   └── StatsBar.tsx     — counters + connection status
└── lib/
    ├── crtsh.ts         — crt.sh polling client w/ id-cursor + demo fallback
    ├── screenshot.ts    — microlink.io homepage capture for evidence preview
    ├── detection.ts     — Levenshtein, combosquatting, keyword, TLD scoring
    ├── homoglyphs.ts    — character substitution map + normalization
    ├── fetcher.ts       — multi-proxy CORS website fetch
    ├── claude.ts        — two-stage rate-limited Anthropic API client
    ├── brandProfile.ts  — Wikidata SPARQL brand-context lookup
    └── demoAnalysis.ts  — canned legal analyses for the no-API-key demo flow
```

## Scope and Audience

This is a Legal Engineering **showcase**, not a commercial brand-protection product — see
[Deliberate Simplifications](#deliberate-simplifications) for what production monitoring would
additionally require. The project deliberately stops at the proof-of-concept layer to
demonstrate end-to-end thinking across the legal-tech stack: real-time CT-log ingest,
multi-vector detection heuristics, structured legal prompting against concrete UDRP / EUTMR
provisions, attorney-facing output framing, and explicit limit awareness.

Intended audience: IP and brand-protection teams evaluating where AI fits into early-stage
cybersquatting triage, and Legal Engineering hiring panels.

## License & Attribution

The MIT License (see [LICENSE](LICENSE)) covers all original source code in this repository.

Bundled third-party dependencies retain their respective licenses; external services accessed
at runtime are governed by their providers' terms. The full inventory — bundled dependencies,
build-time tooling, runtime services (crt.sh, Anthropic, Microlink, Google Fonts, …),
algorithms and data sources — is documented in
[THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).

Run `npm run licenses` to verify the production-bundle inventory against the current
`package-lock.json`.
