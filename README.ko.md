# 모델 실험실 (standalone) — 메모리 배치 예상 앱

**English:** [README.md](README.md)

4gbVramStrata 실험실의 **예상 계산만** 따로 떼낸 단일 페이지 앱입니다.
**어떤 모델도 다운로드하거나 실행하지 않으며, 모든 수치는 공개된 크기 표와 프로필 가정으로
계산한 참고값(예상)입니다.** 판단의 용도로만 사용하세요.

## 실행 방법

`index.html`을 더블클릭하면 됩니다 (다른 웹 앱 불필요, 인터넷 연결도 선택 사항).
엔진을 URL로 추가할 때만 그 URL에 접근할 수 있어야 합니다(CORS 허용 필요 — GitHub raw는 허용).

## 진행 순서 (1 → 2 → 3 → 4)

앱이 순서대로 잠금 해제됩니다. 앞 단계를 확인해야 다음 단계가 열립니다.

1. **이 컴퓨터의 실제 스펙 확인 (3-1)**
   OS · GPU 이름(WebGL) · VRAM 추정 · RAM · 코어 수를 보여줍니다. 브라우저는 VRAM/RAM 총량을
   정확히 알 수 없어 **직접 수정**할 수 있고(이 브라우저에 저장), 확인 버튼을 누르면 아래 단계가 열립니다.
   - GPU 이름이 통합 RAM 계열(GB10/DGX Spark · Apple Silicon · Ryzen AI Max+ 등)로 감지되면
     `메모리 유형: 통합 RAM` 행이 뜨고 VRAM 입력창은 사라집니다(RAM 자리가 곧 메모리 총량).
      이 상태에서는 3단계의 **VRAM/DRAM 프로필 선택이 모두 꺼지고 통합 RAM 풀만** 선택합니다.
    - **외부 그래픽카드(eGPU)**: 통합 RAM 하드웨어에 외장 카드를 얹는 구성(Thunderbolt 독 등)은
      `외부 그래픽카드(이름) + 외부 VRAM(GB)`을 입력하면 됩니다(실기기 입력란 또는 가상 스펙 패널).
      지정하면 **VRAM만 별도로 활성화**되고(VRAM 프로필 = 외부 카드), DRAM 계층은 계속 통합 RAM이 대신합니다.
      해제하면 다시 VRAM 선택이 꺼집니다.
   - **가상 스펙 지정…**: OS(Windows/Linux/macOS) · GPU 이름 · **메모리 유형(자동/분리형/통합 RAM)** ·
     VRAM · RAM을 임의로 정해 **다른 컴퓨터를 실험**할 수 있습니다. GPU에 `GB10`·`Apple M4 Max` 같은
     이름을 넣으면 **메모리 유형 선택 옆에 초록 글로 감지 결과가 즉시 표시**되고(`감지됨: 통합 RAM — GB10(DGX Spark) 계열` 등) 적용 전에도 경고문이 미리 뜹니다. 감지 대상: GB10/DGX Spark · Apple(접두 없는 `M4 Max` 포함) · AI Max+/Strix Halo · 라데온 M 시리즈 내장 · Intel UHD/Iris/Arc 내장 · Snapdragon X/Adreno. 이름을 못 읽으면 `GPU 이름에서 감지된 계열 없음`으로 표시되고 분리형으로 취급됩니다.
     적용 중에는 헤더에 `가상 모드` 배지가 뜨고, 엔진·모델 지원 표시도 이 가상 스펙 기준이 됩니다.
     `실제 스펙으로 돌아가기`로 해제.

   **통합 RAM 경고(즉시 표시)**: 통합 RAM 하드웨어를 고르면 바로 노란 경고문이 뜹니다 —
   VRAM/RAM 분리가 아니라 하나의 메모리를 함께 쓰는 점, AI 연산 지원이 분리형 카드보다 까다로운 점을 알리고,
   - GB10(DGX Spark) · Apple Silicon · AMD AI Max+(Strix Halo)는 **알려진 계열**이라 엔진 공개 지원 목록과 대조 가능,
   - 그 밖의 내장 그래픽(라데온 680M/780M 미니 PC 등)이나 직접 선택한 미확인 계열은
     **"사용자 본인이 반드시 별도로 확인"**해야 한다고 명확히 적습니다.

