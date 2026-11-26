// 모델 실험실 (standalone) — 엔진·프로필을 고르면 모델 메모리 배치를 예상해 주는 단일 페이지 앱.
// 아무것도 다운로드하거나 실행하지 않는다. 모든 수치는 공개 크기 표 + 프로필 가정에 따른 참고값이다.
//
// 계층 설계( MoE 메모리 3단 ) — 이 설계에서 "누수"는 어느 한 계층이 자기 자리를 넘칠 때만 말한다:
//   VRAM = 활성 전문가 + 콘텍스트(어텐션 캐시)      ← 넘어 DRAM으로 나가면 PCIe 재읽기 누수
//   DRAM = 비활성 전문가(항상 대기)                  ← 넘어 SSD 재읽기가 되면 누수
//   SSD  = N-gram 임베딩· 룩업 테이블                ← 설계대로 여기에 놓는 것(초록/보라)이며 누수가 아님
"use strict";

// ---------------------------------------------------------------- 예측 상수 (lab.py와 동일)
const RESERVE_FLOOR_MIB = 256;   // 엔진이 카드에 남기는 최소 예약
const OS_KEEP_MIB = 3584;        // DRAM 프로필 안에서 OS·기타 프로그램이 쓰는 양
const FIXED_VRAM_MIB = 512;      // CUDA 컨텍스트 등 고정 오버헤드(대략)
const VRAM_CHOICES = [4, 6, 8, 12, 16, 24, 32];
const DRAM_CHOICES = [8, 16, 24, 32, 48, 64, 128];
const UNIFIED_CHOICES = [8, 16, 24, 32, 48, 64, 96, 128, 192];   // 통합 RAM(공유 메모리) 하드웨어용 단일 풀
const CTX_CHOICES = [8192, 32768, 65536, 131072, 262144, 524288, 1048576];

// ---------------------------------------------------------------- 모델 패밀리
// row: 컨텍스트 1토큰의 어텐션 캐시 바이트 / floor: 전문가 전에 카드가 쓰는 GB(하한)
// ratio: MoE 활성 전문가 비율(활성/전체 파라미터, 공개 문서 기준) — VRAM 계층의 크기 결정
// ngram: 파일에 포함·동봉되는 N-gram 룩업 테이블 GB — 설계대로 SSD에 놓는 양(누수 아님)
// dense: MoE 계층 없음(전부 VRAM에 올리는 모델) — ratio/ngram 계층 없이 파일 전체가 카드 기준
const FAMS = {
  gemma4:    { row: 28672, floor: 3.6, ratio: 0.15 },   qwen36:  { row: 26624, floor: 4.2, ratio: 0.09 },
  inkling:   { row: 32768, floor: 3.8, ratio: 0.062 },  clover:  { row: 20480, floor: 3.9, ratio: 0.09 },
  lfm25:     { row: 20480, floor: 3.2, ratio: 0.083 },  flint:   { row: 28672, floor: 3.9, ratio: 0.062 },
  kolibri:   { row: 20480, floor: 4.1, ratio: 0.08 },   groot:   { row: 22528, floor: 3.4, ratio: 0.16 },
  ornith:    { row: 26624, floor: 3.9, ratio: 0.09 },   tiel:    { row: 26624, floor: 4.4, ratio: 0.09 },
  minicpmv:  { row: 26624, floor: 4.1, ratio: 0.09 },   deepseek:{ row: 6880,  floor: 32.0, ratio: 0.05, ngram: null },
  ornith122: { row: 26624, floor: 12.0, ratio: 0.07 },
  qwen38:    { row: null, floor: null, ratio: 0.064, ngram: 29 },   // 125B·활성 ~8B / 룩업 테이블 ~29 GB
  hy4:       { row: null, floor: null, ratio: 0.055, ngram: 67.6 }, // 220B-A12B / Engram 67.6(Strata)
  glm53:     { row: null, floor: null, ratio: 0.056 },              // GLM-5.3-Flash 321B/활성 18B
  qwen38d:   { row: null, floor: null, dense: true },               // Qwen3.8-27B(조밀) — MoE 계층 없음
  bonsai:    { row: 65536, floor: null, dense: true },              // Bonsai 27B: KV 64 KiB/토큰 공개
  qwen3a:    { row: null, floor: null, ratio: 0.1 },                // Qwen3 30B-A3B급 — 활성 약 10%
  gptoss:    { row: null, floor: null, ratio: 0.16 },               // gpt-oss-20b A3.6B/20B
  lladense:  { row: null, floor: null, dense: true },               // R1-Distill·Llama·Gemma3 등 조밀 모델
};

// sizes: [quant, download_gb(대략이면 ~), opt?(문자면 근사표시, 객체면 모델별 덮어쓰기)]; opts = 전 모델 공통 덮어쓰기
function modelsOf(fam, title, sizes, opts) {
  const f = FAMS[fam] || {};
  return sizes.map(([quant, gb, opt]) => ({
    name: title, quant, download_gb: gb,
    row_bytes: f.row == null ? null : f.row,
    floor_gb: f.floor == null ? null : f.floor,
    active_ratio: f.ratio == null ? null : f.ratio,
    ngram_gb: f.ngram == null ? null : f.ngram,
    dense_design: !!f.dense || undefined,
    approx: !!(gb && Math.abs(gb * 10 - Math.round(gb * 10)) > 1e-9) || opt === "approx",
    ...(opt && typeof opt === "object" ? opt : {}),
    ...(opts || {}),
  }));
}

