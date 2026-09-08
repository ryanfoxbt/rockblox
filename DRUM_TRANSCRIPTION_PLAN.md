# Drum transcription — rebuild plan

Working doc. Goal: replace the hand-rolled TypeScript DSP in
`src/lib/transcribeDrums.ts` with a Python (librosa, maybe madmom) pipeline
that actually works, keeping the same output contract the rest of the app
already consumes.

---

## Where we are (end of session 2026‑09‑07)

Committed on `master`:

| Commit | What |
|---|---|
| `d911323` | SEO/GEO round 5 — `/ai-music` pillar page (unrelated) |
| `4140156` | `/test` gated behind sign-in |
| `a3e1316` | Fixed false 8/4 meter detection, fractional BPM, centroid fallback |
| `b1c90b8` | **htdemucs_ft**, dropped all non‑drum stem layering, dropped dead full‑song path, `/test` saves to user library not a public URL |
| `b9a2187` | Reverted the hi‑hat recall attempt (it made results worse) |
| `2aa4bec` | **`/test` "▶ vs song" A/B playback** — the feedback instrument |

Current transcription quality: still bad. The architecture already matches
the "right" approach (Demucs → band‑split onsets → tempo/quantize → centroid
classify) but every stage is a weak hand‑rolled version of a solved problem.
Repeated failure modes observed: autocorrelation tempo octave‑flips; the
single full‑spectrum onset detector misses hi‑hats entirely; one instrument
per onset means layered kick+hat / snare+hat get collapsed.

### Infra notes (already done, don't redo)

- `.env.local` has `INNGEST_DEV=1` appended — required for local Inngest
  (prod keys otherwise force cloud mode and 500 the analysis). Remove that
  line to point local at Inngest Cloud.
- Local run: `npm run dev` (lands on **:3002**, since :3000 is taken) +
  `npx inngest-cli@latest dev` + be signed in → `http://localhost:3002/test`.
  PowerShell needs `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`
  for `npx`.
- `mp3s-analysis/.cache/*.wav` = 21 Demucs **htdemucs_ft** drum stems
  (int16 WAV, 44.1 k). Re‑separating costs paid Replicate calls; the cache
  is the free iteration surface.
- `npm run analyze-songs` = existing TS eval harness (writes
  `mp3s-analysis/report.md` + per‑song clips). Keep it working as a
  before/after reference.

---

## The compare feature (done — use it for feedback)

In `/test`, once a slot is filled, **▶ vs song** plays the detected pattern
on a drum kit, on the whole‑song beat grid, over the original audio from the
clip's exact timestamp (2 passes, then stop). Separate drums‑only
`AudioContext`, a few ms of clock slop, existing Play/Preview buttons
untouched. `src/components/SongCropTool.tsx`, `COMPARE_LOOPS = 2`.

Use it to turn "it's bad" into precise notes: *kick dead‑on, snare a 16th
late, hats missing, tempo doubled* — that's what tunes the Python pipeline.

---

## Step 1 — local Python prototype (start here tomorrow)

### Setup

```bash
cd C:/Users/ryanf/RockBlox
python -m venv .venv                 # Python 3.10.2 is installed
.venv/Scripts/activate               # PowerShell: .venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r scripts/requirements-transcribe.txt
```

`scripts/requirements-transcribe.txt` already exists: numpy, scipy,
librosa, soundfile, pretty_midi. All pure wheels, no compiler.

Add to `.gitignore`: `/.venv`.

### File to create: `scripts/transcribe_drums.py`

Two entry points:

- `python scripts/transcribe_drums.py <drums.wav>` → prints the analysis
  JSON to stdout (quick single‑file check).
- `python scripts/transcribe_drums.py --batch` → runs every
  `mp3s-analysis/.cache/*.wav`, writes per song:
  - `mp3s-analysis/<slug>/py-onsets.json` — the analysis
  - `mp3s-analysis/<slug>/py-compare.wav` — original stem mixed with a
    sonified click per detected onset (kick/snare/hi‑hat at distinct
    click pitches) so accuracy is audible without the web app
  - `mp3s-analysis/<slug>/py-drums.mid` — GM drum MIDI (kick 36, snare 38,
    closed hat 42, open hat 46, low tom 45, mid tom 47) to drop into a DAW
    over the original
  - and a top‑level `mp3s-analysis/py-report.md` — bpm, beat count,
    per‑instrument onset counts, duration, per song.

### Output contract (must match — this is the integration boundary)

`analyzeSongForCropping` in `src/lib/transcribeDrums.ts` returns, and
`quantizeClipToLines` in `src/lib/quantizeClip.ts` consumes:

```jsonc
{
  "bpm": 92.34,              // float, unrounded — grid math needs precision
  "beatSeconds": 0.6498,     // 60 / bpm
  "gridOrigin": 0.121,       // seconds; phase of the beat grid
  "durationSeconds": 130.4,
  "onsets": [                // sorted by time; MULTIPLE allowed per instant
    { "time": 0.121, "instrument": "kick" },
    { "time": 0.121, "instrument": "hihatClosed" },
    { "time": 0.446, "instrument": "snare" }
  ]
}
```

`instrument` must be one of `InstrumentId` (`src/lib/instruments.ts`):
`kick`, `snare`, `hihatClosed`, `hihatOpen`, `ride`, `crash`, `lowTom`,
`midTom`, `highTom`, `rimshot`. Prototype target set: `kick`, `snare`,
`hihatClosed`, `hihatOpen`, `lowTom`, `midTom`. Everything downstream
(bar grouping, `quantizeClipToLines`) already handles a flat onset list —
no other changes needed there.

### Algorithm design

1. **Load** — `librosa.load(path, sr=44100, mono=True)`.