2. **엔진 선택 (3-2)** — 고른 엔진이 현재 스펙에서 지원될 가능성이 높은지 **공개 문서(모델 카드) 기준으로 예상**해 표시합니다
   (모델 카드를 기본으로 한 예상치이며, 실제 작동을 보장하는 것은 아닙니다):
   - 내장 12엔진 — **계층화 메모리 MoE 지원 엔진**(Strata · PolyStrata · 4gbVramStrata · Project Maya · Basalt · Sync-Strata)과 **일반 로드 엔진**(YASAKANI · TensorFold · Bonsai(PrismML) · Ollama · Unsloth(Studio·GGUF) · LM Studio)으로 그룹 분리 — 목록에 그룹 헤더 표시
   - **라이브 카탈로그(Unsloth · LM Studio)**: 엔진을 선택하면 Hugging Face 다운로드순 상위 30개 저장소를 읽어 quant별 실파일 크기로 자동 로드된다(오프라인·실패 시 최신세대 기본 목록 사용). `최신화`로 재조회, `카탈로그 지우기`로 기본 목록 복귀. **모델 검색·추가**는 세 런타임 모두에서 HF 저장소를 검색 → quant 칩(실제 크기) 클릭으로 추가하거나 모델명·크기를 직접 입력할 수 있다(추가분은 이 브라우저에 저장, 이름에 AxxB 표기가 없으면 조밀(dense)로 예상). **Ollama은 ollama.com이 브라우저 접근(CORS)을 막아 카탈로그 버튼이 없고** 목록은 공개 라이브러리 대표값(~)이며 검색·직접 입력으로 보충한다
     (각 저장소 README의 공개 지원 범위·크기 표 사용. 예: Basalt는 Blackwell/GB10 전용이라 RTX 3070에서 `GPU 확인 필요`,
     macOS 가상 스펙에서는 Windows/Linux 전용 엔진이 `OS 미지원`으로 빨갛게 뜸)
   - 그 아래 **직접 엔진 추가 (URL 방식)**: 모델 목록 JSON URL을 넣으면 엔진 등록. 서버·설치 불필요로
     **fetch 한 번만으로 동작**하는지 실검증 완료(CORS를 허용하는 URL이면 됨 — GitHub raw 허용).
     추가한 엔진에는 **`최신화` 버튼**이 있어 같은 URL을 다시 받아 **그 시점의 지원 모델 목록**으로 갱신합니다(·삭제 가능).

3. **모델 선택 · 프로필 (3-3)** — 모델과 양자화를 두 드롭다운으로 분리(모델 이름 → 그 모델의 quant별 크기), 선택하면
   `모델 예상: OS / VRAM / DRAM` 배지로 공개 문서를 기반으로 한 예상치를 보여줍니다(실제 작동을 보장하는 것은 아님).
   VRAM 4~32 · DRAM 8~128 · 컨텍스트 8K~1M 프로필은 이 컴퓨터 한계를 넘어도 선택 가능
   (그럴 때는 `이 컴퓨터의 한계를 넘는 설정입니다` 배지).
   **통합 RAM 하드웨어에서는** VRAM/DRAM 알약 대신 **통합 RAM 8~192 GB 단일 풀 알약**으로 바뀝니다.

4. **예상 측정값 — 3단 계층** — VRAM 행 뒤에는 카드 총량과 사용률(`카드 총량 8 GB (75% 사용)`),
   DRAM 행 뒤에는 RAM 총량과 사용률, SSD 행에는 파일 안 비중(`파일의 52%`)이 따라옵니다.

   3단계 프로필에는 추가로:
    - **자원 프리셋**: `전체 자원 사용` / `일상 작업용 자원 20% 남김` 버튼이 실측(또는 가상) 스펙에
      들어가는 가장 큰 VRAM/DRAM 프로필을 골라 줍니다. 엔진에 따라 이 제한을 지원하거나 무시할 수
      있다는 경고문이 붙어 있습니다.
    - **권장 컨텍스트 ★**: 선택한 컴퓨터·엔진·모델 프로필에서 누수 없이 들어가는 가장 큰 컨텍스트
      알약에 ★이 뜨고, 아래에 평문으로 이유를 적습니다(로드만 되는 가장 큰 크기가 대안인 경우 포함).

## 언어 5종 버튼

헤더의 `한국어 / 日本語 / 繁體中文 / 简体中文 / English` 버튼으로 화면 전체가 즉시 전환됩니다
(`i18n.js`, 한국어 원문 키 ~235행 × 4언어, 선택은 `localStorage` `labapp.lang`에 저장).
모델명·단위(MiB/GB)·GPU 이름은 원형 보존이고, 앱은 항상 한국어로 렌더한 뒤 표시 단계에서만 번역합니다.

## 3단 계층 모델 (누수 정의)

MoE 엔진의 설계된 메모리 계층을 그대로 반영합니다:

| 계층 | 내용 | 넘치면 |
|---|---|---|
| **VRAM** | 활성 전문가 + 콘텍스트(어텐션 캐시) + 밀집 가중치 | DRAM으로 나가 답변 중 PCIe 재읽기 → **누수** |
| **DRAM** | 비활성 전문가(항상 대기) | SSD에서 재읽기 → **누수** |
| **SSD** | N-gram 임베딩·룩업 테이블 (Qwen3.8 ~29 GB, Hy4 Engram 67.6/63.4 GB 등) | 설계대로 놓는 자리 — **누수가 아님(보라색)** |

즉 원래부터 DRAM에 넣도록 만든 모델(DeepSeek V4 Flash, GLM 5.3 Flash, Maya 계열)이나
SSD 테이블을 둔는 설계(Strata/Hy4 Engram)는 초록·보라로 정상 표시되고,
**계층이 자기 자리를 초과할 때만** 빨간 누수로 표시됩니다.