// GPU 지원 태그: nvidia | nvidia-rtx3040 | nvidia-blackwell | amd | apple | cpu
// os: ["windows","linux","macos"] + note(지원 범위 해설)
// ---------------------------------------------------------------- 기본 내장 엔진 (공개 문서의 크기 표 + 지원 범위)
const BUILT_IN = [
  {
    id: "strata", name: "Strata", url: "https://github.com/niko1221/strata",
    desc: "계층화 메모리 MoE 엔진 — Qwen3.8-Flash-Next·Hy4-Flash를 포함해 지원 모델이 계속 늘고 있다. 크기는 README/MODELS.md 표의 대표값(~) 사용.",
    tiered: true,
    os: ["windows", "linux"], osNote: "Windows 11 · Linux (macOS 미지원)",
    gpus: ["nvidia-rtx3040", "nvidia-blackwell", "amd"], gpuNote: "NVIDIA RTX(12 GB+) · AMD 지원 카드", min_vram_gb: 12,
    models: [
      ...modelsOf("qwen38", "Qwen3.8-Flash-Next", [["Q2_0", 66], ["IQ2_XS", 70], ["IQ3_XXS", 74], ["IQ3_S", 78]]),
      ...modelsOf("qwen38", "Qwen3.8-Flash-Next (Unsloth)", [["UD-IQ4_XS", 94], ["UD-Q4_K_XL", 111], ["UD-Q5_K_XL", 158], ["UD-Q6_K_XL", 169], ["Q8_0", 188]]),
      ...modelsOf("qwen38", "Qwen3.8-Flash-Next (Gyro)", [["Gyro-S", 58.5], ["Gyro-M", 92.0]]),
      ...modelsOf("qwen38", "Qwen3.8-Flash-Next (NVFP4)", [["NVFP4", 128], ["NVFP4-QAD", 102]]),
      ...modelsOf("qwen36", "Qwen3.6-35B-A3B", [["UD-Q4_K_XL", 22.9], ["UD-Q6_K_XL", 32.6], ["Q8_0", 37.8]]),
      ...modelsOf("inkling", "Inkling 2 Mini", [["UD-Q2_K_XL", 9.1], ["UD-Q3_K_XL", 13.6], ["UD-Q4_K_XL", 17.6]]),
      // Hy4: 모델 파일 + SSD에 두고 읽는 Engram 샤드 67.6 GB 합계(설계상 SSD 계층)
      ...modelsOf("hy4", "Hy4-Flash (+Engram 67.6)", [["SQ-64", 129.6], ["SQ-96", 157.2], ["SQ-128", 181.3]]),
    ],
  },
  {
    id: "polystrata", name: "PolyStrata", url: "https://github.com/simplexai-labs/PolyStrata",
    desc: "Strata 기반 확장 — 자체 엔진의 13개 모델 + Strata 엔진(Qwen3.8/Hy4). GLM 크기는 범위 대표값(~). 8GB VRAM 카드에서 잘 가동된다.",
    tiered: true,
    os: ["windows", "linux"], osNote: "Windows · Linux (macOS 미지원)",
    gpus: ["nvidia-rtx3040", "nvidia-blackwell", "amd"], gpuNote: "NVIDIA RTX 중심 · AMD 일부", min_vram_gb: 8,
    models: [
      ...modelsOf("glm53", "GLM 5.3 Flash", [["UD-IQ2_XXS", 79], ["3.0BIT", 96], ["REAP50-Q3_K_M", 114]]),
      ...modelsOf("deepseek", "DeepSeek V4 Flash", [["UD-IQ2_XXS", 90.9]]),
      ...modelsOf("lfm25", "LFM2.5-24B-A2B", [["UD-Q3_K_XL", 10.9], ["QAD-Q4_0", 13.6], ["UD-Q4_K_XL", 14.9], ["UD-Q6_K_XL", 21.9], ["Q8_0", 25.5]]),
      ...modelsOf("flint", "Flint 40B-A2.5B", [["UD-Q3_K_XL", 18.5], ["UD-Q4_K_XL", 25.1], ["UD-Q6_K_XL", 36.3], ["Q8_0", 42.3]]),
      ...modelsOf("qwen36", "Qwen3.6-35B-A3B", [["UD-Q2_K_XL", 12.6], ["UD-Q3_K_M", 17.1], ["UD-Q4_K_M", 22.7]]),
      ...modelsOf("groot", "Groot 19B-A3B", [["Q4_K_M", 12.5], ["Q6_K", 16.8], ["Q8_0", 20.2]]),
      ...modelsOf("inkling", "Inkling 2 Mini", [["UD-Q2_K_XL", 9.1], ["UD-Q3_K_XL", 13.6], ["UD-Q4_K_XL", 17.6]]),
      ...modelsOf("clover", "Clover-35B-A3B", [["APEX-I-NANOPLUS", 12.6], ["Q3_K_M", 16.8], ["Q4_K_M", 21.2]]),
      ...modelsOf("ornith", "Ornith 1.5 35B-A3B", [["APEX-I-MINI", 14.4], ["APEX-I-COMPACT", 17.4], ["APEX-I-QUALITY", 23.7]]),
      ...modelsOf("gemma4", "Gemma 4 26B-A4B", [["UD-Q2_K_XL", 11.0], ["UD-Q3_K_M", 13.2], ["QAT-UD-Q4_K_XL", 14.7], ["UD-Q4_K_M", 17.4]]),
      ...modelsOf("tiel", "Tiel Coder 35B-A3B", [["UD-IQ3_XXS", 13.6], ["UD-Q3_K_XL", 17.2], ["UD-Q4_K_XL", 22.7]]),
      ...modelsOf("minicpmv", "MiniCPM-V 4.7", [["mix_q3gud_im", 15.5], ["Q4_K_M", 21.2], ["Q6_K", 28.5]]),
      ...modelsOf("kolibri", "Kolibri 1", [["Q2_K", 28.6], ["Q3_K_M", 37.5], ["Q4_K_M", 47.5]]),
      ...modelsOf("qwen38", "Qwen3.8-Flash-Next (Strata 엔진)", [["Q2_0", 66], ["IQ2_XS", 70], ["IQ3_S", 78]]),
      ...modelsOf("hy4", "Hy4-Flash (+Engram, Strata 엔진)", [["SQ-64", 129.6], ["SQ-96", 157.2], ["SQ-128", 181.3]]),
    ],
  },
  {
    id: "fourgbvram", name: "4gbVramStrata", url: "https://github.com/RandoTeam/4gbVramStrata",
    desc: "4~6 GB VRAM을 겨냥한 포크 엔진 — 4gbVramStrata 실험실과 같은 setup.py 크기 표(정확한 값) 사용.",
    tiered: true,
    os: ["windows", "linux"], osNote: "Windows · Linux (macOS 미지원)",
    gpus: ["nvidia-rtx3040", "nvidia-blackwell", "amd"], gpuNote: "작은 NVIDIA 카드용(4 GB부터) · AMD 일부", min_vram_gb: 4,
    models: [
      ...modelsOf("gemma4", "Gemma 4 26B-A4B", [["UD-Q2_K_XL", 11.0], ["UD-Q3_K_M", 13.2], ["QAT-UD-Q4_K_XL", 14.7], ["UD-Q4_K_M", 17.4]]),
      ...modelsOf("qwen36", "Qwen3.6-35B-A3B", [["UD-Q2_K_XL", 12.6], ["UD-Q3_K_M", 17.1], ["UD-Q4_K_M", 22.7]]),
      ...modelsOf("inkling", "Inkling 2 Mini", [["UD-Q2_K_XL", 9.1], ["UD-Q3_K_XL", 13.6], ["UD-Q4_K_XL", 17.6]]),
      ...modelsOf("clover", "Clover-35B-A3B", [["APEX-I-NANOPLUS", 12.6], ["Q3_K_M", 16.8], ["Q4_K_M", 21.2]]),
      ...modelsOf("lfm25", "LFM2.5-24B-A2B", [["UD-Q3_K_XL", 10.9], ["QAD-Q4_0", 13.6], ["UD-Q4_K_XL", 14.9], ["UD-Q6_K_XL", 21.9], ["Q8_0", 25.5]]),
      ...modelsOf("flint", "Flint 40B-A2.5B", [["UD-Q3_K_XL", 18.5], ["UD-Q4_K_XL", 25.1], ["UD-Q6_K_XL", 36.3], ["Q8_0", 42.3]]),
      ...modelsOf("ornith", "Ornith 1.5 35B-A3B", [["APEX-I-MINI", 14.4], ["APEX-I-COMPACT", 17.4], ["APEX-I-QUALITY", 23.7]]),
      ...modelsOf("tiel", "Tiel Coder 35B-A3B", [["UD-IQ3_XXS", 13.6], ["UD-Q3_K_XL", 17.2], ["UD-Q4_K_XL", 22.7]]),
      ...modelsOf("minicpmv", "MiniCPM-V 4.7", [["mix_q3gud_im", 15.5], ["Q4_K_M", 21.2], ["Q6_K", 28.5]]),
      ...modelsOf("kolibri", "Kolibri 1", [["Q2_K", 28.6], ["Q3_K_M", 37.5], ["Q4_K_M", 47.5]]),
      ...modelsOf("groot", "Groot 19B-A3B", [["Q4_K_M", 12.5], ["Q6_K", 16.8], ["Q8_0", 20.2]]),
      ...modelsOf("ornith122", "Ornith 1.5 122B", [["UD-Q2_K_XL", 44.5], ["UD-IQ3_XXS", 49.5], ["UD-Q3_K_XL", 59.8], ["UD-Q4_K_XL", 79.7], ["Q8_0", 132.6]]),
      ...modelsOf("deepseek", "DeepSeek V4 Flash", [["UD-IQ2_XXS", 90.9]]),
    ],
  },
  {
    id: "maya", name: "Project Maya", url: "https://github.com/mw00/project-maya",
    desc: "초대형 MoE 전용 — 전문가 대부분을 RAM에 고정(VRAM은 활성분만). 크기는 공개 표(Maya quant).",
    tiered: true,
    os: ["windows", "linux"], osNote: "Windows · Linux (macOS 미지원) · RAM 32 GB+",
    gpus: ["nvidia", "amd"], gpuNote: "NVIDIA V100+/RTX 20 이상 · AMD 선택 카드", min_vram_gb: 8, ram_min_gb: 32,
    models: [
      ...modelsOf("glm53", "GLM-5.3-Flash (Maya)", [["Maya-S", 96.5], ["S24", 94.7], ["XS", 73.4], ["M", 116], ["L", 156.3]]),
      ...modelsOf("glm53", "GLM-5.3 (Maya)", [["XS", 170.0], ["UD-IQ2_M", 238.6]]),
      // DeepSeek V4.1: Engram 테이블 포함 크기
      ...modelsOf("deepseek", "DeepSeek-V4.1 (Maya, Engram 포함)", [["Maya-S", 340], ["XS-v2", 277]]),
      ...modelsOf("glm53", "MiniMax-M3.1-Flash (Maya)", [["XS", 93], ["S", 122]], ),
      // Hy4: 각 quant + SSD에 두는 n-gram 63.4 GB 별도
      ...modelsOf("hy4", "Hy4-Flash (Maya, +n-gram 63.4)", [["XS", 44.8], ["S", 53.0], ["M", 68.4], ["L", 89.5]], { }),
      ...modelsOf("inkling", "Inkling UD-Q4_K_XL (Maya)", [["UD-Q4_K_XL", 17.6]]),
    ],
  },
  {
    id: "basalt", name: "Basalt", url: "https://github.com/jesdga95/basalt",
    desc: "Blackwell(sm_120/GB10) 전용 CUDA 엔진 — NVFP4 팩 + Engram(SSD 계층). 크기는 공개된 팩만 표기, 나머지는 미공개.",
    tiered: true,
    os: ["windows", "linux"], osNote: "Linux x64 · Windows 10 1903+ (macOS 미지원) · CUDA 13",
    gpus: ["nvidia-blackwell"], gpuNote: "Blackwell(sm_120) / GB10 전용 — RTX 20~40에서는 동작하지 않음", min_vram_gb: 8,
    models: [
      ...modelsOf("qwen38", "Qwen3.8-FN-NVFP4-DQ6_K", [["NVFP4-DQ6_K", 122], ["NVFP4-QAD", "approx-102"]]),
      ...modelsOf("deepseek", "DeepSeek-V4.1-Flash-1017", [["UD-IQ1_M", "approx"], ["NVFP4", "approx"]]),
      ...modelsOf("qwen38d", "Qwen3.8-27B QUASAR-NVFP4", [["QUASAR-NVFP4", 19.7], ["NVIDIA-NVFP4", 22]]),
      // Hy4 NVFP4 팩 158.7 GB = 전문가 83.58 + Engram 63.36(설계상 SSD) + 밀집 등
      ...modelsOf("hy4", "Hy4-flash-NVFP4 (+Engram 63.4)", [["NVFP4", 158.7]], { ngram_gb: 63.4 }),
      ...modelsOf("inkling", "Inkling-2-Mini", [["NVFP4-MX8", 19.6], ["NVFP4-DQ8", 19.7]]),
    ],
  },
  {
    id: "yasakani", name: "YASAKANI", url: "https://github.com/yasakani-dev/yasakani",
    desc: "Windows + NVIDIA 단일 카드 전용(Qwen3.8-27B·Inkling 2 Mini). 계층 없음 — 전부 VRAM에 올리는 설계.",
    os: ["windows"], osNote: "64-bit Windows 11 전용 (Linux는 소스 빌드, macOS 미지원)",
    gpus: ["nvidia"], gpuNote: "NVIDIA RTX (RTX 5090 검증, 30/40/50 시리즈) — AMD·Intel 미지원", min_vram_gb: 16,
    models: [
      ...modelsOf("qwen38d", "Qwen3.8-27B (YASAKANI)", [["fastest", 10.31], ["quality", 12.37], ["max-quality", 15.72, { min_vram_gb: 24 }]]),
      ...modelsOf("inkling", "Inkling-2 Mini (YASAKANI)", [["quality(변환)", 15.9, { min_vram_gb: 24 }], ["published", 19.5, { min_vram_gb: 24 }]]),
    ],
  },
  {
    id: "syncstrata", name: "Sync-Strata", url: "https://github.com/hiruhiru2005/sync-strata",
    desc: "Strata 포크 — Qwen3.8-Flash-Next 재양자화(Sync-XS/S/M). 모델 + 공용 부품 약 35 GB.",
    tiered: true,
    os: ["windows", "linux"], osNote: "Windows 11/10(1803+) · 64-bit Linux (macOS 미지원)",
    gpus: ["nvidia-rtx3040", "nvidia-blackwell", "amd"], gpuNote: "RTX 30/40 검증 — RTX 20/50·GTX 10·AMD(HIP)는 실험, Intel 미지원, VRAM 8 GB+",
    min_vram_gb: 8,
    models: [
      ...modelsOf("qwen38", "Qwen3.8-Flash-Next (Sync)", [["Sync-XS", 24], ["Sync-S", 28], ["Sync-M", 35]]),
    ],
  },
  {
    id: "tensorfold", name: "TensorFold", url: "https://github.com/ashhart/TensorFold",
    desc: "Zig 엔진 — Apple Silicon(Metal)·NVIDIA CUDA. 큰 모델은 듀얼 GB10/M5 Ultra 요구(공개 범위 그대로).",
    os: ["windows", "linux", "macos"], osNote: "macOS(Apple Silicon) · Linux x64/arm64 · Windows (CUDA 13, 드라이버 R580+)",
    gpus: ["nvidia", "apple"], gpuNote: "Apple Silicon Metal · NVIDIA CUDA(sm_80/86/120/121) — AMD 미지원", min_vram_gb: 4,
    models: [
      ...modelsOf("qwen36", "Qwen3.6-35B-A3B (TensorFold)", [["MLX-MTP", 20.9], ["NVFP4", 20.3]]),
      ...modelsOf("qwen38d", "Qwen3.5-2B MLX 4bit", [["MLX-4bit", 1.1]]),
      ...modelsOf("qwen38d", "Qwen3.8-27B MLX 4bit", [["MLX-4bit", 16]]),
      ...modelsOf("lfm25", "LFM2.5-24B-A2B (TensorFold)", [["MLX-4bit", 13.5], ["MLX-6bit", 20], ["MLX-8bit", 27]]),
      ...modelsOf("glm53", "Nemotron 3.5 Lightning 30B-A3B", [["MLX-4bit", 17]], { min_vram_gb: 12 }),
      ...modelsOf("glm53", "Nemotron 3.5 Bolt 74B-A9B", [["24GB", 24]], { min_vram_gb: 24 }),
      // Flash Next MLX: 4-bit은 GB10(대형 카드), 6-bit은 M5 Ultra 급
      ...modelsOf("qwen38", "Qwen3.8-Flash-Next (MLX)", [["MLX-4bit-MTP", 105.5], ["MLX-6bit-MTP", 150]]),
      // GLM-5.3 계열은 듀얼 머신 요구가 공개 범위 — 카드 한 장 예상에는 맞지 않음
      ...modelsOf("glm53", "GLM-5.3 (TensorFold, 2-machine)", [["NVFP4/FP4-Local/XSFP4", 165.3], ["EXLR8 home", 320]], { dual: true }),
      ...modelsOf("glm53", "Nemotron Super VL 120B-A12B NVFP4", [["NVFP4", 73.2]]),
      ...modelsOf("glm53", "MiniMax-M3.1-Flash (MLX mix)", [["mix34", 203.7], ["mix256k", 189.2]], { dual: true }),
    ],
  },
  {
    id: "bonsai", name: "Bonsai (PrismML)", url: "https://github.com/PrismML-Eng/Bonsai-demo",
    desc: "삼진법(ternary) 초저비트 모델 — Mac Metal · CUDA · Vulkan · ROCm · CPU. 27B가 6~8 GB.",
    os: ["windows", "linux", "macos"], osNote: "macOS · Linux · Windows (CPU 전용 실행 가능)",
    gpus: ["nvidia", "amd", "apple", "cpu"], gpuNote: "Metal · CUDA · Vulkan · ROCm · CPU — 자동 선택", min_vram_gb: 0,
    models: [
      ...modelsOf("bonsai", "Bonsai 2.5 27B", [["PQ2_0", 7.6], ["PTQ1_0", 6.4]]),
      ...modelsOf("bonsai", "Bonsai 2 27B", [["PQ2_0", 7.5]]),
      ...modelsOf("bonsai", "Bonsai 2 9B", [["PQ2_0(추정)", 2.6]]),
      ...modelsOf("bonsai", "Bonsai 2 4B", [["PQ2_0(추정)", 1.2]]),
      ...modelsOf("bonsai", "Bonsai 2 2B", [["PQ2_0(추정)", 0.7]]),
    ],
  },
  {
    id: "ollama", name: "Ollama", url: "https://ollama.com",
    desc: "범용 GGUF 런타임(llama.cpp 기반) — 계층화 메모리 MoE 없음, 모델은 통째 로드·레이어 분할. ollama.com이 브라우저 카탈로그 접근(CORS)을 막아 목록은 공개 라이브러리 대표값(~)이며, '모델 검색·추가'로 Hugging Face에서 찾아 담거나 직접 입력할 수 있다.",
    os: ["windows", "linux", "macos"], osNote: "Windows · Linux · macOS(Apple Silicon)",
    gpus: ["nvidia", "amd", "apple", "cpu"], gpuNote: "CUDA · ROCm · Metal — 자동 감지", min_vram_gb: 0,
    models: [
      ...modelsOf("qwen38", "Qwen3.8-Flash-Next (ollama)", [["Q2_K", 70], ["q3_K_M", 90], ["q4_K_M", 110]], { approx: true }),
      ...modelsOf("qwen38d", "Qwen3.8-27B (ollama)", [["IQ4_XS", 15.4], ["q4_K_M", 16.1], ["q8_0", 29]], { approx: true }),
      ...modelsOf("glm53", "GLM 5.3 Flash (ollama)", [["IQ2_XXS", 79], ["q3_K_M", 118]], { approx: true }),
      ...modelsOf("deepseek", "DeepSeek V4 Flash (ollama)", [["iq2_XXS", 91]], { approx: true }),
      ...modelsOf("gemma4", "Gemma 4 26B-A4B (ollama)", [["q4_K_M", 17.4], ["q8_0", 28]], { approx: true }),
      ...modelsOf("qwen36", "Qwen3.6-35B-A3B (ollama)", [["q4_K_M", 22]], { approx: true }),
      ...modelsOf("inkling", "Inkling 2 Mini (ollama)", [["q4_K_M", 17.6]], { approx: true }),
      ...modelsOf("qwen3a", "Qwen3 30B-A3B (ollama)", [["q4_K_M", 18.6], ["q2_K", 12.2]]),
      ...modelsOf("qwen3a", "Qwen3 235B-A22B (ollama)", [["q4_K_M", 148, { approx: true }]]),
      ...modelsOf("gptoss", "gpt-oss 20b (ollama)", [["MXFP4", 16, { approx: true }]]),
      ...modelsOf("gptoss", "gpt-oss 120b (ollama)", [["MXFP4", 63, { approx: true, active_ratio: 0.045 }]]),
    ],
  },
  {
    id: "unsloth", name: "Unsloth (Studio·GGUF)", url: "https://unsloth.ai",
    desc: "Unsloth Studio + 동적 양자화 GGUF(llama.cpp 기반) — 계층화 메모리 MoE 없음. 엔진을 고르면 Hugging Face 최신 카탈로그(다운로드순 상위 30개 저장소, quant별 실파일 크기)가 자동으로 로드되고, 오프라인이면 기본 목록을 씁니다.",
    os: ["windows", "linux"], osNote: "Windows · Linux (macOS는 제한적)",
    gpus: ["nvidia", "amd", "apple", "cpu"], gpuNote: "CUDA · ROCm · Metal — llama.cpp 지원 범위", min_vram_gb: 0,
    models: [
      ...modelsOf("qwen38", "Qwen3.8-Flash-Next (Unsloth)", [["UD-IQ4_XS", 94], ["UD-Q4_K_XL", 111], ["Q8_0", 188]]),
      ...modelsOf("qwen38d", "Qwen3.8-27B (Unsloth)", [["UD-IQ1_M", 6.7], ["Q4_0", 16.1], ["UD-Q4_K_XL", 17, { approx: true }], ["Q8_0", 29]]),
      ...modelsOf("glm53", "GLM-5.3-Flash (Unsloth)", [["UD-IQ2_XXS", 79], ["REAP50-Q3_K_M", 114]], { approx: true }),
      ...modelsOf("deepseek", "DeepSeek V4 Flash (Unsloth)", [["UD-IQ2_XXS", 90.9]]),
      ...modelsOf("gemma4", "Gemma 4 26B-A4B (Unsloth)", [["UD-Q3_K_M", 13.2], ["UD-Q4_K_M", 17.4]]),
      ...modelsOf("qwen36", "Qwen3.6-35B-A3B (Unsloth)", [["UD-Q4_K_XL", 22.9], ["Q8_0", 37.8]]),
      ...modelsOf("inkling", "Inkling 2 Mini (Unsloth)", [["UD-Q3_K_XL", 13.6], ["UD-Q4_K_XL", 17.6]]),
      ...modelsOf("qwen3a", "Qwen3-235B-A22B (Unsloth)", [["UD-IQ2_XXS", 76.6]]),
      ...modelsOf("gptoss", "gpt-oss-120b (Unsloth)", [["MXFP4", 61, { approx: true, active_ratio: 0.045 }]]),
    ],
  },
  {
    id: "lmstudio", name: "LM Studio", url: "https://lmstudio.ai",
    desc: "GGUF·MLX 데스크톱 GUI(llama.cpp 기반) — 계층화 메모리 MoE 없음, 레이어 분할은 수동. 엔진을 고르면 Hugging Face(lmstudio-community) 최신 GGUF·MLX 카탈로그가 자동으로 로드되고, 오프라인이면 기본 목록을 씁니다.",
    os: ["windows", "linux", "macos"], osNote: "Windows · Linux · macOS(Apple Silicon, MLX)",
    gpus: ["nvidia", "amd", "apple", "cpu"], gpuNote: "CUDA · Vulkan · Metal(MLX) — 앱 내 자동 감지", min_vram_gb: 0,
    models: [
      ...modelsOf("qwen38d", "Qwen3.8-27B (LM Studio)", [["MLX-4bit", 15.4], ["MLX-8bit", 29]], { approx: true }),
      ...modelsOf("qwen38", "Qwen3.8-Flash-Next (LM Studio)", [["MLX-4bit", 72], ["IQ4_XS", 74]], { approx: true }),
      ...modelsOf("glm53", "GLM 5.3 Flash (LM Studio)", [["IQ2_XXS", 79]], { approx: true }),
      ...modelsOf("deepseek", "DeepSeek V4 Flash (LM Studio)", [["iq2_XXS", 91]], { approx: true }),
      ...modelsOf("gemma4", "Gemma 4 26B-A4B (LM Studio)", [["MLX-4bit", 15], ["q4_K_M", 17.4]], { approx: true }),
      ...modelsOf("gptoss", "gpt-oss-120b (LM Studio)", [["MLX-4bit", 62, { active_ratio: 0.045 }]], { approx: true }),
      ...modelsOf("qwen3a", "Qwen3-235B-A22B (LM Studio)", [["MLX-4bit", 128]], { approx: true }),
    ],
  },
];

