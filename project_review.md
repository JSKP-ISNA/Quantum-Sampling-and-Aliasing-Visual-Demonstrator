# Quantum Signal Studio — Complete Project Review

> Reviewed against commit `a4b85f5` (Final frontend version 1 with fixes) · 2026-03-28

---

## 1. What the project actually is

A hybrid **classical DSP + quantum simulation** demonstrator built as a browser/desktop app.

| Layer | Technology | Role |
|---|---|---|
| Frontend | React 19 + Three.js + Recharts | 5-route SPA with 3D scene |
| Backend | FastAPI + NumPy/SciPy | Signal engine + WebSocket stream |
| Quantum | Custom engine (LocalClassical / Qiskit-Aer) | Phase estimation, sampling circuits |
| Automation | n8n (Docker) | Webhook stub for AI explanation |
| Persistence | SQLite via ExperimentStore | Quantum job history |
| Desktop shell | Electron 37 + Webview | Standalone app mode |

---

## 2. Pages & what's built vs what's missing

### ✅ Landing Page (`/`)
**Status:** Complete and polished.  
**What's there:** Animated hero, stat band, capabilities, module cards, workflow steps, tech stack, CTA.  
**What's missing:**
- The hero "trace" is static hardcoded numbers (`HERO_TRACE = [34, 58, 49, 72...]`) — it never animates. Add a CSS keyframe loop or a `useEffect` that drives the span heights.
- No real screenshot/preview of the 3D scene. The floating panel is pure HTML — a short animated GIF or canvas capture would make the "preview" believable.
- The topbar nav links (`#capabilities`, `#platform`, `#stack`) are anchor jumps, but there's no smooth-scroll configured anywhere in CSS. Just add `html { scroll-behavior: smooth; }`.
- No responsive mobile hamburger menu — the `landing-nav` collapses to nothing on narrow viewports.

---

### ✅ Dashboard (`/dashboard`)
**Status:** The heaviest and most feature-complete page.  
**What's there:** Mission summary, 3D scene embed, health rails, time-domain chart, FFT bar chart, quantum lane readout, Leva controls, AI Explanation panel.  
**What's missing:**
- **Leva panel collides with ControlPanel** — both appear in the bottom-right area. There's no layout guidance preventing them from stacking on top of one another on 1080p screens.
- **AI Explanation** (`AIExplanation.jsx`) calls `POST /webhook/alias` but the backend clearly marks it as a stub. The frontend has no visible disclaimer to the user — it's silently returning rule-based strings while being labelled "AI Analysis".
- **No experiment history viewer.** The backend at `/api/quantum/experiments` stores every completed quantum job permanently in SQLite, but there's no frontend page or panel that lets you browse them.
- **No Bloch sphere visualisation.** `quantumState.bloch` X/Y/Z values are shown as plain text numbers in the dashboard. A 3D Bloch sphere (already using Three.js!) would be a natural and impactful addition here.
- **The 3D scene panel** uses `<Scene />` inside a dashboard card — meaning the Three.js canvas is a fixed-height embedded box, not the full immersive view. This is a design decision, but it means post-processing effects (Bloom etc.) are clipped to a small window, which reduces their wow factor.
- **No keyboard shortcuts** for common actions (submit job, toggle wave type, reset params).

---

### ✅ Signal Lab (`/signal-lab`)
**Status:** Very solid — controls, scenarios, health rails, 4 charts.  
**What's missing:**
- **Local state desync.** The `localFreq`, `localFs`, `localNoise`, `localWave` state is initialised once from the store but never re-synced if the user changes parameters from the Dashboard's ControlPanel. If you adjust the carrier on the Dashboard and then navigate here, the SignalLab sliders will show stale values.
- **No export/save button.** Users can observe good signals but can't download a CSV or PNG of the charts. Given the Recharts setup this is a 10-line `<a>` download link away.
- **Quick Scenarios only apply locally** — they call `sendParams` but don't write to the Zustand store's control params (`freq`, `fs` etc.). So the Dashboard header chips won't update until the backend echoes the values back.
- **No phase information chart.** The time-domain and FFT charts show amplitude and magnitude — but there's no phase spectrum view, which is important for understanding reconstruction quality.
- **FFT chart X-axis** uses exact `fft.sampled.freq` values which can be sparse. A continuous interpolated area chart would be more readable here.

