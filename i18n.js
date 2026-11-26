// 모델 실험실 (standalone) i18n — 한국어/日本語/繁體中文/简体中文/English.
// 앱의 모든 문자열은 한국어로 쓰고, 이 파일이 DOM에 표시되는 텍스트만 번역한다 (4gbVramStrata 웹과 같은 방식).
// 키 = 한국어 원문(공백 정규화 후 전체 일치). 키 안의 # = 숫자 덩어리, @ = 임의 조각 — 값에서 $1..$9 또는 순서대로 #/@.
// MutationObserver가 앱이 나중에 렌더하는 노드도 번역하고, WeakMap에 원문을 보관해 언어를 돌려도 복원된다.
(() => {
  "use strict";

  const STORE = "labapp.lang";
  const NAMES = [["ko", "한국어"], ["en", "English"], ["ja", "日本語"], ["zh-TW", "繁體中文"], ["zh-CN", "简体中文"]];

  // [한국어, English, 日本語, 繁體中文, 简体中文] — 화면에 보여주는 문자열 한 줄당 하나.
  const TABLE = [
    // ---- 헤더·경고·면책
    ["모델 실험실 — 메모리 예상 (예상 전용)", "Model Lab — memory estimates (estimates only)", "モデルラボ — メモリ予想（推定専用）", "模型實驗室 — 記憶體預估（僅供預估）", "模型实验室 — 内存预估（仅供预估）"],
    ["모델 실험실", "Model Lab", "モデルラボ", "模型實驗室", "模型实验室"],
    ["⚠ 예상 전용 — 참고용으로만 사용하세요", "⚠ Estimates only — for reference only", "⚠ 推定専用 — 参考用としてのみ使用してください", "⚠ 僅供預估 — 僅供參考使用", "⚠ 仅供预估 — 仅作参考使用"],
    ["이 앱은 다운로드도 실행도 하지 않습니다.", "This app neither downloads nor runs anything.", "このアプリはダウンロードも実行もしません。", "本應用不會下載也不會執行任何東西。", "本应用不会下载也不会运行任何东西。"],
    ["아래 모든 수치는 각 엔진의 공개된 크기 표와 선택한 프로필(가상 VRAM · DRAM · 컨텍스트)로 계산한 예상값입니다.",
      "Every number below is an estimate computed from each engine's published size table and the selected profile (virtual VRAM · DRAM · context).",
      "以下のすべての数値は、各エンジンの公開サイズ表と選択したプロファイル(仮想VRAM・DRAM・コンテキスト)から計算した推定値です。",
      "下方所有數值都是依各引擎公開大小表與所選設定檔（虛擬 VRAM・DRAM・上下文）計算的預估。",
      "下方所有数值均按各引擎公开大小表与所选配置档（虚拟 VRAM・DRAM・上下文）计算的预估。"],
    ["실제 설치·측정 결과와 다를 수 있으며, 판단의 참고만으로 사용하세요. 아무 모델도 이 컴퓨터에 받아지지 않습니다.",
      "Real install and measurement results may differ; use them as reference only. No model is brought onto this computer.",
      "実際のインストール・計測結果とは異なることがあるため、判断の参考としてのみ使用してください。モデルはこのコンピュータに一切ダウンロードされません。",
      "實際安裝與量測結果可能不同，請僅作為判斷參考。不會有任何模型下載到這台電腦。",
      "实际安装与测量结果可能不同，请仅作参考使用。不会有任何模型下载到这台电脑。"],
    ["이 화면의 모든 결과는 예상치일 뿐이며, 실제 작동을 보장하지 않습니다.",
      "All results on this screen are estimates only — they do not guarantee that anything will actually work.",
      "この画面のすべての結果は推定値に過ぎず、実際の動作を保証するものではありません。",
      "畫面上的所有結果僅為預估，並不保證實際能夠運作。",
      "本画面的所有结果只是预估，并不保证实际可以运行。"],
    // ---- 1단계
    ["이 컴퓨터의 실제 스펙 확인", "This computer's actual specs", "このコンピュータの実スペック確認", "確認這台電腦的實際規格", "确认这台电脑的实际规格"],
    ["OS · GPU · RAM을 확인합니다.", "Checks OS · GPU · RAM.", "OS・GPU・RAMを確認します。", "檢查 OS・GPU・RAM。", "检查 OS・GPU・RAM。"],
    ["브라우저는 GPU 이름과 코어 개수만 정확히 알 수 있고, VRAM·RAM 총량은 제한 때문에 모자라게 보고될 수 있어 직접 확인해 고칠 수 있게 두었습니다 (Windows 작업 관리자 참고).",
      "A browser can only know the GPU name and core count exactly; total VRAM/RAM may be under-reported due to limits, so you can check and correct it yourself (see Windows Task Manager).",
      "ブラウザはGPU名とコア数しか正確には把握できず、VRAM・RAMの総量は制限のため少なく報告されることがあるため、直接確認して修正できるようにしています（Windowsタスクマネージャー参照）。",
      "瀏覽器只能確切知道 GPU 名稱與核心數，VRAM・RAM 總量可能因限制而少報，因此可自行確認並修改（參考 Windows 工作管理員）。",
      "浏览器只能准确获知 GPU 名称与核心数，VRAM・RAM 总量可能因限制而少报，故可自行确认并修改（参考 Windows 任务管理器）。"],
    ["다른 스펙으로 실험하려면 가상 스펙 지정을 쓰세요.", "To experiment with other specs, use Set virtual specs.", "別のスペックで実験するには「仮想スペック指定」を使ってください。", "若要以其他規格實驗，請使用「虛擬規格指定」。", "若想以其他规格实验，请使用「虚拟规格指定」。"],
    ["시스템 RAM (GB)", "System RAM (GB)", "システムRAM (GB)", "系統 RAM (GB)", "系统 RAM (GB)"],
    ["수정하면 이 브라우저에 저장되고, 아래의 엔진·모델 확인 기준이 됩니다.",
      "Changes are saved in this browser and become the basis for the engine/model checks below.",
      "変更はこのブラウザに保存され、下のエンジン・モデル確認の基準になります。",
      "修改會儲存在此瀏覽器中，並成為下方引擎・模型檢查的依據。",
      "修改会保存在此浏览器中，并成为下方引擎・模型检查的依据。"],
    ["이 스펙으로 확인", "Confirm with these specs", "このスペックで確認", "以此規格確認", "以此规格确认"],
    ["✓ 확인됨 — 다시 확인", "✓ Confirmed — check again", "✓ 確認済み — 再確認", "✓ 已確認 — 再次確認", "✓ 已确认 — 再次确认"],
    ["가상 스펙 지정…", "Set virtual specs…", "仮想スペック指定…", "虛擬規格指定…", "虚拟规格指定…"],
    ["가상 스펙 지정 (다른 컴퓨터를 실험해 봅니다)", "Set virtual specs (experiment with another computer)", "仮想スペック指定（別のコンピュータを想定して実験）", "虛擬規格指定（模擬另一台電腦）", "虚拟规格指定（模拟另一台电脑）"],
    ["GPU 이름", "GPU name", "GPU名", "GPU 名稱", "GPU 名称"],
    ["가상 스펙 적용", "Apply virtual specs", "仮想スペックを適用", "套用虛擬規格", "应用虚拟规格"],
    ["실제 스펙으로 돌아가기", "Back to real specs", "実スペックに戻す", "回到實際規格", "返回实际规格"],
    ["확인된 기준:", "Confirmed basis:", "確認済み基準:", "已確認基準:", "已确认基准:"],
    ["가상 모드", "Virtual mode", "仮想モード", "虛擬模式", "虚拟模式"],
    ["실제 확인", "Real check", "実機確認", "實際確認", "实际确认"],
    ["OS(가상)", "OS (virtual)", "OS(仮想)", "OS（虛擬）", "OS（虚拟）"],
    ["GPU(가상)", "GPU (virtual)", "GPU(仮想)", "GPU（虛擬）", "GPU（虚拟）"],
    ["VRAM(가상)", "VRAM (virtual)", "VRAM(仮想)", "VRAM（虛擬）", "VRAM（虚拟）"],
    ["RAM(가상)", "RAM (virtual)", "RAM(仮想)", "RAM（虛擬）", "RAM（虚拟）"],
    ["실제 확인값", "Real readings", "実機確認値", "實際確認值", "实际确认值"],
    ["GPU(WebGL 확인)", "GPU (WebGL check)", "GPU(WebGL確認)", "GPU（WebGL 檢查）", "GPU（WebGL 检查）"],
    ["확인 불가", "Not detectable", "確認不可", "無法確認", "无法确认"],
    ["VRAM(이름으로 추정)", "VRAM (guessed from name)", "VRAM(名前からの推定)", "VRAM（依名稱推估）", "VRAM（依名称推算）"],
    ["추정 불가 — 아래에서 직접 입력", "Not guessable — enter it below", "推定不可 — 下で直接入力", "無法推估 — 請在下方直接輸入", "无法推算 — 请在下方直接输入"],
    ["확인 불가 — 아래에서 직접 입력", "Not detectable — enter it below", "確認不可 — 下で直接入力", "無法確認 — 請在下方直接輸入", "无法确认 — 请在下方直接输入"],
    ["CPU 코어(스레드)", "CPU cores (threads)", "CPUコア(スレッド)", "CPU 核心（執行緒）", "CPU 核心（线程）"],
    ["(이름 없음)", "(no name)", "(名前なし)", "（無名稱）", "（无名称）"],
    ["GPU @ · VRAM 추정 # GB · RAM # GB", "GPU $1 · VRAM est. $2 GB · RAM $3 GB", "GPU $1 ・ VRAM推定 $2 GB ・ RAM $3 GB", "GPU $1 ・ VRAM 推估 $2 GB ・ RAM $3 GB", "GPU $1 ・ VRAM 推算 $2 GB ・ RAM $3 GB"],
    // ---- 2단계 엔진
    ["엔진 선택", "Choose an engine", "エンジン選択", "選擇引擎", "选择引擎"],
    ["🔒 1단계에서 스펙을 확인하면 열립니다.", "🔒 Opens once you confirm the specs in step 1.", "🔒 ステップ1でスペックを確認すると開きます。", "🔒 在第 1 步確認規格後開啟。", "🔒 在第 1 步确认规格后开启。"],
    ["🔒 2단계에서 엔진을 선택하면 열립니다.", "🔒 Opens once you pick an engine in step 2.", "🔒 ステップ2でエンジンを選ぶと開きます。", "🔒 在第 2 步選擇引擎後開啟。", "🔒 在第 2 步选择引擎后开启。"],
    ["엔진을 고르면 현재 스펙(OS/GPU/VRAM)에서 그 엔진이 지원될 가능성이 높은지 공개 문서(모델 카드) 기준으로 미리 예상해 표시합니다. 이 표시는 모델 카드를 기본으로 한 예상치이며, 실제 작동을 보장하는 것은 아닙니다.",
      "Pick an engine and it shows, from the engine's public docs (model card), whether it is likely supported on your current specs (OS/GPU/VRAM). This display is an estimate based on the model card — it does not guarantee that anything will actually work.",
      "エンジンを選ぶと、そのエンジンの公開文書(モデルカード)基準で、現在のスペック(OS/GPU/VRAM)でサポートされる可能性が高いかを予想して表示します。この表示はモデルカードに基づく推定であり、実際の動作を保証するものではありません。",
      "選擇引擎後，會依該引擎的公開文件（模型卡）預估它在您目前規格（OS/GPU/VRAM）下是否可能受支援並顯示。此顯示為以模型卡為基準的預估，並不保證實際能夠運作。",
      "选择引擎后，会按该引擎的公开文档（模型卡）预估它在您当前规格（OS/GPU/VRAM）下是否可能受支持并显示。此显示为基于模型卡的预估，并不保证实际能够运行。"],
    ["미지원으로 나와도 선택은 가능하지만, 예상 계산은 \"그 하드웨어라면\" 조건이 붙습니다.",
      "You can still select an unsupported engine, but the estimate then carries an \"if that were the hardware\" caveat.",
      "非対応でも選択はできますが、推定計算には「もしそのハードウェアなら」という条件が付きます。",
      "顯示不支援仍可選擇，但預估計算會加上「若該硬體成立」的前提。",
      "显示不支持仍可选择，但预估计算会加上“若该硬件成立”的前提。"],
    ["추가", "Add", "追加", "新增", "添加"],
    ["URL 방식: 아래 형식의 JSON을 아무 데나(예: GitHub raw) 올리고 주소만 넣으면 됩니다.",
      "URL method: host a JSON in the format below anywhere (e.g. GitHub raw) and just paste its address.",
      "URL方式：下の形式のJSONを任意の場所（GitHub rawなど）に置き、アドレスを入れるだけです。",
      "URL 方式：將下方格式的 JSON 放到任何地方（如 GitHub raw），貼上位址即可。",
      "URL 方式：将下方格式的 JSON 放到任意位置（如 GitHub raw），粘贴地址即可。"],
    ["형식 보기", "Show format", "形式を見る", "檢視格式", "查看格式"],
    ["직접 엔진 추가 — 모델 목록 JSON의 URL (예: https://example.com/engine.json)",
      "Add your own engine — URL of the model-list JSON (e.g. https://example.com/engine.json)",
      "エンジン追加 — モデル一覧JSONのURL（例: https://example.com/engine.json）",
      "自行新增引擎 — 模型清單 JSON 的 URL（例：https://example.com/engine.json）",
      "自行添加引擎 — 模型列表 JSON 的 URL（例：https://example.com/engine.json）"],
    ["(직접 추가)", "(added by you)", "(手動追加)", "（自行新增）", "（自行添加）"],
    ["모델 #개", "# models", "モデル#個", "模型 # 個", "模型 # 个"],
    ["직접 추가 엔진", "Custom engine", "手動追加エンジン", "自行新增引擎", "自行添加引擎"],
    ["지원 OS/GPU 정보 없음", "no OS/GPU support info", "サポートOS/GPU情報なし", "無支援 OS/GPU 資訊", "无支持 OS/GPU 信息"],
    ["http(s) URL을 넣으세요.", "Enter an http(s) URL.", "http(s) URLを入れてください。", "請輸入 http(s) URL。", "请输入 http(s) URL。"],
    ["불러오는 중…", "Loading…", "読み込み中…", "讀取中…", "读取中…"],
    ["추가됨: @ (#개 모델)", "Added: $1 ($2 models)", "追加しました: $1（$2モデル）", "已新增：$1（$2 個模型）", "已添加：$1（$2 个模型）"],
    ["실패: @ — URL이 https인지, CORS를 허용하는지 확인하세요 (GitHub raw는 허용함).",
      "Failed: $1 — check that the URL is https and allows CORS (GitHub raw does).",
      "失敗: $1 — URLがhttpsか、CORSを許可しているか確認してください（GitHub rawは許可されています）。",
      "失敗：$1 — 請確認 URL 為 https 且允許 CORS（GitHub raw 允許）。",
      "失败：$1 — 请确认 URL 为 https 且允许 CORS（GitHub raw 允许）。"],
    // ---- 3단계 모델·프로필
    ["모델 선택 · 프로필", "Model · profile", "モデル選択・プロファイル", "模型選擇・設定檔", "模型选择・配置档"],
    ["모델 (선택한 엔진이 지원하는 목록)", "Model (supported by the chosen engine)", "モデル（選択したエンジンがサポートする一覧）", "模型（所選引擎支援的清單）", "模型（所选引擎支持的列表）"],
    ["모델", "Model", "モデル", "模型", "模型"],
    ["이 엔진에는 모델 목록이 없습니다 — URL 방식으로 추가해 보세요", "This engine has no model list — try adding one by URL", "このエンジンにモデル一覧はありません — URL方式で追加してみてください", "這個引擎沒有模型清單 — 試試用 URL 方式新增", "这个引擎没有模型列表 — 试试用 URL 方式添加"],
    ["(크기 미공개)", "(size not published)", "(サイズ非公開)", "（未公開大小）", "（未公开大小）"],
    ["선택한 엔진이 지원하는 모델입니다 (공개 문서의 크기 표).", "Models the selected engine supports (sizes from public docs).", "選択したエンジンがサポートするモデルです（公開文書のサイズ表）。", "所選引擎支援的模型（大小來自公開文件）。", "所选引擎支持的模型（大小来自公开文档）。"],
    ["VRAM 프로필", "VRAM profile", "VRAMプロファイル", "VRAM 設定檔", "VRAM 配置档"],
    ["DRAM 프로필", "DRAM profile", "DRAMプロファイル", "DRAM 設定檔", "DRAM 設定档"],
    ["컨텍스트", "Context", "コンテキスト", "上下文", "上下文"],
    ["자원 프리셋", "Resource preset", "リソースプリセット", "資源預設", "资源预设"],
    ["전체 자원 사용", "Use all resources", "全リソース使用", "使用全部資源", "使用全部资源"],
    ["일상 작업용 자원 20% 남김", "Leave 20% for daily work", "日常作業用にリソースを20%残す", "為日常作業保留 20% 資源", "为日常工作保留 20% 资源"],
    ["이 기능은 엔진에 따라서 지원할 수도 있고 안 할 수도 있습니다 — 엔진이 이 제한을 무시할 수 있습니다.",
      "Engines may or may not support this feature — an engine can ignore these limits.",
      "この機能はエンジンによってサポートする場合としない場合があります — エンジンがこの制限を無視することがあります。",
      "此功能依引擎而異，可能支援也可能不支援 — 引擎可能會忽略這些限制。",
      "此功能视引擎而定，可能支持也可能不支持 — 引擎可能会忽略这些限制。"],
    ["권장 컨텍스트: @ — 이 프로필에서 누수 없이 들어가는 가장 큰 크기입니다",
      "Recommended context: $1 — the largest size that fits this profile without leaks",
      "推奨コンテキスト: $1 — このプロファイルで漏れなく収まる最大のサイズ",
      "建議上下文：$1 — 在此設定檔下不溢出可容納的最大長度",
      "推荐上下文：$1 — 在此配置档下不溢出可容纳的最大长度"],
    ["권장 컨텍스트: @ — 누수까지 피하지는 못하지만, 로드되는 가장 큰 크기입니다",
      "Recommended context: $1 — leaks cannot be avoided, but this is the largest size that loads",
      "推奨コンテキスト: $1 — 漏れは避けられませんが、ロードされる最大のサイズです",
      "建議上下文：$1 — 無法完全避免溢出，但這是可載入的最大長度",
      "推荐上下文：$1 — 无法完全避免溢出，但这是可加载的最大长度"],
    // ---- 4단계 예측
    ["예상 측정값 — 3단 계층", "Expected memory — 3-tier layout", "予想測定値 — 3層階層", "預估測量值 — 三層分級", "预估测量值 — 三层分级"],
    ["이 엔진·모델의 설계된 메모리 계층입니다:", "The designed memory tiers of this engine and model:", "このエンジン・モデルの設計されたメモリ階層です：", "這是此引擎與模型設計的記憶體分層：", "这是此引擎与模型设计的内存分层："],
    ["VRAM = 활성 전문가 + 콘텍스트", "VRAM = active experts + context", "VRAM = アクティブExpert + コンテキスト", "VRAM = 活躍專家模組 + 上下文", "VRAM = 活跃专家模块 + 上下文"],
    ["DRAM = 비활성 전문가(항상 대기)", "DRAM = inactive experts (always on standby)", "DRAM = 非アクティブExpert（常時待機）", "DRAM = 非活躍專家模組（隨時待命）", "DRAM = 非活跃专家模块（随时待命）"],
    ["SSD = N-gram 임베딩·테이블 (설계대로 놓는 곳, 누수 아님)", "SSD = N-gram embeddings & tables (placed here by design, not a leak)", "SSD = N-gram埋め込み・テーブル（設計上の配置場所で、漏れではない）", "SSD = N-gram 嵌入與表（依設計放置之處，非溢漏）", "SSD = N-gram 嵌入与表（按设计放置之处，非泄漏）"],
    ["어느 한 계층이 자기 자리를", "Only when a tier overflows its own space do we call it", "いずれかの階層が自分の場所を", "只有當某一分級超出自身空間時，", "只有当某个分级超出自身空间时，"],
    ["넘칠 때만", "overflows", "超えたときだけ", "超出時才", "超出时才"],
    ["누수", "leak", "漏れ", "溢漏", "泄漏"],
    ["(PCIe 재읽기 · 파일 재읽기)로 판단합니다.", "(re-reads over PCIe · re-reads from file).", "（PCIe再読み込み・ファイル再読み込み）と判定します。", "（PCIe 重讀・檔案重讀）。", "（PCIe 重读・文件重读）。"],
    ["VRAM(활성+밀집)", "VRAM (active+dense)", "VRAM(アクティブ+密)", "VRAM（活躍＋密集）", "VRAM（活跃＋稠密）"],
    ["콘텍스트 캐시", "Context cache", "コンテキストキャッシュ", "上下文快取", "上下文缓存"],
    ["RAM(비활성 대기)", "RAM (inactive standby)", "RAM(非アクティブ待機)", "RAM（非活躍待命）", "RAM（非活跃待命）"],
    ["SSD(N-gram 설계)", "SSD (N-gram by design)", "SSD(N-gram設計)", "SSD（N-gram 設計）", "SSD（N-gram 设计）"],
    ["누수(초과분)", "Leak (overflow)", "漏れ(超過分)", "溢漏（超出部分）", "泄漏（超出部分）"],
    ["계층별 바이트 분배", "Byte distribution by tier", "階層別のバイト配分", "各分級位元組分配", "各级字节分配"],
    // ---- 예측 행 라벨·값
    ["SSD의 파일", "File on SSD", "SSD上のファイル", "SSD 上的檔案", "SSD 上的文件"],
    ["밀집 가중치", "Dense weights", "密な重み", "密集權重", "稠密权重"],
    ["VRAM · 활성 전문가+콘텍스트", "VRAM · active experts + context", "VRAM・アクティブExpert+コンテキスト", "VRAM・活躍專家＋上下文", "VRAM・活跃专家＋上下文"],
    ["DRAM · 비활성 전문가", "DRAM · inactive experts", "DRAM・非アクティブExpert", "DRAM・非活躍專家", "DRAM・非活跃专家"],
    ["SSD · N-gram 테이블", "SSD · N-gram table", "SSD・N-gramテーブル", "SSD・N-gram 表", "SSD・N-gram 表"],
    ["초과(누수)", "Overflow (leak)", "超過(漏れ)", "超出（溢漏）", "超出（泄漏）"],
    ["@ (예상)", "$1 (estimate)", "$1（推定）", "$1（預估）", "$1（预估）"],
    ["미공개", "not published", "非公開", "未公開", "未公开"],
    ["계층 없음 — 전부 VRAM에 올라가는 설계", "No tiers — everything goes onto the card by design", "階層なし — 全てVRAMに載せる設計", "無分級 — 全部放上顯示卡的設計", "无分级 — 全部放入显卡的设计"],
    ["활성 ~# MiB (전문가의 #%) · 어텐션 캐시 @ · 카드 자리 ~# GB",
      "Active ~$1 MiB ($2% of experts) · attention cache $3 · card room ~$4 GB",
      "アクティブ約$1 MiB（Expertの$2%）・アテンションキャッシュ$3・カード上の場所 約$4 GB",
      "活躍約 $1 MiB（專家的 $2%）・注意力快取 $3・顯示卡空間約 $4 GB",
      "活跃约 $1 MiB（专家的 $2%）・注意力缓存 $3・显卡空间约 $4 GB"],
    ["~# MiB 대기 (RAM 자리 # GB)", "~$1 MiB on standby (RAM room $2 GB)", "~$1 MiB待機（RAM上の場所 $2 GB）", "~$1 MiB 待命（RAM 空間 $2 GB）", "~$1 MiB 待命（RAM 空间 $2 GB）"],
    ["없음", "none", "なし", "無", "无"],
    ["~# GB — 설계대로 SSD에 상주 (누수 아님)", "~$1 GB — resident on SSD by design (not a leak)", "~$1 GB — 設計通りSSDに常駐（漏れではない）", "~$1 GB — 依設計常駐於 SSD（非溢漏）", "~$1 GB — 按设计常驻于 SSD（非泄漏）"],
    ["없음 — 각 계층이 자기 자리 안에 들어갑니다", "none — every tier fits inside its designed home", "なし — 各階層とも自分の収まり内に収まります", "無 — 各分級都在自身空間之內", "无 — 各级都在自身空间之内"],
    ["PCIe # GB · SSD 재읽기 # GB", "PCIe $1 GB · SSD re-read $2 GB", "PCIe $1 GB・SSD再読み込み$2 GB", "PCIe $1 GB ・ SSD 重讀 $2 GB", "PCIe $1 GB ・ SSD 重读 $2 GB"],
    ["카드 총량 # GB (#% 사용)", "card total $1 GB ($2% used)", "カード総量 $1 GB（$2%使用）", "顯示卡總量 $1 GB（使用 $2%）", "显卡总量 $1 GB（使用 $2%）"],
    ["총량 # GB (#% 사용)", "total $1 GB ($2% used)", "総量 $1 GB（$2%使用）", "總量 $1 GB（使用 $2%）", "总量 $1 GB（使用 $2%）"],
    ["파일의 #%", "#% of the file", "ファイルの#%", "佔檔案的 #%", "占文件的 #%"],
    // ---- 예측 판정
    ["로드되지 않습니다: 밀집 가중치·고정 오버헤드·어텐션 캐시가 약 # GB 필요하지만, 이 프로필은 카드에 # GB만 제공합니다",
      "Will not load: dense weights, fixed overhead and attention caches need about $1 GB, but this profile gives the card only $2 GB",
      "ロードできません：密な重み・固定オーバーヘッド・アテンションキャッシュが約$1 GB必要ですが、このプロファイルはカードに$2 GBしか確保しません",
      "無法載入：密集權重、固定開銷與注意力快取約需 $1 GB，但此設定檔只提供顯示卡 $2 GB",
      "无法加载：稠密权重、固定开销与注意力缓存约需 $1 GB，但此配置档只为显卡保留 $2 GB"],
    ["이 프로필에서 로드됩니다", "Loads in this profile", "このプロファイルでロードされます", "可在此設定檔載入", "可在此配置档加载"],
    ["VRAM 계층 설계대로: 가중치가 모두 카드에 들어갑니다", "VRAM tier as designed: all weights fit on the card", "VRAM階層は設計通り：重みがすべてカードに収まります", "VRAM 分級符合設計：權重全部放入顯示卡", "VRAM 分级符合设计：权重全部放入显卡"],
    ["VRAM 계층 설계대로: 활성 전문가와 콘텍스트가 모두 카드에 들어갑니다",
      "VRAM tier as designed: active experts and context both fit on the card",
      "VRAM階層は設計通り：アクティブExpertとコンテキストがどちらもカードに収まります",
      "VRAM 分級符合設計：活躍專家與上下文都放入顯示卡",
      "VRAM 分级符合设计：活跃专家与上下文都放入显卡"],
    ["VRAM 계층 초과 → PCIe 누수: 카드에 못 들어간 가중치 # MiB(#%)를 답변 중에 DRAM에서 읽습니다",
      "VRAM tier overflow → PCIe leak: $1 MiB ($2%) of weights that missed the card are read from DRAM while answering",
      "VRAM階層超過 → PCIe漏れ：カードに入りきらなかった重み$1 MiB（$2%）を回答中にDRAMから読みます",
      "VRAM 分級超出 → PCIe 溢漏：未能進入顯示卡的權重 $1 MiB（$2%）將在回答時從 DRAM 讀取",
      "VRAM 分级超出 → PCIe 泄漏：未能进入显卡的权重 $1 MiB（$2%）将在回答时从 DRAM 读取"],
    ["VRAM 계층 초과 → PCIe 누수: 활성 전문가의 #%(# MiB)를 답변 중에 DRAM에서 읽습니다",
      "VRAM tier overflow → PCIe leak: $1% of active experts ($2 MiB) are read from DRAM while answering",
      "VRAM階層超過 → PCIe漏れ：アクティブExpertの$1%（$2 MiB）を回答中にDRAMから読みます",
      "VRAM 分級超出 → PCIe 溢漏：活躍專家的 $1%（$2 MiB）將在回答時從 DRAM 讀取",
      "VRAM 分级超出 → PCIe 泄漏：活跃专家的 $1%（$2 MiB）将在回答时从 DRAM 读取"],
    ["DRAM 대기 계층 없음", "No DRAM standby tier", "DRAM待機階層なし", "無 DRAM 待命分級", "无 DRAM 待命分级"],
    ["카드에 전부 올리는 설계입니다", "a put-everything-on-the-card design", "全てカードに載せる設計です", "為全部放上顯示卡的設計", "为全部放入显卡的设计"],
    ["비활성 전문가 없음: 이 모델은 DRAM 대기 계층이 없습니다", "No inactive experts: this model has no DRAM standby tier", "非アクティブExpertなし：このモデルにDRAM待機階層はありません", "無非活躍專家：此模型沒有 DRAM 待命分級", "无非活跃专家：此模型没有 DRAM 待命分级"],
    ["DRAM 계층 설계대로: 비활성 전문가 # GB가 RAM에 항상 대기합니다",
      "DRAM tier as designed: $1 GB of inactive experts always wait in RAM",
      "DRAM階層は設計通り：非アクティブExpert $1 GBが常にRAMで待機します",
      "DRAM 分級符合設計：$1 GB 的非活躍專家隨時待命於 RAM",
      "DRAM 分级符合设计：$1 GB 的非活跃专家随时待命于 RAM"],
    ["DRAM 계층 초과 → SSD 재읽기 누수: 약 # MiB를 답변 중에 파일에서 다시 읽습니다",
      "DRAM tier overflow → SSD re-read leak: about $1 MiB is re-read from the file while answering",
      "DRAM階層超過 → SSD再読み込み漏れ：約$1 MiBを回答中にファイルから再読み込みします",
      "DRAM 分級超出 → SSD 重讀溢漏：回答時將從檔案重讀約 $1 MiB",
      "DRAM 分级超出 → SSD 重读泄漏：回答时将从文件重读约 $1 MiB"],
    ["N-gram 테이블 ~# GB는 설계대로 SSD 계층에 놓입니다", "The N-gram table of ~$1 GB is placed on the SSD tier by design", "N-gramテーブル約$1 GBは設計通りSSD階層に配置されます", "N-gram 表約 $1 GB 依設計置於 SSD 分級", "N-gram 表约 $1 GB 按设计置于 SSD 分级"],
    ["누수가 아닙니다", "it is not a leak", "漏れではありません", "這不是溢漏", "这不是泄漏"],
    ["이 컴퓨터의 한계를 넘는 설정입니다: 계획은 그런 하드웨어에서 어떻게 될지 보여줍니다",
      "Beyond this computer's limits: the plan shows what would happen on such hardware",
      "このコンピュータの限界を超える設定です：計画はそのハードウェアでどうなるかを示します",
      "這超出了本電腦的極限：該計畫會顯示在那類硬體上會發生的情況",
      "这超出了本电脑的限制：该计划会显示在那样的硬件上会发生什么"],
    // ---- 통합 RAM(공유 메모리) 하드웨어
    ["메모리 유형", "Memory type", "メモリ種別", "記憶體類型", "内存类型"],
    ["자동 (GPU 이름으로 감지)", "Auto (detect from GPU name)", "自動（GPU名で検出）", "自動（依 GPU 名稱偵測）", "自动（按 GPU 名称检测）"],
    ["분리형 — VRAM과 RAM 별도", "Discrete — separate VRAM and RAM", "分離型 — VRAMとRAM別々", "分離式 — VRAM 與 RAM 分開", "分离式 — VRAM 与 RAM 分开"],
    ["통합 RAM — 공유 메모리 (GB10 · Apple Silicon · AI Max 등)", "Unified RAM — shared memory (GB10 · Apple Silicon · AI Max, etc.)", "統合RAM — 共有メモリ（GB10・Apple Silicon・AI Maxなど）", "統一記憶體 — 共用記憶體（GB10・Apple Silicon・AI Max 等）", "统一内存 — 共享内存（GB10·Apple Silicon·AI Max 等）"],
    ["통합 RAM (GB)", "Unified RAM (GB)", "統合RAM (GB)", "統一記憶體 (GB)", "统一内存 (GB)"],
    ["통합 RAM (공유 메모리)", "Unified RAM (shared memory)", "統合RAM（共有メモリ）", "統一記憶體（共用記憶體）", "统一内存（共享内存）"],
    ["VRAM / RAM 분리", "VRAM / RAM separate", "VRAM/RAM分離", "VRAM / RAM 分離", "VRAM / RAM 分离"],
    ["통합 RAM 추정 (내장 그래픽 — 지원은 직접 확인)", "Integrated RAM guessed (built-in GPU — check support yourself)", "統合RAM推定（内蔵GPU・サポートは要確認）", "推估為統一記憶體（內顯 — 支援與否請自行確認）", "推算为统一内存（核显 — 支持与否请自行确认）"],
    ["없음 — 통합 RAM 공유", "none — shared unified RAM", "なし — 統合RAM共有", "無 — 統一記憶體共用", "无 — 统一内存共用"],
    ["통합 RAM(가상)", "Unified RAM (virtual)", "統合RAM(仮想)", "統一記憶體（虛擬）", "统一内存（虚拟）"],
    ["⚠ 통합 RAM 하드웨어입니다: VRAM과 RAM이 분리된 것이 아니라 하나의 메모리를 함께 씁니다. AI 연산 지원은 분리형 카드보다 조건이 까다롭고, GB10(DGX Spark) · Apple Silicon · AMD AI Max+(Strix Halo)는 알려진 계열이라 엔진의 공개 지원 목록과 대조할 수 있습니다. 위 지원 표시는 공개 문서 기반 예상이며 실제 작동을 보장하지 않습니다.",
      "⚠ Unified-RAM hardware: there is no separate VRAM/RAM — one memory is shared by everything. AI support is stricter than on discrete cards; GB10 (DGX Spark) · Apple Silicon · AMD AI Max+ (Strix Halo) are known families you can check against each engine's public support list. The support display above is an estimate from public docs and does not guarantee actual operation.",
      "⚠ 統合RAMハードウェアです：VRAMとRAMの分離はなく、一つのメモリを一緒に使います。AI演算のサポートは分離型カードより条件が厳しく、GB10(DGX Spark)・Apple Silicon・AMD AI Max+(Strix Halo)は既知の系列なのでエンジンの公開サポート一覧と照合できます。上のサポート表示は公開文書に基づく推定で、実際の動作を保証しません。",
      "⚠ 統一記憶體硬體：VRAM 與 RAM 並非分離，而是共用同一個記憶體。AI 運算支援的條件比獨立顯卡更嚴格；GB10（DGX Spark）・Apple Silicon・AMD AI Max+（Strix Halo）是已知系列，可與各引擎公開支援清單對照。上方支援顯示為公開文件預估，不保證實際運作。",
      "⚠ 统一内存硬件：VRAM 与 RAM 并非分离，而是共用同一块内存。AI 运算支持条件比独立显卡更严格；GB10（DGX Spark）·Apple Silicon·AMD AI Max+（Strix Halo）是已知系列，可与各引擎公开支持清单对照。上方支持显示为公开文档预估，不保证实际运行。"],
    ["⚠ 통합 RAM 하드웨어입니다: VRAM과 RAM이 분리된 것이 아니라 하나의 메모리를 함께 씁니다. 통합 RAM을 직접 선택하셨는데 GB10 · Apple Silicon · AI Max(Strix Halo)처럼 잘 알려진 계열이 아닙니다 — 엔진마다 지원 여부가 명시되지 않은 경우가 많으니 사용자 본인이 반드시 별도로 확인해야 합니다. 위 지원 표시는 공개 문서 기반 예상이며 실제 작동을 보장하지 않습니다.",
      "⚠ Unified-RAM hardware: there is no separate VRAM/RAM — one memory is shared by everything. You chose unified RAM manually, but this is not a well-known family like GB10 · Apple Silicon · AI Max (Strix Halo) — support is often unspecified per engine, so you must verify it yourself. The support display above is an estimate from public docs and does not guarantee actual operation.",
      "⚠ 統合RAMハードウェアです：VRAMとRAMの分離はなく、一つのメモリを一緒に使います。統合RAMを手動で選択しましたが、GB10・Apple Silicon・AI Max(Strix Halo)のような既知の系列ではありません — エンジンごとにサポートが明記されない事が多いため、必ずご自身で確認してください。上のサポート表示は公開文書に基づく推定で、実際の動作を保証しません。",
      "⚠ 統一記憶體硬體：VRAM 與 RAM 並非分離，而是共用同一個記憶體。您手動選擇了統一記憶體，但这不是 GB10 · Apple Silicon · AI Max（Strix Halo）般的已知系列 — 各引擎未必載明支援與否，務必自行確認。上方支援顯示為公開文件預估，不保證實際運作。",
      "⚠ 统一内存硬件：VRAM 与 RAM 并非分离，而是共用同一块内存。您手动选择了统一内存，但这不是 GB10·Apple Silicon·AI Max（Strix Halo）般的已知系列 — 各引擎未必载明是否支持，务必自行确认。上方支持显示为公开文档预估，不保证实际运行。"],
    ["⚠ 통합 RAM 하드웨어입니다: VRAM과 RAM이 분리된 것이 아니라 하나의 메모리를 함께 씁니다. 이 내장 그래픽은 GB10 · Apple Silicon · AI Max(Strix Halo)처럼 잘 알려진 계열이 아닙니다 — 엔진마다 지원 여부가 명시되지 않은 경우가 많으니 사용자 본인이 반드시 별도로 확인해야 합니다. 위 지원 표시는 공개 문서 기반 예상이며 실제 작동을 보장하지 않습니다.",
      "⚠ Unified-RAM hardware: there is no separate VRAM/RAM — one memory is shared by everything. This built-in GPU is not a well-known family like GB10 · Apple Silicon · AI Max (Strix Halo) — support is often unspecified per engine, so you must verify it yourself. The support display above is an estimate from public docs and does not guarantee actual operation.",
      "⚠ 統合RAMハードウェアです：VRAMとRAMの分離はなく、一つのメモリを一緒に使います。この内蔵GPUはGB10・Apple Silicon・AI Max(Strix Halo)のような既知の系列ではありません — エンジンごとにサポートが明記されない事が多いため、必ずご自身で確認してください。上のサポート表示は公開文書に基づく推定で、実際の動作を保証しません。",
      "⚠ 統一記憶體硬體：VRAM 與 RAM 並非分離，而是共用同一個記憶體。這個內顯不是 GB10 · Apple Silicon · AI Max（Strix Halo）般的已知系列 — 各引擎未必載明支援與否，務必自行確認。上方支援顯示為公開文件預估，不保證實際運作。",
      "⚠ 统一内存硬件：VRAM 与 RAM 并非分离，而是共用同一块内存。这块核显不是 GB10·Apple Silicon·AI Max（Strix Halo）般的已知系列 — 各引擎未必载明是否支持，务必自行确认。上方支持显示为公开文档预估，不保证实际运行。"],
    ["통합 RAM 하드웨어", "Unified-RAM hardware", "統合RAMハードウェア", "統一記憶體硬體", "统一内存硬件"],
    ["이 엔진의 통합 메모리 지원 여부 확인 필요", "check this engine's unified-memory support", "このエンジンの統合メモリサポートを確認してください", "需確認此引擎是否支援統一記憶體", "需确认此引擎是否支持统一内存"],
    ["통합 RAM(알려지지 않은 계열)", "Unified RAM (unknown family)", "統合RAM(未知の系列)", "統一記憶體（未知系列）", "统一内存（未知系列）"],
    ["지원 여부를 사용자가 직접 확인해야 함", "the user must verify support themselves", "サポートはユーザー自身が確認が必要", "支援與否須由使用者自行確認", "是否支持须由用户自行确认"],
    ["로드되지 않습니다: 밀집 가중치·고정 오버헤드·어텐션 캐시가 약 # GB 필요하지만, 이 프로필의 통합 RAM은 # GB만 제공합니다",
      "Will not load: dense weights, fixed overhead and attention caches need about $1 GB, but this profile's unified RAM provides only $2 GB",
      "ロードできません：密な重み・固定オーバーヘッド・アテンションキャッシュが約$1 GB必要ですが、このプロファイルの統合RAMは$2 GBしか確保しません",
      "無法載入：密集權重、固定開銷與注意力快取約需 $1 GB，但此設定檔的統一記憶體只提供 $2 GB",
      "无法加载：稠密权重、固定开销与注意力缓存约需 $1 GB，但此配置档的统一内存只提供 $2 GB"],
    ["통합 RAM 설계대로: 가중치·콘텍스트·대기 전문가가 모두 통합 RAM에 들어갑니다",
      "Unified RAM as designed: weights, context and standby experts all fit in the unified RAM",
      "統合RAMは設計通り：重み・コンテキスト・待機Expertがすべて統合RAMに収まります",
      "統一記憶體符合設計：權重、上下文與待命專家全部放入統一記憶體",
      "统一内存符合设计：权重、上下文与待机专家全部放入统一内存"],
    ["통합 RAM 초과 → 파일 재읽기 누수: 약 # MiB(#%)를 답변 중에 파일에서 다시 읽습니다",
      "Unified RAM overflow → file re-read leak: about $1 MiB ($2%) is re-read from the file while answering",
      "統合RAM超過 → ファイル再読み込み漏れ：約$1 MiB（$2%）を回答中にファイルから読みます",
      "統一記憶體超出 → 檔案重讀溢漏：回答時將從檔案重讀約 $1 MiB（$2%）",
      "统一内存超出 → 文件重读泄漏：回答时将从文件重读约 $1 MiB（$2%）"],
    ["이 통합 RAM 프로필은 # GB", "this unified-RAM profile is $1 GB", "この統合RAMプロファイルは$1 GB", "此統一記憶體設定檔為 $1 GB", "此统一内存配置档为 $1 GB"],
    ["통합 RAM 빠듯: 최소 약 # GB 필요(프로필 # GB)", "Unified RAM tight: needs at least ~$1 GB (profile $2 GB)", "統合RAMぎりぎり：最低約$1 GB必要（プロファイル$2 GB）", "統一記憶體吃緊：至少約需 $1 GB（設定檔 $2 GB）", "统一内存紧张：至少约需 $1 GB（配置档 $2 GB）"],
    ["통합 RAM # GB에 로드 가능", "Loads on unified RAM $1 GB", "統合RAM $1 GBでロード可能", "可在統一記憶體 $1 GB 載入", "可在统一内存 $1 GB 加载"],
    ["통합 RAM · 활성 전문가+콘텍스트", "Unified RAM · active experts + context", "統合RAM・アクティブExpert+コンテキスト", "統一記憶體・活躍專家＋上下文", "统一内存·活跃专家＋上下文"],
    ["통합 RAM · 비활성 전문가", "Unified RAM · inactive experts", "統合RAM・非アクティブExpert", "統一記憶體・非活躍專家", "统一内存·非活跃专家"],
    ["계층 없음 — 전부 통합 RAM에 올라가는 설계", "No tiers — everything goes onto the unified RAM by design", "階層なし — 全て統合RAMに載せる設計", "無分級 — 全部放上統一記憶體的設計", "无分级 — 全部放入统一内存的设计"],
    ["활성 ~# MiB (전문가의 #%) · 어텐션 캐시 @ · 통합 RAM 자리 ~# GB",
      "Active ~$1 MiB ($2% of experts) · attention cache $3 · unified-RAM room ~$4 GB",
      "アクティブ約$1 MiB（Expertの$2%）・アテンションキャッシュ$3・統合RAM上の場所 約$4 GB",
      "活躍約 $1 MiB（專家的 $2%）・注意力快取 $3・統一記憶體空間約 $4 GB",
      "活跃约 $1 MiB（专家的 $2%）・注意力缓存 $3・统一内存空间约 $4 GB"],
    ["~# MiB 대기 (통합 RAM 자리 # GB)", "~$1 MiB on standby (unified-RAM room $2 GB)", "~$1 MiB待機（統合RAM上の場所 $2 GB）", "~$1 MiB 待命（統一記憶體空間 $2 GB）", "~$1 MiB 待命（统一内存空间 $2 GB）"],
    ["통합 RAM 자리", "unified-RAM room", "統合RAM上の場所", "統一記憶體空間", "统一内存空间"],
    ["초과(파일 재읽기)", "Overflow (file re-read)", "超過(ファイル再読み込み)", "超出（檔案重讀）", "超出（文件重读）"],
    ["통합 RAM을 넘는 약 # GB를 답변 중에 파일에서 다시 읽습니다", "About $1 GB that does not fit the unified RAM is re-read from the file while answering", "統合RAMを超えて約$1 GBを回答中にファイルから読みます", "超出統一記憶體的約 $1 GB 將於回答時從檔案重讀", "超出统一内存的约 $1 GB 将在回答时从文件重读"],
    ["통합 RAM 총량 # GB (#% 사용)", "unified RAM total $1 GB ($2% used)", "統合RAM総量 $1 GB（$2%使用）", "統一記憶體總量 $1 GB（使用 $2%）", "统一内存总量 $1 GB（使用 $2%）"],
    ["통합 RAM 하드웨어에서는 VRAM/DRAM 행이 통합 RAM 행으로 표시되고, 넘칠 때는 바로 파일 재읽기가 됩니다.",
      "On unified-RAM hardware the VRAM/DRAM rows are shown as unified-RAM rows, and overflow goes straight to file re-reads.",
      "統合RAMハードウェアではVRAM/DRAM行が統合RAM行として表示され、超過すると直接ファイル再読み込みになります。",
      "在統一記憶體硬體上，VRAM/DRAM 列會以統一記憶體列顯示，超出時直接成為檔案重讀。",
      "在统一内存硬件上，VRAM/DRAM 行会以统一内存行显示，超出时直接成为文件重读。"],
    // ---- 외부 그래픽카드(eGPU) 구성 — 통합 RAM 하드웨어에 카드를 얹는 경우
    ["외부 그래픽카드 (이름)", "External GPU (name)", "外部GPU（名前）", "外接顯示卡（名稱）", "外接显卡（名称）"],
    ["외부 VRAM (GB)", "External VRAM (GB)", "外部VRAM (GB)", "外接 VRAM (GB)", "外部 VRAM (GB)"],
    ["외부 카드 VRAM 프로필", "External-card VRAM profile", "外部カードVRAMプロファイル", "外接卡 VRAM 設定檔", "外接卡 VRAM 配置档"],
    ["통합 RAM + 외부 그래픽카드", "Unified RAM + external GPU", "統合RAM＋外部GPU", "統一記憶體＋外接顯示卡", "统一内存＋外接显卡"],
    ["외부 카드(지정)", "External card (set)", "外部カード(指定)", "外接卡（已指定）", "外接卡（已指定）"],
    ["VRAM(외부 카드) · 활성 전문가+콘텍스트", "VRAM (external GPU) · active experts + context", "VRAM(外部GPU)・アクティブExpert+コンテキスト", "VRAM（外接顯示卡）・活躍專家＋上下文", "VRAM（外接显卡）·活跃专家＋上下文"],
    ["외부 그래픽카드 사용: VRAM은 외부 카드이고, DRAM 계층(대기 메모리)는 통합 RAM이 대신합니다",
      "External GPU in use: VRAM is the external card; the DRAM tier (standby memory) is served by the unified RAM",
      "外部GPU使用：VRAMは外部カードで、DRAM階層（待機メモリ）は統合RAMが代行します",
      "使用外接顯示卡：VRAM 為外接卡，DRAM 階層（待命記憶體）由統一記憶體替代",
      "使用外接显卡：VRAM 为外接卡，DRAM 层级（待机内存）由统一内存替代"],
    ["외부 그래픽카드 @ (# GB) 지정 — 카드의 VRAM이 별도로 활성화되고, 비활성 전문가·초과 분은 통합 RAM을 씁니다",
      "External GPU $1 ($2 GB) configured — the card's VRAM is enabled separately; inactive experts and overflow use the unified RAM",
      "外部GPU $1（$2 GB）指定 — カードのVRAMが個別に有効になり、非アクティブExpert・超過分は統合RAMを使います",
      "已指定外接顯示卡 $1（$2 GB）— 卡的 VRAM 另行啟用，非活躍專家與超出部分使用統一記憶體",
      "已指定外接显卡 $1（$2 GB）— 卡的 VRAM 另行启用，非活跃专家与超出部分使用统一内存"],
    ["통합 RAM + 외부 카드", "Unified RAM + external card", "統合RAM＋外部カード", "統一記憶體＋外接卡", "统一内存＋外接卡"],
    ["통합 RAM + 외부 카드(알려지지 않은 계열)", "Unified RAM + external card (unknown family)", "統合RAM＋外部カード（未知の系列）", "統一記憶體＋外接卡（未知系列）", "统一内存＋外接卡（未知系列）"],
    ["엔진의 외장 GPU·통합 메모리 지원 확인 필요", "check this engine's discrete-GPU / unified-memory support", "このエンジンの外部GPU・統合メモリサポートを確認してください", "需確認此引擎對外接 GPU・統一記憶體的支援", "需确认此引擎对外接 GPU·统一内存的支持"],
    ["통합 RAM 권장 # GB", "Unified-RAM recommended $1 GB", "統合RAM推奨 $1 GB", "建議統一記憶體 $1 GB", "建议统一内存 $1 GB"],
    ["통합 RAM @에 비활성 전문가 # GB 대기 가능", "$1 GB of inactive experts can wait in unified RAM $2", "統合RAM $2に非アクティブExpert $1 GBが待機可能", "非活躍專家 $1 GB 可在統一記憶體 $2 待命", "非活跃专家 $1 GB 可在统一内存 $2 待命"],
    ["통합 RAM 대기분 없음", "nothing waiting in unified RAM", "統合RAM待機分なし", "統一記憶體中無待命部分", "统一内存中无待命部分"],
    // ---- GPU 이름 자동 감지 결과 표시 (가상 스펙)
    ["감지됨: 통합 RAM — GB10(DGX Spark) 계열", "Detected: unified RAM — GB10 (DGX Spark) family", "検出：統合RAM — GB10(DGX Spark)系列", "偵測：統一記憶體 — GB10（DGX Spark）系列", "检测：统一内存 — GB10（DGX Spark）系列"],
    ["감지됨: 통합 RAM — Apple Silicon 계열", "Detected: unified RAM — Apple Silicon family", "検出：統合RAM — Apple Silicon系列", "偵測：統一記憶體 — Apple Silicon 系列", "检测：统一内存 — Apple Silicon 系列"],
    ["감지됨: 통합 RAM — AMD AI Max+(Strix Halo) 계열", "Detected: unified RAM — AMD AI Max+ (Strix Halo) family", "検出：統合RAM — AMD AI Max+(Strix Halo)系列", "偵測：統一記憶體 — AMD AI Max+（Strix Halo）系列", "检测：统一内存 — AMD AI Max+（Strix Halo）系列"],
    ["감지됨: 내장 그래픽 추정 — 지원 여부는 본인이 확인하세요", "Detected: likely integrated GPU — verify support yourself", "検出：内蔵GPU推定 — サポート可否はご自身で確認してください", "偵測：推估為內顯 — 支援與否請自行確認", "检测：推算为核显 — 支持与否请自行确认"],
    ["GPU 이름에서 감지된 계열 없음 — 자동이면 분리형(VRAM/RAM)으로 취급", "No family detected from the GPU name — auto treats it as discrete (VRAM/RAM)", "GPU名から系列を検出できず — 自動では分離型(VRAM/RAM)として扱います", "從 GPU 名稱未偵測到系列 — 自動時以分離式（VRAM/RAM）處理", "从 GPU 名称未检测到系列 — 自动时按分离式（VRAM/RAM）处理"],
    // ---- 엔진 최신화 (URL 재다운로드)
    ["최신화", "Refresh", "更新", "重新整理", "刷新"],
    ["최신화 중…", "Refreshing…", "更新中…", "重新整理中…", "刷新中…"],
    ["최신화됨: @ (#개 모델)", "Refreshed: $1 ($2 models)", "更新しました: $1（$2モデル）", "已重新整理：$1（$2 個模型）", "已刷新：$1（$2 个模型）"],
    ["최신화 실패: @", "Refresh failed: $1", "更新失敗: $1", "重新整理失敗：$1", "刷新失败：$1"],
    // ---- 호환성 배지
    ["모델 예상:", "Model estimate:", "モデル推定:", "模型預估:", "模型预估:"],
    ["지원 OS 정보 없음", "No supported-OS info", "サポートOS情報なし", "無支援 OS 資訊", "无支持 OS 信息"],
    ["OS @ 지원", "$1 supported", "$1 対応", "支援 $1", "支持 $1"],
    ["OS 미지원", "OS not supported", "OS非対応", "不支援此 OS", "不支持此 OS"],
    ["이 엔진은 @용", "this engine is for $1", "このエンジンは$1用です", "此引擎僅供 $1 使用", "此引擎仅供 $1 使用"],
    ["지원 GPU 정보 없음", "No supported-GPU info", "サポートGPU情報なし", "無支援 GPU 資訊", "无支持 GPU 信息"],
    ["GPU 지원 (@)", "GPU supported ($1)", "GPU対応 ($1)", "GPU 支援（$1）", "GPU 支持（$1）"],
    ["GPU 확인 필요", "GPU needs checking", "GPU確認が必要", "需檢查 GPU", "需检查 GPU"],
    ["GPU 미지원", "GPU not supported", "GPU非対応", "不支援此 GPU", "不支持此 GPU"],
    ["이 엔진의 GPU 목록에 없음", "not in this engine's GPU list", "このエンジンのGPUリストにありません", "不在此引擎的 GPU 清單中", "不在此引擎的 GPU 列表中"],
    ["VRAM # GB < 권장 # GB", "VRAM $1 GB < recommended $2 GB", "VRAM $1 GB < 推奨 $2 GB", "VRAM $1 GB < 建議 $2 GB", "VRAM $1 GB < 建议 $2 GB"],
    ["RAM # GB < 권장 # GB", "RAM $1 GB < recommended $2 GB", "RAM $1 GB < 推奨 $2 GB", "RAM $1 GB < 建議 $2 GB", "RAM $1 GB < 建议 $2 GB"],
    ["OS 확인 불가", "OS not detectable", "OS確認不可", "無法確認 OS", "无法确认 OS"],
    ["OS 미지원 (@)", "OS not supported ($1)", "OS非対応 ($1)", "不支援此 OS（$1）", "不支持此 OS（$1）"],
    ["이 모델은 공개 문서상 두 대의 머신을 요구합니다", "This model requires two machines per its public docs", "このモデルは公開文書上2台のマシンを要求します", "依公開文件，此模型需要兩台機器", "按公开文件，此模型需要两台机器"],
    ["한 장 기준 예상은 참고용", "the single-card estimate is only a reference", "1枚基準の推定は参考用です", "單卡預估僅供參考", "单卡预估仅供参考"],
    ["VRAM 권장 # GB", "VRAM recommended $1 GB", "VRAM推奨 $1 GB", "建議 VRAM $1 GB", "建议 VRAM $1 GB"],
    ["이 카드는 # GB", "this card is $1 GB", "このカードは$1 GB", "這張顯示卡是 $1 GB", "这张显卡是 $1 GB"],
    ["VRAM 빠듯: 최소 약 # GB 필요(실측 # GB)", "VRAM tight: needs at least ~$1 GB (measured $2 GB)", "VRAMぎりぎり：最低約$1 GB必要（実測$2 GB）", "VRAM 吃緊：至少約需 $1 GB（實測 $2 GB）", "VRAM 紧张：至少约需 $1 GB（实测 $2 GB）"],
    ["VRAM # GB에 로드 가능", "Loads on VRAM $1 GB", "VRAM $1 GBでロード可能", "可在 VRAM $1 GB 載入", "可在 VRAM $1 GB 加载"],
    ["VRAM 확인 불가", "VRAM not detectable", "VRAM確認不可", "無法確認 VRAM", "无法确认 VRAM"],
    ["프로필 기준 계산", "computed from the profile only", "プロファイル基準で計算", "僅依設定檔計算", "仅按配置档计算"],
    ["DRAM 권장 # GB", "DRAM recommended $1 GB", "DRAM推奨 $1 GB", "建議 DRAM $1 GB", "建议 DRAM $1 GB"],
    ["이 PC는 # GB", "this PC has $1 GB", "このPCは$1 GB", "這台電腦是 $1 GB", "这台电脑是 $1 GB"],
    ["DRAM @에 비활성 전문가 # GB 대기 가능", "$1 GB of inactive experts can wait in DRAM $2", "$2 のDRAMに非アクティブExpert $1 GBが待機可能", "非活躍專家 $1 GB 可在 DRAM $2 待命", "非活跃专家 $1 GB 可在 DRAM $2 待命"],
    ["MoE 계층 없음", "No MoE tiers", "MoE階層なし", "無 MoE 分級", "无 MoE 分级"],
    ["DRAM 대기분 없음", "nothing waiting in DRAM", "DRAM待機分なし", "RAM 中無待命部分", "RAM 中无待命部分"],
    // ---- 엔진 설명 (BUILT_IN)
    ["계층화 메모리 MoE 엔진 — Qwen3.8-Flash-Next·Hy4-Flash를 포함해 지원 모델이 계속 늘고 있다. 크기는 README/MODELS.md 표의 대표값(~) 사용.",
      "Tiered-memory MoE engine — support keeps growing beyond Qwen3.8-Flash-Next & Hy4-Flash. Sizes are the representative values (~) from the README/MODELS.md tables.",
      "階層メモリMoEエンジン — Qwen3.8-Flash-Next・Hy4-Flashを含め対応モデルがどんどん増えています。サイズはREADME/MODELS.md表の代表値(~)。",
      "分級記憶體 MoE 引擎 — 除 Qwen3.8-Flash-Next・Hy4-Flash 外，支援模型持續增加。大小取自 README/MODELS.md 表的代表值（~）。",
      "分层内存 MoE 引擎 — 除 Qwen3.8-Flash-Next·Hy4-Flash 外，支持模型持续增加。大小取自 README/MODELS.md 表的代表值（~）。"],
    ["Strata 기반 확장 — 자체 엔진의 13개 모델 + Strata 엔진(Qwen3.8/Hy4). GLM 크기는 범위 대표값(~). 8GB VRAM 카드에서 잘 가동된다.",
      "Extension built on Strata — 13 models for its own engine + the Strata engine (Qwen3.8/Hy4). GLM sizes are range representatives (~). Runs well on an 8 GB VRAM card.",
      "Strataベースの拡張 — 独自エンジンの13モデル + Strataエンジン(Qwen3.8/Hy4)。GLMサイズは範囲の代表値(~)。8GB VRAMカードで好調に動作します。",
      "以 Strata 為基礎的擴充 — 自有引擎的 13 個模型 + Strata 引擎（Qwen3.8/Hy4）。GLM 大小為範圍代表值（~）。在 8GB VRAM 顯示卡上可順暢運作。",
      "基于 Strata 的扩展 — 自有引擎的 13 个模型 + Strata 引擎（Qwen3.8/Hy4）。GLM 大小为范围代表值（~）。在 8GB VRAM 显卡上运行良好。"],
    ["4~6 GB VRAM을 겨냥한 포크 엔진 — 4gbVramStrata 실험실과 같은 setup.py 크기 표(정확한 값) 사용.",
      "A fork targeting 4–6 GB VRAM — uses the same exact setup.py size table as the 4gbVramStrata lab.",
      "4〜6GB VRAMを狙ったフォークエンジン — 4gbVramStrataラボと同じsetup.pyサイズ表（正確な値）を使用。",
      "瞄準 4~6 GB VRAM 的分支引擎 — 使用與 4gbVramStrata 實驗室相同的 setup.py 大小表（精確值）。",
      "瞄准 4~6 GB VRAM 的分支引擎 — 使用与 4gbVramStrata 实验室相同的 setup.py 大小表（精确值）。"],
    ["초대형 MoE 전용 — 전문가 대부분을 RAM에 고정(VRAM은 활성분만). 크기는 공개 표(Maya quant).",
      "For giant MoEs — most experts stay pinned in RAM (only active ones on the card). Sizes from the public table (Maya quant).",
      "超大型MoE専用 — Expertの大半をRAMに固定（アクティブ分のみVRAM）。サイズは公開表(Maya quant)。",
      "超大 MoE 專用 — 多數專家常駐 RAM（顯示卡只放活躍部分）。大小取自公開表（Maya quant）。",
      "超大 MoE 专用 — 多数专家常驻 RAM（显卡只放活跃部分）。大小取自公开表（Maya quant）。"],
    ["Blackwell(sm_120/GB10) 전용 CUDA 엔진 — NVFP4 팩 + Engram(SSD 계층). 크기는 공개된 팩만 표기, 나머지는 미공개.",
      "CUDA engine for Blackwell (sm_120/GB10) only — NVFP4 packs + Engram (SSD tier). Only published pack sizes are listed; the rest are undisclosed.",
      "Blackwell(sm_120/GB10)専用CUDAエンジン — NVFP4パック＋Engram（SSD階層）。サイズは公開済みのパックのみ記載、他は非公開。",
      "僅限 Blackwell（sm_120/GB10）的 CUDA 引擎 — NVFP4 組合＋Engram（SSD 分級）。僅列出已公開的組合大小，其餘未公開。",
      "仅限 Blackwell（sm_120/GB10）的 CUDA 引擎 — NVFP4 包＋Engram（SSD 层级）。仅列出已公开的包大小，其余未公开。"],
    ["Windows + NVIDIA 단일 카드 전용(Qwen3.8-27B·Inkling 2 Mini). 계층 없음 — 전부 VRAM에 올리는 설계.",
      "Single-card only: Windows + NVIDIA (Qwen3.8-27B, Inkling 2 Mini). No tiers — everything goes on the VRAM by design.",
      "Windows + NVIDIA単一カード専用（Qwen3.8-27B・Inkling 2 Mini）。階層なし — 全てVRAMに載せる設計。",
      "僅限 Windows + NVIDIA 單卡（Qwen3.8-27B、Inkling 2 Mini）。無分級 — 全部放上 VRAM 的設計。",
      "仅限 Windows + NVIDIA 单卡（Qwen3.8-27B、Inkling 2 Mini）。无分级 — 全部放入 VRAM 的设计。"],
    ["Strata 포크 — Qwen3.8-Flash-Next 재양자화(Sync-XS/S/M). 모델 + 공용 부품 약 35 GB.",
      "A Strata fork — requantized Qwen3.8-Flash-Next (Sync-XS/S/M). Model + shared parts, about 35 GB.",
      "Strataフォーク — Qwen3.8-Flash-Nextの再量子化(Sync-XS/S/M)。モデル＋共通部品で約35 GB。",
      "Strata 分支 — Qwen3.8-Flash-Next 重新量化（Sync-XS/S/M）。模型＋共用元件約 35 GB。",
      "Strata 分支 — Qwen3.8-Flash-Next 重量化（Sync-XS/S/M）。模型＋共享部件约 35 GB。"],
    ["Zig 엔진 — Apple Silicon(Metal)·NVIDIA CUDA. 큰 모델은 듀얼 GB10/M5 Ultra 요구(공개 범위 그대로).",
      "A Zig engine — Apple Silicon (Metal) & NVIDIA CUDA. Big models need dual GB10/M5 Ultra (as publicly stated).",
      "Zigエンジン — Apple Silicon(Metal)・NVIDIA CUDA。大きなモデルはデュアルGB10/M5 Ultraが必要（公開範囲のまま）。",
      "Zig 引擎 — Apple Silicon（Metal）・NVIDIA CUDA。大型模型需要雙 GB10/M5 Ultra（依公開範圍）。",
      "Zig 引擎 — Apple Silicon（Metal）・NVIDIA CUDA。大型模型需要双 GB10/M5 Ultra（按公开范围）。"],
    ["삼진법(ternary) 초저비트 모델 — Mac Metal · CUDA · Vulkan · ROCm · CPU. 27B가 6~8 GB.",
      "Ternary ultra-low-bit models — Mac Metal · CUDA · Vulkan · ROCm · CPU. 27B in 6–8 GB.",
      "三値(ternary)超低ビットモデル — Mac Metal・CUDA・Vulkan・ROCm・CPU。27Bが6〜8 GB。",
      "三值（ternary）超低位元模型 — Mac Metal・CUDA・Vulkan・ROCm・CPU。27B 僅 6〜8 GB。",
      "三值（ternary）超低位模型 — Mac Metal・CUDA・Vulkan・ROCm・CPU。27B 仅 6〜8 GB。"],
    // ---- 엔진 그룹 헤더 + 범용 런타임 (Ollama · Unsloth · LM Studio)
    ["계층화 메모리 MoE 지원 엔진 — VRAM 활성 · DRAM 대기 · SSD 테이블",
      "Tiered-memory MoE engines — VRAM active · DRAM standby · SSD tables",
      "階層メモリMoE対応エンジン — VRAMアクティブ・DRAM待機・SSDテーブル",
      "分級記憶體 MoE 支援引擎 — VRAM 活躍・DRAM 待命・SSD 表格",
      "分层内存 MoE 支持引擎 — VRAM 活跃·DRAM 待机·SSD 表"],
    ["일반 로드 엔진 — 전문가 계층 스트리밍 없음(총량·카드 기준 예상)",
      "General-load engines — no expert-tier streaming (estimates by total/card capacity)",
      "一般ロードエンジン — Expert階層ストリーミングなし（総量・カード基準の推定）",
      "一般載入引擎 — 無專家階層串流（以總量／顯示卡為基準預估）",
      "常规加载引擎 — 无专家层级流式（按总量／显卡基准预估）"],
    ["범용 GGUF 런타임(llama.cpp 기반) — 계층화 메모리 MoE 없음, 모델은 통째 로드·레이어 분할. ollama.com이 브라우저 카탈로그 접근(CORS)을 막아 목록은 공개 라이브러리 대표값(~)이며, '모델 검색·추가'로 Hugging Face에서 찾아 담거나 직접 입력할 수 있다.",
      "General GGUF runtime (llama.cpp-based) — no tiered-memory MoE; models load whole or split by layer. ollama.com blocks browser catalog access (CORS), so the list holds representative public-library values (~) — use 'Search & add models' to pull from Hugging Face or type your own.",
      "汎用GGUFランタイム(llama.cppベース) — 階層メモリMoEなし、モデルは丸ごとロード・レイヤー分割。ollama.comはブラウザからのカタログアクセス(CORS)を遮るため、一覧は公開ライブラリの代表値(~)で、『モデル検索・追加』からHugging Faceで探して入れるか直接入力できます。",
      "通用 GGUF 執行期（llama.cpp 基礎）— 無分級記憶體 MoE，模型整載或按層切分。ollama.com 封鎖瀏覽器目錄存取（CORS），清單僅為公開程式庫代表值（~），可用「模型搜尋・新增」從 Hugging Face 尋找加入或直接輸入。",
      "通用 GGUF 运行时（llama.cpp 基础）— 无分层内存 MoE，模型整体加载或按层切分。ollama.com 阻止浏览器目录访问（CORS），列表仅为公开库代表值（~），可用「模型搜索・添加」从 Hugging Face 查找加入或直接输入。"],
    ["Unsloth Studio + 동적 양자화 GGUF(llama.cpp 기반) — 계층화 메모리 MoE 없음. 엔진을 고르면 Hugging Face 최신 카탈로그(다운로드순 상위 30개 저장소, quant별 실파일 크기)가 자동으로 로드되고, 오프라인이면 기본 목록을 씁니다.",
      "Unsloth Studio + dynamic-quant GGUF (llama.cpp-based) — no tiered-memory MoE. Selecting the engine auto-loads the latest Hugging Face catalog (top 30 repos by downloads, real per-quant file sizes); offline falls back to the built-in list.",
      "Unsloth Studio＋動的量子化GGUF(llama.cppベース) — 階層メモリMoEなし。エンジンを選ぶとHugging Face最新カタログ（ダウンロード上位30リポジトリ、quant別実ファイルサイズ）が自動ロードされ、オフラインでは既定一覧を使います。",
      "Unsloth Studio＋動態量化 GGUF（llama.cpp 基礎）— 無分級記憶體 MoE。選擇引擎後會自動載入 Hugging Face 最新目錄（下載排序前 30 個儲存庫、quant 別實際檔大小），離線則使用基本清單。",
      "Unsloth Studio＋动态量化 GGUF（llama.cpp 基础）— 无分层内存 MoE。选择引擎后会自动加载 Hugging Face 最新目录（下载排序前 30 个仓库、quant 别实际文件大小），离线则使用基本列表。"],
    ["GGUF·MLX 데스크톱 GUI(llama.cpp 기반) — 계층화 메모리 MoE 없음, 레이어 분할은 수동. 엔진을 고르면 Hugging Face(lmstudio-community) 최신 GGUF·MLX 카탈로그가 자동으로 로드되고, 오프라인이면 기본 목록을 씁니다.",
      "GGUF·MLX desktop GUI (llama.cpp-based) — no tiered-memory MoE; layer split is manual. Selecting the engine auto-loads the latest GGUF·MLX catalog from Hugging Face (lmstudio-community); offline falls back to the built-in list.",
      "GGUF・MLXデスクトップGUI(llama.cppベース) — 階層メモリMoEなし、レイヤー分割は手動。エンジンを選ぶとHugging Face(lmstudio-community)の最新GGUF・MLXカタログが自動ロードされ、オフラインでは既定一覧を使います。",
      "GGUF・MLX 桌面 GUI（llama.cpp 基礎）— 無分級記憶體 MoE，切層為手動。選擇引擎後會自動載入 Hugging Face(lmstudio-community) 最新 GGUF・MLX 目錄，離線則使用基本清單。",
      "GGUF·MLX 桌面 GUI（llama.cpp 基础）— 无分层内存 MoE，切层为手动。选择引擎后会自动加载 Hugging Face(lmstudio-community) 最新 GGUF·MLX 目录，离线则使用基本列表。"],
    // ---- HF 카탈로그 불러오기 / 모델 검색·직접 입력 패널
    ["카탈로그 불러오기", "Load catalog", "カタログ読み込み", "載入目錄", "加载目录"],
    ["카탈로그 최신화 중…", "Refreshing catalog…", "カタログ更新中…", "正在重新整理目錄…", "正在刷新目录…"],
    ["카탈로그 불러오는 중… #/#", "Loading catalog… $1/$2", "カタログ読み込み中… $1/$2", "正在載入目錄… $1/$2", "正在加载目录… $1/$2"],
    ["카탈로그 반영됨: #개 모델 (Hugging Face @ 다운로드순)", "Catalog applied: $1 models (Hugging Face $2, by downloads)", "カタログを反映：$1モデル（Hugging Face $2、ダウンロード順）", "已套用目錄：$1 個模型（Hugging Face $2，依下載量）", "已应用目录：$1 个模型（Hugging Face $2，按下载量）"],
    ["카탈로그 실패: @ — 오프라인이면 기본 목록을 그대로 사용합니다", "Catalog failed: $1 — offline? the built-in list stays in use", "カタログ失敗: $1 — オフラインでは既定一覧をそのまま使用します", "目錄失敗：$1 — 離線時將继续使用基本清單", "目录失败：$1 — 离线时将继续使用基本列表"],
    ["카탈로그 지우기", "Clear catalog", "カタログを消去", "清除目錄", "清除目录"],
    ["카탈로그를 지웠습니다 — 기본 모델 목록으로 돌아갔습니다", "Catalog cleared — back to the default model list", "カタログを消去しました — 既定のモデル一覧に戻りました", "已清除目錄 — 回到預設模型清單", "已清除目录 — 回到默认模型列表"],
    ["카탈로그 반영", "catalog applied", "カタログ反映済み", "已套用目錄", "已应用目录"],
    ["모델 검색·추가", "Search & add models", "モデル検索・追加", "模型搜尋・新增", "模型搜索·添加"],
    ["검색", "Search", "検索", "搜尋", "搜索"],
    ["검색 대상 엔진: @ — 결과에서 고르거나 아래에 직접 입력하세요", "Searching for engine: $1 — pick from the results or type below", "検索対象エンジン：$1 — 結果から選ぶか下に入力してください", "搜尋目標引擎：$1 — 從結果擇一或在下方輸入", "搜索目标引擎：$1 — 从结果选择或在下方输入"],
    ["먼저 엔진을 선택하세요", "Select an engine first", "まずエンジンを選択してください", "請先選擇引擎", "请先选择引擎"],
    ["검색어를 입력하세요", "Enter a search term", "検索語を入力してください", "請輸入搜尋詞", "请输入搜索词"],
    ["Hugging Face 검색 중…", "Searching Hugging Face…", "Hugging Face檢索中…", "正在搜尋 Hugging Face…", "正在搜索 Hugging Face…"],
    ["GGUF·MLX 저장소 검색 결과가 없습니다", "No GGUF·MLX repositories found", "GGUF・MLXリポジトリが見つかりません", "找不到 GGUF・MLX 儲存庫", "未找到 GGUF·MLX 仓库"],
    ["검색 결과 #개 — 저장소를 누르면 quant·크기를 읽습니다", "$1 results — click a repository to read its quants and sizes", "検索結果$1件 — リポジトリを押すとquant・サイズを読み込みます", "搜尋結果 $1 個 — 點儲存庫可讀取 quant・大小", "搜索结果 $1 个 — 点仓库读取 quant·大小"],
    ["검색 실패: @", "Search failed: $1", "検索失敗: $1", "搜尋失敗：$1", "搜索失败：$1"],
    ["저장소 읽는 중…", "Reading repository…", "リポジトリを読み込み中…", "正在讀取儲存庫…", "正在读取仓库…"],
    ["@ — quant을 누르면 엔진에 추가됩니다", "$1 — click a quant to add it to the engine", "$1 — quantを押すとエンジンに追加されます", "$1 — 點 quant 可加入引擎", "$1 — 点 quant 加入引擎"],
    ["저장소 실패: @", "Repository failed: $1", "リポジトリ失敗: $1", "儲存庫失敗：$1", "仓库失败：$1"],
    ["추가됨: @ (@ GB) — @ 목록에 반영", "Added: $1 ($2 GB) — now in $3's list", "追加しました: $1（$2 GB）— $3の一覧に反映", "已新增：$1（$2 GB）— 已納入 $3 清單", "已添加：$1（$2 GB）— 已纳入 $3 列表"],
    ["모델명과 크기(GB)를 입력하세요", "Enter a model name and size (GB)", "モデル名とサイズ(GB)を入力してください", "請輸入模型名稱與大小（GB）", "请输入模型名称与大小（GB）"],
    ["모델 검색 (Hugging Face GGUF·MLX) — 예: Qwen3.8, gemma-4, Hy4", "Search models (Hugging Face GGUF·MLX) — e.g. Qwen3.8, gemma-4, Hy4", "モデル検索（Hugging Face GGUF・MLX）— 例: Qwen3.8, gemma-4, Hy4", "模型搜尋（Hugging Face GGUF・MLX）— 例：Qwen3.8, gemma-4, Hy4", "模型搜索（Hugging Face GGUF·MLX）— 例：Qwen3.8, gemma-4, Hy4"],
    ["직접 입력 — 모델명 (예: some-model q4_K_M)", "Manual entry — model name (e.g. some-model q4_K_M)", "直接入力 — モデル名（例: some-model q4_K_M）", "手動輸入 — 模型名稱（例：some-model q4_K_M）", "手动输入 — 模型名称（例：some-model q4_K_M）"],
    ["양자화", "Quantization", "量子化", "量化", "量化"],
    ["(양자화 없음)", "(no quant)", "(量子化なし)", "(無量化)", "(无量化)"],
    ["양자화 (예: q4_K_M)", "Quant (e.g. q4_K_M)", "量子化（例: q4_K_M）", "量化（例：q4_K_M）", "量化（例：q4_K_M）"],
    // ---- 엔진 지원 범위 노트 (osNote / gpuNote)
    ["Windows 11 · Linux (macOS 미지원)", "Windows 11 · Linux (no macOS)", "Windows 11・Linux（macOS非対応）", "Windows 11・Linux（不支援 macOS）", "Windows 11・Linux（不支持 macOS）"],
    ["Windows · Linux (macOS 미지원)", "Windows · Linux (no macOS)", "Windows・Linux（macOS非対応）", "Windows・Linux（不支援 macOS）", "Windows・Linux（不支持 macOS）"],
    ["Windows · Linux (macOS 미지원) · RAM 32 GB+", "Windows · Linux (no macOS) · RAM 32 GB+", "Windows・Linux（macOS非対応）・RAM 32 GB以上", "Windows・Linux（不支援 macOS）・RAM 32 GB+", "Windows・Linux（不支持 macOS）・RAM 32 GB+"],
    ["Linux x64 · Windows 10 1903+ (macOS 미지원) · CUDA 13", "Linux x64 · Windows 10 1903+ (no macOS) · CUDA 13", "Linux x64・Windows 10 1903+（macOS非対応）・CUDA 13", "Linux x64・Windows 10 1903+（不支援 macOS）・CUDA 13", "Linux x64・Windows 10 1903+（不支持 macOS）・CUDA 13"],
    ["64-bit Windows 11 전용 (Linux는 소스 빌드, macOS 미지원)", "64-bit Windows 11 only (Linux from source, no macOS)", "64bit Windows 11専用（Linuxはソースビルド、macOS非対応）", "僅限 64-bit Windows 11（Linux 需自行編譯，不支援 macOS）", "仅限 64-bit Windows 11（Linux 需源码编译，不支持 macOS）"],
    ["Windows 11/10(1803+) · 64-bit Linux (macOS 미지원)", "Windows 11/10(1803+) · 64-bit Linux (no macOS)", "Windows 11/10(1803+)・64bit Linux（macOS非対応）", "Windows 11/10(1803+)・64-bit Linux（不支援 macOS）", "Windows 11/10(1803+)・64-bit Linux（不支持 macOS）"],
    ["macOS(Apple Silicon) · Linux x64/arm64 · Windows (CUDA 13, 드라이버 R580+)", "macOS (Apple Silicon) · Linux x64/arm64 · Windows (CUDA 13, driver R580+)", "macOS(Apple Silicon)・Linux x64/arm64・Windows（CUDA 13、ドライバR580+）", "macOS（Apple Silicon）・Linux x64/arm64・Windows（CUDA 13，驅動 R580+）", "macOS（Apple Silicon）・Linux x64/arm64・Windows（CUDA 13，驱动 R580+）"],
    ["macOS · Linux · Windows (CPU 전용 실행 가능)", "macOS · Linux · Windows (CPU-only run possible)", "macOS・Linux・Windows（CPU専用実行可）", "macOS・Linux・Windows（可僅用 CPU 執行）", "macOS・Linux・Windows（可仅用 CPU 运行）"],
    ["NVIDIA RTX(12 GB+) · AMD 지원 카드", "NVIDIA RTX (12 GB+) · supported AMD cards", "NVIDIA RTX（12 GB以上）・AMD対応カード", "NVIDIA RTX（12 GB+）・支援的 AMD 顯示卡", "NVIDIA RTX（12 GB+）・支持的 AMD 显卡"],
    ["NVIDIA RTX 중심 · AMD 일부", "Mainly NVIDIA RTX · some AMD", "NVIDIA RTX中心・AMD一部", "以 NVIDIA RTX 為主・部分 AMD", "以 NVIDIA RTX 为主・部分 AMD"],
    ["작은 NVIDIA 카드용(4 GB부터) · AMD 일부", "For small NVIDIA cards (from 4 GB) · some AMD", "小さいNVIDIAカード用（4 GBから）・AMD一部", "適用小 NVIDIA 顯示卡（4 GB 起）・部分 AMD", "适用小 NVIDIA 显卡（4 GB 起）・部分 AMD"],
    ["NVIDIA V100+/RTX 20 이상 · AMD 선택 카드", "NVIDIA V100+/RTX 20 or newer · selected AMD cards", "NVIDIA V100+/RTX 20以上・AMD選択カード", "NVIDIA V100+/RTX 20 以上・選定的 AMD 顯示卡", "NVIDIA V100+/RTX 20 及以上・选定的 AMD 显卡"],
    ["Blackwell(sm_120) / GB10 전용 — RTX 20~40에서는 동작하지 않음", "Blackwell (sm_120) / GB10 only — does not run on RTX 20–40", "Blackwell(sm_120)/GB10専用 — RTX 20〜40では動作しません", "僅限 Blackwell（sm_120）/ GB10 — 在 RTX 20~40 上無法運作", "仅限 Blackwell（sm_120）/ GB10 — 在 RTX 20~40 上无法运行"],
    ["NVIDIA RTX (RTX 5090 검증, 30/40/50 시리즈) — AMD·Intel 미지원", "NVIDIA RTX (validated on RTX 5090, 30/40/50 series) — no AMD/Intel", "NVIDIA RTX（RTX 5090検証、30/40/50シリーズ）— AMD・Intel非対応", "NVIDIA RTX（RTX 5090 驗證，30/40/50 系列）— 不支援 AMD・Intel", "NVIDIA RTX（RTX 5090 验证，30/40/50 系列）— 不支持 AMD・Intel"],
    ["RTX 30/40 검증 — RTX 20/50·GTX 10·AMD(HIP)는 실험, Intel 미지원, VRAM 8 GB+", "Validated on RTX 30/40 — RTX 20/50·GTX 10·AMD(HIP) experimental, no Intel, VRAM 8 GB+", "RTX 30/40検証 — RTX 20/50・GTX 10・AMD(HIP)は実験的、Intel非対応、VRAM 8 GB以上", "RTX 30/40 驗證 — RTX 20/50・GTX 10・AMD(HIP) 為實驗性質，不支援 Intel，VRAM 8 GB+", "RTX 30/40 验证 — RTX 20/50・GTX 10・AMD(HIP) 为实验性质，不支持 Intel，VRAM 8 GB+"],
    ["Apple Silicon Metal · NVIDIA CUDA(sm_80/86/120/121) — AMD 미지원", "Apple Silicon Metal · NVIDIA CUDA (sm_80/86/120/121) — no AMD", "Apple Silicon Metal・NVIDIA CUDA(sm_80/86/120/121) — AMD非対応", "Apple Silicon Metal・NVIDIA CUDA（sm_80/86/120/121）— 不支援 AMD", "Apple Silicon Metal・NVIDIA CUDA（sm_80/86/120/121）— 不支持 AMD"],
    ["Metal · CUDA · Vulkan · ROCm · CPU — 자동 선택", "Metal · CUDA · Vulkan · ROCm · CPU — auto-selected", "Metal・CUDA・Vulkan・ROCm・CPU — 自動選択", "Metal・CUDA・Vulkan・ROCm・CPU — 自動選擇", "Metal・CUDA・Vulkan・ROCm・CPU — 自动选择"],
    // ---- footer
    ["다시 한 번: 이 화면의 모든 수치는 실제로 올린 것이 아닌 예상이며 참고용으로만 사용하세요.",
      "Once more: every number on this screen is an estimate, not something actually loaded — for reference only.",
      "もう一度：この画面のすべての数値は実際にロードしたものでなく、推定値であり参考用です。",
      "再次提醒：畫面上所有數值都是預估而非實際載入，僅供參考。",
      "再次提醒：画面上所有数值均为预估而非实际加载，仅供参考。"],
    ["계산 기준은 4gbVramStrata 실험실과 같은 산식입니다 (카드 − 예약 256 MiB − 밀집 가중치 − 고정 오버헤드 512 MiB − 어텐션 캐시 = 활성 전문가 자리; RAM 예산 = DRAM − OS 보관 3.5 GB − 대화 캐시).",
      "The math matches the 4gbVramStrata lab (card − 256 MiB reserve − dense weights − 512 MiB fixed overhead − attention caches = active-expert room; RAM budget = DRAM − 3.5 GB kept for OS − conversation cache).",
      "計算基準は4gbVramStrataラボと同じ式です（カード − 予約256 MiB − 密な重み − 固定オーバーヘッド512 MiB − アテンションキャッシュ ＝ アクティブExpertの席；RAM予算 ＝ DRAM − OS保持3.5 GB − 会話キャッシュ）。",
      "計算基準與 4gbVramStrata 實驗室相同（顯示卡 − 保留 256 MiB − 密集權重 − 固定開銷 512 MiB − 注意力快取 ＝ 活躍專家空間；RAM 預算 ＝ DRAM − OS 保留 3.5 GB − 對話快取）。",
      "计算基准与 4gbVramStrata 实验室相同（显卡 − 保留 256 MiB − 稠密权重 − 固定开销 512 MiB − 注意力缓存 ＝ 活跃专家空间；RAM 预算 ＝ DRAM − OS 保留 3.5 GB − 对话缓存）。"],
    ["엔진 모델 크기·지원 범위 출처: 각 프로젝트의 공개 문서(Strata · PolyStrata · Maya · Basalt · YASAKANI · Sync-Strata · TensorFold · Bonsai README, setup.py)이며 ~ 표시는 근사값입니다.",
      "Engine model sizes and support ranges come from each project's public docs (Strata · PolyStrata · Maya · Basalt · YASAKANI · Sync-Strata · TensorFold · Bonsai READMEs, setup.py); ~ marks approximate values.",
      "エンジンのモデルサイズ・サポート範囲の出典は各プロジェクトの公開文書（Strata・PolyStrata・Maya・Basalt・YASAKANI・Sync-Strata・TensorFold・BonsaiのREADME、setup.py）で、~は近似値です。",
      "引擎模型大小與支援範圍來源：各專案公開文件（Strata · PolyStrata · Maya · Basalt · YASAKANI · Sync-Strata · TensorFold · Bonsai 的 README、setup.py），~ 表示近似值。",
      "引擎模型大小与支持范围来源：各项目公开文档（Strata・PolyStrata・Maya・Basalt・YASAKANI・Sync-Strata・TensorFold・Bonsai 的 README、setup.py），~ 表示近似值。"],
    // ---- 속성(aria-label)·기타
    ["언어", "Language", "言語", "語言", "语言"],
    ["엔진", "Engine", "エンジン", "引擎", "引擎"],
  ];

  // ---------------------------------------------------------------- 사전 컴파일 (4gbVramStrata 웹과 동일)
  const flat = (s) => String(s).replace(/\s+/g, " ").trim();
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  function compile(ko) {
    let re = "", i = 0;
    while (i < ko.length) {
      const c = ko[i];
      if (c === "#") { re += "(-?\\d[\\d.,]*)"; i += 1; }
      else if (c === "@") { re += "(.+?)"; i += 1; }
      else { let j = i; while (j < ko.length && ko[j] !== "#" && ko[j] !== "@") j += 1; re += escRe(ko.slice(i, j)); i = j; }
    }
    return new RegExp("^" + re + "$");
  }
  const built = {};
  function langMaps(l) {
    if (!built[l]) {
      const exact = new Map(), patterns = [];
      for (const row of TABLE) {
        const ko = flat(row[0]), val = row[NAMES.findIndex((x) => x[0] === l)];
        if (val == null || val === ko) continue;
        if (/[#@]/.test(ko)) patterns.push([compile(ko), val]);
        else exact.set(ko, val);
      }
      patterns.sort((a, b) => b[0].source.length - a[0].source.length);
      built[l] = { exact, patterns };
    }
    return built[l];
  }
  function tr(text) {
    if (lang === "ko" || !/\S/.test(text)) return null;
    const m = langMaps(lang), t = flat(text);
    const hit = m.exact.get(t);
    if (hit != null) return pad(text, hit);
    for (const [re, tpl] of m.patterns) {
      const mm = t.match(re);
      if (!mm) continue;
      let i = 0;
      return pad(text, tpl.replace(/\$(\d)/g, (d, n) => (mm[+n] != null ? mm[+n] : d))
                           .replace(/[#@]/g, () => (mm[++i] != null ? mm[i] : "#")));
    }
    return null;
  }
  function pad(orig, val) {
    const lead = /^\s*/.exec(orig)[0], trail = /\s*$/.exec(orig)[0];
    return lead + val + trail;
  }

  // ---------------------------------------------------------------- DOM 통과
  const SKIP = "script,style,textarea,code,pre,#lang-btns";
  const originals = new WeakMap();
  const attrOriginals = new WeakMap();
  const applied = new WeakMap();
  let muting = false;

  function skip(node) {
    for (let el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement; el; el = el.parentElement)
      if (el.matches && el.matches(SKIP)) return true;
    return false;
  }
  function translateText(node) {
    if (skip(node)) return;
    const cur = node.nodeValue;
    if (!cur || !/\S/.test(cur)) return;
    if (applied.get(node) === cur && originals.has(node)) return;
    originals.set(node, cur);
    const out = lang === "ko" ? null : tr(cur);
    if (out == null || out === cur) { applied.delete(node); return; }
    muting = true;
    try { node.nodeValue = out; applied.set(node, out); } finally { muting = false; }
  }
  function translateAttrs(el) {
    if (!el.getAttribute) return;
    let store = attrOriginals.get(el);
    for (const attr of ["title", "placeholder", "aria-label"]) {
      const cur = el.getAttribute(attr);
      if (cur == null) continue;
      if (!store) { store = {}; attrOriginals.set(el, store); }
      const src = store[attr] != null && store["applied:" + attr] === cur ? store[attr] : cur;
      store[attr] = src;
      const out = lang === "ko" ? null : tr(src);
      const want = out == null ? src : out;
      store["applied:" + attr] = want;
      if (cur !== want) { muting = true; try { el.setAttribute(attr, want); } finally { muting = false; } }
    }
  }
  function walk(root) {
    if (root.nodeType === Node.TEXT_NODE) { translateText(root); return; }
    if (!(root.nodeType === Node.ELEMENT_NODE || root.nodeType === Node.DOCUMENT_NODE || root.nodeType === Node.FRAGMENT_NODE)) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n;
    while ((n = w.nextNode())) {
      if (n.nodeType === Node.TEXT_NODE) translateText(n);
      else translateAttrs(n);
    }
  }

  // ---------------------------------------------------------------- 언어 상태
  let lang = "ko";
  try { lang = localStorage.getItem(STORE) || "ko"; } catch (e) { lang = "ko"; }
  if (!NAMES.some((x) => x[0] === lang)) lang = "ko";

  function restore() {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const src = originals.get(n);
      if (src != null && applied.has(n)) { muting = true; try { n.nodeValue = src; } finally { muting = false; } }
    }
  }
  function syncButtons() {
    for (const b of document.querySelectorAll("#lang-btns .lang-btn"))
      b.setAttribute("aria-pressed", b.dataset.lang === lang ? "true" : "false");
  }
  function setLang(l) {
    lang = l;
    try { localStorage.setItem(STORE, l); } catch (e) {}
    document.documentElement.lang = l === "zh-TW" ? "zh-Hant" : l.split("-")[0];
    restore();
    walk(document.body);
    applyTitle();
    syncButtons();
  }

  // <title>은 body walk 밖에 있으므로 따로 처리한다
  let titleOrig = null;
  function applyTitle() {
    const tEl = document.querySelector("title");
    if (!tEl) return;
    if (titleOrig == null) titleOrig = tEl.textContent;
    muting = true;
    try { tEl.textContent = lang === "ko" ? titleOrig : (tr(titleOrig) || titleOrig); } finally { muting = false; }
  }

  // ---------------------------------------------------------------- 관찰 (앱이 나중에 렌더하는 노드)
  let queue = new Set(), timer = null;
  function flush() {
    timer = null;
    const todo = queue; queue = new Set();
    for (const n of todo) {
      if (n.nodeType === Node.TEXT_NODE) translateText(n);
      else if (n.nodeType === Node.ELEMENT_NODE) walk(n);
    }
  }
  const observer = new MutationObserver((records) => {
    if (muting) return;
    for (const r of records) {
      if (r.type === "characterData") queue.add(r.target);
      else for (const n of r.addedNodes) queue.add(n);
    }
    if (!timer) timer = setTimeout(flush, 60);
  });

  function boot() {
    document.documentElement.lang = lang === "zh-TW" ? "zh-Hant" : lang.split("-")[0];
    walk(document.body);
    applyTitle();
    syncButtons();
    for (const b of document.querySelectorAll("#lang-btns .lang-btn"))
      b.onclick = () => setLang(b.dataset.lang);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: false });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