// ---------------------------------------------------------------- 상태·저장
const store = {
  get(k, dflt) { try { const v = localStorage.getItem("labapp." + k); return v == null ? dflt : JSON.parse(v); } catch (e) { return dflt; } },
  set(k, v) { try { localStorage.setItem("labapp." + k, JSON.stringify(v)); } catch (e) {} },
};
const S = {
  engine: store.get("engine", "fourgbvram"),
  modelSel: store.get("modelSel", null),               // {name, quant} — 모델·양자화 분리 선택
  vram: store.get("vram", null), dram: store.get("dram", 32), ctx: store.get("ctx", 32768),
  uram: store.get("uram", null),                     // 통합 RAM 프로필(GB) — 통합 하드웨어일 때만 사용
  custom: store.get("customEngines", []),            // [{id,name,url,desc,models[],src}]
  catalog: store.get("catalog", {}),                 // 엔진 id → {ts, replace, models[]} — HF 카탈로그/검색/직접 추가 결과
  hw: store.get("hw", { vram: null, ram: null }),    // 사용자가 확인·수정한 실측 값
  hwConfirmed: store.get("hwConfirmed", false),      // 3-1 확인 버튼
  virt: store.get("virt", { on: false, os: "windows", gpu: "", vram: 24, ram: 64, unified: false }),  // 가상 스펙
};

// ---------------------------------------------------------------- 물리 장비 확인 (OS · GPU · RAM)
const VRAM_GUESS = [
  [/RTX 50(90|80)/i, 32], [/RTX 4090|4090 D/i, 24], [/RTX 4080 SUPER/i, 16], [/RTX 4080/i, 16],
  [/RTX 5070 Ti/i, 16], [/RTX (5070|4070 Ti SUPER|4070 Ti)/i, 12], [/RTX (3090 Ti|3090)/i, 24],
  [/RTX 30(70|80)/i, 8], [/RTX 3060 Ti/i, 8], [/RTX 3060/i, 12], [/RTX 20(70|80)/i, 8],
  [/GTX 1(0[5-9]0|6[05])0?/i, 6], [/RX 7900 XTX/i, 24], [/RX 7900 GT/i, 20],
  [/RX 7(800|700) ?XT ?S?BED?/i, 16], [/RX 7600/i, 8], [/RX 90(60|70)/i, 16],
  [/Arc B580/i, 12], [/Arc A7(50|70)/i, 8],
];
function detectHardware() {
  const out = { gpu: null, vramGuess: null, cores: navigator.hardwareConcurrency || null,
                ramGB: navigator.deviceMemory || null,
                platform: (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || "?" };
  try {
    const gl = document.createElement("canvas").getContext("webgl2") || document.createElement("canvas").getContext("webgl");
    if (gl) {
      const dbg = gl.getExtension("WEBGL_debug_renderer_info");
      out.gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    }
  } catch (e) {}
  for (const [re, gb] of VRAM_GUESS) if (out.gpu && re.test(out.gpu)) { out.vramGuess = gb; break; }
  return out;
}
const HW = detectHardware();
// 첫 실행의 기본 VRAM 프로필: 감지한 카드에 가장 가까운(넘지 않는) 선택지, 없으면 8 GB
if (S.vram == null) S.vram = VRAM_CHOICES.slice().reverse().find((x) => x <= (HW.vramGuess || 8)) || 8;

const OS_NAME = { windows: "Windows", linux: "Linux", macos: "macOS", other: "기타" };
function detectedOs() {
  const p = String(HW.platform).toLowerCase();
  if (/win/.test(p)) return "windows";
  if (/linux|ubuntu|debian|fedora/.test(p)) return "linux";
  if (/mac/.test(p)) return "macos";
  return "other";
}
// 현재 기준 하드웨어(3-1): 가상 스펙이 켜지면 가상 값, 아니면 확인값/수정값
function curOs() { return S.virt.on ? S.virt.os : detectedOs(); }
function curGpuName() { return S.virt.on ? (S.virt.gpu || "가상 GPU") : (HW.gpu || "확인 불가"); }
// 통합 RAM + 외부 카드 구성에서는 "카드" = 외부 그래픽카드, "호스트 RAM" = 통합 RAM 풀
function curVram() { if (curExternal()) return curEgpu().vram; return S.virt.on ? Number(S.virt.vram) || 8 : (Number(S.hw.vram) > 0 ? Number(S.hw.vram) : HW.vramGuess); }
function curRam() { if (curUnifiedAny()) return curUnifiedGb(); return S.virt.on ? Number(S.virt.ram) || 16 : (Number(S.hw.ram) > 0 ? Number(S.hw.ram) : (navigator.deviceMemory || null)); }

// GPU 이름 → 지원 태그 판정 (RTX 50 = Blackwell, RTX 30/40 = rtx3040, 그 외 NVIDIA = nvidia)
function gpuTag(name) {
  const n = String(name || "");
  if (/Apple M\d/i.test(n)) return "apple";
  if (/blackwell|B200|B300|GB10/i.test(n)) return "nvidia-blackwell";
  if (/RTX\s*5\d{3}/i.test(n)) return "nvidia-blackwell";
  if (/RTX\s*[34]\d{3}/i.test(n)) return "nvidia-rtx3040";
  if (/NVIDIA|GeForce|RTX|GTX|Tesla/i.test(n)) return "nvidia";
  if (/Radeon|AMD.*GPU|RX ?\d/i.test(n)) return "amd";
  if (/Arc|Intel/i.test(n)) return "intel";
  return "unknown";
}
function isBlackwellName(name) { const t = gpuTag(name); return t === "nvidia-blackwell"; }

// ---------------------------------------------------------------- 통합 RAM(공유 메모리) 하드웨어
// GPU 이름 → 통합 RAM 계열 (없으면 null = 분리형 추정)
// GB10(DGX Spark) · Apple Silicon · Ryzen AI Max+(Strix Halo)는 알려진 계열,
// 그 밖의 내장 그래픽(라데온 680M/780M/860M·Intel UHD/Iris/Arc 내장·Snapdragon X 등)은 "other" — 지원 여부는 사용자가 직접 확인해야 함.
function unifiedFamily(name) {
  const n = String(name || "");
  if (/GB10|DGX Spark/i.test(n)) return "gb10";
  if (/Apple M\d|Apple Silicon|\bM\d\s?(Pro|Max|Ultra)\b/i.test(n)) return "apple";   // "M4 Max"처럼 Apple 생략도 인식
  if (/AI ?Max\+?|Ryzen AI Max|Strix Halo|Radeon 80[0-9]0S/i.test(n)) return "aimax";
  if (/Snapdragon X|Adreno/i.test(n)) return "other";                                  // ARM 미니 PC·랩톱 — 통합 RAM
  if (/Radeon\s*(Pro\s)?[678]\d{2}M|\b[678][4-9]0M\b|Vega\s(Graphics|[5-9]\d{2})C?/i.test(n)) return "other"; // AMD 내장 그래픽
  if (/Intel.*(UHD|Iris)|Arc(\([^)]*\))?\s*Graphics/i.test(n)) return "other";         // Intel 내장 — "Arc A750/B580" 등 번호가 붙는 이산 카드는 제외
  return null;
}
// 가상 스펙 패널의 실시간 감지 결과 문구 (드롭다운이 실제로 무엇을 봤는지 보여준다)
function memDetectText(fam) {
  if (fam === "gb10") return "감지됨: 통합 RAM — GB10(DGX Spark) 계열";
  if (fam === "apple") return "감지됨: 통합 RAM — Apple Silicon 계열";
  if (fam === "aimax") return "감지됨: 통합 RAM — AMD AI Max+(Strix Halo) 계열";
  if (fam === "other") return "감지됨: 내장 그래픽 추정 — 지원 여부는 본인이 확인하세요";
  return "GPU 이름에서 감지된 계열 없음 — 자동이면 분리형(VRAM/RAM)으로 취급";
}
// 통합 RAM 하드웨어 여부 (외부 카드 지정 여부와 무관하게 메모리 유형만 본다)
function curUnifiedAny() {
  if (S.virt.on) {
    const mem = S.virt.mem || (S.virt.unified ? "unified" : "auto");
    if (mem === "split") return false;
    return mem === "unified" || !!unifiedFamily(S.virt.gpu);
  }
  return !!unifiedFamily(HW.gpu);
}
// 통합 RAM 하드웨어에 지정한 외부 그래픽카드(Thunderbolt/PCIe eGPU 독 등) — 없으면 vram 0
function curEgpu() {
  const g = (S.virt.on ? S.virt.egpu : S.hw.egpu) || {};
  return { gpu: String(g.gpu || ""), vram: Number(g.vram) > 0 ? Number(g.vram) : 0 };
}
// 통합 RAM + 외부 카드 → VRAM만 별도로 활성화되고, DRAM 계층은 통합 RAM 풀이 대신한다
function curExternal() { return curUnifiedAny() && curEgpu().vram > 0; }
// 순수 통합 RAM(외부 카드 없음) — VRAM/DRAM 경계가 사라지는 상태
function curUnified() { return curUnifiedAny() && !curExternal(); }
// 통합 RAM 풀 크기(GB): 가상 모드면 가상 RAM, 실기기면 확인/수정한 RAM
function curUnifiedGb() {
  if (S.virt.on) return Number(S.virt.ram) || 64;
  return Number(S.hw.ram) > 0 ? Number(S.hw.ram) : (navigator.deviceMemory || null);
}
// 예측에 넘길 프로필 값: 통합은 풀 크기, 외부 카드가 있으면 카드 VRAM + 통합 RAM 풀
function profileArgs() {
  if (curExternal()) return { vram: S.vram, dram: S.uram };
  return curUnified() ? { vram: S.uram, dram: S.uram } : { vram: S.vram, dram: S.dram };
}

