# Model Lab (standalone) — Memory Placement Estimator

**한국어:** [README.ko.md](README.ko.md)

A single-page app that extracts **only the estimation logic** from the 4gbVramStrata
experiment lab. Pick an engine and a profile, and it shows where an MoE model's memory
would sit across **VRAM / DRAM / SSD tiers**.

> ⚠ **Estimates only.** This app never downloads or runs anything. Every number is a
> reference estimate computed from each engine's *published* size tables plus your chosen
> profile assumptions. It does not — and cannot — guarantee real-world behavior.

## Run it

Double-click `index.html`. No server, no build step, no internet required.
(Static hosting such as GitHub Pages works too — it is plain HTML/CSS/JS.)
The only network access happens when you *add an engine by URL*; that URL must allow CORS
(GitHub raw URLs do).

## The 4-step flow

Steps unlock in order — confirm one, and the next opens.

1. **Real hardware check** — shows OS · GPU name (WebGL) · estimated VRAM · RAM · cores.
   Browsers cannot read exact VRAM/RAM totals, so every field is **editable** (saved to this
   browser via `localStorage`).
   - If the GPU name matches a **unified-RAM family**, the app detects it and shows a green
     live status next to the memory-type selector (e.g. `Detected: unified RAM — GB10 (DGX Spark) family`).
     Detection covers GB10/DGX Spark · Apple Silicon (including bare names like `M4 Max`) ·
     Ryzen AI Max+/Strix Halo · Radeon M-series iGPUs · Intel UHD/Iris/Arc integrated ·
     Snapdragon X/Adreno. Discrete cards with model numbers (`Arc A770`, `RX 7600`, RTX…) stay
     discrete. In unified mode the VRAM input disappears — the RAM field *is* the whole pool.
   - **eGPU on unified hardware** (Thunderbolt dock etc.): enter the external card's name +
     VRAM and only the VRAM tier activates from that card; DRAM keeps using the shared pool.
   - **Virtual specs**: set OS · GPU name · memory type (auto/discrete/unified) · VRAM · RAM to
     experiment with *another* machine. A `virtual mode` badge appears in the header and all
     engine/model support checks follow the virtual spec. `Back to real specs` exits.
   - **Unified-RAM warning** appears instantly: one shared pool, stricter AI support than
     discrete cards; well-known families (GB10 · Apple Silicon · AI Max+) can be cross-checked
     against engines' published support lists, while anything else must be verified by *you*.

2. **Engine selection** — 12 built-in engines, grouped by whether they use tiered-memory MoE:
   - *Tiered-memory MoE engines* — Strata · PolyStrata · 4gbVramStrata · Project Maya · Basalt · Sync-Strata
   - *General-load engines* (no expert-tier streaming; totals/card-capacity estimates) —
     YASAKANI · TensorFold · Bonsai (PrismML) · Ollama · Unsloth (Studio·GGUF) · LM Studio

   Support badges (OS/GPU/VRAM) are predictions from each project's public docs, not guarantees.
   **Live catalog (Unsloth · LM Studio):** selecting the engine auto-loads its top 30 Hugging Face repos by
   downloads with real per-quant file sizes (GGUF files / MLX weight totals; capped at 12 quants per repo).
   Offline or on failure the built-in current-generation list is used instead; *Refresh* re-fetches and
   *Clear catalog* returns to it.
   **Search & add models:** on all three runtimes you can search Hugging Face for any GGUF/MLX repo, click through to
   its quant chips (real sizes) and add one — or type a model name + size manually. Added models persist in this
   browser; without an `AxxB` marker in the name they are estimated as dense (general loaders load whole models).
   *Ollama has no catalog button because ollama.com blocks browser access (CORS)* — its list is representative
   public-library values (~); use search/manual add for anything newer.
   Below the list you can **add your own engine by URL** — a single `fetch` of a JSON file is all
   it takes (see format below). Added engines get a **Refresh** button that re-fetches the same
   URL and updates the model list to whatever it says at that moment.

3. **Model + profile** — model and quant are two separate dropdowns (pick a name, then its quants with sizes); selecting one
   shows `model estimate: OS / VRAM / DRAM` badges. VRAM 4–32 · DRAM 8–128 · context 8K–1M
   profiles remain selectable even beyond your machine (with an "exceeds this computer" badge).
   On unified-RAM hardware the VRAM/DRAM pills become a single **unified RAM pool (8–192 GB)**.
   Extras: **resource presets** (use everything / leave 20% for daily work) and a ★ on the
   largest **recommended context** that fits without leakage, with a plain-language reason.

4. **Results — 3-tier placement** — each tier row shows capacity and utilization
   (`card total 8 GB (75% used)`), and the SSD row shows its share of the model file.

## The 3-tier model (and what "leak" means)

