/**
 * 全局多语言字典与命理术语对照库（繁中 zh、简中 cn、英文 en、日文 ja、韩文 ko、泰文 th）
 * 逻辑来源：ziwei-fortune/webapp/app.js:7538-8069 (I18N, ASTRO_TERMS, getTermAnnotated, detectLanguage)
 */

export type SupportedLocale = 'zh' | 'cn' | 'en' | 'ja' | 'ko' | 'th';

export interface QuickQuestionsDict {
  today: string;
  lottery: string;
  letou: string;
  piancai: string;
  taohua: string;
  guiren: string;
  jiankang: string;
  shangji: string;
  shiye: string;
  clothing: string;
  remedy: string;
}

export interface RankingsTabsDict {
  all: string;
  piancai: string;
  letou: string;
  taohua: string;
  guiren: string;
  shiye: string;
  jiankang: string;
  shangji: string;
}

export interface LocaleDictionary {
  appTitle: string;
  navChat: string;
  navRankings: string;
  navRemedy: string;
  navCharts: string;
  navAbout: string;
  btnNewClient: string;
  langToggle: string;
  sidebarTitle: string;
  btnAddSession: string;
  sessionCount: (n: number) => string;
  chatIndicator: (name: string, bday: string) => string;
  inputPlaceholder: string;
  btnSend: string;
  quickTitle: string;
  quickSubtitle: string;
  quickQuestions: QuickQuestionsDict;
  rankingsTitle: string;
  btnDownloadJSON: string;
  rankingsTabs: RankingsTabsDict;
  modalNewTitle: string;
  modalNewSubtitle: string;
  labelClientName: string;
  labelBirthday: string;
  labelCalendarType: string;
  labelGender: string;
  labelBirthTime: string;
  labelTargetYear: string;
  labelIncludeNatal: string;
  btnSubmitNew: string;
  remedyHeadTitle: string;
  remedyHeadSubtitle: string;
  chatgptBrandName?: string;
  chatgptAboutLink?: string;
  chatgptToggleInputTextExpand?: string;
  chatgptToggleInputTextCollapse?: string;
  chatgptInputTitle?: string;
  chatgptCloseInput?: string;
  chatgptLabelName?: string;
  chatgptLabelBirthday?: string;
  chatgptLabelClockTime?: string;
  chatgptLabelPlace?: string;
  chatgptLabelGender?: string;
  chatgptGenderMale?: string;
  chatgptGenderFemale?: string;
  chatgptLabelApiKey?: string;
  chatgptBtnSubmit?: string;
  chatgptBirthPromptText?: string;
  chatgptPlaceholder?: string;
  chatgptDisclaimer?: string;
  drawerBirthData?: string;
  drawerShare?: string;
  drawerSwitchAccount?: string;
  drawerAbout?: string;
  mobileNavToggle?: string;
}