// ---------------------------------------------------------------- 예측 (계층 모델)
const num = (n, d = 0) => (n == null || Number.isNaN(n) ? "–"
  : Number(n).toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d }));
const ctxShort = (n) => (n >= 1048576 && n % 1048576 === 0 ? `${Math.round(n / 1048576)}M` : `${Math.round(n / 1024)}K`);
const gbOf = (mib) => `${(mib / 1024).toFixed(1)} GB`;

function predict(model, vramGb, dramGb, ctx) {
  if (!model || !model.download_gb) return null;
  const totalMib = model.download_gb * 1024;
  // N-gram 룩업 테이블: 설계대로 SSD에 놓는 양 — 전문가 합계에서 미리 뺀다
  const ngramMib = Math.min(totalMib, (model.ngram_gb || 0) * 1024);
  let dense;
  if (model.floor_gb) dense = Math.max(0, model.floor_gb * 1024 - FIXED_VRAM_MIB);
  else dense = Math.max(0, (totalMib - ngramMib) * 0.2);   // 하한 미공개: 밀집 가중치를 전문가 영역의 약 20%로 추정
  const expertPool = Math.max(0, totalMib - ngramMib - dense);
  const kv = model.row_bytes ? Math.round(model.row_bytes * ctx / 2 ** 20) : null;

  // 계층 설계: dense는 MoE 계층이 없는 모델 — 전부 VRAM에 올리는 설계(Maya 고정 계층 없음)
  const ratio = model.dense_design ? null : (model.active_ratio != null ? model.active_ratio : 0.08);
  const activeDesign = ratio == null ? expertPool : Math.round(expertPool * ratio);   // VRAM에 있어야 하는 활성 전문가
  const inactive = Math.max(0, expertPool - activeDesign);                             // DRAM에 항상 대기하는 비활성 전문가
  const baseNeed = dense + FIXED_VRAM_MIB + (kv || 0);        // 로드 최소 요구(밀집+고정+캐시)

  let loads, vramCapacity, activeInVram, spillActive, ramCapacity, inactiveResident, ssdReRead, beyondPc, failMsg;
  const uni = curUnified();
  if (uni) {
    // 통합 RAM: VRAM/DRAM 경계가 없는 하나의 풀 — 넘치면 바로 파일 재읽기(PCIe 누수 없음)
    const poolMib = Math.max(0, vramGb) * 1024;              // profileArgs()가 풀 크기를 vramGb에 넣는다
    const physPool = (curUnifiedGb() || 0) * 1024;
    beyondPc = physPool && poolMib > physPool;
    const avail = Math.max(0, poolMib - OS_KEEP_MIB);        // OS·데스크톱이 풀에서 쓰는 양
    loads = baseNeed <= avail;
    vramCapacity = avail;
    activeInVram = Math.min(activeDesign, Math.max(0, avail - baseNeed));
    spillActive = 0;                                          // 같은 메모리 — PCIe 재읽기 경계 없음
    ramCapacity = Math.max(0, avail - baseNeed - activeInVram);
    inactiveResident = Math.min(inactive, ramCapacity);
    ssdReRead = (activeDesign - activeInVram) + (inactive - inactiveResident);
    failMsg = `로드되지 않습니다: 밀집 가중치·고정 오버헤드·어텐션 캐시가 약 ${(baseNeed / 1024).toFixed(1)} GB 필요하지만, 이 프로필의 통합 RAM은 ${(((vramGb * 1024) - OS_KEEP_MIB) / 1024).toFixed(1)} GB만 제공합니다`;
  } else {
    const physMib = (curVram() || 0) * 1024;               // 실측/가상 카드는 GB로 들어오므로 MiB로 맞춘다
    const targetMib = vramGb * 1024;
    const cardEff = Math.max(physMib, targetMib);
    beyondPc = (physMib && targetMib > physMib) || (curRam() && dramGb * 1024 > curRam() * 1024);
    const reserve = (physMib && targetMib > physMib) ? RESERVE_FLOOR_MIB : (physMib ? Math.max(RESERVE_FLOOR_MIB, physMib - targetMib) : RESERVE_FLOOR_MIB);
    loads = baseNeed <= cardEff - reserve;
    vramCapacity = Math.max(0, cardEff - reserve - baseNeed);   // 컨텍스트를 빼고 활성 전문가에게 남는 자리
    activeInVram = Math.min(activeDesign, vramCapacity);
    spillActive = activeDesign - activeInVram;            // 설계상 VRAM인데 못 들어간 활성분 → PCIe 재읽기
    const ramBudget = Math.max(0, dramGb * 1024 - OS_KEEP_MIB);
    // 통합 RAM이 호스트인 구성(외부 카드 사용)은 풀에서 OS 몫을 이미 뺐으므로 대화 캐시만 잡는다
    const conv = curUnifiedAny() ? Math.min(8192, Math.max(512, Math.floor(ramBudget / 6)))
                                 : Math.min(8192, Math.max(512, Math.floor(ramBudget / 3)));   // OS·대화 캐시 등
    ramCapacity = Math.max(0, ramBudget - conv);
    inactiveResident = Math.min(inactive, ramCapacity);
    ssdReRead = inactive - inactiveResident + spillActive;             // 설계는 RAM인데 못 들어 SSD 재읽기
    failMsg = `로드되지 않습니다: 밀집 가중치·고정 오버헤드·어텐션 캐시가 약 ${(baseNeed / 1024).toFixed(1)} GB 필요하지만, 이 프로필은 카드에 ${((cardEff - reserve) / 1024).toFixed(1)} GB만 제공합니다`;
  }

  const verdicts = [];
  if (curExternal()) verdicts.push(["ok", "외부 그래픽카드 사용: VRAM은 외부 카드이고, DRAM 계층(대기 메모리)는 통합 RAM이 대신합니다"]);
  if (!loads) {
    verdicts.push(["bad", failMsg]);
  } else {
    verdicts.push(["ok", "이 프로필에서 로드됩니다"]);
    if (uni) {
      if (ssdReRead <= 16) {
        verdicts.push(["ok", "통합 RAM 설계대로: 가중치·콘텍스트·대기 전문가가 모두 통합 RAM에 들어갑니다"]);
      } else {
        const share = Math.round(100 * ssdReRead / Math.max(1, activeDesign + inactive));
        verdicts.push([share <= 40 ? "warn" : "bad", `통합 RAM 초과 → 파일 재읽기 누수: 약 ${num(Math.round(ssdReRead))} MiB(${share}%)를 답변 중에 파일에서 다시 읽습니다`]);
      }
    } else {
      if (spillActive <= 16) {
        verdicts.push(["ok", ratio == null ? "VRAM 계층 설계대로: 가중치가 모두 카드에 들어갑니다" : "VRAM 계층 설계대로: 활성 전문가와 콘텍스트가 모두 카드에 들어갑니다"]);
      } else {
        const share = Math.round(100 * spillActive / Math.max(1, activeDesign));
        verdicts.push([share <= 40 ? "warn" : "bad", ratio == null
          ? `VRAM 계층 초과 → PCIe 누수: 카드에 못 들어간 가중치 ${num(Math.round(spillActive))} MiB(${share}%)를 답변 중에 DRAM에서 읽습니다`
          : `VRAM 계층 초과 → PCIe 누수: 활성 전문가의 ${share}%(${num(Math.round(spillActive))} MiB)를 답변 중에 DRAM에서 읽습니다`]);
      }
      if (inactive <= 16) {
        verdicts.push(["ok", ratio == null ? "DRAM 대기 계층 없음 — 카드에 전부 올리는 설계입니다" : "비활성 전문가 없음: 이 모델은 DRAM 대기 계층이 없습니다"]);
      } else if (ssdReRead <= 16) {
        verdicts.push(["ok", `DRAM 계층 설계대로: 비활성 전문가 ${gbOf(inactiveResident)}가 RAM에 항상 대기합니다`]);
      } else {
        const share = Math.round(100 * ssdReRead / Math.max(1, inactive + spillActive));
        verdicts.push([share <= 40 ? "warn" : "bad", `DRAM 계층 초과 → SSD 재읽기 누수: 약 ${num(Math.round(ssdReRead))} MiB를 답변 중에 파일에서 다시 읽습니다`]);
      }
    }
    if (ngramMib > 16) verdicts.push(["ok", `N-gram 테이블 ~${(ngramMib / 1024).toFixed(1)} GB는 설계대로 SSD 계층에 놓입니다 — 누수가 아닙니다`]);
  }
  if (beyondPc) verdicts.push(["warn", "이 컴퓨터의 한계를 넘는 설정입니다: 계획은 그런 하드웨어에서 어떻게 될지 보여줍니다"]);

  return {
    model, file_gb: model.download_gb, dense_mib: Math.round(dense), kv_mib: kv, loads, unified: uni,
    expert_pool_mib: Math.round(expertPool), ngram_mib: Math.round(ngramMib),
    active_design_mib: activeDesign, inactive_mib: inactive, ratio,
    vram_capacity_mib: Math.round(vramCapacity), ram_capacity_mib: Math.round(ramCapacity),
    spill_active_mib: Math.round(spillActive), ssd_reread_mib: Math.round(ssdReRead),
    tiers: { vram: Math.round(baseNeed + activeInVram), ram: Math.round(inactiveResident), ssd_design: Math.round(ngramMib), leak: Math.round(spillActive + (inactive - inactiveResident)) },
    verdicts,
  };
}

// ---------------------------------------------------------------- 호환성 판정 (3-2 엔진 / 3-3 모델)
function engineCompat(e) {
  const os = curOs();
  const out = [];
  if (!e.os) out.push(["warn", "지원 OS 정보 없음"]);
  else if (e.os.includes(os)) out.push(["ok", `OS ${OS_NAME[os]} 지원`]);
  else out.push(["bad", `OS 미지원 — 이 엔진은 ${e.os.map((x) => OS_NAME[x]).join("·")}용`]);
  const name = curGpuName();
  const tag = gpuTag(name);
  if (!e.gpus) out.push(["warn", "지원 GPU 정보 없음"]);
  else {
    let ok = false, maybe = false;
    const tagsOk = new Set(e.gpus);
    if (tag === "nvidia" || tag === "nvidia-rtx3040" || tag === "nvidia-blackwell") {
      const genSpecific = tagsOk.has("nvidia-blackwell") || tagsOk.has("nvidia-rtx3040");
      if (tagsOk.has(tag)) ok = true;                                    // 같은 세대 태그로 지원
      else if (!genSpecific && tagsOk.has("nvidia")) ok = true;          // 세대를 가리지 않는 NVIDIA 엔진
      else if (tag === "nvidia") maybe = true;                           // 일반 NVIDIA 카드 — 엔진이 특정 세대를 요구
      else maybe = /NVIDIA|RTX|GTX/i.test(name);
    } else if (tag === "amd") { ok = e.gpus.includes("amd"); maybe = !ok; }
    else if (tag === "apple") { ok = e.gpus.includes("apple"); maybe = !ok; }
    else if (tag === "cpu" || tag === "unknown") { ok = e.gpus.includes("cpu"); maybe = !ok; }
    else if (tag === "intel") { maybe = false; ok = false; }
    if (ok) out.push(["ok", `GPU 지원 (${name.slice(0, 42)})`]);
    else if (maybe) out.push(["warn", `GPU 확인 필요 — ${e.gpuNote || ""}`]);
    else out.push(["bad", `GPU 미지원 — ${e.gpuNote || "이 엔진의 GPU 목록에 없음"}`]);
  }
  const vram = curVram();
  if (vram && e.min_vram_gb && vram < e.min_vram_gb) out.push(["warn", `VRAM ${vram} GB < 권장 ${e.min_vram_gb} GB`]);
  const ram = curRam();
  if (ram && e.ram_min_gb && ram < e.ram_min_gb) out.push(["warn", `RAM ${ram} GB < 권장 ${e.ram_min_gb} GB`]);
  if (curUnifiedAny()) {
    const fam = unifiedFamily(curGpuName());
    if (curExternal()) out.push(fam && fam !== "other" ? ["warn", "통합 RAM + 외부 카드 — 엔진의 외장 GPU·통합 메모리 지원 확인 필요"]
                                                       : ["warn", "통합 RAM + 외부 카드(알려지지 않은 계열) — 지원 여부를 사용자가 직접 확인해야 함"]);
    else out.push(fam && fam !== "other" ? ["warn", "통합 RAM 하드웨어 — 이 엔진의 통합 메모리 지원 여부 확인 필요"]
                                         : ["warn", "통합 RAM(알려지지 않은 계열) — 지원 여부를 사용자가 직접 확인해야 함"]);
  }
  return { os, verdicts: out, bad: out.some(([t]) => t === "bad") };
}