---

### ✅ Quantum Lab (`/quantum-lab`)
**Status:** The `QuantumLabPage.jsx` itself is literally 4 lines — it just delegates to `QuantumWorkbench` (43 KB JSX).  
**What's good:** `QuantumWorkbench` is very comprehensive — circuit config, shot histograms, measurement state breakdown, classical comparison, expectation values.  
**What's missing:**
- **No Bloch sphere** animation driven by the live expectation values (Z₀, Z₁ … Z_n).
- **`QuantumHardwareEngine` is `NotImplementedError`** — the UI still exposes a `qiskit_hardware` backend option. Selecting it will fail. There should be a clear disabled/locked state in the backend selector with a tooltip: "IBM hardware: requires API token and `qiskit-ibm-runtime` install."
- **No circuit diagram visualisation.** The backend knows exactly what circuit was built (depth, gate count, type) — a simple ASCII or SVG schematic of the phase-estimation / QFT / sampling circuit would be an educational win.
- **No job history panel** — only the last job is visible. The store holds `quantumJobs` as a map, but the Workbench only shows the active job.
- **Shot histogram** from `ShotHistogram.jsx` exists but is it wired live? The Workbench appears to render it conditionally on `quantumMetrics.counts`. If no job has been submitted it shows nothing — no placeholder or empty-state illustration.

---

### ✅ Nyquist Explorer (`/nyquist`)
**Status:** Best standalone educational page. Entirely client-side, no backend dependency.  
**What's missing:**
- **The frequency spectrum** (`spectrumData`) uses a naïve ±1 Hz peak detection window, so at high frequencies the peaks can disappear or merge. Replace with a proper FFT of the sampled signal.
- **No smoothing demo.** The page shows raw sinc samples but never shows how sinc interpolation reconstructs the waveform — adding a third "Reconstruction" line (computed on the client) would close the educational loop directly.
- **No aliasing animation.** When you cross the Nyquist boundary the alias signal just appears. A brief animated transition where the ghost "folds" into view would make the theorem click for students.
- **The alias frequency formula caption** on line 194 is correct but hard to read inline. Consider a proper `<math>` or `KaTeX` block.
- **No shareable URL state.** If you set freq=12, sampleRate=15 and want to share it, you lose the state on reload. `useSearchParams` to persist freq/sampleRate/waveType in the URL is a small but very valuable educational feature.

---

### ✅ Status Page (`/status`)
**Status:** Solid observability page.  
**What's missing:**
- **`/health` is fetched as `/health`** (relative URL). In the browser context (served from nginx at port 3000) this hits `localhost:3000/health`, not `localhost:8000/health`. The `nginx.conf` likely proxies it, but if it doesn't this silently 404s.
- **No experiment count** from `/api/quantum/experiments` displayed here.
- **No WebSocket ping latency metric.** You have the connected boolean, but showing the WebSocket round-trip time would make this page genuinely useful for ops.
- **No historical uptime graph.** The health check fires every 30 s — could keep a rolling 10-minute buffer in local state and plot it as a sparkline.

---

## 3. Cross-cutting frontend gaps (missing everywhere)