export const I18N: Readonly<Record<SupportedLocale, LocaleDictionary>> = {
  zh: {
    appTitle: '紫微斗數流日命理運算系統 — 滿天星 Plus',
    navChat: '命理諮詢對話',
    navRankings: '全年運勢排行',
    navRemedy: 'Jack 老師個人化處方',
    navCharts: '命盤與運勢視覺化',
    navAbout: '關於',
    btnNewClient: '➕ 新建客戶命盤',
    langToggle: '繁中 ▾',
    sidebarTitle: '👥 客戶聊天室',
    btnAddSession: '➕ 新增',
    sessionCount: (n) => `共 ${n} 位客戶紀錄`,
    chatIndicator: (name, bday) => `正在向【${name}】(${bday}) 的命盤提問...`,
    inputPlaceholder: '請輸入想詢問的問題（Enter 送出，Shift+Enter 換行），例如：「這個人哪一天適合買彩券？」...',
    btnSend: '送出 ↵',
    quickTitle: '⚡ 快速提問',
    quickSubtitle: '點擊直接詢問當前客戶',
    quickQuestions: {
      today: '今天流日如何',
      lottery: '這個人哪一天適合買彩券',
      letou: '這個人的樂透運 TOP 10',
      piancai: '這個人今年偏財如何',
      taohua: '這個人的桃花日是哪幾天',
      guiren: '這個人的貴人什麼時候出現',
      jiankang: '這個人的健康要注意什麼',
      shangji: '這個人的商機日是哪幾天',
      shiye: '這個人事業升遷如何',
      clothing: '這個人五行穿衣開運色是什麼',
      remedy: '推薦這個人的開運處方',
    },
    rankingsTitle: '🏆 全年 365 天流日運勢排行榜',
    btnDownloadJSON: '📥 下載此客戶全年數據 JSON',
    rankingsTabs: {
      all: '全部排行榜',
      piancai: '💰 偏財日',
      letou: '🎫 樂透運',
      taohua: '🌸 桃花日',
      guiren: '👑 貴人日',
      shiye: '💼 事業日',
      jiankang: '🌿 健康日',
      shangji: '🚀 巨大商機日',
    },
    modalNewTitle: '➕ 新建客戶命盤與聊天室',
    modalNewSubtitle: '輸入客戶生日、時辰與出生地，系統將結合真太陽時、七政四餘與全年流日數據',
    labelClientName: '客戶姓名 / 代稱',
    labelBirthday: '出生日期 (陽曆/國曆)',
    labelCalendarType: '曆法類型',
    labelGender: '性別',
    labelBirthTime: '出生時辰',
    labelTargetYear: '推算年份',
    labelIncludeNatal: '同時納入本命四化加權計算',
    btnSubmitNew: '⚡ 開始計算並建立聊天室',
    remedyHeadTitle: '🌿 Jack 老師開運工具箱',
    remedyHeadSubtitle: '道家天紀傳承 · 五行調和 · 中藥辟穢 · 經絡通神 · 陽宅立向',
    chatgptBrandName: 'Jack 老師 AI 命理',
    chatgptAboutLink: '關於',
    chatgptToggleInputTextExpand: '編輯出生資料',
    chatgptToggleInputTextCollapse: '收合出生資料',
    chatgptInputTitle: '出生資料輸入（排盤基準）',
    chatgptCloseInput: '✕ 收合',
    chatgptLabelName: '姓名（選填）',
    chatgptLabelBirthday: '出生日期 (西元)',
    chatgptLabelClockTime: '出生時間 (HH:mm)',
    chatgptLabelPlace: '出生地（城市或經緯度）',
    chatgptLabelGender: '性別',
    chatgptGenderMale: '男 (乾造)',
    chatgptGenderFemale: '女 (坤造)',
    chatgptLabelApiKey: 'API Key（DeepInfra 選填）',
    chatgptBtnSubmit: '開始排盤',
    chatgptBirthPromptText: '請輸入你的出生資料，Jack 老師才能幫你排盤。',
    chatgptPlaceholder: '向 Jack 老師提問...（Enter 送出，Shift+Enter 換行）',
    chatgptDisclaimer: '由 Jack 老師設計的 AI 工具 · 商業機密保護中',
    drawerBirthData: '出生資料',
    drawerShare: '脫敏分享',
    drawerSwitchAccount: '切換帳號',
    drawerAbout: '關於我們',
    mobileNavToggle: '目錄',
  },
  cn: {
    appTitle: '紫微斗数流日命理运算系统 — 满天星 Plus',
    navChat: '命理咨询对话',
    navRankings: '全年八大排行',
    navRemedy: 'Jack 老师个性化处方',
    navCharts: '命盘与运势可视化',
    navAbout: '关于',
    btnNewClient: '➕ 新建客户命盘',
    langToggle: '简中 ▾',
    sidebarTitle: '👥 客户聊天室',
    btnAddSession: '➕ 新增',
    sessionCount: (n) => `共 ${n} 位客户记录`,
    chatIndicator: (name, bday) => `正在向【${name}】(${bday}) 的命盘提问...`,
    inputPlaceholder: '请输入想询问的问题（Enter 发送，Shift+Enter 换行），例如：“这个人哪一天适合买彩票？”...',
    btnSend: '发送 ↵',
    quickTitle: '⚡ 快速提问',
    quickSubtitle: '点击直接询问当前客户',
    quickQuestions: {
      today: '今天流日如何',
      lottery: '这个人哪一天适合买彩票',
      letou: '这个人的乐透运 TOP 10',
      piancai: '这个人今年偏财如何',
      taohua: '这个人的桃花日是哪几天',
      guiren: '这个人的贵人什么时候出现',
      jiankang: '这个人的健康要注意什么',
      shangji: '这个人的商机日是哪几天',
      shiye: '这个人事业升迁如何',
      clothing: '这个人五行穿衣开运色是什么',
      remedy: '推荐这个人的开运处方',
    },
    rankingsTitle: '🏆 全年 365 天流日运势排行榜',
    btnDownloadJSON: '📥 下载此客户全年数据 JSON',
    rankingsTabs: {
      all: '全部排行榜',
      piancai: '💰 偏财日',
      letou: '🎫 乐透运',
      taohua: '🌸 桃花日',
      guiren: '👑 贵人日',
      shiye: '💼 事业日',
      jiankang: '🌿 健康日',
      shangji: '🚀 巨大商机日',
    },
    modalNewTitle: '➕ 新建客户命盘与聊天室',
    modalNewSubtitle: '输入客户生日、时辰与出生地，系统将结合真太阳时、七政四余与全年流日数据',
    labelClientName: '客户姓名 / 代称',
    labelBirthday: '出生日期 (阳历/国历)',
    labelCalendarType: '历法类型',
    labelGender: '性别',
    labelBirthTime: '出生时辰',
    labelTargetYear: '推算年份',
    labelIncludeNatal: '同时纳入本命四化加权计算',
    btnSubmitNew: '⚡ 开始计算并建立聊天室',
    remedyHeadTitle: '🌿 Jack 老师开运工具箱',
    remedyHeadSubtitle: '道家天纪传承 · 五行调和 · 中药辟秽 · 经络通神 · 阳宅立向',
    chatgptBrandName: 'Jack 老师 AI 命理',
    chatgptAboutLink: '关于',
    chatgptToggleInputTextExpand: '编辑出生资料',
    chatgptToggleInputTextCollapse: '收合出生资料',
    chatgptInputTitle: '出生资料输入（排盘基准）',
    chatgptCloseInput: '✕ 收合',
    chatgptLabelName: '姓名（选填）',
    chatgptLabelBirthday: '出生日期 (西元)',
    chatgptLabelClockTime: '出生时间 (HH:mm)',
    chatgptLabelPlace: '出生地（城市或经纬度）',
    chatgptLabelGender: '性别',
    chatgptGenderMale: '男 (乾造)',
    chatgptGenderFemale: '女 (坤造)',
    chatgptLabelApiKey: 'API Key（DeepInfra 选填）',
    chatgptBtnSubmit: '开始排盘',
    chatgptBirthPromptText: '请输入你的出生资料，Jack 老师才能帮你排盘。',
    chatgptPlaceholder: '向 Jack 老师提问...（Enter 发送，Shift+Enter 换行）',
    chatgptDisclaimer: '由 Jack 老师设计的 AI 工具 · 商业机密保护中',
  },
  en: {
    appTitle: 'Zi Wei Dou Shu Fortune System — Full Astrolabe Plus',
    navChat: 'Consultation Chat',
    navRankings: 'Yearly Top 8 Rankings',
    navRemedy: "Jack's Personalized Remedy",
    navCharts: 'Visual Charts & Heatmap',
    navAbout: 'About',
    btnNewClient: '➕ New Client Chart',
    langToggle: 'English ▾',
    sidebarTitle: '👥 Client Chatrooms',
    btnAddSession: '➕ Add',
    sessionCount: (n) => `${n} Client Records`,
    chatIndicator: (name, bday) => `Consulting chart of 【${name}】 (${bday})...`,
    inputPlaceholder: 'Ask a fortune question (Enter to send, Shift+Enter for new line), e.g. "Which day is best for lottery?"...',
    btnSend: 'Send ↵',
    quickTitle: '⚡ Quick Inquiries',
    quickSubtitle: 'Click to ask for active client',
    quickQuestions: {
      today: "How is today's transit fortune?",
      lottery: 'Which day is best to buy lottery?',
      letou: 'Top 10 Lottery Luck Days',
      piancai: 'How is windfall wealth this year?',
      taohua: 'When are the romance days?',
      guiren: 'When will noble benefactors appear?',
      jiankang: 'What health signs to watch out for?',
      shangji: 'When are the major business opportunity days?',
      shiye: 'How is career promotion outlook?',
      clothing: 'What are the five-element lucky clothing colors?',
      remedy: 'Recommend personal remedies',
    },
    rankingsTitle: '🏆 365-Day Daily Fortune Leaderboard',
    btnDownloadJSON: '📥 Download Full-Year JSON Data',
    rankingsTabs: {
      all: 'All Leaderboards',
      piancai: '💰 Windfall Wealth',
      letou: '🎫 Lottery Luck',
      taohua: '🌸 Romance / Peach Blossom',
      guiren: '👑 Noble Benefactor',
      shiye: '💼 Career & Prestige',
      jiankang: '🌿 Health & Longevity',
      shangji: '🚀 Mega Opportunity',
    },
    modalNewTitle: '➕ Create Client Chart & Chatroom',
    modalNewSubtitle: 'Enter birthday, clock time, and birthplace for True Solar Time and Seven Luminaries calculation',
    labelClientName: 'Client Name / Alias',
    labelBirthday: 'Date of Birth (Solar)',
    labelCalendarType: 'Calendar System',
    labelGender: 'Gender',
    labelBirthTime: 'Birth Hour (Shichen)',
    labelTargetYear: 'Target Transit Year',
    labelIncludeNatal: 'Include Natal Mutagens in scoring',
    btnSubmitNew: '⚡ Calculate & Open Consultation',
    remedyHeadTitle: '🌿 Master Jack Classical Remedy Toolbox',
    remedyHeadSubtitle: 'Daoist Tianji Heritage · Five Elements Balance · Herbal Aromatherapy · Acupuncture Channeling',
    chatgptBrandName: 'Teacher Jack AI Astrology',
    chatgptAboutLink: 'About',
    chatgptToggleInputTextExpand: 'Edit Birth Info',
    chatgptToggleInputTextCollapse: 'Collapse Birth Info',
    chatgptInputTitle: 'Birth Data Input (Chart Basis)',
    chatgptCloseInput: '✕ Close',
    chatgptLabelName: 'Name (Optional)',
    chatgptLabelBirthday: 'Birth Date (AD)',
    chatgptLabelClockTime: 'Birth Time (HH:mm)',
    chatgptLabelPlace: 'Birthplace (City/Coordinates)',
    chatgptLabelGender: 'Gender',
    chatgptGenderMale: 'Male',
    chatgptGenderFemale: 'Female',
    chatgptLabelApiKey: 'API Key (DeepInfra Optional)',
    chatgptBtnSubmit: 'Generate Chart',
    chatgptBirthPromptText: 'Please enter your birth details so Teacher Jack can calculate your chart.',
    chatgptPlaceholder: 'Ask Teacher Jack a question... (Enter to send, Shift+Enter for newline)',
    chatgptDisclaimer: 'AI astrology tool designed by Teacher Jack · Protected by trade secret',
    drawerBirthData: 'Birth Data',
    drawerShare: 'Share (Anonymized)',
    drawerSwitchAccount: 'Switch Account',
    drawerAbout: 'About Us',
    mobileNavToggle: 'Menu',
  },
  ja: {
    appTitle: '紫微斗数・流日運勢推算システム — 満天星 Plus',
    navChat: '命理鑑定チャット',
    navRankings: '年間八大ランキング',
    navRemedy: 'Jack先生パーソナル開運処方',
    navCharts: '命盤と運勢の可視化',
    navAbout: '概要',
    btnNewClient: '➕ 新規クライアント命盤',
    langToggle: '日本語 ▾',
    sidebarTitle: '👥 クライアント一覧',
    btnAddSession: '➕ 追加',
    sessionCount: (n) => `登録クライアント：${n} 件`,
    chatIndicator: (name, bday) => `【${name}】様 (${bday}) の命盤について相談中...`,
    inputPlaceholder: '質問を入力してください（Enterで送信、Shift+Enterで改行）。例：「宝くじを買うのに最適な日はいつですか？」...',
    btnSend: '送信 ↵',
    quickTitle: '⚡ クイック質問',
    quickSubtitle: 'クリックして即座に質問',
    quickQuestions: {
      today: '本日の流日運勢はどうですか',
      lottery: '宝くじを買うのに適した日はいつですか',
      letou: '宝くじ当選運 TOP 10',
      piancai: '今年の臨時収入・偏財運はどうですか',
      taohua: '恋愛・モテ期はいつですか',
      guiren: 'キーパーソン・貴人はいつ現れますか',
      jiankang: '健康面で注意すべき点は何ですか',
      shangji: '大きなビジネスチャンス日はいつですか',
      shiye: '仕事運と出世のタイミングはどうですか',
      clothing: '五行のラッキーカラーは何ですか',
      remedy: 'おすすめの開運処方を教えてください',
    },
    rankingsTitle: '🏆 365日 年間流日運勢ランキング',
    btnDownloadJSON: '📥 年間JSONデータをダウンロード',
    rankingsTabs: {
      all: '総合ランキング',
      piancai: '💰 偏財・臨時収入',
      letou: '🎫 宝くじ運',
      taohua: '🌸 桃花・恋愛運',
      guiren: '👑 貴人・引き立て運',
      shiye: '💼 事業・出世運',
      jiankang: '🌿 健康運',
      shangji: '🚀 ビッグビジネス日',
    },
    modalNewTitle: '➕ 新規クライアント命盤と相談室作成',
    modalNewSubtitle: '生年月日、出生時刻、出生地を入力。真太陽時・七政四余・年間流日を精確に推算します',
    labelClientName: 'お名前 / 呼称',
    labelBirthday: '生年月日 (西暦/太陽暦)',
    labelCalendarType: '暦の種類',
    labelGender: '性別',
    labelBirthTime: '出生時辰 (2時間単位)',
    labelTargetYear: '推算対象年',
    labelIncludeNatal: '本命四化の重み付けを含める',
    btnSubmitNew: '⚡ 推算開始してチャットを開く',
    remedyHeadTitle: '🌿 Jack先生の開運ツールボックス',
    remedyHeadSubtitle: '道家天紀の正統伝承 · 五行調和 · 芳香療法 · 経絡活性化 · 風水立向',
    chatgptBrandName: 'Jack 先生 AI 占術',
    chatgptAboutLink: '概要',
    chatgptToggleInputTextExpand: '生年月日を編集',
    chatgptToggleInputTextCollapse: '入力欄を閉じる',
    chatgptInputTitle: '生年月日入力（命盤基準）',
    chatgptCloseInput: '✕ 閉じる',
    chatgptLabelName: 'お名前（任意）',
    chatgptLabelBirthday: '生年月日 (西暦)',
    chatgptLabelClockTime: '出生時刻 (HH:mm)',
    chatgptLabelPlace: '出生地（都市または経緯度）',
    chatgptLabelGender: '性別',
    chatgptGenderMale: '男性 (乾造)',
    chatgptGenderFemale: '女性 (坤造)',
    chatgptLabelApiKey: 'API Key（DeepInfra 任意）',
    chatgptBtnSubmit: '命盤を作成',
    chatgptBirthPromptText: 'あなたの生年月日を入力してください。Jack 先生が命盤を作成します。',
    chatgptPlaceholder: 'Jack 先生に質問する... (Enter で送信、Shift+Enter で改行)',
    chatgptDisclaimer: 'Jack 先生が設計した AI 占術ツール · 商業機密保護中',
    drawerBirthData: '出生データ',
    drawerShare: '匿名共有',
    drawerSwitchAccount: 'アカウント切替',
    drawerAbout: '私たちについて',
    mobileNavToggle: 'メニュー',
  },
  ko: {
    appTitle: '자미두수 유일 운세 연산 시스템 — 만천성 Plus',
    navChat: '명리 상담 채팅',
    navRankings: '연간 8대 랭킹',
    navRemedy: 'Jack선생님 개인 맞춤 처방',
    navCharts: '명반 및 운세 시각화',
    navAbout: '소개',
    btnNewClient: '➕ 신규 고객 명반 등록',
    langToggle: '한국어 ▾',
    sidebarTitle: '👥 고객 채팅방',
    btnAddSession: '➕ 추가',
    sessionCount: (n) => `총 ${n}명의 고객 기록`,
    chatIndicator: (name, bday) => `【${name}】(${bday}) 님의 명반에 대해 상담 중...`,
    inputPlaceholder: '질문을 입력하세요 (Enter 전송, Shift+Enter 줄바꿈). 예: "이 사람은 복권을 사기에 언제가 가장 좋은가요?"...',
    btnSend: '전송 ↵',
    quickTitle: '⚡ 빠른 질문',
    quickSubtitle: '클릭하여 즉시 질문하기',
    quickQuestions: {
      today: '오늘의 유일 운세는 어떤가요?',
      lottery: '복권을 사기에 가장 좋은 날은 언제인가요?',
      letou: '복권 당첨운 TOP 10',
      piancai: '올해 횡재수와 편재운은 어떤가요?',
      taohua: '도화운과 연애운이 좋은 날은 언제인가요?',
      guiren: '나를 도와줄 귀인은 언제 나타나나요?',
      jiankang: '건강상 주의해야 할 점은 무엇인가요?',
      shangji: '큰 사업 기회가 오는 날은 언제인가요?',
      shiye: '사업운과 승진운은 어떤가요?',
      clothing: '오행에 맞는 행운의 옷 색상은 무엇인가요?',
      remedy: '추천하는 개운 처방을 알려주세요',
    },
    rankingsTitle: '🏆 365일 연간 유일 운세 랭킹보드',
    btnDownloadJSON: '📥 연간 JSON 데이터 다운로드',
    rankingsTabs: {
      all: '전체 랭킹',
      piancai: '💰 편재·횡재일',
      letou: '🎫 복권 행운일',
      taohua: '🌸 도화·연애일',
      guiren: '👑 귀인 도움일',
      shiye: '💼 사업·승진일',
      jiankang: '🌿 건강 수호일',
      shangji: '🚀 초대형 사업기회일',
    },
    modalNewTitle: '➕ 신규 고객 명반 및 상담실 생성',
    modalNewSubtitle: '생년월일, 출생시간, 출생지를 입력하시면 진태양시·칠정사여·연간 유일 운세를 정밀 산출합니다',
    labelClientName: '고객명 / 호칭',
    labelBirthday: '생년월일 (양력)',
    labelCalendarType: '역법 종류',
    labelGender: '성별',
    labelBirthTime: '출생 시진 (2시간 단위)',
    labelTargetYear: '추산 연도',
    labelIncludeNatal: '본명 사화 가중치 포함',
    btnSubmitNew: '⚡ 연산 시작 및 상담실 생성',
    remedyHeadTitle: '🌿 Jack선생님 개운 툴박스',
    remedyHeadSubtitle: '도가 천기 전승 · 오행 조화 · 중약 방향 요법 · 경락 소통 · 풍수 방위',
  },
  th: {
    appTitle: 'ระบบจัดอันดับและคำนวณดวงชะตารายวันตลอดปี 2026 จื่อเวยโต้วซู่ — Full Astrolabe Plus',
    navChat: 'ปรึกษาดวงชะตา',
    navRankings: 'จัดอันดับดวงชะตาตลอดปี (8 ด้าน)',
    navRemedy: 'เครื่องมือปรับดวงอาจารย์ Jack',
    navCharts: 'แผนภูมิทัศน์ดวงชะตา',
    navAbout: 'เกี่ยวกับ',
    btnNewClient: '➕ สร้างดวงชะตาลูกค้าใหม่',
    langToggle: 'ไทย ▾',
    sidebarTitle: '👥 รายการห้องแชทลูกค้า',
    btnAddSession: '➕ เพิ่ม',
    sessionCount: (n) => `บันทึกลูกค้าทั้งหมด ${n} ท่าน`,
    chatIndicator: (name, bday) => `กำลังถามคำถามเกี่ยวกับดวงชะตาของ【${name}】(${bday})...`,
    inputPlaceholder: 'กรุณาพิมพ์คำถาม (Enter เพื่อส่ง, Shift+Enter เพื่อขึ้นบรรทัดใหม่) เช่น "คนนี้เหมาะจะซื้อหวยวันไหน?"...',
    btnSend: 'ส่ง ↵',
    quickTitle: '⚡ คำถามด่วน',
    quickSubtitle: 'คลิกเพื่อถามดวงลูกค้าปัจจุบันทันที',
    quickQuestions: {
      today: 'ดวงรายวันวันนี้เป็นอย่างไร',
      lottery: 'คนนี้เหมาะจะซื้อหวยวันไหน',
      letou: '10 อันดับวันโชคลาภลอตเตอรี่สูงสุด',
      piancai: 'ดวงลาภลอยปีนี้ของคนนี้เป็นอย่างไร',
      taohua: 'วันดาวดอกท้อเสน่ห์แรงคือวันไหนบ้าง',
      guiren: 'ดาวผู้อุปถัมภ์จะปรากฏเมื่อไหร่',
      jiankang: 'สุขภาพต้องระวังเรื่องอะไรบ้าง',
      shangji: 'วันโอกาสทองทางธุรกิจคือวันไหนบ้าง',
      shiye: 'ดวงการงานการเลื่อนตำแหน่งเป็นอย่างไร',
      clothing: 'สีเสื้อผ้าเสริมดวงตามธาตุห้าคือสีอะไร',
      remedy: 'แนะนำวิธีปรับดวงสำหรับคนนี้',
    },
    rankingsTitle: '🏆 ตารางจัดอันดับดวงชะตารายวัน 365 วันตลอดปี',
    btnDownloadJSON: '📥 ดาวน์โหลดข้อมูล JSON ทั้งปีของลูกค้านี้',
    rankingsTabs: {
      all: 'การจัดอันดับทั้งหมด',
      piancai: '💰 วันลาภลอย',
      letou: '🎫 โชคลาภลอตเตอรี่',
      taohua: '🌸 วันดาวดอกท้อ',
      guiren: '👑 วันผู้อุปถัมภ์',
      shiye: '💼 วันความก้าวหน้าการงาน',
      jiankang: '🌿 วันสุขภาพ',
      shangji: '🚀 วันโอกาสธุรกิจใหญ่',
    },
    modalNewTitle: '➕ สร้างดวงชะตาลูกค้าใหม่',
    modalNewSubtitle: 'กรอกวันเดือนปีเกิดและเวลาตกฟาก ระบบจะสร้างห้องแชทแยกอิสระและคำนวณดวงชะตารายวันตลอดปี 2026',
    labelClientName: 'ชื่อลูกค้า / นามเรียก',
    labelBirthday: 'วันเดือนปีเกิด (ค.ศ./สุริยคติ)',
    labelCalendarType: 'ประเภทปฏิทิน',
    labelGender: 'เพศ',
    labelBirthTime: 'เวลาตกฟาก (ยาม)',
    labelTargetYear: 'ปีที่ต้องการคำนวณ',
    labelIncludeNatal: 'รวมค่าน้ำหนักสี่การแปลงสภาพกำเนิดด้วย',
    btnSubmitNew: '⚡ เริ่มคำนวณและสร้างห้องแชท',
    remedyHeadTitle: '🌿 กล่องเครื่องมือปรับดวงชะตาอาจารย์ Jack',
    remedyHeadSubtitle: 'สืบทอดศาสตร์ฟ้าเต๋า · ปรับธาตุทั้งห้า · สุคนธบำบัดขจัดอัปมงคล · ปรับลมปราณ · ฮวงจุ้ยตำแหน่งประธาน',
    chatgptBrandName: 'อาจารย์ Jack โหราศาสตร์ AI',
    chatgptAboutLink: 'เกี่ยวกับ',
    chatgptToggleInputTextExpand: 'แก้ไขข้อมูลเกิด',
    chatgptToggleInputTextCollapse: 'ซ่อนข้อมูลเกิด',
    chatgptInputTitle: 'กรอกข้อมูลเกิด (เกณฑ์ผูกดวง)',
    chatgptCloseInput: '✕ ซ่อน',
    chatgptLabelName: 'ชื่อ (ไม่บังคับ)',
    chatgptLabelBirthday: 'วันเกิด (ค.ศ.)',
    chatgptLabelClockTime: 'เวลาเกิด (ชั่วโมง:นาที)',
    chatgptLabelPlace: 'สถานที่เกิด (เมือง/พิกัด)',
    chatgptLabelGender: 'เพศ',
    chatgptGenderMale: 'ชาย (乾造)',
    chatgptGenderFemale: 'หญิง (坤造)',
    chatgptLabelApiKey: 'API Key (DeepInfra ไม่บังคับ)',
    chatgptBtnSubmit: 'เริ่มผูกดวงชะตา',
    chatgptBirthPromptText: 'กรุณากรอกข้อมูลวันเดือนปีเกิดของคุณ เพื่อให้อาจารย์ Jack ผูกดวงชะตาให้ครับ',
    chatgptPlaceholder: 'ถามคำถามกับอาจารย์ Jack... (กด Enter เพื่อส่ง, Shift+Enter เพื่อขึ้นบรรทัดใหม่)',
    chatgptDisclaimer: 'เครื่องมือ AI ที่ออกแบบโดยอาจารย์ Jack · ได้รับการคุ้มครองความลับทางการค้า',
    drawerBirthData: 'ข้อมูลวันเกิด',
    drawerShare: 'แชร์รายงาน',
    drawerSwitchAccount: 'สลับบัญชี',
    drawerAbout: 'เกี่ยวกับเรา',
    mobileNavToggle: 'เมนู',
  },
};