// 모델이 현재 기준 OS/카드/DRAM에 맞는지 (3-3). 요구 비교는 확인된 실측(또는 가상) 기준이며, 표시는 공개 문서 기반 예상이다.
function modelCompat(m) {
  const out = [];
  if (!m || !m.download_gb) return out;
  const pa = profileArgs();
  const p = predict(m, pa.vram, pa.dram, S.ctx);
  if (!p) return out;
  const eng = engineById(S.engine);
  if (eng) {
    const ec = engineCompat(eng);
    if (ec.os === "other") out.push(["warn", "OS 확인 불가"]);
    else if (!eng.os || eng.os.includes(ec.os)) out.push(["ok", `OS ${OS_NAME[ec.os]} 지원`]);
    else out.push(["bad", `OS 미지원 (${e2os(eng)})`]);
  }
  const needMib = p.dense_mib + FIXED_VRAM_MIB + Math.min(p.active_design_mib, 8192) + (p.kv_mib || 0);
  if (m.dual) out.push(["warn", "이 모델은 공개 문서상 두 대의 머신을 요구합니다 — 한 장 기준 예상은 참고용"]);
  if (curUnified()) {
    const pool = S.uram;
    if (m.min_vram_gb && pool < m.min_vram_gb) {
      out.push([needMib <= pool * 1024 - OS_KEEP_MIB ? "warn" : "bad", `VRAM 권장 ${m.min_vram_gb} GB — 이 통합 RAM 프로필은 ${pool} GB`]);
    } else if (p.ssd_reread_mib > 64) {
      out.push(["warn", `통합 RAM 빠듯: 최소 약 ${(needMib / 1024).toFixed(1)} GB 필요(프로필 ${pool} GB)`]);
    } else out.push(["ok", `통합 RAM ${pool} GB에 로드 가능`]);
    return out;                       // 분리형 DRAM 배지는 통합 하드웨어에서 의미 없음
  }
  const card = curVram();
  if (card && m.min_vram_gb && card < m.min_vram_gb) {
    out.push([needMib <= card * 1024 - RESERVE_FLOOR_MIB ? "warn" : "bad", `VRAM 권장 ${m.min_vram_gb} GB — 이 카드는 ${card} GB`]);
  } else if (p.tiers.vram > 0 && needMib > (card || 99) * 1024 - RESERVE_FLOOR_MIB) {
    out.push(["warn", `VRAM 빠듯: 최소 약 ${(needMib / 1024).toFixed(1)} GB 필요(실측 ${card || "?"} GB)`]);
  } else out.push(["ok", card ? `VRAM ${card} GB에 로드 가능` : "VRAM 확인 불가 — 프로필 기준 계산"]);
  const ram = curRam();
  const host = curUnifiedAny() ? "통합 RAM" : "DRAM";   // 외부 카드 구성이면 대기 계층이 통합 RAM
  if (p.inactive_mib > 16) {
    const needRam = p.inactive_mib / 1024 + 4;   // OS·프로그램 여유 포함
    if (ram && needRam > ram) out.push(["warn", `${host} 권장 ${Math.ceil(needRam)} GB — 이 PC는 ${ram} GB`]);
    else out.push(["ok", `${host} ${ram ? ram + " GB" : "프로필"}에 비활성 전문가 ${gbOf(p.inactive_mib)} 대기 가능`]);
  } else if (p.ratio == null) {
    out.push(["ok", `MoE 계층 없음 — ${host} 대기분 없음`]);
  }
  return out;
}
const e2os = (eng) => (eng.os || []).map((x) => OS_NAME[x]).join("·") || "?";

// ---------------------------------------------------------------- 렌더
const $id = (x) => document.getElementById(x);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => (
  {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
// 배지는 " — " 기준으로 조각을 나눠 각 span에 넣는다 — i18n이 문장 전체를 번역하도록 (조각마다 사전 행)
function badge(tone, text, cls, pre) {
  const parts = String(text).split(" — ");
  return `<span class="badge${cls || ""}" data-tone="${tone}">` + (pre ? `<span>${esc(pre)}</span> ` : "")
    + parts.map((s) => `<span>${esc(s)}</span>`).join(" — ") + "</span>";
}

function withCatalog(e) {                                   // HF 카탈로그/검색 추가분이 있으면 모델 목록에 합친다 (지원 정보·그룹은 유지)
  const c = S.catalog[e.id];
  if (!c || !Array.isArray(c.models) || !c.models.length) return e;
  return Object.assign({}, e, { models: c.replace ? c.models : e.models.concat(c.models), catTs: c.ts });
}
function allEngines() { return BUILT_IN.concat(S.custom).map(withCatalog); }
function engineById(id) { return allEngines().find((e) => e.id === id) || null; }
// 단계 잠금(3-1 → 3-2 → 3-3): 앞 단계를 확인해야 다음 단계 열림
function applyGating() {
  const step2ok = S.hwConfirmed, step3ok = S.hwConfirmed && !!S.engine;
  $id("step-engine").classList.toggle("locked", !step2ok);
  $id("step-model").classList.toggle("locked", !step3ok);
  $id("engine-gate-note").hidden = step2ok;
  $id("model-gate-note").hidden = step3ok;
  $id("hw-confirm-btn").textContent = S.hwConfirmed ? "✓ 확인됨 — 다시 확인" : "이 스펙으로 확인";
  $id("hw-confirm-btn").classList.toggle("confirmed", S.hwConfirmed);
}

function hwSummary() {
  if (curExternal()) {
    const g = curEgpu();
    return `${OS_NAME[curOs()] || "?"} · ${curGpuName().slice(0, 46)} · 통합 RAM ${curUnifiedGb() || "?"} GB · 외부 카드 ${g.gpu || "?"} (${g.vram} GB)`;
  }
  if (curUnified()) return `${OS_NAME[curOs()] || "?"} · ${curGpuName().slice(0, 46)} · 통합 RAM ${curUnifiedGb() || "?"} GB`;
  const v = curVram(), r = curRam();
  return `${OS_NAME[curOs()] || "?"} · ${curGpuName().slice(0, 46)} · VRAM ${v || "?"} GB · RAM ${r || "?"} GB`;
}

// 통합 RAM 하드웨어면 즉시 뜨는 경고 (#3): 알려진 계열과 "본인 확인 필요" 계열을 구분한다
const UNI_WARN_PRE = "⚠ 통합 RAM 하드웨어입니다: VRAM과 RAM이 분리된 것이 아니라 하나의 메모리를 함께 씁니다. ";
function unifiedWarnText(fam, manual) {
  if (fam === "gb10" || fam === "apple" || fam === "aimax") {
    return UNI_WARN_PRE + "AI 연산 지원은 분리형 카드보다 조건이 까다롭고, GB10(DGX Spark) · Apple Silicon · AMD AI Max+(Strix Halo)는 알려진 계열이라 엔진의 공개 지원 목록과 대조할 수 있습니다. 위 지원 표시는 공개 문서 기반 예상이며 실제 작동을 보장하지 않습니다.";
  }
  return UNI_WARN_PRE + (manual
    ? "통합 RAM을 직접 선택하셨는데 GB10 · Apple Silicon · AI Max(Strix Halo)처럼 잘 알려진 계열이 아닙니다 — 엔진마다 지원 여부가 명시되지 않은 경우가 많으니 사용자 본인이 반드시 별도로 확인해야 합니다."
    : "이 내장 그래픽은 GB10 · Apple Silicon · AI Max(Strix Halo)처럼 잘 알려진 계열이 아닙니다 — 엔진마다 지원 여부가 명시되지 않은 경우가 많으니 사용자 본인이 반드시 별도로 확인해야 합니다.")
    + " 위 지원 표시는 공개 문서 기반 예상이며 실제 작동을 보장하지 않습니다.";
}
// 외부 카드를 지정했을 때 통합 RAM 경고 아래 붙는 안내 (단일 노드 — i18n은 문장 전체 키)
function egpuNoteText(gpuName, vramGb) {
  return `외부 그래픽카드 ${gpuName || "이름 없음"} (${vramGb} GB) 지정 — 카드의 VRAM이 별도로 활성화되고, 비활성 전문가·초과 분은 통합 RAM을 씁니다`;
}
// preview 생략 시 적용된 스펙 기준, {any, fam, manual, egpu} 전달 시 가상 패널 미리보기
function updateUnifiedWarn(preview) {
  const el = $id("unified-warn"), elx = $id("unified-warn-ext");
  let on, fam, manual, eg;
  if (preview) { on = preview.any; fam = preview.fam; manual = !!preview.manual; eg = preview.egpu || { vram: 0 }; }
  else { on = curUnifiedAny(); fam = unifiedFamily(curGpuName()); manual = S.virt.on && (S.virt.mem === "unified") && !fam; eg = curEgpu(); }
  if (!on) { el.hidden = true; el.textContent = ""; if (elx) elx.hidden = true; return; }
  el.textContent = unifiedWarnText(fam, manual);
  el.hidden = false;
  if (elx) {
    if (eg.vram > 0) { elx.textContent = egpuNoteText(eg.gpu, eg.vram); elx.hidden = false; }
    else elx.hidden = true;
  }
}

function renderHw() {
  $id("hw-mode-badge").textContent = S.virt.on ? "가상 모드" : "실제 확인";
  $id("hw-mode-badge").dataset.tone = S.virt.on ? "warn" : "ok";
  const uni = curUnifiedAny(), ext = curExternal(), eg = curEgpu();
  const rows = S.virt.on ? [
    ["OS(가상)", OS_NAME[S.virt.os] || S.virt.os],
    ["GPU(가상)", S.virt.gpu || "(이름 없음)"],
    ["메모리 유형", uni ? (ext ? "통합 RAM + 외부 그래픽카드" : "통합 RAM (공유 메모리)") : "VRAM / DRAM 분리"],
    ...(uni ? [["통합 RAM(가상)", `${S.virt.ram} GB`]] : [["VRAM(가상)", `${S.virt.vram} GB`], ["RAM(가상)", `${S.virt.ram} GB`]]),
    ...(ext ? [["외부 카드(지정)", `${eg.gpu || "?"} (${eg.vram} GB)`]] : []),
    ["실제 확인값", `GPU ${HW.gpu ? HW.gpu.slice(0, 40) : "?"} · VRAM 추정 ${HW.vramGuess || "?"} GB · RAM ${navigator.deviceMemory || "?"} GB`],
  ] : [
    ["OS", `${HW.platform} → ${OS_NAME[detectedOs()]}`],
    ["GPU(WebGL 확인)", HW.gpu || "확인 불가"],
    ...(uni ? [["메모리 유형", ext ? "통합 RAM + 외부 그래픽카드" : unifiedFamily(HW.gpu) === "other"
      ? "통합 RAM 추정 (내장 그래픽 — 지원은 직접 확인)" : "통합 RAM (공유 메모리)"]] : []),
    ...(ext ? [["외부 카드(지정)", `${eg.gpu || "?"} (${eg.vram} GB)`]] : []),
    ["VRAM(이름으로 추정)", uni ? "없음 — 통합 RAM 공유" : (HW.vramGuess ? `${HW.vramGuess} GB` : "추정 불가 — 아래에서 직접 입력")],
    ["시스템 RAM", navigator.deviceMemory ? `navigator.deviceMemory ${navigator.deviceMemory} GB (브라우저는 상한 보고 가능)` : "확인 불가 — 아래에서 직접 입력"],
    ["CPU 코어(스레드)", HW.cores || "?"],
  ];
  $id("hw-facts").innerHTML = rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("");
  if (!$id("hw-vram").value) $id("hw-vram").value = S.hw.vram || HW.vramGuess || "";
  if (!$id("hw-ram").value) $id("hw-ram").value = S.hw.ram || navigator.deviceMemory || "";
  if (!$id("hw-egpu-gpu").value) $id("hw-egpu-gpu").value = (S.hw.egpu && S.hw.egpu.gpu) || "";
  if (!$id("hw-egpu-vram").value) $id("hw-egpu-vram").value = (S.hw.egpu && S.hw.egpu.vram) || "";
  $id("hw-vram-wrap").hidden = uni;                       // 통합 하드웨어는 내부 VRAM 입력 없음 — RAM 자리가 곧 풀
  $id("hw-egpu-wrap").hidden = !(uni && !S.virt.on);      // 외부 카드는 통합 하드웨어에서만(가상 모드는 가상 패널에서 지정)
  $id("hw-ram-label").textContent = uni ? "통합 RAM (GB)" : "시스템 RAM (GB)";
  $id("hw-summary").textContent = hwSummary();
  updateUnifiedWarn();
}

function renderEngines() {
  const cur = engineById(S.engine);
  const card = (e) => {
    const c = e.custom ? null : engineCompat(e);
    return `
    <div class="engine-opt${c && c.bad ? " eng-bad" : ""}" role="radio" tabindex="0" data-id="${esc(e.id)}" aria-checked="${e.id === S.engine}">
      <span>
        <span class="e-name">${esc(e.name)}</span>${e.custom ? ' <span class="small">(직접 추가)</span>' : ""}
        <a href="${esc(e.url || "#")}" target="_blank" rel="noopener">${esc(e.url || "")}</a>
        <span class="e-desc muted small"><span>${esc(e.desc || "")}</span> · <span>모델 ${e.models.length}개</span>${e.catTs ? ' · <span>카탈로그 반영</span>' : ""}</span>
        <span class="badge-row">${c ? c.verdicts.map(([t, x]) => badge(t, x)).join("") : badge("warn", "직접 추가 엔진 — 지원 OS/GPU 정보 없음")}</span>
      </span>
      ${e.custom ? '<button type="button" class="remove" data-refresh="' + esc(e.id) + '">최신화</button>'
               + '<button type="button" class="remove" data-remove="' + esc(e.id) + '">삭제</button>' : ""}
      ${HF_ENGINES[e.id] ? (S.catalog[e.id] && S.catalog[e.id].models.length
          ? `<button type="button" class="remove" data-catref="${esc(e.id)}">최신화</button>`
          + `<button type="button" class="remove" data-catclr="${esc(e.id)}">카탈로그 지우기</button>`
          : `<button type="button" class="remove" data-catlod="${esc(e.id)}">카탈로그 불러오기</button>`) : ""}
      ${HF_SEARCHABLE.includes(e.id) ? `<button type="button" class="remove" data-hfsearch="${esc(e.id)}">모델 검색·추가</button>` : ""}
    </div>`;
  };
  const list = allEngines();
  $id("engine-list").innerHTML =
      `<div class="eng-group"><span>계층화 메모리 MoE 지원 엔진 — VRAM 활성 · DRAM 대기 · SSD 테이블</span></div>`
    + list.filter((e) => e.tiered === true).map(card).join("")
    + `<div class="eng-group"><span>일반 로드 엔진 — 전문가 계층 스트리밍 없음(총량·카드 기준 예상)</span></div>`
    + list.filter((e) => e.tiered !== true).map(card).join("");
  for (const el of $id("engine-list").querySelectorAll(".engine-opt")) {
    const pick = () => { S.engine = el.dataset.id; store.set("engine", S.engine); S.modelSel = null; renderEngines(); renderModels(); renderPredict(); };
    el.onclick = (ev) => { if (!ev.target.closest("button")) pick(); };
    el.onkeydown = (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); pick(); } };
  }
  for (const b of $id("engine-list").querySelectorAll("[data-refresh]")) {
    b.onclick = () => refreshEngine(b.dataset.refresh);
  }
  for (const b of $id("engine-list").querySelectorAll("[data-remove]")) {
    b.onclick = () => {
      S.custom = S.custom.filter((e) => e.id !== b.dataset.remove);
      store.set("customEngines", S.custom);
      if (!engineById(S.engine)) S.engine = BUILT_IN[0].id;
      renderEngines(); renderModels(); renderPredict();
    };
  }
  for (const b of $id("engine-list").querySelectorAll("[data-catlod]")) b.onclick = () => loadCatalog(b.dataset.catlod);
  for (const b of $id("engine-list").querySelectorAll("[data-catref]")) b.onclick = () => loadCatalog(b.dataset.catref, true);
  for (const b of $id("engine-list").querySelectorAll("[data-catclr]")) b.onclick = () => clearCatalog(b.dataset.catclr);
  for (const b of $id("engine-list").querySelectorAll("[data-hfsearch]")) b.onclick = () => openHfSearch(b.dataset.hfsearch);
  return cur;
}