2. **Tempo + beat grid** — `librosa.beat.beat_track(y, sr, units='time',
   trim=False)`. This is a DP beat tracker; far better than the current
   autocorrelation but can still octave‑err on slow songs. Expose
   `--start-bpm` and `--bpm` override. `beatSeconds = 60/bpm`;
   `gridOrigin = beat_times[0] % beatSeconds`. Optional refinement: sweep
   phase over `[0, beatSeconds)` at 1/16 resolution, score by onset
   proximity to the 16th grid (same idea as the old `estimateGridPhase`,
   but fed by librosa onsets).

3. **Per‑band onset detection** — `scipy.signal.butter(..., output='sos')`
   + `sosfiltfilt`, then `librosa.onset.onset_strength` +
   `librosa.onset.onset_detect(backtrack=True, delta=..., wait=...,
   units='time')` per band. Keep the onset‑strength value at each hit
   (interp the envelope) for the collision rules below. **Every param
   (band edges, `delta`, `wait`) exposed as a module constant / CLI flag**
   for ear‑tuning.

   | band | filter | instrument |
   |---|---|---|
   | kick | bandpass 30–110 Hz | `kick` |
   | snare | bandpass 180–2800 Hz | `snare` |
   | hi‑hat | highpass 6500 Hz | `hihatClosed` / `hihatOpen` |
   | tom | bandpass 90–220 Hz | `lowTom` / `midTom` |

4. **Merge / disambiguate** (don't force one instrument per instant):
   - **Emit bands independently** — kick‑band hit at *t* → kick at *t*;
     hi‑hat‑band hit at *t* → hi‑hat at *t*, even if both fire. This is
     the main fix over the current code.
   - **Hi‑hat sanity** — require spectral centroid at the hit > ~3500 Hz
     (`librosa.feature.spectral_centroid`), else drop (kills snare‑buzz
     false hats).
   - **Kick shoulder** — a snare hit within ~25 ms of a much stronger kick
     (kick strength ≥ ~2× snare, snare below a floor) → drop; it's the
     kick's mid energy, not a real snare. Genuine kick+snare unison stays.
   - **Tom vs snare body** — a tom‑band hit with no strong snare‑band
     crack within ~25 ms → tom; otherwise drop (it's the snare's body).
     Split `lowTom`/`midTom` by tom‑band spectral centroid (~140 Hz).
   - **Open vs closed hat** — energy ratio 20 ms vs ~120 ms after the hit
     in the hi‑hat band; long ring → `hihatOpen`.

5. **Sort onsets by time, return the JSON.**

### Evaluate

- Ear: `py-compare.wav` per song, and `py-drums.mid` in a DAW over the
  original.
- Numbers: `py-report.md` vs `mp3s-analysis/report.md` (the TS baseline) —
  BPM sanity (no octave flips), hi‑hat counts non‑zero, plausible
  kick/snare density.
- Loop: tweak the exposed params, re‑run `--batch` (cache = free), re‑listen.

madmom (trained ADT CNN/RNN, `madmom.features.drums`) is the stronger
classifier and would likely beat the band‑split heuristic outright — but it
has real install friction (Cython, pinned old numpy, historically Python
≤3.11). Try it **only after** the librosa version is a clear improvement,
as a drop‑in alternative for steps 3–4. Structure the code so the
"onsets → instrument list" stage is swappable.

---

## Step 2 — deploy the Python

Prototype proven → move it server‑side. Two options:

- **Vercel Python function** (recommended for iteration speed). This stack
  supports Python well (3.13/3.14, 5 GB package limit fits librosa/madmom).
  New route, e.g. `api/transcribe/` (Python), that takes the drum‑stem
  bytes (or a blob URL) and returns the analysis JSON. The
  `analyzeSongCrop` Inngest function calls it right after
  `separateDrumStem`. Iterating = redeploy a function, no Replicate model
  push.
- **Bundle into one Replicate model** with Demucs — fewer round trips, one
  paid call instead of two, but every tweak is a Cog rebuild + push.

Keep Demucs itself on Replicate (GPU) either way.

---

## Step 3 — cut over

- `analyzeSongCrop` (`src/inngest/functions.ts`): after `separateDrumStem`,
  call the Python transcriber instead of `analyzeSongForCropping`. Store
  the same `songAnalyses` columns (`bpm`, `beatSeconds`, `gridOrigin`,
  `durationSeconds`, `onsets`).
- Optional: also rebuild the auto A–D path (`transcribeDrums` /
  `importSong` / `scripts/analyzeSongs.mts`) on the Python onsets — its
  bar‑grouping/clustering/fill logic can stay, just fed better onsets.
- Delete from `src/lib/transcribeDrums.ts`: `detectOnsets`,
  `computeSpectralFlux`/`pickFluxPeaks` (if still there),
  `estimateTempo`, `estimateGridPhase`, `estimateBeatsPerBar` internals,
  `extractOnsetFeatures`, `classifyOnset`, `classifyCymbal`, `broadBand`,
  the tom‑decay machinery, `refineOnsetTime`. **Keep**: WAV parsing only if
  still needed, `groupIntoBars`, the cluster/fill logic,
  `quantizeClipToLines` (untouched — pure onsets → pattern).
- `SongCropAnalysis` type stays the same shape.

---

## Open decisions for you

1. **madmom or not** — fight the install for the trained ADT model, or
   ship the librosa band‑split heuristic if it's good enough?
2. **Deploy target** — Vercel Python function (fast iteration) vs one
   fused Replicate model (fewer calls)?
3. **Scope** — just `/test` (`analyzeSongForCropping`), or also the auto
   A–D importer (`transcribeDrums`)?
4. **Cymbals** — prototype does closed/open hat + toms. Ride/crash/rimshot
   now, or later?