**통합 RAM 하드웨어(GB10 · Apple Silicon · AI Max · 내장 그래픽 미니 PC 등)**에서는 VRAM/DRAM 경계가 없으므로
두 행이 `통합 RAM · 활성 전문가+콘텍스트` / `통합 RAM · 비활성 전문가` 하나의 풀로 표시되고,
PCIe 누수 없이 **풀을 넘치는 분량만 바로 파일 재읽기**로 계산됩니다(`초과(파일 재읽기)` 행).

## 계산 기준 (serve/lab.py predict()와 동일 산식)

- 카드에서 예약 256 MiB · 밀집 가중치 · 고정 오버헤드 512 MiB · 어텐션 캐시(row_bytes × 토큰 수)를 뺀 자리가 활성 전문가 자리
- 활성 전문가 = 전문가 합계 × 활성 비율(패밀리별 공개 값: GLM-5.3-Flash 18B/321B≈5.6%, Hy4 A12B/220B≈5.5%, Qwen3.8 ~8B/125B≈6.4% 등, 미공개 패밀리 기본 8%)
- RAM 예산 = DRAM − OS 보관 3,584 MiB − 대화 캐시(최대 8 GiB)
- N-gram 테이블은 전문가 합계에서 미리 빼 SSD 계층으로 배치 (`~` 표시는 근사값)

## 엔진 JSON 형식 (URL 방식)

```json
{
  "name": "내 엔진",
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

- `download_gb` 필수(없으면 그 모델은 예상 불가).
- `row_bytes`(컨텍스트 1토큰 KV 캐시), `floor_gb`(전문가 전에 카드가 쓰는 GB)가 있으면 정확도가 올라갑니다.
- `active_ratio`(활성 전문가 비율), `ngram_gb`(SSD 상주 N-gram 테이블), `dense: true`(MoE 계층 없음),
  `min_vram_gb`(권장 카드)로 계층 모델을 맞춥니다.
- `tiered: true`를 넣으면 '계층화 메모리 MoE 지원' 그룹에 등록됩니다(생략 시 일반 로드 엔진 그룹).
- `engines/example-custom-engine.json`이 동작하는 예제입니다.
  이 폴더에서 `python -m http.server 8090` 실행 후
  `http://127.0.0.1:8090/engines/example-custom-engine.json`을 넣어 보세요.
- URL 추가는 **fetch 한 번만으로 동작**(AI 연산·서버 불필요)하며, 추가된 엔진의
  **`최신화`** 버튼을 누르면 같은 URL을 다시 받아 그 시점의 모델 목록·지원 정보로 갱신됩니다(`updated` 시각 기록).

## 데이터 출처 (모두 공개 문서, ~는 근사값)

- 4gbVramStrata: 4gbVramStrata 프로젝트 `setup.py` FAMILIES (정확한 크기 표)
- Strata / PolyStrata: README·docs/MODELS.md의 다운로드·메모리 표
- Project Maya: GLM/DeepSeek/MiniMax/Hy4 quant 표 (Maya-S 96.5 GB 등, Hy4 +n-gram 63.4)
- Basalt: docs/models·model-file.md (Hy4 NVFP4 팩 158.7 = 전문가 83.6 + Engram 63.4, Qwen3.8-27B QUASAR 19.7 등)
- YASAKANI: README 모델 표 (fastest 10.31 / quality 12.37 / max-quality 15.72, Inkling 변환본 15.9)
- Sync-Strata: README (Sync-XS 24 / S 28 / M 35 + 공용 부품 ~35 GB, RTX 30/40 검증)
- TensorFold: docs/supported-models.md (Qwen3.6 20.9, Nemotron 표, GLM은 듀얼 GB10/M5 Ultra 요구 등)
- Bonsai: README (Bonsai 2.5 27B PQ2_0 7.6 / PTQ1_0 6.4, KV 64 KiB/토큰; 2B~9B 크기는 추정치)
- Ollama · Unsloth · LM Studio: 기본 목록은 각 공개 라이브러리·카탈로그의 대표 태그 크기(~근사값)이며, 라이브 카탈로그·검색 기능은 Hugging Face 저장소의 quant별 실파일 크기를 직접 읽는다 — 일반 로드 런타임이라 전문가 계층 배지가 아니라 총량 기준 예상만 제공

## 파일

- `index.html` — 4단계 흐름 · 경고 문구(상단 배너/하단 재안내, "예상치일 뿐 실제 작동을 보장하지 않음" 명시) · 통합 RAM 경고 · 언어 버튼
- `style.css` — 다크 테마 · 계층 색상(VRAM 초록, RAM 파랑, SSD 보라, 누수 빨강 빗살) · 통합 RAM 경고 박스
- `i18n.js` — 표시 전용 번역 계층(한국어 원문 키 + 4언어, MutationObserver, 언어 저장)
- `app.js` — 장비 확인·가상 스펙(통합 RAM 감지/지정 포함), 엔진 지원 예상, URL 엔진 추가·최신화, 계층 예측(lab.py 이식), 자원 프리셋, 권장 컨텍스트 ★, 렌더
- `engines/example-custom-engine.json` — URL 방식 예제
- `LICENSE` — MIT 라이선스 · `.gitignore`