// 모델 선택은 2단 — 이름 목록을 고르면 그 모델의 양자화(크기 포함)만 두 번째 드롭다운에 채워진다
function renderModels() {
  const eng = engineById(S.engine);
  const nameSel = $id("model-name"), quantSel = $id("model-quant");
  if (!eng || !eng.models.length) {
    nameSel.innerHTML = '<option value="">이 엔진에는 모델 목록이 없습니다 — URL 방식으로 추가해 보세요</option>';
    quantSel.innerHTML = "";
    $id("model-note").textContent = ""; renderPredict(); return;
  }
  const names = [...new Set(eng.models.map((m) => m.name))];
  if (!S.modelSel || !names.includes(S.modelSel.name)) S.modelSel = { name: names[0], quant: null };
  nameSel.innerHTML = names.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join("");
  nameSel.value = S.modelSel.name;
  const group = eng.models.filter((m) => m.name === S.modelSel.name);
  if (!S.modelSel.quant || !group.some((m) => m.quant === S.modelSel.quant)) S.modelSel.quant = group[0].quant;
  quantSel.innerHTML = group.map((m) => `<option value="${esc(m.quant)}">${esc(m.quant || "(양자화 없음)")}${m.download_gb ? ` · ${m.approx ? "~" : ""}${m.download_gb} GB` : " (크기 미공개)"}</option>`).join("");
  quantSel.value = S.modelSel.quant;
  store.set("modelSel", S.modelSel);
  $id("model-note").textContent = "선택한 엔진이 지원하는 모델입니다 (공개 문서의 크기 표).";
  renderPredict();
  maybeAutoCatalog(eng);                                 // 카탈로그 엔진을 처음 고르면 HF 최신 목록을 자동으로 불러온다
}
const catalogAutoTried = new Set();                      // 한 페이지 세션에서 엔진당 자동 시도 1회 (실패 시 버튼으로 재시도)
function maybeAutoCatalog(eng) {
  if (!eng || !HF_ENGINES[eng.id] || S.catalog[eng.id]) return;
  if (catalogAutoTried.has(eng.id) || navigator.onLine === false) return;
  catalogAutoTried.add(eng.id);
  loadCatalog(eng.id);
}

function selectedModel() {
  const eng = engineById(S.engine);
  if (!eng) return null;
  const sel = S.modelSel || {};
  const i = eng.models.findIndex((m) => m.name === sel.name && m.quant === sel.quant);
  return i >= 0 ? eng.models[i] : eng.models[0] || null;
}

function pills(id, values, current, fmt, onPick, mark) {
  const el = $id(id);
  el.innerHTML = values.map((x) => `<button type="button" role="radio" data-v="${x}"${x === mark ? ' data-best="1"' : ""} aria-checked="${x === current}">${fmt ? fmt(x) : x}</button>`).join("");
  for (const b of el.querySelectorAll("button")) {
    b.onclick = () => { onPick(Number(b.dataset.v)); };
  }
}

// 이 컴퓨터·엔진·모델 프로필에서 누수 없이 들어가는 가장 큰 컨텍스트를 고른다 (#5)
function recommendCtx(m) {
  if (!m || !m.download_gb) return null;
  const pa = profileArgs();
  let loadable = null;
  for (const c of CTX_CHOICES.slice().reverse()) {          // 큰 것부터
    const p = predict(m, pa.vram, pa.dram, c);
    if (!p) return null;
    if (p.loads && !loadable) loadable = c;                 // 로드되는 가장 큰 크기(대안)
    if (p.loads && p.spill_active_mib <= 16 && p.ssd_reread_mib <= 16) return { ctx: c, clean: true };
  }
  return loadable ? { ctx: loadable, clean: false } : null;
}
function markReco(m) {
  const r = recommendCtx(m);
  for (const b of $id("ctx-pills").querySelectorAll("button"))
    b.toggleAttribute("data-best", !!r && Number(b.dataset.v) === r.ctx);
  $id("ctx-reco").textContent = !r ? "" : r.clean
    ? `권장 컨텍스트: ${ctxShort(r.ctx)} — 이 프로필에서 누수 없이 들어가는 가장 큰 크기입니다`
    : `권장 컨텍스트: ${ctxShort(r.ctx)} — 누수까지 피하지는 못하지만, 로드되는 가장 큰 크기입니다`;
}

// 전체 자원 사용 / 20% 남김 (#3): 실측(또는 가상) 스펙에 들어오는 가장 큰 프로필 선택지 (통합 RAM도 동일)
function fitPreset(frac) {
  const pick = (choices, gb) => {
    let best = null;
    for (const c of choices) if (gb && c <= gb * frac && (best === null || c > best)) best = c;
    return best == null ? choices[0] : best;
  };
  if (curExternal()) {                                  // 외부 카드 VRAM + 통합 RAM 풀, 둘 다 실측 스펙에 맞춤
    S.vram = pick(VRAM_CHOICES, curEgpu().vram);
    S.uram = pick(UNIFIED_CHOICES, curUnifiedGb());
    store.set("vram", S.vram); store.set("uram", S.uram);
  } else if (curUnified()) {
    S.uram = pick(UNIFIED_CHOICES, curUnifiedGb());
    store.set("uram", S.uram);
  } else {
    S.vram = pick(VRAM_CHOICES, curVram());
    S.dram = pick(DRAM_CHOICES, curRam());
    store.set("vram", S.vram); store.set("dram", S.dram);
  }
  renderProfile(); renderPredict();
}

function renderProfile() {
  const anyU = curUnifiedAny(), ext = curExternal();
  if (anyU && S.uram == null) {
    const g = curUnifiedGb();
    S.uram = UNIFIED_CHOICES.slice().reverse().find((x) => x <= (g || 32)) || 32;
    store.set("uram", S.uram);
  }
  if (ext && S.vram == null) {                          // 외부 카드 프로필 초기값: 카드 용량 내 가장 큰 선택지
    const g = curEgpu().vram;
    S.vram = VRAM_CHOICES.slice().reverse().find((x) => x <= g) || VRAM_CHOICES[0];
    store.set("vram", S.vram);
  }
  $id("vram-out").textContent = `${S.vram} GB`;
  $id("dram-out").textContent = `${S.dram} GB`;
  $id("uram-out").textContent = `${S.uram || 32} GB`;
  $id("ctx-out").textContent = `${ctxShort(S.ctx)} 토큰`;
  // 통합 RAM이면 VRAM/DRAM 선택 불가 — 외부 카드를 지정했을 때만 VRAM(외부 카드) 다시 활성화
  $id("field-vram").hidden = anyU && !ext; $id("field-dram").hidden = anyU; $id("field-uram").hidden = !anyU;
  $id("vram-label").textContent = ext ? "외부 카드 VRAM 프로필" : "VRAM 프로필";
  pills("vram-pills", VRAM_CHOICES, S.vram, (x) => `${x} GB`, (x) => { S.vram = x; store.set("vram", x); renderProfile(); renderPredict(); });
  pills("dram-pills", DRAM_CHOICES, S.dram, (x) => `${x} GB`, (x) => { S.dram = x; store.set("dram", x); renderProfile(); renderPredict(); });
  pills("uram-pills", UNIFIED_CHOICES, S.uram, (x) => `${x} GB`, (x) => { S.uram = x; store.set("uram", x); renderProfile(); renderPredict(); });
  pills("ctx-pills", CTX_CHOICES, S.ctx, ctxShort, (x) => { S.ctx = x; store.set("ctx", x); renderProfile(); renderPredict(); },
        (function () { const r = recommendCtx(selectedModel()); return r ? r.ctx : null; })());
}