| Tier | Contents | Overflow behavior |
|---|---|---|
| **VRAM** | active experts + context (attention cache) + dense weights | spills to DRAM → PCIe re-reads mid-answer = **leak** |
| **DRAM** | inactive experts (always on standby) | re-read from SSD = **leak** |
| **SSD** | N-gram embeddings / lookup tables (by design) | this is their *home* — **not a leak** (purple) |

Models designed to live in DRAM (DeepSeek V4 Flash, GLM 5.3 Flash, Maya-family) or to keep SSD
tables (Strata/Hy4 Engram) render green/purple as designed; **red leak badges appear only when a
tier exceeds its own budget.** On unified-RAM hardware there is no PCIe boundary: both expert
tiers share one pool and only the amount beyond the pool counts as file re-reads.

## Calculation basis (same formulas as lab.py)

- Card reserve 256 MiB · dense weights · fixed overhead 512 MiB · attention cache
  (`row_bytes` × tokens) are subtracted first; what's left is the active-expert budget.
- Active experts = expert total × family `active_ratio` (published values, e.g. GLM-5.3-Flash
  ≈5.6%, Hy4 ≈5.5%, Qwen3.8 ≈6.4%; default 8% for undisclosed families).
- RAM budget = DRAM − OS keep 3,584 MiB − conversation cache (up to 8 GiB).
- N-gram tables are subtracted from the expert total up front and placed in the SSD tier.
  `~` marks approximate sizes.

## Engine JSON format (URL method)

```json
{
  "name": "My Engine",
  "url": "https://github.com/me/engine",
  "os": ["windows", "linux"],
  "gpus": ["nvidia", "amd"],
  "min_vram_gb": 8,
  "tiered": true,
  "models": [
    { "name": "MoE 35B-A3B", "quant": "Q4_K_M", "download_gb": 21.2,
      "row_bytes": 26624, "floor_gb": 4.0,
      "active_ratio": 0.09, "ngram_gb": 29, "min_vram_gb": 8 }
  ]
}
```

- `download_gb` is required (without it the model can't be estimated).
- Optional accuracy knobs: `row_bytes` (KV bytes/token), `floor_gb` (card usage before experts),
  `active_ratio`, `ngram_gb` (SSD-resident table), `dense: true` (no MoE tiers), per-model `min_vram_gb`.
- `"tiered": true` registers the engine in the *tiered-memory MoE* group (omit → general-load).
- Working sample: `engines/example-custom-engine.json`. Run `python -m http.server 8090` in this
  folder and paste `http://127.0.0.1:8090/engines/example-custom-engine.json` into the add box.

## 5-language UI

Header buttons switch the entire UI instantly: 한국어 · 日本語 · 繁體中文 · 简体中文 · English.
Model names, units (MiB/GB) and GPU names are preserved verbatim; the app always renders Korean
internally and translates at display time only (`i18n.js`, ~235 Korean source keys × 4 languages;
choice stored in `localStorage` under `labapp.lang`).

## Data sources (all public documentation, `~` = approximate)

- **4gbVramStrata**: the project's `setup.py` FAMILIES size table (exact)
- **Strata / PolyStrata**: README · docs/MODELS.md download/memory tables
- **Project Maya**: GLM/DeepSeek/MiniMax/Hy4 quant tables
- **Basalt**: docs/models·model-file.md (NVFP4 packs + Engram SSD tier)
- **YASAKANI**: README model table
- **Sync-Strata**: README (re-quantized Qwen3.8 sizes + shared components)
- **TensorFold**: docs/supported-models.md
- **Bonsai (PrismML)**: README (2B–9B sizes are estimates)
- **Ollama · Unsloth · LM Studio**: built-in lists use representative public library/catalog sizes (~approximate);
  the live catalog and search features read **real per-file sizes** from Hugging Face repos. General-load runtimes,
  so estimates are total/card-based rather than expert-tier placements

## Files

- `index.html` — 4-step flow, disclaimers (top banner + footer), unified-RAM warnings, language buttons
- `style.css` — dark theme, tier colors (VRAM green · RAM blue · SSD purple · leak red hatching)
- `i18n.js` — display-only translation layer (Korean source keys + 4 languages, MutationObserver)
- `app.js` — hardware check, virtual specs (unified-RAM detection/eGPU), engine support prediction,
  URL engine add/refresh, tiered placement prediction (ported from lab.py), presets, ★ context
- `engines/example-custom-engine.json` — URL-method sample
- `LICENSE` — MIT · `.gitignore`

## Disclaimer

This is a planning reference, not a verdict. Support badges and placements are predictions based
on public model cards and documentation; actual behavior depends on engine versions, drivers and
your exact system. Verify against each engine's own documentation before drawing conclusions.

## License

[MIT](LICENSE)