| # | Gap | Severity |
|---|---|---|
| 1 | **No `ErrorBoundary`** wrapping any page. If Three.js throws (bad geometry, GPU issue) the whole SPA white-screens. | 🔴 High |
| 2 | **No loading skeleton / empty states** for charts — they just render nothing until WebSocket delivers data. | 🟡 Medium |
| 3 | **No dark-mode respects `prefers-color-scheme`** — the app is hard-coded dark. Fine for a demo but worth a note. | 🟢 Low |
| 4 | **`useAudio.js`** calls Tone.js but is it actually triggering any sound? Referenced in `WorkspaceShell` but no visible toggle. Audio APIs require user gesture — this may be silently failing on mount. | 🟡 Medium |
| 5 | **Mobile layout.** Sidebar + 3D scene + charts all break below ~900 px. No responsive breakpoints for mobile. | 🔴 High (for public demo) |
| 6 | **Accessibility.** Charts have no `aria-label`, keyboard navigation, or screen-reader text. Recharts supports `<desc>` elements. | 🟡 Medium |
| 7 | **`BootSequence` component** exists with a full CSS animation, but the router never shows it — it would fire on the `/dashboard` route if wired. Currently orphaned. | 🟡 Medium |
| 8 | **No global notification / toast system.** Quantum job failures set `quantumJobError` in the store but nothing surfaces them to the user unless they're in the Quantum Lab. | 🟡 Medium |
| 9 | **Leva panel** is rendered inside DashboardPage but controls in `ControlPanel.jsx` also accept `sendParams`. The two control surfaces need deduplication or clear ownership. | 🟡 Medium |
| 10 | **No URL persistence for signal params** — refreshing `/signal-lab` with freq=250 resets to defaults. | 🟢 Low |

---

## 4. Backend review

### ✅ Strengths
- Clean three-backend abstraction (`LocalClassical` / `QiskitSimulator` / `QiskitHardware`).
- Async job manager with polling pattern — correct design for quantum jobs.
- Signal engine is solid: genuine sinc interpolation, cached results, proper vectorised FFT.
- Experiment persistence to SQLite is a production-minded inclusion.
- CORS is correctly scoped to known origins.

### ⚠️ Gaps
| # | Gap | Severity |
|---|---|---|
| 1 | **n8n webhook is a stub** — backend explicitly says `is_stub = True` but frontend's `AIExplanation.jsx` shows the result as "AI Analysis." This is misleading. | 🟡 Medium |
| 2 | **`/api/quantum/submit` uses query params, not a request body** — large `signal_samples` payloads would overflow URL length limits. Should be `POST` with a JSON body. | 🟡 Medium |
| 3 | **No rate limiting.** The WebSocket send loop at 30 FPS × N clients will saturate a single uvicorn worker. Consider throttling or limiting concurrent connections. | 🟡 Medium |
| 4 | **`signal_engine.py` caches are in-memory and process-scoped.** Under Docker (single worker) this is fine, but if you scale to multiple workers the cache provides no benefit and results could be inconsistent. | 🟢 Low |
| 5 | **Qiskit Aer is optional** — the `QuantumSimulatorEngine` silently falls back to `LocalClassicalEngine` if `qiskit-aer` is not installed. The health endpoint should surface which engine is actually running. | 🟡 Medium |
| 6 | **No input validation on WebSocket stream** beyond range clamping — a malformed `wave_type` string beyond the 4 allowed values is silently ignored. Fine currently, but `pydantic` validation would be cleaner. | 🟢 Low |

---

## 5. Docker / Infrastructure — Can you use Alpine Linux for Docker nodes?

### Current setup
```
backend:  python:3.11-slim (Debian-based)
frontend: node:20-alpine → nginx:alpine  ✅ already using Alpine
n8n:      n8io/n8n:latest (Alpine internally)
```

### Question: Should the backend switch to Alpine?

**Short answer: Possible, but not recommended for this project. `python:3.11-slim` is the right choice.**

#### Why Alpine works for the frontend ✅
- The frontend only runs `npm ci` + `vite build`, then serves static files from nginx. No complex native dependencies.
- Alpine image is ~7 MB vs ~180 MB for Debian-slim — significant saving.
- `nginx:alpine` is already used — this is correct.

#### Why Alpine is risky for the Python backend ⚠️