export const ASTRO_TERMS: Readonly<Record<string, Record<SupportedLocale, string>>> = {
  '紫微星': { zh: '紫微星 (帝王之主)', cn: '紫微星 (帝王之主)', en: '紫微星 (Ziwei / Emperor Star)', ja: '紫微星 (エンペラースター / 帝王星)', ko: '紫微星 (자미성 / 제왕성)', th: '紫微星 (ดาวจักรพรรดิ์จื่อเวย)' },
  '天機星': { zh: '天機星 (智慧智謀)', cn: '天机星 (智慧智谋)', en: '天機星 (Tianji / Celestial Strategist)', ja: '天機星 (天機・知恵の星)', ko: '天機星 (천기성 / 지혜의 별)', th: '天機星 (ดาวเทียนจี / เสนาธิการ)' },
  '太陽星': { zh: '太陽星 (光明博愛)', cn: '太阳星 (光明博爱)', en: '太陽星 (Taiyang / The Great Sun)', ja: '太陽星 (太陽星・光明の星)', ko: '太陽星 (태양성 / 광명의 별)', th: '太陽星 (ดาวพระอาทิตย์ไท่หยาง)' },
  '武曲星': { zh: '武曲星 (正財剛毅)', cn: '武曲星 (正财刚毅)', en: '武曲星 (Wuqu / Star of Finance & Courage)', ja: '武曲星 (武曲・財政の星)', ko: '武曲星 (무곡성 / 재물의 별)', th: '武曲星 (ดาวอู่ชวี / ดาวการเงิน)' },
  '天同星': { zh: '天同星 (福德福星)', cn: '天同星 (福德福星)', en: '天同星 (Tiantong / Star of Harmony & Blessings)', ja: '天同星 (天同・福徳の星)', ko: '天同星 (천동성 / 복덕의 별)', th: '天同星 (ดาวเทียนถง / ดาวแห่งโชค)' },
  '廉貞星': { zh: '廉貞星 (次桃花威權)', cn: '廉贞星 (次桃花威权)', en: '廉貞星 (Lianzhen / Fiery Magnetism & Authority)', ja: '廉貞星 (廉貞・情熱と規律)', ko: '廉貞星 (염정성 / 매력과 위엄)', th: '廉貞星 (ดาวเหลียนเจิน / ดาวเสน่ห์รอง)' },
  '天府星': { zh: '天府星 (令星庫藏)', cn: '天府星 (令星库藏)', en: '天府星 (Tianfu / Celestial Treasury)', ja: '天府星 (天府・天の蔵主)', ko: '天府星 (천부성 / 하늘의 창고)', th: '天府星 (ดาวเทียนฝู่ / คลังสมบัติ)' },
  '太陰星': { zh: '太陰星 (富貴母宿)', cn: '太阴星 (富贵母宿)', en: '太陰星 (Taiyin / The Moon & Real Estate)', ja: '太陰星 (太陰・月の星)', ko: '太陰星 (태음성 / 달과 재백의 별)', th: '太陰星 (ดาวพระจันทร์ไท่อิน)' },
  '貪狼星': { zh: '貪狼星 (第一桃花)', cn: '贪狼星 (第一桃花)', en: '貪狼星 (Tanlang / Chief Star of Desire & Networking)', ja: '貪狼星 (貪狼・欲望と社交の星)', ko: '貪狼星 (탐랑성 / 욕망과 사교의 별)', th: '貪狼星 (ดาวทันหลาง / ดอกท้อเอก)' },
  '巨門星': { zh: '巨門星 (暗曜深沉)', cn: '巨门星 (暗曜深沉)', en: '巨門星 (Jumen / Star of Eloquence & Depth)', ja: '巨門星 (巨門・弁舌と洞察)', ko: '巨門星 (거문성 / 언변과 심층)', th: '巨門星 (ดาวจวี้เหมิน / วาทศิลป์)' },
  '天相星': { zh: '天相星 (印星宰輔)', cn: '天相星 (印星宰辅)', en: '天相星 (Tianxiang / Minister of Seal & Service)', ja: '天相星 (天相・宰相の印)', ko: '天相星 (천상성 / 인장과 보좌)', th: '天相星 (ดาวเทียนเซี่ยง / ตราประทับ)' },
  '天梁星': { zh: '天梁星 (蔭星長壽)', cn: '天梁星 (荫星长寿)', en: '天梁星 (Tianliang / Heavenly Elder & Protection)', ja: '天梁星 (天梁・長老の加護)', ko: '天梁星 (천량성 / 수호의 장로)', th: '天梁星 (ดาวเทียนเหลียง / ผู้คุ้มครอง)' },
  '七殺星': { zh: '七殺星 (將星魄力)', cn: '七杀星 (将星魄力)', en: '七殺星 (Qisha / General & Pioneer)', ja: '七殺星 (七殺・先陣を切る将軍)', ko: '七殺星 (칠살성 / 선봉의 장수)', th: '七殺星 (ดาวชีซ่า / ขุนพลแนวหน้า)' },
  '破軍星': { zh: '破軍星 (先鋒改革)', cn: '破军星 (先锋改革)', en: '破軍星 (Pojun / Breaker of Armies & Innovator)', ja: '破軍星 (破軍・変革の先駆者)', ko: '破軍星 (파군성 / 혁신과 개척)', th: '破軍星 (ดาวพั่วจวิน / นักปฏิวัติ)' },
  '化祿': { zh: '化祿 (財源順流)', cn: '化禄 (财源顺流)', en: '化祿 (Hua Lu / Prosperity Transformation)', ja: '化祿 (禄化・財運向上)', ko: '化祿 (화록 / 번영의 록)', th: '化祿 (ฮว่าลู่ / ดาวนำโชคลาภ)' },
  '化權': { zh: '化權 (掌控領導)', cn: '化权 (掌控领导)', en: '化權 (Hua Quan / Authority Transformation)', ja: '化權 (権化・主導権掌握)', ko: '化權 (화권 / 권력과 리더십)', th: '化權 (ฮว่าเฉวียน / อำนาจบารมี)' },
  '化科': { zh: '化科 (聲名科名)', cn: '化科 (声名科名)', en: '化科 (Hua Ke / Fame & Wisdom Transformation)', ja: '化科 (科化・名声と知性)', ko: '化科 (화과 / 명예와 학문)', th: '化科 (ฮว่าเคอ / ชื่อเสียงปัญญา)' },
  '化忌': { zh: '化忌 (內省阻力)', cn: '化忌 (内省阻力)', en: '化忌 (Hua Ji / Obstacle & In-depth Caution)', ja: '化忌 (忌化・慎重と試練)', ko: '化忌 (화기 / 시련과 내성)', th: '化忌 (ฮว่าจี้ / อุปสรรคและความรอบคอบ)' },
  '七政四餘': { zh: '七政四餘 (天象古曆)', cn: '七政四余 (天象古历)', en: '七政四餘 (Seven Luminaries & Four Extras)', ja: '七政四余 (日月五星と四余)', ko: '七政四餘 (칠정사여 천문 체계)', th: '七政四餘 (ดาวทั้งเจ็ดและเศษดาวทั้งสี่)' },
  '流分推算': { zh: '流分推算 (每分時氣)', cn: '流分推算 (每分时气)', en: '流分推算 (Minute-level Fortune Projection)', ja: '流分推算 (分単位の時気推算)', ko: '流分推算 (분 단위 시기 추산)', th: '流分推算 (การคำนวณดวงชะตารายนาที)' },
};