function renderPredict() {
  const m = selectedModel();
  const facts = $id("predict-facts"), verds = $id("predict-verdicts"), bar = $id("tier-bar");
  const pa = profileArgs();
  const p = predict(m, pa.vram, pa.dram, S.ctx);
  markReco(m);
  if (!p) {
    facts.innerHTML = ""; verds.innerHTML = badge("warn", "이 모델은 공개된 파일 크기가 없어 예상할 수 없습니다");
    bar.innerHTML = ""; $id("model-compat").innerHTML = ""; return;
  }
  const t = p.tiers;
  const uni = curUnified(), ext = curExternal();
  const kvTxt = p.kv_mib == null ? "미공개" : "~" + num(p.kv_mib) + " MiB";
  // 행 뒤의 총량·사용률 (#2): 통합 RAM은 풀 하나, 분리형은 카드/RAM 각각, SSD는 파일 안 비중
  const cardGb = curVram(), ramGb = curRam();
  const pctOf = (used, gb) => (gb ? Math.round(100 * used / (gb * 1024)) : null);
  const totVram = uni ? `통합 RAM 총량 ${S.uram} GB (${pctOf(t.vram + t.ram, S.uram)}% 사용)`
                      : (cardGb ? `카드 총량 ${cardGb} GB (${pctOf(t.vram, cardGb)}% 사용)` : "");
  const totRam = uni ? "" : (ramGb ? `총량 ${ramGb} GB (${pctOf(t.ram, ramGb)}% 사용)` : "");
  const totSsd = p.ngram_mib > 16 && p.file_gb ? `파일의 ${Math.round(100 * p.ngram_mib / (p.file_gb * 1024))}%` : "";
  const roomTxt = uni ? "통합 RAM 자리" : "카드 자리";
  const hostTxt = (uni || ext) ? "통합 RAM" : "RAM";   // 외부 카드 구성에서 대기 계층은 통합 RAM
  facts.innerHTML = [
    ["모델", `${p.model.name}${p.model.quant ? " — " + p.model.quant : ""} (예상)`, ""],
    ["SSD의 파일", `~${p.file_gb} GB`, ""],
    ["밀집 가중치", `~${num(p.dense_mib)} MiB`, ""],
    [uni ? "통합 RAM · 활성 전문가+콘텍스트" : ext ? "VRAM(외부 카드) · 활성 전문가+콘텍스트" : "VRAM · 활성 전문가+콘텍스트", p.ratio == null ? (uni ? "계층 없음 — 전부 통합 RAM에 올라가는 설계" : "계층 없음 — 전부 VRAM에 올라가는 설계") : `활성 ~${num(p.active_design_mib)} MiB (전문가의 ${Math.round(p.ratio * 100)}%) · 어텐션 캐시 ${kvTxt} · ${roomTxt} ~${gbOf(Math.min(p.active_design_mib, p.vram_capacity_mib) + (p.kv_mib || 0) + p.dense_mib)}`, totVram],
    [uni || ext ? "통합 RAM · 비활성 전문가" : "DRAM · 비활성 전문가", p.inactive_mib > 16 ? `~${num(p.inactive_mib)} MiB 대기 (${hostTxt} 자리 ${gbOf(p.ram_capacity_mib)})` : "없음", totRam],
    ["SSD · N-gram 테이블", p.ngram_mib > 16 ? `~${(p.ngram_mib / 1024).toFixed(1)} GB — 설계대로 SSD에 상주 (누수 아님)` : "없음", totSsd],
    [uni ? "초과(파일 재읽기)" : "초과(누수)", t.leak > 16 ? (uni ? `통합 RAM을 넘는 약 ${gbOf(t.leak)}를 답변 중에 파일에서 다시 읽습니다` : `PCIe ${gbOf(p.spill_active_mib)} · SSD 재읽기 ${gbOf(Math.max(0, p.tiers.leak - p.spill_active_mib))}`) : "없음 — 각 계층이 자기 자리 안에 들어갑니다", ""],
  ].map(([k, v, s]) => `<dt>${esc(k)}</dt><dd>${esc(v)}${s ? ` <span class="tot">${esc(s)}</span>` : ""}</dd>`).join("");
  verds.innerHTML = p.verdicts.map(([tone, text]) => badge(tone, text)).join("")
    + modelCompat(m).map(([tone, text]) => badge(tone, text, " compat", "모델 예상:")).join("");
  $id("model-compat").innerHTML = "";
  const activeInVramNow = Math.max(0, Math.min(p.active_design_mib, p.vram_capacity_mib));
  const segs = [["t-vram", activeInVramNow + p.dense_mib], ["t-ctx", p.kv_mib || 0], ["t-ram", t.ram], ["t-ssd-design", t.ssd_design], ["t-leak", t.leak]];
  const total = Math.max(1, segs.reduce((a, [, v]) => a + v, 0));
  bar.innerHTML = segs.map(([cls, v]) => (v > 0 ? `<i class="${cls}" style="width:${(100 * v / total).toFixed(1)}%" title="${cls}: ${num(v)} MiB"></i>` : "")).join("");
}

// ---------------------------------------------------------------- 엔진 추가 (URL 방식) + 형식 보기
async function addEngineFromUrl() {
  const input = $id("engine-url"), note = $id("engine-add-note");
  const url = input.value.trim();
  if (!/^https?:\/\/.+/i.test(url)) { note.textContent = "http(s) URL을 넣으세요."; return; }
  note.textContent = "불러오는 중…";
  try {
    const eng = await fetchEngine(url);
    S.custom = S.custom.filter((e) => e.src !== url).concat([eng]);
    store.set("customEngines", S.custom);
    S.engine = eng.id; store.set("engine", eng.id); S.modelSel = null;
    input.value = ""; note.textContent = `추가됨: ${eng.name} (${eng.models.length}개 모델)`;
    renderEngines(); renderModels(); renderPredict();
  } catch (e) {
    note.textContent = `실패: ${e.message} — URL이 https인지, CORS를 허용하는지 확인하세요 (GitHub raw는 허용함).`;
  }
}

// URL에서 엔진 JSON을 받아 표준 형식으로 바꾼다 (추가/최신화共用 — 서버·설치 없이 fetch 한 번이면 동작)
async function fetchEngine(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  if (!j || !Array.isArray(j.models) || !j.models.length) throw new Error("models 배열이 없습니다");
  return {
    id: "custom-" + url.length + "-" + Math.abs(url.split("").reduce((a, c) => a * 31 + c.charCodeAt(0) | 0, 7)).toString(36),
    name: String(j.name || "직접 추가 엔진"), url: String(j.url || url), desc: j.desc ? String(j.desc) : "URL로 추가한 엔진",
    custom: true, src: url, updated: new Date().toISOString(),
    tiered: j.tiered === true,                                  // 계층화 메모리 MoE 엔진이면 JSON에 "tiered": true
    os: Array.isArray(j.os) ? j.os.filter((x) => ["windows", "linux", "macos"].includes(x)) : null,
    gpus: Array.isArray(j.gpus) ? j.gpus : null,
    min_vram_gb: Number(j.min_vram_gb) > 0 ? Number(j.min_vram_gb) : null,
    models: j.models.slice(0, 400).map((m) => ({
      name: String(m.name || "이름 없는 모델"), quant: m.quant == null ? "" : String(m.quant),
      download_gb: Number(m.download_gb) > 0 ? Number(m.download_gb) : null,
      row_bytes: Number.isFinite(Number(m.row_bytes)) && Number(m.row_bytes) > 0 ? Number(m.row_bytes) : null,
      floor_gb: Number.isFinite(Number(m.floor_gb)) && Number(m.floor_gb) >= 0 ? Number(m.floor_gb) : null,
      active_ratio: Number(m.active_ratio) > 0 && Number(m.active_ratio) <= 1 ? Number(m.active_ratio) : null,
      ngram_gb: Number(m.ngram_gb) > 0 ? Number(m.ngram_gb) : null,
      min_vram_gb: Number(m.min_vram_gb) > 0 ? Number(m.min_vram_gb) : null,
      dense_design: !!m.dense,
    })),
  };
}

// 최신화 (#5): 같은 URL을 다시 받아 모델 목록·지원 정보를 그 시점 기준으로 갱신
async function refreshEngine(id) {
  const eng = S.custom.find((e) => e.id === id);
  const note = $id("engine-add-note");
  if (!eng || !eng.src) return;
  note.textContent = "최신화 중…";
  try {
    const fresh = await fetchEngine(eng.src);
    Object.assign(eng, fresh, { id: eng.id });
    store.set("customEngines", S.custom);
    note.textContent = `최신화됨: ${eng.name} (${eng.models.length}개 모델)`;
    renderEngines(); renderModels(); renderPredict();
  } catch (e) {
    note.textContent = `최신화 실패: ${e.message}`;
  }
}

// ---------------------------------------------------------------- Hugging Face 카탈로그(Unsloth·LM Studio) + 직접 검색·입력
// ollama.com은 브라우저 카탈로그 접근(CORS)이 차단되어 연동 불가 — 대신 이 앱에서 HF 저장소를 검색해 담거나 직접 입력한다.
const HF_ENGINES = { unsloth: "unsloth", lmstudio: "lmstudio-community" };   // 엔진 id → Hugging Face 조직
const HF_SEARCHABLE = ["ollama", "unsloth", "lmstudio"];                     // '모델 검색·추가' 패널을 여는 엔진