| Concern | Detail |
|---|---|
| **musl libc vs glibc** | Alpine uses `musl` instead of GNU `libc`. NumPy, SciPy, and especially Qiskit-Aer ship pre-built wheels compiled against `glibc`. On Alpine these wheels are **incompatible** and pip falls back to building from source. |
| **SciPy build** | Building SciPy from source on Alpine requires `gfortran`, `openblas-dev`, `lapack-dev`. The build takes 5–15 minutes and the image becomes larger than `python:3.11-slim` after all dev tools are added. |
| **Qiskit-Aer** | Qiskit-Aer uses C++ extensions. Alpine builds of these routinely fail or produce undefined behaviour due to musl incompatibilities. IBM Quantum does not officially support Alpine. |
| **curl for healthcheck** | You already `apt-get install curl` in the Debian Dockerfile. On Alpine it's `apk add curl` — trivial change but remember it. |

#### What you *should* do for backend image optimization

```dockerfile
# Keep python:3.11-slim but add multi-stage build to reduce final image size
FROM python:3.11-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl build-essential && rm -rf /var/lib/apt/lists/*
COPY pyproject.toml .
RUN pip install --no-cache-dir --prefix=/install .

FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
COPY --from=builder /install /usr/local
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

This keeps glibc compatibility but separates the build tools from the final runtime image, reducing size by ~200-400 MB.

#### n8n — Alpine is fine ✅
`n8nio/n8n:latest` is already Alpine-based internally. You don't need to change anything there.

---

## 6. Prioritised improvements list

### 🔴 Must-fix (demo-breakers)
1. Add an `<ErrorBoundary>` around each lazy-loaded page route.
2. Fix local state desync between SignalLab sliders and the global store.
3. Label the AI Explanation as "Rule-based analysis (not LLM)" or wire n8n to an actual LLM.
4. Verify the `/health` proxy path is correctly configured in `nginx.conf`.
5. Disable/grey-out the `qiskit_hardware` backend selector with a clear "requires API token" message.

### 🟡 High-value additions
6. **Bloch sphere 3D widget** using Three.js sphere + axis lines — fits perfectly in Quantum Lab.
7. **Experiment history table** on Status page showing the last 10 SQLite records from `/api/quantum/experiments`.
8. **Nyquist page URL state** with `useSearchParams` so scenarios are shareable.
9. **Toast notification system** for quantum job errors surfacing from anywhere.
10. **BootSequence** — wire it to the workspace entry — one `useEffect` on first mount of `WorkspaceShell`.

### 🟢 Nice-to-have
11. Animate the landing hero trace bars.
12. Add smooth-scroll CSS to the landing page anchor links.
13. Export chart as PNG from Signal Lab (Recharts has a `toJSON` path; `canvas.toBlob` is sufficient).
14. WebSocket ping latency counter in Status page.
15. Phase spectrum chart alongside FFT magnitude in Signal Lab.
16. Mobile responsive layout (sidebar collapses to bottom tab bar below 768 px).

---

## 7. Overall score

| Dimension | Score | Notes |
|---|---|---|
| Architecture | 9/10 | Clean separation; WebSocket + REST + quantum job polling is the right model |
| Backend quality | 8/10 | Solid signal engine; quantum abstraction is well designed; stub AI is the main blemish |
| Frontend completeness | 6/10 | 4 of 5 pages are solid; QuantumLab is feature-rich; gaps are mostly polish and sync issues |
| DevOps / Docker | 7/10 | Compose is clean; Alpine is correctly used where safe; backend image can be optimised |
| Educational value | 8/10 | Nyquist explorer is excellent; circuit visualisation is the missing piece |
| Production-readiness | 5/10 | No mobile layout, no error boundaries, no auth, stub AI — needs another sprint |

**This is a strong V1.** The architecture is more sophisticated than most student projects — genuine WebSocket streaming, quantum job lifecycle, experiment persistence, and an Electron shell. The gaps are mostly in polish, sync correctness, and a few incomplete features (hardware backend, AI explanation, Bloch sphere). A focused 2-week sprint on items 1-10 above would bring this to a credible V2.
