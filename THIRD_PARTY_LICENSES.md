# Third-Party Components and Attributions

This document inventories the third-party software components, external services, and data
sources used by TM Radar, along with the licenses or terms that govern them.

The MIT License (see [LICENSE](LICENSE)) covers all original source code in this repository.
The components listed below retain their respective licenses, or are governed by their
providers' terms; this project neither redistributes their code (where they are runtime
services) nor modifies their license terms (where they are bundled).

---

## A. Bundled Production Dependencies

These five packages are included in the production JavaScript bundle distributed to end users
and are subject to the MIT License's attribution requirements (preservation of copyright +
permission notice).

### React, React DOM, Scheduler

> Copyright (c) Meta Platforms, Inc. and affiliates.

Licensed under the MIT License — full text:
[github.com/facebook/react/blob/main/LICENSE](https://github.com/facebook/react/blob/main/LICENSE)

| Package | Version | Repository |
|---------|---------|------------|
| react | 18.3.1 | https://github.com/facebook/react |
| react-dom | 18.3.1 | https://github.com/facebook/react |
| scheduler | 0.23.2 | https://github.com/facebook/react |

### loose-envify

> Copyright (c) 2015 Andres Suarez

Licensed under the MIT License — full text:
[github.com/zertosh/loose-envify/blob/master/LICENSE](https://github.com/zertosh/loose-envify/blob/master/LICENSE)

| Package | Version | Repository |
|---------|---------|------------|
| loose-envify | 1.4.0 | https://github.com/zertosh/loose-envify |

### js-tokens

> Copyright (c) 2014–2020 Simon Lydell

Licensed under the MIT License — full text:
[github.com/lydell/js-tokens/blob/master/LICENSE](https://github.com/lydell/js-tokens/blob/master/LICENSE)

| Package | Version | Repository |
|---------|---------|------------|
| js-tokens | 4.0.0 | https://github.com/lydell/js-tokens |

**Total: 5 bundled packages** (`react`, `react-dom`, `scheduler`, `loose-envify`, `js-tokens`),
all under the MIT License.

> Run `npm run licenses` to verify this inventory against the current `package-lock.json`.

### MIT License Text

The following permission notice applies to **all five packages listed in Section A**. Their
copyright notices appear above; this text reproduces the standard MIT permission notice that
each package's upstream LICENSE file contains verbatim.

```
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## B. Build-Time Dependencies (not redistributed)

These tools process source code at build time but are **not included** in the production
bundle. Listed for transparency. The full transitive dev-tree includes additional packages
under MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, CC-BY-4.0 (caniuse-lite browser
compatibility data), and CC0-1.0 licenses.

| Package | License | Repository |
|---------|---------|------------|
| @types/react, @types/react-dom | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped |
| @vitejs/plugin-react | MIT | https://github.com/vitejs/vite-plugin-react |
| autoprefixer | MIT | https://github.com/postcss/autoprefixer |
| gh-pages | MIT | https://github.com/tschaub/gh-pages |
| license-checker | BSD-3-Clause | https://github.com/davglass/license-checker |
| postcss | MIT | https://github.com/postcss/postcss |
| tailwindcss | MIT | https://github.com/tailwindlabs/tailwindcss |
| typescript | Apache-2.0 | https://github.com/microsoft/TypeScript |
| vite | MIT | https://github.com/vitejs/vite |

---

## C. External Services (accessed at runtime)

This application makes runtime requests to the following third-party services. **Their code is
not bundled with this project**; their use is governed by the respective providers' terms of
service. The user — by running the application — initiates these requests directly from their
browser to the provider.

### Certificate Transparency Data

| Service | Operator | Purpose | URL |
|---------|----------|---------|-----|
| crt.sh | Sectigo Limited | Frontend over the public Certificate Transparency log ecosystem (Google, Cloudflare, Let's Encrypt, etc.); substring match against the watched brand | https://crt.sh |
| api.allorigins.win | gnuns / open-source community | CORS proxy (primary) for browser access to crt.sh and target websites | https://allorigins.win |
| api.codetabs.com | codetabs | CORS proxy (fallback) for browser access to crt.sh and target websites | https://codetabs.com |

`crt.sh` is operated by Sectigo Limited as a public service; the underlying data originates
from the public Certificate Transparency log ecosystem maintained by Google, Cloudflare,
Let's Encrypt and other CAs. None of these three services publish formal Terms of Service;
usage is at-will, subject to undocumented per-IP rate limits, and without warranty. They
are used in [`src/lib/crtsh.ts`](src/lib/crtsh.ts) and
[`src/lib/fetcher.ts`](src/lib/fetcher.ts).

### LLM Inference

| Service | Operator | Purpose | URL |
|---------|----------|---------|-----|
| api.anthropic.com | Anthropic, PBC | LLM inference (default model: Claude Sonnet 4.6) | https://www.anthropic.com |

The user supplies their own Anthropic API key; queries are made directly from the browser to
Anthropic. Use is governed by Anthropic's
[Commercial Terms of Service](https://www.anthropic.com/legal/commercial-terms) and
[Usage Policies](https://www.anthropic.com/legal/aup). The application sets the
`anthropic-dangerous-direct-browser-access: true` header (required for browser-origin requests
under Anthropic's CORS policy) — production use should proxy through a server-side endpoint
to avoid exposing API keys client-side at scale.

### Screenshot Capture

| Service | Operator | Purpose | URL |
|---------|----------|---------|-----|
| api.microlink.io | Microlink HQ | Headless-Chrome homepage screenshots (free tier, no API key, ~50 req/day) | https://microlink.io |

Use is governed by Microlink's [Terms of Service](https://microlink.io/tos). Free-tier usage is
subject to per-IP rate limits, daily request caps, and the watermarking/branding requirements
defined in their TOS. Production use beyond these limits requires a paid plan.

### Web Fonts

| Service | Operator | Purpose | URL |
|---------|----------|---------|-----|
| fonts.googleapis.com | Google LLC | *Inter* and *JetBrains Mono* webfonts | https://fonts.google.com |

Use is governed by [Google Fonts terms](https://developers.google.com/fonts/faq).

> **GDPR notice for EU/EEA visitors.** Loading webfonts from Google's CDN transmits the
> visitor's IP address to Google. The Landgericht München I (Regional Court Munich I) ruled in
> *3 O 17493/20* (judgment of 20 January 2022) that dynamic Google Fonts embedding without
> consent constitutes processing of personal data without a legal basis under
> **Art. 6(1) GDPR**, awarding EUR 100 in damages under § 823(1) BGB; the court did not reach
> the Chapter V cross-border-transfer question
> ([rewis.io/lhm-20-01-2022-3-o-1749320](https://rewis.io/urteile/urteil/lhm-20-01-2022-3-o-1749320/)).
> For production deployment in EU contexts, fonts should be self-hosted (downloaded and served
> from the same origin) or loaded behind a consent gate. This project links Google Fonts
> directly as a deliberate showcase simplification — see
> [Deliberate Simplifications](README.md#deliberate-simplifications) in the main README.

### External Reference Links (passive — opened in a new tab on user click)

| Target | Purpose |
|--------|---------|
| whois.domaintools.com | Registrant lookup |
| wipo.int | WIPO Arbitration reference |

---

## D. Algorithms and Data Sources

### Levenshtein Distance

A standard edit-distance algorithm published by V. I. Levenshtein in 1965 ("Binary codes
capable of correcting deletions, insertions, and reversals", *Soviet Physics Doklady*
10:707–710). Mathematical algorithms are not subject to copyright; the implementation in
[`src/lib/detection.ts`](src/lib/detection.ts) is original to this project.

### Homoglyph Substitution Table

The 17-entry mapping in [`src/lib/homoglyphs.ts`](src/lib/homoglyphs.ts) is custom-curated for
this project and not derived from any third-party data set. The canonical reference for
comprehensive homoglyph data is the **Unicode Technical Standard #39 — Confusables**
([unicode.org/reports/tr39](https://www.unicode.org/reports/tr39/)), which production
deployments should consult for broader coverage.

### Suspicious Keywords and TLDs

The keyword list (`support`, `login`, `secure`, `verify`, …) and TLD list (`.tk`, `.xyz`,
`.click`, …) in [`src/lib/detection.ts`](src/lib/detection.ts) reflect common patterns
documented across security and brand-protection publications (e.g., Spamhaus reports, ICANN
SSAC advisories). The specific selections are this project's own and not derived from any
single proprietary source.

---

## License Scope Summary

The MIT License (see [LICENSE](LICENSE)) covers all original source code in this repository
authored by Sahil Singh.

Bundled third-party dependencies (Section A) retain their respective licenses; their copyright
notices and license terms are preserved upstream and reproduced above.

Build-time dependencies (Section B) are used to process source code but are not redistributed
in any user-facing artifact.

External services (Section C) are governed by their providers' terms; this project neither
redistributes their code nor warrants their availability.

Algorithms and data (Section D) are either non-copyrightable mathematical methods or original
to this project.