export function getTermAnnotated(term: string, lang: SupportedLocale = 'zh'): string {
  if (ASTRO_TERMS[term] && ASTRO_TERMS[term][lang]) {
    return ASTRO_TERMS[term][lang];
  }
  return term;
}

export function detectLanguage(text?: string, uiLang: SupportedLocale = 'zh'): SupportedLocale {
  if (!text || typeof text !== 'string') {
    return uiLang === 'cn' ? 'zh' : uiLang;
  }
  const s = text.trim();
  if (/(?:請?用|以|speak|in|reply in|answer in)\s*(?:英文|英語|english)/i.test(s) || /answer.*in english/i.test(s)) {
    return 'en';
  }
  if (/(?:請?用|以)\s*泰[文語]|(?:speak|in|reply in|answer in)\s*thai|ตอบเป็นภาษาไทย/i.test(s)) {
    return 'th';
  }
  if (/(?:請?用|以)\s*(?:繁體|正體)?中[文語]|(?:speak|in|reply in|answer in)\s*chinese|ตอบเป็นภาษาจีน/i.test(s)) {
    return 'zh';
  }
  if (/(?:請?用|以)\s*日[文語]|(?:speak|in|reply in|answer in)\s*japanese|日本語で/i.test(s)) {
    return 'ja';
  }
  if (/(?:請?用|以)\s*韓[文語]|(?:speak|in|reply in|answer in)\s*korean|한국어로/i.test(s)) {
    return 'ko';
  }
  return uiLang === 'cn' ? 'zh' : uiLang;
}