async function hfJson(url, ms = 15000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);       // 일부 저장소가 행업해도 카탈로그 전체가 멈추지 않게 타임아웃
  try {
    const r = await fetch(url, { cache: "no-store", signal: ac.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(timer); }
}
// GGUF 저장소 → quant별 크기 [{quant, gb}] — 최상위 파일만(BF16·MTP 같은 하위폴더 제외), 다중 분할 샤드는 합산
function ggufQuants(repoId, siblings) {
  const base = repoId.split("/")[1].replace(/[-_]gguf$/i, "");
  const acc = new Map();
  for (const s of siblings || []) {
    const f = String(s.rfilename || "");
    if (!/\.gguf$/i.test(f) || f.includes("/") || /mmproj/i.test(f)) continue;   // mmproj(비전 프로젝터)는 모델이 아님
    let q = f.replace(/-\d{5}-of-\d{5}(?=\.gguf$)/i, "").replace(/\.gguf$/i, "");
    if (q.toLowerCase().startsWith(base.toLowerCase() + "-")) q = q.slice(base.length + 1);
    else if (!/[-_]/.test(q)) continue;                                       // 모델명과 같은 단일 파일은 quant 구분 없음
    acc.set(q, (acc.get(q) || 0) + (Number(s.size) || 0));
  }
  return [...acc.entries()].filter(([, b]) => b > 1e8)
    .map(([quant, bytes]) => ({ quant, gb: +(bytes / 1e9).toFixed(1) }))
    .sort((a, b) => a.gb - b.gb);
}
// 저장소 하나 → 모델 항목들 (GGUF는 quant별, MLX는 safetensors 총합). 이름에 AxxB 표기가 없으면 조밀(dense)로 본다 — 일반 로더는 통째 로드 기준.
async function hfRepoModels(repoId, dl) {
  const path = String(repoId).split("/").map(encodeURIComponent).join("/");   // 조직/이름 슬래시는 보존 (통째 인코딩 시 HF가 400)
  const j = await hfJson(`https://huggingface.co/api/models/${path}?blobs=true`);
  const sibs = Array.isArray(j.siblings) ? j.siblings : [];
  const name = repoId.split("/")[1].replace(/[-_]gguf$/i, "");
  const moeHint = /[-\s]A\d+(\.\d+)?[BM]\b/i.test(name) || /gpt-oss/i.test(repoId);
  const mk = (quant, gb) => ({ name, quant, download_gb: gb, dense_design: moeHint ? undefined : true, src: repoId, dl: dl || null });
  const quants = ggufQuants(repoId, sibs);
  if (quants.length) {
    const HOT = /q4_k_m|ud-q4_k_xl|q8_0|iq4_xs|ud-q3_k_xl|q2_k|q4_0/i;   // 드롭다운이 지나치게 길어지지 않게 자주 쓰는 quant 우선 12개
    if (quants.length > 12) {
      const hot = quants.filter((q) => HOT.test(q.quant)), rest = quants.filter((q) => !HOT.test(q.quant));
      return [...hot, ...rest].slice(0, 12).sort((a, b) => a.gb - b.gb).map((q) => mk(q.quant, q.gb));
    }
    return quants.map((q) => mk(q.quant, q.gb));
  }
  const stTotal = sibs.filter((s) => /\.safetensors$/i.test(s.rfilename)).reduce((a, s) => a + (Number(s.size) || 0), 0);
  if (stTotal > 1e8 && /mlx/i.test(repoId)) {
    const m = repoId.match(/[-_](mlx[-\s][\d.]+bit|mlx)$/i);
    return [mk(m ? m[1].toUpperCase() : "MLX", +(stTotal / 1e9).toFixed(1))];
  }
  throw new Error("GGUF·MLX 파일이 없는 저장소입니다");
}
// 조직의 다운로드순 상위 30개 저장소를 읽어 엔진 모델 목록을 통째로 대체한다 (동시 4개, 진행률은 엔진 추가 안내 줄에 표시)
async function loadCatalog(engineId, isRefresh) {
  const org = HF_ENGINES[engineId];
  const note = $id("engine-add-note");
  if (!org) return;
  note.textContent = isRefresh ? "카탈로그 최신화 중…" : "카탈로그 불러오는 중…";
  try {
    const repos = await hfJson(`https://huggingface.co/api/models?author=${encodeURIComponent(org)}&sort=downloads&limit=30`);
    if (!Array.isArray(repos) || !repos.length) throw new Error("저장소 목록이 비어 있습니다");
    const byRepo = new Array(repos.length);
    for (let i = 0; i < repos.length; i += 4) {
      const chunk = repos.slice(i, i + 4);
      const rs = await Promise.allSettled(chunk.map((r) => hfRepoModels(r.id, r.downloads)));
      rs.forEach((res, k) => { if (res.status === "fulfilled") byRepo[i + k] = res.value; });
      note.textContent = `카탈로그 불러오는 중… ${Math.min(i + 4, repos.length)}/${repos.length}`;
    }
    const models = byRepo.filter(Boolean).flat();
    if (!models.length) throw new Error("크기를 읽을 수 있는 GGUF·MLX 저장소가 없습니다");
    S.catalog[engineId] = { ts: Date.now(), replace: true, models };
    store.set("catalog", S.catalog);
    note.textContent = `카탈로그 반영됨: ${models.length}개 모델 (Hugging Face ${org} 다운로드순)`;
    if (S.engine === engineId) S.modelSel = null;
    renderEngines(); renderModels(); renderPredict();
  } catch (e) { note.textContent = `카탈로그 실패: ${e.message} — 오프라인이면 기본 목록을 그대로 사용합니다`; }
}
function clearCatalog(engineId) {
  delete S.catalog[engineId];
  store.set("catalog", S.catalog);
  S.modelSel = null;
  $id("engine-add-note").textContent = "카탈로그를 지웠습니다 — 기본 모델 목록으로 돌아갔습니다";
  renderEngines(); renderModels(); renderPredict();
}

// ---------------------------------------------------------------- 모델 직접 검색·입력 패널 (세 엔진 공통)
let hfTarget = null;                                                          // 검색/추가 대상 엔진 (세션 전용)
function openHfSearch(engineId) {
  const eng = engineById(engineId);
  if (!eng) return;
  hfTarget = engineId;
  $id("hfcat-panel").hidden = false;
  $id("hfcat-results").innerHTML = "";
  $id("hfcat-note").textContent = `검색 대상 엔진: ${eng.name} — 결과에서 고르거나 아래에 직접 입력하세요`;
  $id("hfcat-q").focus();
}
async function hfSearch() {
  const q = $id("hfcat-q").value.trim();
  const note = $id("hfcat-note"), box = $id("hfcat-results");
  if (!hfTarget || !engineById(hfTarget)) { note.textContent = "먼저 엔진을 선택하세요"; return; }
  if (!q) { note.textContent = "검색어를 입력하세요"; return; }
  note.textContent = "Hugging Face 검색 중…"; box.innerHTML = "";
  try {
    const j = await hfJson(`https://huggingface.co/api/models?search=${encodeURIComponent(q)}&sort=downloads&limit=24`);
    const hits = (Array.isArray(j) ? j : []).filter((r) => /(gguf|mlx)/i.test(r.id));
    if (!hits.length) { note.textContent = "GGUF·MLX 저장소 검색 결과가 없습니다"; return; }
    note.textContent = `검색 결과 ${hits.length}개 — 저장소를 누르면 quant·크기를 읽습니다`;
    box.innerHTML = hits.map((r) => `<div class="hfcat-repo" data-repo="${esc(r.id)}"><span>${esc(r.id)}</span>`
      + `<span class="muted small">${(Number(r.downloads) || 0).toLocaleString()} DL</span></div>`).join("");
    for (const el of box.querySelectorAll(".hfcat-repo")) el.onclick = () => hfPickRepo(el.dataset.repo);
  } catch (e) { note.textContent = `검색 실패: ${e.message}`; }
}
async function hfPickRepo(repoId) {
  const note = $id("hfcat-note"), box = $id("hfcat-results");
  note.textContent = "저장소 읽는 중…";
  try {
    const models = await hfRepoModels(repoId);
    note.textContent = `${repoId} — quant을 누르면 엔진에 추가됩니다`;
    box.insertAdjacentHTML("beforeend", `<div class="hfcat-quants">`
      + models.map((m, i) => `<button type="button" class="hfcat-q" data-i="${i}">${esc(m.quant)} · ${m.download_gb} GB</button>`).join("")
      + `</div>`);
    const list = box.querySelectorAll(".hfcat-quants");
    for (const b of list[list.length - 1].querySelectorAll(".hfcat-q")) {
      b.onclick = () => addCatalogModel(hfTarget, models[Number(b.dataset.i)]);
    }
  } catch (e) { note.textContent = `저장소 실패: ${e.message}`; }
}
// 엔진의 카탈로그 저장분에 모델을 추가한다 (같은 name+quant는 새 값으로 교체, 자동 선택)
function addCatalogModel(engineId, m) {
  const note = $id("hfcat-note");
  if (!engineId || !engineById(engineId)) return;
  const c = S.catalog[engineId] || (S.catalog[engineId] = { ts: Date.now(), replace: false, models: [] });
  c.models = c.models.filter((x) => !(x.name === m.name && x.quant === m.quant));
  c.models.push(m);
  c.ts = Date.now();
  store.set("catalog", S.catalog);
  if (S.engine !== engineId) { S.engine = engineId; store.set("engine", engineId); }
  S.modelSel = { name: m.name, quant: m.quant };        // 추가한 모델·양자화가 바로 선택된 상태로 렌더
  renderEngines(); renderModels();
  note.textContent = `추가됨: ${m.name} ${m.quant || ""} (${m.download_gb} GB) — ${engineById(engineId).name} 목록에 반영`;
}
function hfManualAdd() {
  const name = $id("hfcat-m-name").value.trim(), quant = $id("hfcat-m-quant").value.trim();
  const gb = Number($id("hfcat-m-gb").value);
  if (!hfTarget || !engineById(hfTarget)) { $id("hfcat-note").textContent = "먼저 엔진을 선택하세요"; return; }
  if (!name || !(gb > 0)) { $id("hfcat-note").textContent = "모델명과 크기(GB)를 입력하세요"; return; }
  addCatalogModel(hfTarget, { name, quant, download_gb: gb, approx: true,
                              dense_design: /[-\s]A\d+(\.\d+)?[BM]\b/i.test(name) ? undefined : true });
  $id("hfcat-m-name").value = $id("hfcat-m-quant").value = $id("hfcat-m-gb").value = "";
}

// ---------------------------------------------------------------- 가상 스펙 지정 (3-1 버튼)
function fillVirtForm() {
  $id("virt-os").value = S.virt.os || "windows";
  $id("virt-gpu").value = S.virt.gpu || "";
  $id("virt-mem").value = S.virt.mem || (S.virt.unified ? "unified" : "auto");
  $id("virt-vram").value = S.virt.vram || 24;
  $id("virt-ram").value = S.virt.ram || 64;
  $id("virt-egpu-gpu").value = (S.virt.egpu && S.virt.egpu.gpu) || "";
  $id("virt-egpu-vram").value = (S.virt.egpu && S.virt.egpu.vram) || "";
  virtMemToggled();
}
// 메모리 유형 선택/입력에 따른 즉시 반응: 필드 전환 + 감지 결과 표시 + 경고 표시(적용 전 미리보기)
function virtMemToggled() {
  const sel = $id("virt-mem").value;
  const fam = unifiedFamily($id("virt-gpu").value);
  const uni = sel === "unified" || (sel === "auto" && !!fam);
  $id("virt-vram-wrap").hidden = uni;
  $id("virt-egpu-wrap").hidden = !uni;                   // 외부 카드는 통합 RAM 하드웨어에서만 지정 가능
  $id("virt-ram-label").textContent = uni ? "통합 RAM (GB)" : "RAM (GB)";
  const hasName = $id("virt-gpu").value.trim().length > 0;
  $id("virt-mem-detected").textContent = (!hasName || (!fam && sel === "unified")) ? "" : memDetectText(fam);
  updateUnifiedWarn({ any: uni, fam, manual: sel === "unified" && !fam,
                      egpu: { gpu: $id("virt-egpu-gpu").value.trim(), vram: Number($id("virt-egpu-vram").value) || 0 } });
}
function applyVirt() {
  const mem = $id("virt-mem").value;
  S.virt = { on: true, os: $id("virt-os").value, gpu: $id("virt-gpu").value.trim(),
             vram: Number($id("virt-vram").value) || 24, ram: Number($id("virt-ram").value) || 64, mem,
             egpu: { gpu: $id("virt-egpu-gpu").value.trim(), vram: Number($id("virt-egpu-vram").value) || 0 } };
  store.set("virt", S.virt);
  if (curUnifiedAny()) {
    const g = curUnifiedGb();
    S.uram = UNIFIED_CHOICES.slice().reverse().find((x) => x <= (g || 32)) || 32;
    store.set("uram", S.uram);
  }
  if (curExternal()) {                                  // 외부 카드 VRAM 프로필을 카드 용량에 맞춰 초기화
    const g = curEgpu().vram;
    S.vram = VRAM_CHOICES.slice().reverse().find((x) => x <= g) || VRAM_CHOICES[0];
    store.set("vram", S.vram);
  }
  renderHw(); renderEngines(); renderProfile(); renderPredict();
}
function realSpecs() {
  S.virt.on = false; store.set("virt", S.virt);
  renderHw(); renderEngines(); renderProfile(); renderPredict();
}

// ---------------------------------------------------------------- 연결
document.addEventListener("DOMContentLoaded", () => {
  renderHw(); fillVirtForm();
  if (!engineById(S.engine)) S.engine = BUILT_IN[0].id;
  renderEngines(); renderModels(); renderProfile(); applyGating();

  $id("hw-confirm-btn").onclick = () => {
    const v = Number($id("hw-vram").value), r = Number($id("hw-ram").value);
    if (!S.virt.on) {
      S.hw = { vram: v > 0 ? v : null, ram: r > 0 ? r : null,
               egpu: { gpu: $id("hw-egpu-gpu").value.trim(), vram: Number($id("hw-egpu-vram").value) || 0 } };
      store.set("hw", S.hw);
    }
    S.hwConfirmed = true; store.set("hwConfirmed", true);
    applyGating(); renderHw(); renderEngines(); renderPredict();
    $id("step-engine").scrollIntoView({ behavior: "smooth", block: "start" });
  };
  $id("virt-toggle-btn").onclick = () => {
    const panel = $id("virt-panel");
    panel.hidden = !panel.hidden;
    if (!panel.hidden) fillVirtForm();
    else updateUnifiedWarn();                             // 닫을 때 미적용 미리보기 경고는 버리고 적용 스펙 기준으로 복원
  };
  $id("virt-apply-btn").onclick = applyVirt;
  $id("virt-real-btn").onclick = realSpecs;
  $id("virt-mem").onchange = virtMemToggled;
  $id("virt-gpu").oninput = () => {                       // GB10·Apple M 등 알려진 통합 이름은 자동 감지
    if (unifiedFamily($id("virt-gpu").value)) $id("virt-mem").value = "auto";
    virtMemToggled();
  };
  $id("virt-egpu-gpu").oninput = virtMemToggled;          // 외부 카드 입력도 미리보기에 즉시 반영
  $id("virt-egpu-vram").oninput = virtMemToggled;

  $id("model-name").onchange = () => { S.modelSel = { name: $id("model-name").value, quant: null }; renderModels(); };
  $id("model-quant").onchange = () => { if (S.modelSel) { S.modelSel.quant = $id("model-quant").value; store.set("modelSel", S.modelSel); renderPredict(); } };
  $id("res-full-btn").onclick = () => fitPreset(1);
  $id("res-keep20-btn").onclick = () => fitPreset(0.8);
  $id("engine-add-btn").onclick = addEngineFromUrl;
  $id("engine-url").onkeydown = (e) => { if (e.key === "Enter") addEngineFromUrl(); };
  $id("engine-format-btn").onclick = () => { const p = $id("engine-format"); p.hidden = !p.hidden; };
  $id("hfcat-search-btn").onclick = hfSearch;
  $id("hfcat-q").onkeydown = (e) => { if (e.key === "Enter") hfSearch(); };
  $id("hfcat-m-add-btn").onclick = hfManualAdd;
  for (const [id, key] of [["hw-vram", "vram"], ["hw-ram", "ram"]]) {
    $id(id).onchange = () => { S.hw[key] = Number($id(id).value) || null; store.set("hw", S.hw); renderHw(); renderEngines(); renderPredict(); };
  }
  $id("hw-egpu-gpu").onchange = $id("hw-egpu-vram").onchange = () => {   // 실기기 통합 RAM에서 외부 카드 지정/해제
    S.hw.egpu = { gpu: $id("hw-egpu-gpu").value.trim(), vram: Number($id("hw-egpu-vram").value) || 0 };
    store.set("hw", S.hw);
    renderHw(); renderEngines(); renderProfile(); renderPredict();
  };
});
