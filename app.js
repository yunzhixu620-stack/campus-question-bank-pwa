const shell = document.querySelector(".phone-shell");
const bottomNav = document.querySelector(".bottom-nav");
const DB_NAME = "campus-question-bank-prototype";
const DB_VERSION = 1;
const currentUserKey = "campus-question-bank-current-user";
const PLAN_VERSION = 2;
const APP_HISTORY_MARKER = "campus-question-bank";

const chapters = [
  { mark: "图", title: "图形推理", meta: "北森 / 智鼎 / 林木 · 1743 题 · 已练 42", progress: 8 },
  { mark: "言", title: "言语理解与语义判断", meta: "北森核心看 · 2138 题 · 已练 31", progress: 5 },
  { mark: "算", title: "数学运算与计算题", meta: "EPI / 微测 / 套题 · 1680 题 · 已练 28", progress: 11 },
  { mark: "资", title: "资料分析", meta: "图表题 / 增长率 / 占比 · 927 题 · 已练 17", progress: 6 },
  { mark: "套", title: "智鼎图片真题套题", meta: "套题 1-36 · 图片题保留原图 · 1120 题", progress: 3 },
];

let questions = [
  {
    id: "demo-ziliao-001",
    source: "林木互联网校招笔试题库",
    category: "资料分析",
    type: "资料分析",
    image: true,
    text: "过去四年，A 手机与 B 手机的新用户增长情况如下。下列说法正确的是哪一项？",
    options: [
      "过去四年，A 手机的新用户总量大于 B 手机的新用户总量",
      "过去四年，B 手机新用户的增长速度低于 A 手机新用户的增长速度",
      "过去四年，B 手机在第二年的新用户增长率低于 A 手机的新用户增长率",
      "过去四年，该地区 A 手机新用户数和 B 手机新用户数接近",
    ],
    answer: "A",
    analysis: "A 项累计值明显高于 B 项；B、C 项比较的是增长速度，需要用相邻年份差值和基数计算，不能只看柱状高度。",
  },
  {
    id: "demo-yanyu-001",
    source: "北森题库",
    category: "言语理解",
    type: "言语理解",
    image: false,
    text: "“北麦南稻，南船北马”主要反映了我国不同地区哪方面的差异？",
    options: ["地理环境和生活习俗", "行政区划差异", "人口数量差异", "语言文字差异"],
    answer: "A",
    analysis: "该表述分别涉及农作物和交通方式，核心是自然地理条件影响生活方式与生产方式。",
  },
  {
    id: "demo-shuxue-001",
    source: "EPI能力测试",
    category: "数学运算",
    type: "数学运算",
    image: false,
    text: "某产品原价 240 元，先降价 20%，再涨价 25%。现在价格与原价相比如何？",
    options: ["相同", "上涨 5%", "下降 5%", "下降 10%"],
    answer: "A",
    analysis: "240 × 0.8 × 1.25 = 240。连续百分比变化要用乘法，不能直接把 20% 和 25% 相减。",
  },
];

const records = {
  mistakes: [
    ["增长率比较题", "资料分析 · 错 2 次 · 今天加入", "错题"],
    ["图形旋转规律", "图推 · 错 1 次 · 昨天加入", "待复习"],
    ["语义排序题", "言语理解 · 错 3 次 · 3 天未看", "高频"],
  ],
  favorites: [
    ["北森图表分析 427 页重点题", "资料分析 · 收藏于今天", "收藏"],
    ["智鼎套题 10 图片题", "整题截图 · 可放大查看", "图片"],
    ["EPI 数字推理母题", "数学运算 · 临考前背", "重点"],
  ],
  recent: [
    ["今日抽样计划", "已完成 18 / 62 题", "继续"],
    ["智鼎重点 2 · 套题 1", "上次做到第 12 题", "套题"],
    ["北森言语理解", "随机练习 30 题", "模块"],
  ],
};

let currentQuestion = 0;
let activeSession = null;
let memoryMode = false;
let memorySide = "front";
let examTimer = null;
let practiceTimer = null;
let examSeconds = 0;
let examSession = null;
let currentUserIndex = 0;
let currentUserState = null;
let dbPromise = null;
let questionIndexById = new Map();
const VALID_VIEWS = new Set(["home", "search", "records", "practice", "exam"]);
let sheetReturnView = "home";
let activeRecordTab = "mistakes";
let dataLoadInFlight = null;
let questionDataIndex = null;
let allQuestionDataLoaded = false;
let retryQuestionLoad = null;
const loadedQuestionChunks = new Set();
const questionChunkPromises = new Map();
let historyReady = false;
let practiceConfirmReturnOverlay = null;
let examConfirmReturnOverlay = null;
const viewScrollPositions = new Map();
let searchInputTimer = null;
const users = [
  { id: "user-a", name: "用户 A" },
  { id: "user-b", name: "用户 B" },
  { id: "user-c", name: "用户 C" },
  { id: "user-d", name: "用户 D" },
  { id: "user-e", name: "用户 E" },
];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeForSearch(value) {
  return String(value ?? "").toLowerCase().replace(/\s+/g, "");
}

function highlightSnippet(text, query, maxLength = 96) {
  const raw = String(text || "");
  if (!query) return escapeHtml(raw.slice(0, maxLength));
  const compactQuery = query.trim();
  const lower = raw.toLowerCase();
  const lowerQuery = compactQuery.toLowerCase();
  const foundAt = lower.indexOf(lowerQuery);
  const start = foundAt >= 0 ? Math.max(0, foundAt - 28) : 0;
  const snippet = raw.slice(start, start + maxLength);
  const prefix = start > 0 ? "..." : "";
  if (foundAt < 0) return escapeHtml(prefix + snippet);
  const escapedQuery = compactQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return escapeHtml(prefix + snippet).replace(new RegExp(escapedQuery, "gi"), (match) => `<mark>${match}</mark>`);
}

function rebuildQuestionIndex() {
  questionIndexById = new Map();
  questions.forEach((question, index) => {
    questionIndexById.set(question.id, index);
  });
}

function getQuestionById(questionId) {
  const index = questionIndexById.get(questionId);
  return Number.isInteger(index) ? questions[index] : null;
}

function setCurrentQuestionById(questionId) {
  const index = questionIndexById.get(questionId);
  if (Number.isInteger(index)) {
    currentQuestion = index;
    return true;
  }
  return false;
}

function currentQuestionObject() {
  if (activeSession?.questionIds?.length) {
    activeSession.index = Math.max(0, Math.min(activeSession.index || 0, activeSession.questionIds.length - 1));
    const sessionQuestion = getQuestionById(activeSession.questionIds[activeSession.index]);
    if (sessionQuestion) {
      setCurrentQuestionById(sessionQuestion.id);
      return sessionQuestion;
    }
  }
  return questions[currentQuestion % questions.length];
}

function nextPracticeQuestionIndex(startIndex = currentQuestion) {
  if (!questions.length) return 0;
  for (let offset = 1; offset <= questions.length; offset += 1) {
    const index = (startIndex + offset) % questions.length;
    if (practiceEligibleQuestion(questions[index])) return index;
  }
  return (startIndex + 1) % questions.length;
}

function questionKey() {
  return currentQuestionObject()?.id || questions[0]?.id || "";
}

function firstAnswer(question) {
  if (Array.isArray(question.answer)) return question.answer[0] || "";
  return question.answer || "";
}

function referenceOnlyQuestion(question) {
  return Boolean(
    question?.referenceOnly === true ||
    question?.practiceMode === "reference-only" ||
      question?.answerRevealed ||
      question?.questionType === "image-only" ||
      (!question?.options?.length && question?.images?.length),
  );
}

function reviewOnlyQuestion(question) {
  return Boolean(
    question?.practiceMode === "review-only" ||
      question?.reviewOnly === true ||
      question?.importNotes?.some((note) => String(note).startsWith("audit_") || note === "auto_audit_suspected_incomplete_question"),
  );
}

function practiceEligibleQuestion(question) {
  if (referenceOnlyQuestion(question) || reviewOnlyQuestion(question)) return false;
  if (question?.practiceEligible === true) return true;
  return Boolean(question?.options?.length >= 2 && firstAnswer(question));
}

function normalizeQuestion(rawQuestion) {
  const imageItems = rawQuestion.images || [];
  return {
    ...rawQuestion,
    id: rawQuestion.id || `question-${Math.random().toString(36).slice(2)}`,
    text: rawQuestion.text || rawQuestion.question || "",
    type: rawQuestion.type || rawQuestion.category || "单选题",
    source: rawQuestion.source || rawQuestion.library || "样本题库",
    category: rawQuestion.category || rawQuestion.type || "未分类",
    answer: firstAnswer(rawQuestion),
    options: (rawQuestion.options || []).map((option) => (typeof option === "string" ? option : option.text || "")),
    image: Boolean(rawQuestion.image || rawQuestion.images?.length),
    images: imageItems.map((image) => (typeof image === "string" ? image : image.src || image.url || image.path || "")).filter(Boolean),
  };
}

function normalizeCatalogQuestion(rawQuestion) {
  return {
    ...rawQuestion,
    text: rawQuestion.textPreview || "",
    question: rawQuestion.textPreview || "",
    options: [],
    answer: "",
    analysis: "",
    images: [],
    image: Boolean(rawQuestion.imageCount),
    catalogOnly: true,
  };
}

function mergeLoadedQuestion(rawQuestion, chunkPath) {
  const index = questionIndexById.get(rawQuestion.id);
  if (!Number.isInteger(index)) return;
  const catalogQuestion = questions[index];
  questions[index] = {
    ...catalogQuestion,
    ...normalizeQuestion(rawQuestion),
    dataChunk: catalogQuestion.dataChunk || chunkPath,
    catalogOnly: false,
  };
}

function setAppStatus(message = "", type = "info", actionText = "") {
  const status = document.querySelector("#app-status");
  const text = document.querySelector("#app-status-text");
  const action = document.querySelector("#app-status-action");
  if (!status || !text || !action) return;
  if (!message) {
    status.hidden = true;
    return;
  }
  status.hidden = false;
  status.classList.toggle("warning", type === "warning");
  status.classList.toggle("error", type === "error");
  text.textContent = message;
  action.hidden = !actionText;
  action.textContent = actionText || "重试";
}

async function fetchJsonWithTimeout(url, options = {}) {
  const timeout = options.timeout || 25000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      cache: options.cache || "no-cache",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function loadQuestionData({ showLoading = false } = {}) {
  if (dataLoadInFlight) return dataLoadInFlight;
  dataLoadInFlight = (async () => {
    try {
      if (showLoading) setAppStatus("正在加载题库目录。", "info");
      const index = await fetchJsonWithTimeout("./data/index.json", { timeout: 15000 });
      if (!index.catalog) throw new Error("Question catalog is missing.");
      const catalog = await fetchJsonWithTimeout(`./${index.catalog}`, { timeout: 20000 });
      if (!Array.isArray(catalog) || !catalog.length) throw new Error("Question catalog is empty.");
      questionDataIndex = index;
      questions = catalog.map(normalizeCatalogQuestion);
      rebuildQuestionIndex();
      document.querySelector("#total-count").textContent = String(index.totalQuestions || questions.length);
      document.querySelector("#practice-title").textContent = index.libraries?.[0]?.name || "校招题库";
      retryQuestionLoad = null;
      setAppStatus("");
      return true;
    } catch (error) {
      retryQuestionLoad = () => loadQuestionData({ showLoading: true });
      setAppStatus(`题库目录加载失败：${error.name === "AbortError" ? "网络超时" : "请检查网络后重试"}。`, "error", "重试");
      return false;
    } finally {
      dataLoadInFlight = null;
    }
  })();
  return dataLoadInFlight;
}

async function loadQuestionChunk(chunkPath) {
  if (!chunkPath || loadedQuestionChunks.has(chunkPath)) return true;
  if (questionChunkPromises.has(chunkPath)) return questionChunkPromises.get(chunkPath);
  const promise = (async () => {
    try {
      const chunk = await fetchJsonWithTimeout(`./${chunkPath}`, { timeout: 25000, cache: "default" });
      if (!Array.isArray(chunk)) throw new Error(`Invalid question chunk: ${chunkPath}`);
      chunk.forEach((question) => mergeLoadedQuestion(question, chunkPath));
      loadedQuestionChunks.add(chunkPath);
      return true;
    } catch (error) {
      questionChunkPromises.delete(chunkPath);
      throw error;
    }
  })();
  questionChunkPromises.set(chunkPath, promise);
  return promise;
}

async function loadQuestionChunks(chunkPaths, message = "正在准备题目") {
  const pendingPaths = [...new Set(chunkPaths)].filter((chunkPath) => chunkPath && !loadedQuestionChunks.has(chunkPath));
  if (!pendingPaths.length) return true;
  setAppStatus(`${message}，首次打开可能需要几秒。`, "info");
  const results = await Promise.allSettled(pendingPaths.map(loadQuestionChunk));
  const failedPaths = pendingPaths.filter((_, index) => results[index].status === "rejected");
  if (failedPaths.length) {
    retryQuestionLoad = () => loadQuestionChunks(failedPaths, message);
    setAppStatus(`有 ${failedPaths.length} 个题目数据块加载失败。`, "error", "重试");
    return false;
  }
  retryQuestionLoad = null;
  setAppStatus("");
  allQuestionDataLoaded = Boolean(
    questionDataIndex?.questionChunks?.length && loadedQuestionChunks.size >= questionDataIndex.questionChunks.length,
  );
  return true;
}

async function ensureQuestionsLoaded(questionIds, message = "正在准备本次练习") {
  const chunkPaths = uniqueIds(questionIds).map((id) => getQuestionById(id)?.dataChunk).filter(Boolean);
  return loadQuestionChunks(chunkPaths, message);
}

async function ensureAllQuestionDataLoaded() {
  if (allQuestionDataLoaded) return true;
  return loadQuestionChunks(questionDataIndex?.questionChunks || [], "正在加载搜题全文");
}

function defaultUserState(user) {
  return {
    userId: user.id,
    userName: user.name,
    currentQuestion: 0,
    lastView: "home",
    favorites: [],
    mistakes: [],
    recent: [],
    progress: {},
    dailyPlans: {},
    activeSession: null,
    examSession: null,
    prefs: {
      planMode: "day",
      planDays: 30,
      planScheduleDays: null,
      planStartDate: null,
      planTargetDate: null,
      defaultBatchSize: 30,
      extraBatchSizes: [30, 40, 50],
      lastSearchQuery: "",
      lastSearchLibrary: "",
      lastSearchFolder: "",
      lastSearchSet: "",
      lastSearchCategory: "",
    },
    updatedAt: new Date().toISOString(),
  };
}

function normalizeUserState(state, user) {
  const base = defaultUserState(user);
  const incoming = state || {};
  return {
    ...base,
    ...incoming,
    favorites: incoming.favorites || base.favorites,
    mistakes: incoming.mistakes || base.mistakes,
    recent: incoming.recent || base.recent,
    progress: incoming.progress || base.progress,
    dailyPlans: incoming.dailyPlans || base.dailyPlans,
    activeSession: incoming.activeSession || null,
    examSession: incoming.examSession || null,
    prefs: {
      ...base.prefs,
      ...(incoming.prefs || {}),
    },
  };
}

function openAppDb() {
  if (!("indexedDB" in window)) {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("userStates")) {
        db.createObjectStore("userStates", { keyPath: "userId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function readUserState(user) {
  let localState = null;
  const raw = localStorage.getItem(`${DB_NAME}:${user.id}`);
  if (raw) {
    try {
      localState = JSON.parse(raw);
    } catch {
      localState = null;
    }
  }
  try {
    const db = await openAppDb();
    const databaseState = await new Promise((resolve, reject) => {
      const transaction = db.transaction("userStates", "readonly");
      const request = transaction.objectStore("userStates").get(user.id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    const localUpdatedAt = localState?.updatedAt ? new Date(localState.updatedAt).getTime() : 0;
    const databaseUpdatedAt = databaseState?.updatedAt ? new Date(databaseState.updatedAt).getTime() : 0;
    const newestState = localUpdatedAt >= databaseUpdatedAt ? localState : databaseState;
    if (newestState) return normalizeUserState(newestState, user);
  } catch {
    if (localState) return normalizeUserState(localState, user);
  }
  return defaultUserState(user);
}

async function persistUserState(state) {
  if (!state?.userId) return;
  localStorage.setItem(`${DB_NAME}:${state.userId}`, JSON.stringify(state));
  try {
    const db = await openAppDb();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction("userStates", "readwrite");
      transaction.objectStore("userStates").put(state);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch {
    // localStorage fallback above already saved the state for this device.
  }
}

async function writeUserState() {
  if (!currentUserState) return;
  currentUserState.currentQuestion = currentQuestion;
  currentUserState.activeSession = activeSession;
  currentUserState.examSession = examSession;
  currentUserState.updatedAt = new Date().toISOString();
  await persistUserState(currentUserState);
}

function setProgressTransferStatus(message) {
  const status = document.querySelector("#progress-transfer-status");
  if (status) status.textContent = message;
}

async function exportProgress() {
  if (!currentUserState) return;
  setProgressTransferStatus("正在准备");
  await writeUserState();
  const states = [];
  for (const user of users) {
    states.push(await readUserState(user));
  }
  const payload = {
    format: "campus-question-bank-progress",
    version: 1,
    exportedAt: new Date().toISOString(),
    questionBankTotal: questionDataIndex?.totalQuestions || questions.length,
    currentUserId: currentUserState.userId,
    users: states,
  };
  const content = JSON.stringify(payload, null, 2);
  const filename = `题库进度-${todayKey()}.json`;
  const file = new File([content], filename, { type: "application/json" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ title: "题库进度备份", files: [file] });
      setProgressTransferStatus("已导出");
      return;
    } catch (error) {
      if (error?.name === "AbortError") {
        setProgressTransferStatus("已取消");
        return;
      }
    }
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setProgressTransferStatus("已导出");
}

async function importProgressFile(file) {
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    setProgressTransferStatus("文件过大");
    return;
  }
  setProgressTransferStatus("正在校验");
  try {
    const payload = JSON.parse(await file.text());
    if (payload?.format !== "campus-question-bank-progress" || payload?.version !== 1 || !Array.isArray(payload.users)) {
      throw new Error("invalid-format");
    }
    const knownUserIds = new Set(users.map((user) => user.id));
    const incomingStates = payload.users.filter((state) => state && knownUserIds.has(state.userId));
    if (!incomingStates.length) throw new Error("no-users");
    if (!window.confirm(`将覆盖本机 ${incomingStates.length} 个用户的题库进度，是否继续？`)) {
      setProgressTransferStatus("已取消");
      return;
    }
    for (const state of incomingStates) {
      const user = users.find((item) => item.id === state.userId);
      await persistUserState({ ...normalizeUserState(state, user), updatedAt: new Date().toISOString() });
    }
    const importedIndex = users.findIndex((user) => user.id === payload.currentUserId);
    await loadCurrentUser(importedIndex >= 0 ? importedIndex : currentUserIndex);
    setProgressTransferStatus(`已导入 ${incomingStates.length} 个用户`);
  } catch {
    setProgressTransferStatus("文件格式不正确");
  }
}

function sanitizeUserQuestionQueues() {
  if (!currentUserState) return;
  if (activeSession?.questionIds?.length && activeSession.type !== "single" && activeSession.type !== "reference") {
    activeSession.questionIds = activeSession.questionIds.filter((id) => practiceEligibleQuestion(getQuestionById(id)));
    if (!activeSession.questionIds.length) {
      activeSession = null;
    } else {
      activeSession.index = Math.max(0, Math.min(activeSession.index || 0, activeSession.questionIds.length - 1));
    }
    currentUserState.activeSession = activeSession;
  }
  Object.values(currentUserState.dailyPlans || {}).forEach((plan) => {
    if (!Array.isArray(plan.questionIds)) return;
    plan.questionIds = plan.questionIds.filter((id) => practiceEligibleQuestion(getQuestionById(id)));
    plan.reviewIds = (plan.reviewIds || []).filter((id) => practiceEligibleQuestion(getQuestionById(id)));
    plan.newCount = Math.max(0, plan.questionIds.length - plan.reviewIds.length);
    plan.reviewCount = plan.reviewIds.length;
  });
  if (examSession?.questionIds?.length) {
    examSession.questionIds = examSession.questionIds.filter((id) => examEligibleQuestion(getQuestionById(id)));
    if (examSession.questionIds.length < 2) examSession = null;
    currentUserState.examSession = examSession;
  }
  if (!activeSession && questions[currentQuestion] && !practiceEligibleQuestion(questions[currentQuestion])) {
    currentQuestion = nextPracticeQuestionIndex(currentQuestion);
  }
}

async function loadCurrentUser(index = currentUserIndex) {
  currentUserIndex = index;
  const user = users[currentUserIndex];
  currentUserState = await readUserState(user);
  activeSession = currentUserState.activeSession || null;
  examSession = currentUserState.examSession || null;
  examSeconds = examSession?.seconds || 0;
  currentQuestion = currentUserState.currentQuestion || 0;
  sanitizeUserQuestionQueues();
  if (activeSession?.questionIds?.length) {
    setCurrentQuestionById(activeSession.questionIds[activeSession.index || 0]);
  }
  localStorage.setItem(currentUserKey, String(currentUserIndex));
  document.querySelector("#user-switch").textContent = user.name;
  renderAllDynamicSections();
}

function getQuestionProgress(questionId = questionKey()) {
  if (!currentUserState) return {};
  currentUserState.progress[questionId] ||= {
    answeredCount: 0,
    wrongCount: 0,
    correctStreak: 0,
    memoryViews: 0,
    memoryRepetitions: 0,
    memoryIntervalDays: 0,
    memoryEase: 2.3,
    memoryLapses: 0,
  };
  return currentUserState.progress[questionId];
}

async function updateQuestionProgress(questionId, updater) {
  const progress = getQuestionProgress(questionId);
  updater(progress);
  await writeUserState();
  updateHomeStats();
}

function moveToFront(list, item, limit = 30) {
  const next = [item, ...list.filter((existing) => existing.questionId !== item.questionId)];
  return next.slice(0, limit);
}

function questionTitle(questionId) {
  const question = questions.find((item) => item.id === questionId);
  if (!question) return "未知题目";
  return question.text.length > 24 ? `${question.text.slice(0, 24)}...` : question.text;
}

function todayKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function dateFromKey(value) {
  const [year, month, day] = String(value || "")
    .split("-")
    .map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function dateKeyFromDate(value) {
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${value.getFullYear()}-${month}-${day}`;
}

function addDaysToKey(value, amount) {
  const date = dateFromKey(value) || new Date();
  date.setDate(date.getDate() + amount);
  return dateKeyFromDate(date);
}

function inclusiveDaysBetween(startKey, endKey) {
  const start = dateFromKey(startKey);
  const end = dateFromKey(endKey);
  if (!start || !end) return 1;
  return Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1);
}

function ensurePlanSchedule(days) {
  const prefs = currentUserState.prefs;
  const today = todayKey();
  const scheduleChanged =
    prefs.planScheduleDays !== days ||
    !dateFromKey(prefs.planStartDate) ||
    !dateFromKey(prefs.planTargetDate);
  if (scheduleChanged) {
    prefs.planScheduleDays = days;
    prefs.planStartDate = today;
    prefs.planTargetDate = addDaysToKey(today, days - 1);
    currentUserState.dailyPlans = {};
  }
  return {
    startDate: prefs.planStartDate,
    targetDate: prefs.planTargetDate,
    remainingDays: inclusiveDaysBetween(today, prefs.planTargetDate),
    changed: scheduleChanged,
  };
}

function clampNumber(value, min, max, fallback) {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.max(min, Math.min(max, Math.round(next)));
}

function isQuestionDone(questionId) {
  const progress = currentUserState?.progress?.[questionId];
  return Boolean(progress?.done || progress?.answeredCount > 0);
}

function isQuestionPracticedToday(questionId) {
  const progress = currentUserState?.progress?.[questionId];
  const date = todayKey();
  return Boolean(
    progress?.lastPracticedAt?.slice(0, 10) === date ||
      progress?.lastMemoryAt?.slice(0, 10) === date ||
      progress?.lastAnsweredAt?.slice(0, 10) === date,
  );
}

function shuffled(items) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function uniqueIds(ids) {
  return [...new Set(ids.filter((id) => questionIndexById.has(id)))];
}

function sampleIdsFromFewChunks(ids, count) {
  if (!count) return [];
  const groups = new Map();
  uniqueIds(ids).forEach((id) => {
    const chunk = getQuestionById(id)?.dataChunk || "inline";
    if (!groups.has(chunk)) groups.set(chunk, []);
    groups.get(chunk).push(id);
  });
  const selected = [];
  shuffled([...groups.values()]).some((chunkIds) => {
    selected.push(...shuffled(chunkIds).slice(0, count - selected.length));
    return selected.length >= count;
  });
  return selected.slice(0, count);
}

function availableQuestionIds(filter = () => true) {
  return questions.filter(filter).map((question) => question.id);
}

function availablePracticeQuestionIds(filter = () => true) {
  return questions.filter((question) => practiceEligibleQuestion(question) && filter(question)).map((question) => question.id);
}

function sampleBalancedByCategory(count, candidateIds, excludedIds = new Set()) {
  const candidates = uniqueIds(candidateIds).filter((id) => !excludedIds.has(id));
  if (!count || candidates.length <= count) return shuffled(candidates);

  const groups = new Map();
  candidates.forEach((id) => {
    const category = getQuestionById(id)?.category || "未分类";
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(id);
  });

  const total = candidates.length;
  const quotaRows = [...groups.entries()].map(([category, ids]) => {
    const exact = (ids.length / total) * count;
    return {
      category,
      ids: shuffled(ids),
      quota: Math.min(ids.length, Math.floor(exact)),
      remainder: exact - Math.floor(exact),
    };
  });

  let used = quotaRows.reduce((sum, row) => sum + row.quota, 0);
  quotaRows
    .sort((left, right) => right.remainder - left.remainder || right.ids.length - left.ids.length)
    .forEach((row) => {
      if (used >= count || row.quota >= row.ids.length) return;
      row.quota += 1;
      used += 1;
    });

  const selected = quotaRows.flatMap((row) => sampleIdsFromFewChunks(row.ids, row.quota));
  if (selected.length < count) {
    const selectedSet = new Set(selected);
    selected.push(...sampleIdsFromFewChunks(candidates.filter((id) => !selectedSet.has(id)), count - selected.length));
  }
  return shuffled(selected.slice(0, count));
}

function reviewQuestionIds(limit) {
  if (!limit || !currentUserState?.mistakes?.length) return [];
  const now = Date.now();
  const scored = currentUserState.mistakes
    .map((item) => {
      const progress = currentUserState.progress[item.questionId] || {};
      const dueAt = progress.nextReviewAt ? new Date(progress.nextReviewAt).getTime() : 0;
      const dueBoost = !dueAt || dueAt <= now ? 1000 : 0;
      return {
        id: item.questionId,
        score: dueBoost + (progress.wrongCount || 1) * 10 + (item.updatedAt ? new Date(item.updatedAt).getTime() / 10000000000000 : 0),
      };
    })
    .filter((item) => questionIndexById.has(item.id) && practiceEligibleQuestion(getQuestionById(item.id)))
    .sort((left, right) => right.score - left.score);
  return uniqueIds(scored.map((item) => item.id)).slice(0, limit);
}

function memoryQuestionIds(limit = 30) {
  const count = clampNumber(limit, 1, 100, 30);
  const now = Date.now();
  const due = [];
  const unseen = [];
  const future = [];
  availablePracticeQuestionIds().forEach((id) => {
    const progress = currentUserState?.progress?.[id] || {};
    const dueAt = progress.memoryNextReviewAt ? new Date(progress.memoryNextReviewAt).getTime() : 0;
    if (!progress.memoryViews && !progress.memoryRepetitions) {
      unseen.push(id);
      return;
    }
    const row = { id, dueAt: Number.isFinite(dueAt) ? dueAt : 0, lapses: progress.memoryLapses || 0 };
    if (!row.dueAt || row.dueAt <= now) due.push(row);
    else future.push(row);
  });
  due.sort((left, right) => left.dueAt - right.dueAt || right.lapses - left.lapses);
  future.sort((left, right) => left.dueAt - right.dueAt || right.lapses - left.lapses);
  const selected = due.slice(0, count).map((row) => row.id);
  if (selected.length < count) {
    selected.push(...sampleBalancedByCategory(count - selected.length, unseen, new Set(selected)));
  }
  if (selected.length < count) {
    selected.push(...future.map((row) => row.id).filter((id) => !selected.includes(id)).slice(0, count - selected.length));
  }
  return uniqueIds(selected).slice(0, count);
}

function summarizeQuestionIds(questionIds, reviewIds = []) {
  const reviewSet = new Set(reviewIds);
  const counts = new Map();
  questionIds.forEach((id) => {
    if (reviewSet.has(id)) {
      counts.set("错题复习", (counts.get("错题复习") || 0) + 1);
      return;
    }
    const category = getQuestionById(id)?.category || "未分类";
    counts.set(category, (counts.get(category) || 0) + 1);
  });
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8)
    .map(([name, count]) => `${name} ${count}`);
}

function dailyPlanPreview() {
  if (!currentUserState || !questions.length) {
    return { questionIds: [], reviewIds: [], newCount: 0, reviewCount: 0, days: 30, tags: [] };
  }
  currentUserState.dailyPlans ||= {};
  const date = todayKey();
  const days = clampNumber(currentUserState.prefs?.planDays, 1, 365, 30);
  const schedule = ensurePlanSchedule(days);
  const existing = currentUserState.dailyPlans[date];
  if (
    existing?.planVersion === PLAN_VERSION &&
    existing?.days === days &&
    existing?.targetDate === schedule.targetDate &&
    Array.isArray(existing.questionIds) &&
    existing.questionIds.length &&
    existing.questionIds.every((id) => questionIndexById.has(id) && practiceEligibleQuestion(getQuestionById(id)))
  ) {
    return existing;
  }

  const practiceQuestions = questions.filter(practiceEligibleQuestion);
  if (!practiceQuestions.length) {
    const emptyPlan = {
      date,
      days,
      questionIds: [],
      reviewIds: [],
      newCount: 0,
      reviewCount: 0,
      remainingDays: schedule.remainingDays,
      targetDate: schedule.targetDate,
      planVersion: PLAN_VERSION,
      tags: ["暂无可正常练习题"],
      createdAt: new Date().toISOString(),
    };
    currentUserState.dailyPlans[date] = emptyPlan;
    void writeUserState();
    return emptyPlan;
  }
  const doneCount = practiceQuestions.filter((question) => isQuestionDone(question.id)).length;
  const remainingCount = Math.max(0, practiceQuestions.length - doneCount);
  const newTarget = remainingCount ? Math.max(1, Math.ceil(remainingCount / schedule.remainingDays)) : 0;
  const reviewTarget = Math.min(currentUserState.mistakes?.length || 0, Math.max(0, Math.round(newTarget * 0.15)));
  const reviewIds = reviewQuestionIds(reviewTarget);
  const excludedIds = new Set(reviewIds);
  const newCandidateIds = availablePracticeQuestionIds((question) => !isQuestionDone(question.id));
  let newIds = sampleBalancedByCategory(newTarget, newCandidateIds, excludedIds);
  if (newIds.length < newTarget) {
    newIds = [
      ...newIds,
      ...sampleBalancedByCategory(newTarget - newIds.length, availablePracticeQuestionIds(), new Set([...excludedIds, ...newIds])),
    ];
  }
  const questionIds = uniqueIds([...reviewIds, ...newIds]);
  const plan = {
    date,
    days,
    questionIds,
    reviewIds,
    newCount: newIds.length,
    reviewCount: reviewIds.length,
    remainingDays: schedule.remainingDays,
    targetDate: schedule.targetDate,
    planVersion: PLAN_VERSION,
    tags: summarizeQuestionIds(questionIds, reviewIds),
    createdAt: new Date().toISOString(),
  };
  currentUserState.dailyPlans[date] = plan;
  void writeUserState();
  return plan;
}

function buildExtraSession(size) {
  const count = clampNumber(size, 1, 200, 30);
  const unseenIds = availablePracticeQuestionIds((question) => !isQuestionDone(question.id));
  let ids = sampleBalancedByCategory(count, unseenIds);
  if (ids.length < count) {
    ids = [...ids, ...sampleBalancedByCategory(count - ids.length, availablePracticeQuestionIds(), new Set(ids))];
  }
  return ids;
}

function examEligibleQuestion(question) {
  return practiceEligibleQuestion(question);
}

function startSession(title, questionIds, type = "practice", meta = "") {
  const rawIds = uniqueIds(questionIds);
  const ids =
    type === "single" || type === "reference"
      ? rawIds
      : rawIds.filter((id) => practiceEligibleQuestion(getQuestionById(id)));
  if (!ids.length || !currentUserState) return false;
  activeSession = {
    id: `${type}-${Date.now()}`,
    type,
    title,
    questionIds: ids,
    index: 0,
    seconds: 0,
    answers: {},
    marked: {},
    submitted: false,
    result: null,
    createdAt: new Date().toISOString(),
  };
  currentUserState.activeSession = activeSession;
  viewScrollPositions.set("practice", 0);
  setCurrentQuestionById(ids[0]);
  recordRecent(title, `${ids.length} 题${meta ? ` · ${meta}` : ""}`, type === "daily" ? "今日" : "练习", ids[0]);
  void writeUserState();
  return true;
}

function startSessionFromTarget(target) {
  const sessionType = target.dataset.session;
  if (!currentUserState) return;
  if (!sessionType) {
    if (target.dataset.target === "practice" && !activeSession?.questionIds?.length) {
      const size = currentUserState.prefs?.defaultBatchSize || 30;
      startSession("随机练习", buildExtraSession(size), "random", "默认抽样");
    }
    return;
  }
  if (sessionType === "daily") {
    const plan = dailyPlanPreview();
    const remainingIds = plan.questionIds.filter((id) => !isQuestionPracticedToday(id));
    startSession("今日计划", remainingIds.length ? remainingIds : plan.questionIds, "daily", `${plan.days} 天计划`);
    return;
  }
  if (sessionType === "extra") {
    const size = clampNumber(target.dataset.size, 1, 200, 30);
    startSession(`自由加练 ${size} 题`, buildExtraSession(size), "extra", "不影响今日计划");
    return;
  }
  if (sessionType === "memory") {
    const ids = memoryQuestionIds(currentUserState.prefs?.defaultBatchSize || 30);
    startSession("间隔背题", ids, "memory", "到期卡片优先");
    return;
  }
  if (sessionType === "category") {
    const category = target.dataset.category;
    const candidates = availablePracticeQuestionIds((question) => question.category === category && !isQuestionDone(question.id));
    const fallback = availablePracticeQuestionIds((question) => question.category === category);
    if (fallback.length) {
      startSession(category, sampleBalancedByCategory(currentUserState.prefs?.defaultBatchSize || 30, candidates.length ? candidates : fallback), "category", "专项练习");
      return;
    }
    const referenceIds = availableQuestionIds((question) => question.category === category && referenceOnlyQuestion(question));
    startSession(`${category}资料查看`, sampleBalancedByCategory(currentUserState.prefs?.defaultBatchSize || 30, referenceIds), "reference", "答案外露，仅浏览");
    return;
  }
  if (sessionType === "single" && target.dataset.questionId) {
    startSession("单题复习", [target.dataset.questionId], "single", "来自记录");
    return;
  }
  const size = currentUserState.prefs?.defaultBatchSize || 30;
  startSession("随机练习", buildExtraSession(size), "random", "默认抽样");
}

function advanceQuestion() {
  if (activeSession?.questionIds?.length) {
    if ((activeSession.index || 0) < activeSession.questionIds.length - 1) {
      activeSession.index += 1;
      setCurrentQuestionById(activeSession.questionIds[activeSession.index]);
    } else {
      if (activeSession.type === "memory") completeMemorySession();
      else finishPracticeSession();
      return;
    }
  } else {
    currentQuestion = nextPracticeQuestionIndex(currentQuestion);
  }
  memorySide = "front";
  void writeUserState();
  renderQuestion();
  viewScrollPositions.set("practice", 0);
  window.scrollTo(0, 0);
}

function previousQuestion() {
  if (activeSession?.questionIds?.length) {
    activeSession.index = Math.max(0, (activeSession.index || 0) - 1);
    setCurrentQuestionById(activeSession.questionIds[activeSession.index]);
  } else {
    currentQuestion = Math.max(0, currentQuestion - 1);
  }
  memorySide = "front";
  void writeUserState();
  renderQuestion();
  viewScrollPositions.set("practice", 0);
  window.scrollTo(0, 0);
}

function startPracticeTimer() {
  if (practiceTimer) return;
  practiceTimer = setInterval(() => {
    const view = shell.dataset.view;
    const activePracticeView = view === "practice" || (view === "sheet" && sheetReturnView === "practice");
    if (!activeSession || activeSession.submitted || !activePracticeView) return;
    activeSession.seconds = (activeSession.seconds || 0) + 1;
    document.querySelector("#practice-timer").textContent = formatSeconds(activeSession.seconds);
    if (activeSession.seconds % 5 === 0) {
      currentUserState.activeSession = activeSession;
      void writeUserState();
    }
  }, 1000);
}

function stopPracticeTimer() {
  if (!practiceTimer) return;
  clearInterval(practiceTimer);
  practiceTimer = null;
}

function recordRecent(title, meta, pill, questionId = questionKey()) {
  if (!currentUserState) return;
  currentUserState.recent = moveToFront(currentUserState.recent, {
    questionId,
    title,
    meta,
    pill,
    updatedAt: new Date().toISOString(),
  });
  void writeUserState();
}

function setRecordListsFromState() {
  renderRecords("mistakes", "#mistake-list");
  renderRecords("favorites", "#favorite-list");
  renderRecords("recent", "#recent-list");
}

function setRecordTab(tab) {
  activeRecordTab = ["mistakes", "favorites", "recent"].includes(tab) ? tab : "mistakes";
  document.querySelectorAll("[data-record-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.recordTab === activeRecordTab);
  });
  document.querySelectorAll("[data-record-panel]").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.recordPanel === activeRecordTab);
  });
}

function updateSheetCloseButton() {
  const closeButton = document.querySelector("#sheet-close");
  if (!closeButton) return;
  const context = document.querySelector("#sheet-context");
  if (context) {
    context.textContent = sheetReturnView === "practice" ? "草稿会保留到本次练习结束" : sheetReturnView === "exam" ? "模拟计时继续运行" : "临时计算与手写草稿";
  }
}

function appHistoryState(view = shell.dataset.view || "home", overlay = null, root = false) {
  return {
    app: APP_HISTORY_MARKER,
    view,
    overlay,
    sheetReturnView,
    root,
  };
}

function syncPracticeOverlay(overlay = null) {
  const answerCard = document.querySelector("#practice-sheet-backdrop");
  const confirm = document.querySelector("#practice-submit-confirm");
  const result = document.querySelector("#practice-result-backdrop");
  const answerCardVisible = overlay === "answer-card";
  const confirmVisible = overlay === "practice-confirm";
  const resultVisible = overlay === "practice-result";
  answerCard.classList.toggle("visible", answerCardVisible);
  answerCard.setAttribute("aria-hidden", String(!answerCardVisible));
  confirm.classList.toggle("visible", confirmVisible);
  confirm.setAttribute("aria-hidden", String(!confirmVisible));
  result.classList.toggle("visible", resultVisible);
  result.setAttribute("aria-hidden", String(!resultVisible));
}

function syncExamOverlay(overlay = null) {
  const answerCard = document.querySelector("#exam-sheet-backdrop");
  const confirm = document.querySelector("#exam-submit-confirm");
  const answerCardVisible = overlay === "exam-answer-card";
  const confirmVisible = overlay === "exam-confirm";
  answerCard.classList.toggle("visible", answerCardVisible);
  answerCard.setAttribute("aria-hidden", String(!answerCardVisible));
  confirm.classList.toggle("visible", confirmVisible);
  confirm.setAttribute("aria-hidden", String(!confirmVisible));
}

function syncAppOverlay(overlay = null) {
  syncPracticeOverlay(overlay);
  syncExamOverlay(overlay);
  const toolSheet = document.querySelector("#view-sheet");
  const visible = overlay === "tool-sheet";
  toolSheet.classList.toggle("tool-sheet-visible", visible);
  toolSheet.setAttribute("aria-hidden", String(!visible));
}

function setOverlayHistory(overlay, { replace = false } = {}) {
  if (!historyReady) {
    syncAppOverlay(overlay);
    return;
  }
  const method = replace ? "replaceState" : "pushState";
  history[method](appHistoryState(shell.dataset.view || "practice", overlay), "", location.href);
  syncAppOverlay(overlay);
}

function navigateBack(fallback = "home") {
  if (!historyReady || history.state?.app !== APP_HISTORY_MARKER || history.state?.root) {
    goTo(fallback, { replace: true });
    return;
  }
  history.back();
}

function initializeAppHistory(view) {
  history.replaceState(appHistoryState("home", null, true), "", location.href);
  if (view !== "home") {
    history.pushState(appHistoryState(view), "", location.href);
  }
  historyReady = true;
  window.addEventListener("popstate", (event) => {
    const state = event.state;
    if (state?.app !== APP_HISTORY_MARKER) return;
    sheetReturnView = state.sheetReturnView || "home";
    syncAppOverlay(null);
    goTo(state.view || "home", { history: false, returnTo: sheetReturnView });
    if (state.overlay) {
      syncAppOverlay(state.overlay);
      if (state.overlay === "answer-card") renderPracticeSheet();
      if (state.overlay === "practice-result") renderPracticeResult();
      if (state.overlay === "exam-answer-card") renderAnswerSheet();
    }
  });
}

function closeSheet() {
  if (history.state?.overlay === "tool-sheet") {
    navigateBack(sheetReturnView || "home");
    return;
  }
  syncAppOverlay(null);
}

function openToolSheet(returnTo) {
  sheetReturnView = returnTo || shell.dataset.view || "practice";
  updateSheetCloseButton();
  setSheetTool(activeSheetTool);
  setOverlayHistory("tool-sheet");
}

function goTo(view, options = {}) {
  if (["mistakes", "favorites", "recent"].includes(view)) {
    activeRecordTab = view;
    view = "records";
  }
  if (view === "sheet") {
    openToolSheet(options.returnTo || shell.dataset.view || "practice");
    return;
  }
  view = VALID_VIEWS.has(view) ? view : "home";
  const fromView = shell.dataset.view || "home";
  if (fromView !== view) viewScrollPositions.set(fromView, window.scrollY);
  shell.dataset.view = view;
  if (view !== "practice") syncPracticeOverlay(null);
  if (view !== "exam") syncExamOverlay(null);
  if (currentUserState) {
    currentUserState.lastView = view;
    void writeUserState();
  }
  bottomNav.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("active", button.dataset.target === view);
  });
  if (view === "practice" || (view === "sheet" && sheetReturnView === "practice" && activeSession?.questionIds?.length)) {
    renderQuestion();
    startPracticeTimer();
  } else {
    stopPracticeTimer();
  }
  if (view === "exam" || (view === "sheet" && sheetReturnView === "exam" && examSession && !examSession.submitted)) {
    ensureExamSession();
    renderExam();
    startExamTimer();
  } else {
    stopExamTimer();
  }
  if (view === "search") {
    renderSearchCategoryOptions();
    renderSearchResults();
    setTimeout(() => document.querySelector("#search-input")?.focus(), 50);
  }
  if (view === "home" && currentUserState) {
    updateHomeStats();
  }
  if (view === "records") {
    setRecordListsFromState();
    setRecordTab(activeRecordTab);
  }
  if (historyReady && options.history !== false) {
    const method = options.replace ? "replaceState" : "pushState";
    history[method](appHistoryState(view), "", location.href);
  }
  if (fromView !== view) {
    const nextScroll = options.scrollTop ?? viewScrollPositions.get(view) ?? 0;
    requestAnimationFrame(() => window.scrollTo(0, nextScroll));
  }
}

function renderChapters() {
  const list = document.querySelector("#chapter-list");
  const progress = currentUserState?.progress || {};
  const categoryMap = new Map();
  questions.forEach((question) => {
    const category = question.category || "未分类";
    if (!categoryMap.has(category)) {
      categoryMap.set(category, {
        mark: category.slice(0, 1),
        title: category,
        count: 0,
        practiceCount: 0,
        referenceCount: 0,
        done: 0,
        sources: new Set(),
      });
    }
    const item = categoryMap.get(category);
    item.count += 1;
    if (practiceEligibleQuestion(question)) item.practiceCount += 1;
    if (referenceOnlyQuestion(question)) item.referenceCount += 1;
    item.sources.add(question.source || "题库");
    if (practiceEligibleQuestion(question) && (progress[question.id]?.done || progress[question.id]?.answeredCount > 0)) item.done += 1;
  });
  const displayChapters = categoryMap.size
    ? [...categoryMap.values()].sort((left, right) => right.practiceCount - left.practiceCount || right.count - left.count)
    : chapters.map((item) => ({ ...item, count: 0, practiceCount: 0, referenceCount: 0, done: 0, sources: new Set(["样本"]) }));
  list.innerHTML = displayChapters
    .map(
      (item) => {
        const progressPercent = item.practiceCount ? Math.round((item.done / item.practiceCount) * 100) : item.progress || 0;
        const isReferenceOnly = !item.practiceCount && item.referenceCount;
        const meta = item.count
          ? isReferenceOnly
            ? `${item.count} 题 · 答案外露，仅资料查看`
            : `${item.practiceCount} 可练 · 已练 ${item.done} · ${item.referenceCount ? `${item.referenceCount} 仅资料 · ` : ""}${[...item.sources].slice(0, 2).join(" / ")}`
          : item.meta;
        return `
      <button class="chapter-item" data-target="practice" data-session="category" data-category="${escapeHtml(item.title)}" type="button">
        <span class="chapter-badge">${escapeHtml(item.mark)}</span>
        <span class="chapter-copy">
          <strong>${escapeHtml(item.title)}</strong>
          <p>${escapeHtml(meta)}</p>
        </span>
        <span class="item-arrow" aria-hidden="true"></span>
        <span class="item-progress">
          <span><i style="width:${progressPercent}%"></i></span>
          <span>${progressPercent}%</span>
        </span>
      </button>
    `;
      },
    )
    .join("");
}

function renderRecords(type, selector) {
  const list = document.querySelector(selector);
  const stateRecords = currentUserState?.[type] || [];
  const displayRecords = stateRecords.length
    ? stateRecords.map((item) => ({
        questionId: item.questionId,
        title: item.title || questionTitle(item.questionId),
        meta: item.meta || "本地记录",
        pill: item.pill || "记录",
      }))
    : records[type].map(([title, meta, pill]) => ({ title, meta, pill }));
  list.innerHTML = displayRecords
    .map(
      ({ questionId, title, meta, pill }) => `
      <button class="record-item" data-target="practice" ${questionId ? `data-session="single" data-question-id="${escapeHtml(questionId)}"` : ""} type="button">
        <span class="record-copy">
          <strong>${escapeHtml(title)}</strong>
          <p>${escapeHtml(meta)}</p>
        </span>
        <span class="record-pill">${escapeHtml(pill)}</span>
      </button>
    `,
    )
    .join("");
}

function questionSearchText(question) {
  return [
    question.text,
    ...(question.options || []),
    question.answer,
    question.analysis,
    question.ocrText,
    question.category,
    question.type,
    question.source,
    question.setName,
    question.originalFile,
  ]
    .filter(Boolean)
    .join(" ");
}

function searchQuestions(query, filters) {
  const normalizedQuery = normalizeForSearch(query);
  const hasFilter = Object.values(filters).some(Boolean);
  if (!normalizedQuery && !hasFilter) return [];
  return questions
    .map((question) => {
      if (filters.library && question.library !== filters.library) return null;
      if (filters.folder && question.subCategory !== filters.folder) return null;
      if (filters.setName && question.setName !== filters.setName) return null;
      if (filters.category && question.category !== filters.category) return null;
      const haystack = questionSearchText(question);
      const compactHaystack = normalizeForSearch(haystack);
      if (normalizedQuery && !compactHaystack.includes(normalizedQuery)) return null;
      let rank = 0;
      const compactQuestion = normalizeForSearch(question.text);
      const compactOptions = normalizeForSearch((question.options || []).join(" "));
      const compactOcr = normalizeForSearch(question.ocrText || "");
      if (normalizedQuery && compactQuestion.includes(normalizedQuery)) rank += 40;
      if (normalizedQuery && compactOptions.includes(normalizedQuery)) rank += 20;
      if (normalizedQuery && compactOcr.includes(normalizedQuery)) rank += 12;
      if (question.images?.length) rank += 2;
      return { question, rank };
    })
    .filter(Boolean)
    .sort((left, right) => right.rank - left.rank)
    .slice(0, 80)
    .map((item) => item.question);
}

function searchFilters() {
  return {
    library: document.querySelector("#search-library").value,
    folder: document.querySelector("#search-folder").value,
    setName: document.querySelector("#search-set").value,
    category: document.querySelector("#search-category").value,
  };
}

function renderFilterSelect(selector, label, values, preferredValue) {
  const select = document.querySelector(selector);
  const sortedValues = [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right, "zh-Hans-CN"));
  select.innerHTML = `<option value="">${label}</option>${sortedValues
    .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
    .join("")}`;
  select.value = sortedValues.includes(preferredValue) ? preferredValue : "";
  return select.value;
}

function renderSearchCategoryOptions(preferred = {}) {
  const saved = currentUserState?.prefs || {};
  const currentLibrary = preferred.library ?? (document.querySelector("#search-library").value || saved.lastSearchLibrary || "");
  const library = renderFilterSelect(
    "#search-library",
    "全部题库",
    questions.map((question) => question.library || question.source),
    currentLibrary,
  );
  const libraryQuestions = library ? questions.filter((question) => question.library === library) : questions;
  const currentFolder = preferred.folder ?? (document.querySelector("#search-folder").value || saved.lastSearchFolder || "");
  const folder = renderFilterSelect(
    "#search-folder",
    "全部目录",
    libraryQuestions.map((question) => question.subCategory),
    currentFolder,
  );
  const folderQuestions = folder ? libraryQuestions.filter((question) => question.subCategory === folder) : libraryQuestions;
  const currentSet = preferred.setName ?? (document.querySelector("#search-set").value || saved.lastSearchSet || "");
  const setName = renderFilterSelect(
    "#search-set",
    "全部套题",
    folderQuestions.map((question) => question.setName),
    currentSet,
  );
  const setQuestions = setName ? folderQuestions.filter((question) => question.setName === setName) : folderQuestions;
  const currentCategory = preferred.category ?? (document.querySelector("#search-category").value || saved.lastSearchCategory || "");
  renderFilterSelect(
    "#search-category",
    "全部模块",
    setQuestions.map((question) => question.category || "未分类"),
    currentCategory,
  );
}

function renderSearchResults() {
  const input = document.querySelector("#search-input");
  const filters = searchFilters();
  const query = input.value.trim();
  const resultList = document.querySelector("#search-results");
  const count = document.querySelector("#search-count");
  if (currentUserState) {
    currentUserState.prefs.lastSearchQuery = query;
    currentUserState.prefs.lastSearchLibrary = filters.library;
    currentUserState.prefs.lastSearchFolder = filters.folder;
    currentUserState.prefs.lastSearchSet = filters.setName;
    currentUserState.prefs.lastSearchCategory = filters.category;
  }
  if (!query && !Object.values(filters).some(Boolean)) {
    count.textContent = "选择题库、目录、套题或模块，也可以输入关键词";
    resultList.innerHTML = "";
    return;
  }
  const results = searchQuestions(query, filters);
  count.textContent = results.length ? `显示前 ${results.length} 条题目` : "没有匹配题目";
  resultList.innerHTML = results
    .map((question) => {
      const hasOcrHit = query && normalizeForSearch(question.ocrText || "").includes(normalizeForSearch(query));
      const isReviewOnly = reviewOnlyQuestion(question);
      const isReferenceOnly = referenceOnlyQuestion(question);
      const pill = isReviewOnly
        ? "待复核"
        : isReferenceOnly
          ? "仅资料"
          : hasOcrHit
            ? "OCR"
            : question.images?.length || question.imageCount
              ? "图片"
              : "可练";
      const preview = hasOcrHit ? question.ocrText : question.analysis || question.options?.join(" ") || question.setName || question.subCategory || "";
      return `
        <button class="record-item" data-target="practice" data-session="single" data-question-id="${escapeHtml(question.id)}" type="button">
          <span class="record-copy">
            <strong>${highlightSnippet(question.text, query, 68)}</strong>
            <p>${escapeHtml(question.library || question.source)} · ${escapeHtml(question.category)} · ${highlightSnippet(preview, query, 72)}</p>
          </span>
          <span class="record-pill">${pill}</span>
        </button>
      `;
    })
    .join("");
}

async function prepareSearchResults() {
  const query = document.querySelector("#search-input").value.trim();
  if (query && !allQuestionDataLoaded) {
    const ready = await ensureAllQuestionDataLoaded();
    if (!ready) return;
  }
  renderSearchResults();
  void writeUserState();
}

function renderQuestion() {
  const question = currentQuestionObject();
  if (!question) return;
  const letters = ["A", "B", "C", "D"];
  const progress = getQuestionProgress(question.id);
  const optionList = document.querySelector("#option-list");
  const questionImage = document.querySelector("#question-image");
  const realImage = document.querySelector("#question-real-image");
  const hasRealImage = Boolean(question.images?.length);
  const isReferenceOnly = referenceOnlyQuestion(question);
  const isReviewOnly = reviewOnlyQuestion(question);
  const sessionTotal = activeSession?.questionIds?.length || 30;
  const sessionIndex = activeSession?.questionIds?.length ? (activeSession.index || 0) + 1 : (currentQuestion % sessionTotal) + 1;
  const selectedAnswer = activeSession?.answers?.[question.id] || "";
  const sessionSubmitted = Boolean(activeSession?.submitted);
  document.querySelector("#practice-count").textContent = `${sessionIndex}/${sessionTotal}`;
  document.querySelector("#practice-timer").textContent = formatSeconds(activeSession?.seconds || 0);
  document.querySelector("#practice-title").textContent = activeSession?.title || "随机练习";
  document.querySelector(".thin-progress span").style.width = `${Math.min(100, Math.round((sessionIndex / sessionTotal) * 100))}%`;
  document.querySelector("#question-type").textContent = isReviewOnly ? "待复核" : isReferenceOnly ? "资料题" : "单选题";
  document.querySelector("#question-category").textContent = question.category;
  document.querySelector("#question-score").textContent = question.source || "1 分";
  document.querySelector("#question-text").textContent = question.text;
  document.querySelector("#answer-text").textContent = firstAnswer(question);
  document.querySelector("#analysis-text").textContent = question.analysis;
  questionImage.classList.remove("expanded");
  questionImage.classList.toggle("visible", question.image || hasRealImage);
  questionImage.classList.toggle("has-real-image", hasRealImage);
  realImage.src = hasRealImage ? question.images[0] : "";
  realImage.alt = hasRealImage ? `${question.category}题图` : "题目图表";
  document.querySelector("#question-image-caption").textContent = hasRealImage
    ? isReferenceOnly
      ? "答案外露资料图，点按放大"
      : question.images.length > 1
      ? `题图 1 / ${question.images.length}，点按放大`
      : "题图，点按放大"
    : "图片题会保留整题截图或题干图表，可点开放大";
  document.querySelector("#memory-panel").classList.toggle("visible", memoryMode);
  const memoryAnswerVisible = memoryMode && memorySide === "back";
  document.querySelector(".question-card").classList.toggle("memory-question-card", memoryMode);
  document.querySelector("#analysis-card").classList.toggle("visible", memoryAnswerVisible || sessionSubmitted);
  document.querySelector("#answer-toggle").textContent = memoryAnswerVisible || sessionSubmitted ? "收起解析" : "看解析";
  document.querySelector("#mark-favorite").textContent = progress.favorite ? "已收藏" : "收藏";
  document.querySelector("#mark-wrong").textContent = progress.wrong ? "已记入" : "记错题";
  if (question.options?.length) {
    optionList.innerHTML = question.options
      .map(
        (option, index) => {
          const letter = letters[index];
          const answered = Boolean(selectedAnswer);
          const isCorrect = letter === firstAnswer(question);
          const isSelected = selectedAnswer === letter;
          const reveal = memoryAnswerVisible || answered || sessionSubmitted;
          const locked = memoryMode || answered || sessionSubmitted;
          return `
      <button class="option-button ${reveal && isCorrect ? "correct" : ""} ${isSelected ? "selected" : ""} ${reveal && isSelected && !isCorrect ? "wrong" : ""}" data-letter="${letter}" type="button" ${locked ? "disabled" : ""}>
        <strong>${letters[index]}</strong>
        <span>${escapeHtml(option)}</span>
      </button>
    `;
        },
      )
      .join("");
  } else {
    optionList.innerHTML = `
      <div class="image-only-note">
        <strong>${isReferenceOnly ? "答案外露资料题" : "整题截图题"}</strong>
        <span>${isReferenceOnly ? "截图里可能已经有勾选或高亮答案，只用于搜题定位、收藏和背题浏览，不进入普通刷题。" : "当前没有结构化选项，适合浏览、收藏和后续人工整理。"}</span>
      </div>
    `;
  }
  renderMemoryCard();
  renderPracticeNav();
  renderPracticeSheet();
}

function renderPracticeNav() {
  const prevButton = document.querySelector("#prev-question");
  const nextButton = document.querySelector("#next-question");
  const index = activeSession?.questionIds?.length ? activeSession.index || 0 : currentQuestion;
  const total = activeSession?.questionIds?.length || questions.length;
  prevButton.disabled = index <= 0;
  prevButton.textContent = "上一题";
  nextButton.textContent = index >= total - 1 ? (activeSession?.submitted ? "查看结果" : "完成") : "下一题";
}

function practiceSheetOpen(options = {}) {
  renderPracticeSheet();
  if (options.history === false) {
    syncPracticeOverlay("answer-card");
    return;
  }
  setOverlayHistory("answer-card");
}

function practiceSheetClose(options = {}) {
  if (options.history === false) {
    syncPracticeOverlay(null);
    return;
  }
  navigateBack("practice");
}

function isPracticeMarked(questionId) {
  const progress = currentUserState?.progress?.[questionId];
  return Boolean(progress?.wrong || progress?.favorite || activeSession?.marked?.[questionId]);
}

function renderPracticeSheet() {
  const grid = document.querySelector("#practice-sheet-grid");
  if (!grid) return;
  const ids = activeSession?.questionIds?.length ? activeSession.questionIds : [currentQuestionObject()?.id].filter(Boolean);
  const activeIndex = activeSession?.questionIds?.length ? activeSession.index || 0 : 0;
  const submitted = Boolean(activeSession?.submitted);
  grid.innerHTML = ids
    .map((id, index) => {
      const chosen = activeSession?.answers?.[id] || "";
      const answered = Boolean(chosen);
      const marked = isPracticeMarked(id);
      const correct = submitted && chosen && chosen === firstAnswer(getQuestionById(id));
      const wrong = submitted && chosen && !correct;
      return `<button class="${answered ? "done" : ""} ${marked ? "marked" : ""} ${correct ? "correct" : ""} ${wrong ? "wrong" : ""} ${index === activeIndex ? "current" : ""}" data-practice-index="${index}" type="button">${index + 1}</button>`;
    })
    .join("");
  const submitButton = document.querySelector("#submit-practice-session");
  submitButton.textContent = submitted ? "查看练习结果" : "提交并查看结果";
  document.querySelector("#practice-submit-result").textContent = submitted
    ? `已提交：正确 ${activeSession.result?.correct || 0}/${activeSession.result?.total || ids.length}`
    : "";
}

function goToPracticeIndex(index) {
  if (!activeSession?.questionIds?.length) return;
  activeSession.index = Math.max(0, Math.min(activeSession.questionIds.length - 1, Number(index) || 0));
  setCurrentQuestionById(activeSession.questionIds[activeSession.index]);
  memorySide = "front";
  renderQuestion();
  viewScrollPositions.set("practice", 0);
  window.scrollTo(0, 0);
  practiceSheetClose();
  void writeUserState();
}

function practiceSessionStats() {
  const ids = activeSession?.questionIds || [];
  const wrongIds = [];
  const unansweredIds = [];
  let correct = 0;
  ids.forEach((id) => {
    const question = getQuestionById(id);
    const chosen = activeSession?.answers?.[id] || "";
    if (!chosen) {
      unansweredIds.push(id);
      return;
    }
    if (question && chosen === firstAnswer(question)) {
      correct += 1;
    } else {
      wrongIds.push(id);
    }
  });
  return {
    total: ids.length,
    answered: ids.length - unansweredIds.length,
    correct,
    wrong: wrongIds.length,
    unanswered: unansweredIds.length,
    wrongIds,
    unansweredIds,
  };
}

function renderPracticeResult() {
  if (!activeSession?.submitted) return;
  const stats = activeSession.result || practiceSessionStats();
  const percent = stats.total ? Math.round((stats.correct / stats.total) * 100) : 0;
  document.querySelector("#practice-result-score").textContent = `${stats.correct} / ${stats.total}`;
  document.querySelector("#practice-result-summary").textContent = `正确率 ${percent}% · 用时 ${formatSeconds(activeSession.seconds || 0)}`;
  document.querySelector("#practice-result-correct").textContent = String(stats.correct);
  document.querySelector("#practice-result-wrong").textContent = String(stats.wrong);
  document.querySelector("#practice-result-unanswered").textContent = String(stats.unanswered);
  document.querySelector("#practice-result-review").disabled = !stats.wrongIds?.length;
}

function showPracticeResult({ replace } = {}) {
  if (!activeSession?.submitted) return;
  renderPracticeResult();
  const shouldReplace = replace ?? Boolean(history.state?.overlay);
  setOverlayHistory("practice-result", { replace: shouldReplace });
}

function finalizePracticeSession() {
  if (!activeSession?.questionIds?.length || activeSession.submitted) {
    showPracticeResult();
    return;
  }
  const stats = practiceSessionStats();
  activeSession.submitted = true;
  activeSession.submittedAt = new Date().toISOString();
  activeSession.completedAt = activeSession.submittedAt;
  activeSession.result = stats;
  currentUserState.activeSession = activeSession;
  stopPracticeTimer();
  recordRecent(
    `${activeSession.title || "练习"}已提交`,
    `正确 ${stats.correct}/${stats.total} · 用时 ${formatSeconds(activeSession.seconds || 0)}`,
    "提交",
    activeSession.questionIds[activeSession.index || 0],
  );
  document.querySelector("#practice-submit-result").textContent = `已提交：正确 ${stats.correct}/${stats.total}`;
  renderQuestion();
  renderPracticeSheet();
  void writeUserState();
  showPracticeResult({ replace: Boolean(history.state?.overlay) });
}

function finishPracticeSession() {
  if (!activeSession?.questionIds?.length) return;
  if (activeSession.submitted) {
    showPracticeResult();
    return;
  }
  const stats = practiceSessionStats();
  if (!stats.unanswered) {
    finalizePracticeSession();
    return;
  }
  practiceConfirmReturnOverlay = history.state?.overlay === "answer-card" ? "answer-card" : null;
  document.querySelector("#practice-confirm-message").textContent = `还有 ${stats.unanswered} 题未作答，提交后答案将锁定，是否继续？`;
  setOverlayHistory("practice-confirm", { replace: Boolean(practiceConfirmReturnOverlay) });
}

function cancelPracticeSubmit() {
  if (practiceConfirmReturnOverlay === "answer-card") {
    practiceConfirmReturnOverlay = null;
    setOverlayHistory("answer-card", { replace: true });
    return;
  }
  practiceConfirmReturnOverlay = null;
  navigateBack("practice");
}

function reviewPracticeMistakes() {
  const stats = activeSession?.result || practiceSessionStats();
  const firstWrongId = stats.wrongIds?.[0];
  if (!firstWrongId || !activeSession?.questionIds?.length) return;
  activeSession.index = Math.max(0, activeSession.questionIds.indexOf(firstWrongId));
  setCurrentQuestionById(firstWrongId);
  syncPracticeOverlay(null);
  if (historyReady) history.replaceState(appHistoryState("practice"), "", location.href);
  renderQuestion();
  void writeUserState();
}

function leavePracticeResult() {
  syncPracticeOverlay(null);
  goTo("home", { replace: true });
}

function chooseOption(button) {
  const question = currentQuestionObject();
  if (
    !question?.options?.length ||
    !firstAnswer(question) ||
    !activeSession?.questionIds?.length ||
    activeSession.submitted ||
    activeSession.answers?.[question.id]
  )
    return;
  const chosen = button.dataset.letter;
  const isAnswerCorrect = chosen === firstAnswer(question);
  activeSession.answers ||= {};
  activeSession.answers[question.id] = chosen;
  activeSession.updatedAt = new Date().toISOString();
  currentUserState.activeSession = activeSession;
  void updateQuestionProgress(question.id, (progress) => {
    progress.answeredCount += 1;
    progress.lastAnswer = chosen;
    progress.lastAnsweredAt = new Date().toISOString();
    progress.lastPracticedAt = new Date().toISOString();
    progress.done = true;
    if (isAnswerCorrect) {
      progress.correctStreak += 1;
      progress.nextReviewAt = new Date(Date.now() + Math.min(14, 1 + progress.correctStreak * 2) * 24 * 60 * 60 * 1000).toISOString();
    } else {
      progress.correctStreak = 0;
      progress.wrong = true;
      progress.wrongCount += 1;
      progress.nextReviewAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      currentUserState.mistakes = moveToFront(currentUserState.mistakes, {
        questionId: question.id,
        title: questionTitle(question.id),
        meta: `${question.category} · 错 ${progress.wrongCount} 次 · 最近更新`,
        pill: "错题",
        updatedAt: new Date().toISOString(),
      });
      setRecordListsFromState();
    }
  });
  renderQuestion();
}

function setMode(nextMemoryMode) {
  memoryMode = nextMemoryMode;
  memorySide = "front";
  document.querySelector("#mode-practice").classList.toggle("active", !memoryMode);
  document.querySelector("#mode-memory").classList.toggle("active", memoryMode);
  renderQuestion();
}

function nextKnownMemoryInterval(progress = {}) {
  const repetitions = progress.memoryRepetitions || 0;
  const interval = progress.memoryIntervalDays || 0;
  const ease = Math.max(1.3, progress.memoryEase || 2.3);
  if (repetitions <= 0) return 1;
  if (repetitions === 1) return 3;
  return Math.min(180, Math.max(3, Math.round(interval * ease)));
}

function renderMemoryCard() {
  const question = currentQuestionObject();
  if (!question) return;
  const card = document.querySelector("#memory-card");
  const answer = firstAnswer(question);
  const answerOption = question.options[["A", "B", "C", "D"].indexOf(answer)] || "";
  const answerVisible = memorySide === "back";
  const progress = getQuestionProgress(question.id);
  card.dataset.side = memorySide;
  document.querySelector("#memory-label").textContent = answerVisible ? "答案与解析" : "先回忆";
  document.querySelector("#memory-front").textContent = question.text;
  document.querySelector("#memory-back").textContent = answer ? `答案 ${answer}：${answerOption}` : "答案见整题截图中的勾选项";
  document.querySelector("#memory-flip").textContent = "显示答案";
  document.querySelector(".memory-controls").hidden = answerVisible;
  document.querySelector("#memory-ratings").hidden = !answerVisible;
  document.querySelector("#memory-known-interval").textContent = `${nextKnownMemoryInterval(progress)} 天`;
}

function flipMemoryCard() {
  if (!memoryMode || memorySide === "back") return;
  memorySide = "back";
  void updateQuestionProgress(questionKey(), (progress) => {
    progress.memoryViews = (progress.memoryViews || 0) + 1;
    progress.lastMemoryAt = new Date().toISOString();
  });
  renderQuestion();
}

function completeMemorySession() {
  if (!activeSession?.questionIds?.length) return;
  const completedSession = activeSession;
  const ratings = completedSession.memoryRatings || {};
  const ratingCounts = Object.values(ratings).reduce(
    (counts, rating) => ({ ...counts, [rating]: (counts[rating] || 0) + 1 }),
    {},
  );
  recordRecent(
    `${completedSession.title || "间隔背题"}已完成`,
    `认识 ${ratingCounts.known || 0} · 模糊 ${ratingCounts.fuzzy || 0} · 不会 ${ratingCounts.forgot || 0}`,
    "背题",
    completedSession.questionIds[completedSession.questionIds.length - 1],
  );
  activeSession = null;
  currentUserState.activeSession = null;
  memoryMode = false;
  memorySide = "front";
  document.querySelector("#mode-practice").classList.add("active");
  document.querySelector("#mode-memory").classList.remove("active");
  void writeUserState();
  goTo("home", { replace: true });
}

async function rateMemory(rating) {
  const question = currentQuestionObject();
  if (!memoryMode || memorySide !== "back" || !question || !activeSession?.questionIds?.length) return;
  const now = Date.now();
  await updateQuestionProgress(question.id, (progress) => {
    progress.memoryEase = Math.max(1.3, progress.memoryEase || 2.3);
    if (rating === "forgot") {
      progress.memoryRepetitions = 0;
      progress.memoryIntervalDays = 0;
      progress.memoryEase = Math.max(1.3, progress.memoryEase - 0.2);
      progress.memoryLapses = (progress.memoryLapses || 0) + 1;
      progress.memoryNextReviewAt = new Date(now + 10 * 60 * 1000).toISOString();
    } else if (rating === "fuzzy") {
      progress.memoryRepetitions = Math.max(1, progress.memoryRepetitions || 0);
      progress.memoryIntervalDays = Math.min(90, Math.max(1, Math.round((progress.memoryIntervalDays || 1) * 1.2)));
      progress.memoryEase = Math.max(1.3, progress.memoryEase - 0.12);
      progress.memoryNextReviewAt = new Date(now + progress.memoryIntervalDays * 24 * 60 * 60 * 1000).toISOString();
    } else {
      progress.memoryIntervalDays = nextKnownMemoryInterval(progress);
      progress.memoryRepetitions = (progress.memoryRepetitions || 0) + 1;
      progress.memoryEase = Math.min(2.8, progress.memoryEase + 0.08);
      progress.memoryNextReviewAt = new Date(now + progress.memoryIntervalDays * 24 * 60 * 60 * 1000).toISOString();
    }
    progress.memoryLastRating = rating;
    progress.lastMemoryAt = new Date(now).toISOString();
  });
  activeSession.memoryRatings ||= {};
  activeSession.memoryRatings[question.id] = rating;
  if ((activeSession.index || 0) >= activeSession.questionIds.length - 1) {
    completeMemorySession();
    return;
  }
  activeSession.index += 1;
  setCurrentQuestionById(activeSession.questionIds[activeSession.index]);
  memorySide = "front";
  currentUserState.activeSession = activeSession;
  await writeUserState();
  renderQuestion();
  viewScrollPositions.set("practice", 0);
  window.scrollTo(0, 0);
}

function updateDailyPlanUI() {
  if (!currentUserState) return;
  const plan = dailyPlanPreview();
  const answeredCount = plan.questionIds.filter((id) => isQuestionPracticedToday(id)).length;
  const totalCount = plan.questionIds.length || 0;
  const percent = totalCount ? Math.round((answeredCount / totalCount) * 100) : 0;
  document.querySelector("#plan-days").value = String(plan.days || currentUserState.prefs.planDays || 30);
  document.querySelector("#plan-count").textContent = `${totalCount} 题`;
  document.querySelector("#today-count").textContent = String(totalCount);
  document.querySelector("#plan-meter-fill").style.width = `${percent}%`;
  document.querySelector("#plan-description").textContent =
    currentUserState.prefs.planMode === "extra"
      ? "自由加练会优先抽未做题，不破坏今日计划，但答题仍计入总进度"
      : `目标 ${plan.targetDate || "未设置"}，剩余 ${plan.remainingDays || plan.days} 天：新题 ${plan.newCount}，错题复习 ${plan.reviewCount}`;
  document.querySelector("#sample-tags").innerHTML = (plan.tags?.length ? plan.tags : ["暂无可抽题目"])
    .map((tag) => `<span>${escapeHtml(tag)}</span>`)
    .join("");
}

function setPlanMode(mode) {
  const isExtra = mode === "extra";
  document.querySelector("#plan-day").classList.toggle("active", !isExtra);
  document.querySelector("#plan-extra").classList.toggle("active", isExtra);
  document.querySelector("#extra-practice").classList.toggle("visible", isExtra);
  if (currentUserState) {
    currentUserState.prefs.planMode = mode;
    void writeUserState();
  }
  updateDailyPlanUI();
}

function formatSeconds(totalSeconds = 0) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function validExamSession(session) {
  return Boolean(
    session?.questionIds?.length &&
      session.questionIds.every((id) => questionIndexById.has(id)) &&
      Number.isInteger(session.index),
  );
}

function createExamSession(questionIds = null) {
  const sourceIds =
    questionIds?.length
      ? questionIds
      : activeSession?.questionIds?.length
        ? activeSession.questionIds.slice(activeSession.index || 0)
        : buildExtraSession(30);
  let ids = uniqueIds(sourceIds).filter((id) => examEligibleQuestion(getQuestionById(id))).slice(0, 30);
  if (ids.length < 30) {
    const fillIds = buildExtraSession(30)
      .filter((id) => examEligibleQuestion(getQuestionById(id)) && !ids.includes(id))
      .slice(0, 30 - ids.length);
    ids = [...ids, ...fillIds];
  }
  if (ids.length < 30) {
    const broadFillIds = availableQuestionIds((question) => examEligibleQuestion(question) && !ids.includes(question.id)).slice(0, 30 - ids.length);
    ids = [...ids, ...broadFillIds];
  }
  const fallbackIds = ids.length ? ids : availableQuestionIds(examEligibleQuestion).slice(0, 30);
  examSession = {
    id: `exam-${Date.now()}`,
    title: "模拟计时",
    questionIds: fallbackIds,
    index: 0,
    answers: {},
    seconds: 0,
    startedAt: new Date().toISOString(),
    submitted: false,
    score: null,
  };
  examSeconds = 0;
  currentUserState.examSession = examSession;
  void writeUserState();
  return examSession;
}

function ensureExamSession(forceNew = false) {
  if (!currentUserState) return null;
  if (forceNew || !validExamSession(examSession)) {
    return createExamSession();
  }
  examSeconds = examSession.seconds || 0;
  return examSession;
}

function renderExam() {
  const session = ensureExamSession();
  if (!session) return;
  session.index = Math.max(0, Math.min(session.index || 0, session.questionIds.length - 1));
  const question = getQuestionById(session.questionIds[session.index]);
  if (!question) return;
  const letters = ["A", "B", "C", "D"];
  const selected = session.answers?.[question.id] || "";
  const correct = firstAnswer(question);
  const submitted = Boolean(session.submitted);
  const examImage = document.querySelector("#exam-question-image");
  const examRealImage = document.querySelector("#exam-real-image");
  const hasRealImage = Boolean(question.images?.length);

  document.querySelector("#exam-timer").textContent = formatSeconds(session.seconds || examSeconds);
  document.querySelector("#exam-meta").textContent = `第 ${session.index + 1} / ${session.questionIds.length} 题`;
  document.querySelector("#exam-progress-count").textContent = `${session.index + 1}/${session.questionIds.length}`;
  document.querySelector("#exam-progress-fill").style.width = `${Math.round(((session.index + 1) / session.questionIds.length) * 100)}%`;
  document.querySelector("#exam-type").textContent = question.type || "单选题";
  document.querySelector("#exam-question-text").textContent = question.text;
  examImage.classList.remove("expanded");
  examImage.classList.toggle("visible", hasRealImage);
  examImage.classList.toggle("has-real-image", hasRealImage);
  examRealImage.src = hasRealImage ? question.images[0] : "";
  examRealImage.alt = hasRealImage ? `${question.category}模拟题图` : "模拟题图";
  document.querySelector("#exam-image-caption").textContent =
    hasRealImage && question.images.length > 1 ? `题图 1 / ${question.images.length}，点按放大` : "题图，点按放大";
  document.querySelector("#exam-option-list").innerHTML = question.options
    .map((option, index) => {
      const letter = letters[index];
      const isSelected = selected === letter;
      const isCorrect = submitted && correct === letter;
      const isWrong = submitted && isSelected && !isCorrect;
      return `
        <button class="option-button ${isSelected ? "selected" : ""} ${isCorrect ? "correct" : ""} ${isWrong ? "wrong" : ""}" data-letter="${letter}" type="button" ${submitted ? "disabled" : ""}>
          <strong>${letter}</strong>
          <span>${escapeHtml(option)}</span>
        </button>
      `;
    })
    .join("");
  document.querySelector("#submit-exam").textContent = submitted ? "已交卷" : "交卷";
  document.querySelector("#submit-exam").disabled = submitted;
  const examPrev = document.querySelector("#exam-prev");
  const examNext = document.querySelector("#exam-next");
  examPrev.disabled = session.index <= 0;
  examNext.textContent = session.index >= session.questionIds.length - 1 ? "打开答题卡" : "下一题";
  renderAnswerSheet();
  renderExamScore();
}

function renderAnswerSheet() {
  const grid = document.querySelector("#answer-sheet-grid");
  if (!examSession?.questionIds?.length) {
    grid.innerHTML = "";
    return;
  }
  grid.innerHTML = examSession.questionIds
    .map((id, index) => {
      const answer = examSession.answers?.[id];
      const question = getQuestionById(id);
      const submitted = Boolean(examSession.submitted);
      const correct = submitted && answer && answer === firstAnswer(question);
      const wrong = submitted && answer !== firstAnswer(question);
      return `<button class="${answer ? "done" : ""} ${index === examSession.index ? "current" : ""} ${correct ? "correct" : ""} ${wrong ? "wrong" : ""}" data-exam-index="${index}" type="button">${index + 1}</button>`;
    })
    .join("");
  const answered = examSession.questionIds.filter((id) => examSession.answers?.[id]).length;
  document.querySelector("#exam-sheet-summary").textContent = examSession.submitted
    ? `已交卷 · 作答 ${answered}/${examSession.questionIds.length}`
    : `已答 ${answered} / ${examSession.questionIds.length}`;
}

function renderExamScore() {
  const scoreCard = document.querySelector("#score-card");
  if (!examSession?.submitted || !examSession.score) {
    scoreCard.classList.remove("visible");
    return;
  }
  const { correct, total, unanswered } = examSession.score;
  const percent = total ? Math.round((correct / total) * 100) : 0;
  scoreCard.querySelector("strong").textContent = `得分 ${correct} / ${total}`;
  scoreCard.querySelector("span").textContent = `正确率 ${percent}% · 未答 ${unanswered} 题 · 用时 ${formatSeconds(examSession.seconds || 0)}，错题已进入错题本`;
  scoreCard.classList.add("visible");
}

function startExamTimer() {
  if (!examSession || examSession.submitted || examTimer) return;
  document.querySelector("#exam-timer").textContent = formatSeconds(examSession.seconds || 0);
  examTimer = setInterval(() => {
    examSession.seconds = (examSession.seconds || 0) + 1;
    examSeconds = examSession.seconds;
    document.querySelector("#exam-timer").textContent = formatSeconds(examSeconds);
    if (examSeconds % 5 === 0) {
      void writeUserState();
    }
  }, 1000);
}

function stopExamTimer() {
  if (!examTimer) return;
  clearInterval(examTimer);
  examTimer = null;
}

function chooseExamOption(button) {
  if (!examSession || examSession.submitted) return;
  const questionId = examSession.questionIds[examSession.index || 0];
  examSession.answers ||= {};
  examSession.answers[questionId] = button.dataset.letter;
  examSession.updatedAt = new Date().toISOString();
  currentUserState.examSession = examSession;
  renderExam();
  void writeUserState();
}

function moveExam(delta) {
  if (!examSession?.questionIds?.length) return;
  examSession.index = Math.max(0, Math.min(examSession.questionIds.length - 1, (examSession.index || 0) + delta));
  renderExam();
  viewScrollPositions.set("exam", 0);
  window.scrollTo(0, 0);
  void writeUserState();
}

function goToExamIndex(index) {
  if (!examSession?.questionIds?.length) return;
  examSession.index = Math.max(0, Math.min(examSession.questionIds.length - 1, Number(index) || 0));
  renderExam();
  viewScrollPositions.set("exam", 0);
  window.scrollTo(0, 0);
  if (history.state?.overlay === "exam-answer-card") navigateBack("exam");
  void writeUserState();
}

function openExamAnswerSheet(options = {}) {
  renderAnswerSheet();
  renderExamScore();
  if (options.history === false) {
    syncExamOverlay("exam-answer-card");
    return;
  }
  setOverlayHistory("exam-answer-card");
}

function closeExamAnswerSheet() {
  navigateBack("exam");
}

function requestExamSubmit() {
  if (!examSession?.questionIds?.length) return;
  if (examSession.submitted) {
    openExamAnswerSheet();
    return;
  }
  const answered = examSession.questionIds.filter((id) => examSession.answers?.[id]).length;
  const unanswered = examSession.questionIds.length - answered;
  examConfirmReturnOverlay = history.state?.overlay === "exam-answer-card" ? "exam-answer-card" : null;
  document.querySelector("#exam-confirm-message").textContent = unanswered
    ? `还有 ${unanswered} 题未作答，交卷后不能修改答案。`
    : `已完成 ${answered} 题，交卷后不能修改答案。`;
  setOverlayHistory("exam-confirm", { replace: Boolean(examConfirmReturnOverlay) });
}

function cancelExamSubmit() {
  if (examConfirmReturnOverlay === "exam-answer-card") {
    examConfirmReturnOverlay = null;
    setOverlayHistory("exam-answer-card", { replace: true });
    return;
  }
  examConfirmReturnOverlay = null;
  navigateBack("exam");
}

function recordExamQuestionResult(question, chosen, isCorrect) {
  const progress = getQuestionProgress(question.id);
  progress.answeredCount += chosen ? 1 : 0;
  progress.lastAnswer = chosen || "";
  progress.lastAnsweredAt = new Date().toISOString();
  progress.lastPracticedAt = new Date().toISOString();
  progress.done = true;
  if (isCorrect) {
    progress.correctStreak += 1;
    progress.nextReviewAt = new Date(Date.now() + Math.min(14, 1 + progress.correctStreak * 2) * 24 * 60 * 60 * 1000).toISOString();
    return;
  }
  progress.correctStreak = 0;
  progress.wrong = true;
  progress.wrongCount = (progress.wrongCount || 0) + 1;
  progress.nextReviewAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  currentUserState.mistakes = moveToFront(currentUserState.mistakes, {
    questionId: question.id,
    title: questionTitle(question.id),
    meta: `${question.category} · ${chosen ? "模拟错题" : "模拟未答"} · 错 ${progress.wrongCount} 次`,
    pill: "错题",
    updatedAt: new Date().toISOString(),
  });
}

async function submitExam() {
  if (!examSession || examSession.submitted) return;
  stopExamTimer();
  let correctCount = 0;
  let unanswered = 0;
  examSession.questionIds.forEach((id) => {
    const question = getQuestionById(id);
    if (!question) return;
    const chosen = examSession.answers?.[id] || "";
    if (!chosen) unanswered += 1;
    const isCorrect = chosen === firstAnswer(question);
    if (isCorrect) correctCount += 1;
    recordExamQuestionResult(question, chosen, isCorrect);
  });
  examSession.submitted = true;
  examSession.submittedAt = new Date().toISOString();
  examSession.score = {
    correct: correctCount,
    total: examSession.questionIds.length,
    unanswered,
  };
  currentUserState.examSession = examSession;
  currentUserState.recent = moveToFront(currentUserState.recent, {
    questionId: examSession.questionIds[0],
    title: "模拟计时",
    meta: `得分 ${correctCount}/${examSession.questionIds.length} · 用时 ${formatSeconds(examSession.seconds || 0)}`,
    pill: "模拟",
    updatedAt: new Date().toISOString(),
  });
  setRecordListsFromState();
  updateHomeStats();
  renderExam();
  await writeUserState();
  setOverlayHistory("exam-answer-card", { replace: Boolean(history.state?.overlay) });
}

function setupCalculator() {
  const keys = ["C", "(", ")", "⌫", "7", "8", "9", "÷", "4", "5", "6", "×", "1", "2", "3", "-", "0", ".", "=", "+"];
  const grid = document.querySelector("#calc-grid");
  const display = document.querySelector("#calc-display");
  grid.innerHTML = keys
    .map((key) => {
      const className = key === "=" ? "equals" : key === "C" || key === "⌫" ? "danger" : "+-×÷()".includes(key) ? "op" : "";
      return `<button class="${className}" data-key="${key}" type="button">${key}</button>`;
    })
    .join("");

  grid.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    const key = button.dataset.key;
    if (key === "C") {
      display.value = "";
      return;
    }
    if (key === "⌫") {
      display.value = display.value.slice(0, -1);
      return;
    }
    if (key === "=") {
      const expression = display.value.replaceAll("×", "*").replaceAll("÷", "/");
      if (!/^[\d+\-*/().\s]+$/.test(expression)) {
        display.value = "格式错误";
        return;
      }
      try {
        const result = Function(`"use strict"; return (${expression})`)();
        display.value = Number.isFinite(result) ? String(Number(result.toFixed(8))) : "无法计算";
      } catch {
        display.value = "格式错误";
      }
      return;
    }
    display.value += key;
  });
}

const canvas = document.querySelector("#scratch-canvas");
const ctx = canvas.getContext("2d");
let drawing = false;
let lastPoint = null;
let eraserMode = false;
let activeSheetTool = "scratch";
let canvasHistory = [];

function configureCanvasContext() {
  const scale = window.devicePixelRatio || 1;
  ctx.lineWidth = (eraserMode ? 18 : 3) * scale;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#1f2937";
  ctx.globalCompositeOperation = eraserMode ? "destination-out" : "source-over";
}

function captureCanvasState() {
  if (!canvas.width || !canvas.height) return;
  canvasHistory.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
  canvasHistory = canvasHistory.slice(-20);
  document.querySelector("#undo-canvas").disabled = canvasHistory.length <= 1;
}

function setSheetTool(tool) {
  activeSheetTool = tool === "calculator" ? "calculator" : "scratch";
  const scratchActive = activeSheetTool === "scratch";
  document.querySelector("#tool-tab-scratch").classList.toggle("active", scratchActive);
  document.querySelector("#tool-tab-calculator").classList.toggle("active", !scratchActive);
  document.querySelector("#scratch-tool-panel").classList.toggle("active", scratchActive);
  document.querySelector("#calculator-tool-panel").classList.toggle("active", !scratchActive);
  viewScrollPositions.set("sheet", 0);
  window.scrollTo(0, 0);
  if (scratchActive) requestAnimationFrame(resizeCanvasBackingStore);
}

function resizeCanvasBackingStore() {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const scale = window.devicePixelRatio || 1;
  const previous = ctx.getImageData(0, 0, canvas.width, canvas.height);
  canvas.width = Math.max(1, Math.floor(rect.width * scale));
  canvas.height = Math.max(1, Math.floor(rect.height * scale));
  ctx.putImageData(previous, 0, 0);
  configureCanvasContext();
  canvasHistory = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
  document.querySelector("#undo-canvas").disabled = true;
}

function getCanvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  const touch = event.touches?.[0] || event.changedTouches?.[0] || event;
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (touch.clientX - rect.left) * scaleX,
    y: (touch.clientY - rect.top) * scaleY,
  };
}

function startDrawing(event) {
  event.preventDefault();
  drawing = true;
  lastPoint = getCanvasPoint(event);
}

function draw(event) {
  if (!drawing) return;
  event.preventDefault();
  const point = getCanvasPoint(event);
  ctx.beginPath();
  ctx.moveTo(lastPoint.x, lastPoint.y);
  ctx.lineTo(point.x, point.y);
  ctx.stroke();
  lastPoint = point;
}

function stopDrawing() {
  if (drawing) captureCanvasState();
  drawing = false;
  lastPoint = null;
}

function bindEvents() {
  document.body.addEventListener("click", async (event) => {
    const target = event.target.closest("[data-target]");
    if (!target) return;
    event.preventDefault();
    const wasDisabled = target.disabled;
    target.disabled = true;
    try {
      startSessionFromTarget(target);
      if (target.dataset.mode === "memory") {
        setMode(true);
      } else if (target.dataset.target === "practice") {
        setMode(false);
      }
      let ready = true;
      if (target.dataset.target === "practice" && activeSession?.questionIds?.length) {
        ready = await ensureQuestionsLoaded(activeSession.questionIds);
      } else if (target.dataset.target === "exam") {
        ensureExamSession();
        ready = await ensureQuestionsLoaded(examSession?.questionIds || [], "正在准备模拟试卷");
      }
      if (ready) goTo(target.dataset.target);
    } finally {
      target.disabled = wasDisabled;
    }
  });

  document.querySelector("#mode-practice").addEventListener("click", () => setMode(false));
  document.querySelector("#mode-memory").addEventListener("click", () => setMode(true));
  document.querySelector("#memory-flip").addEventListener("click", flipMemoryCard);
  document.querySelectorAll("[data-memory-rating]").forEach((button) => {
    button.addEventListener("click", () => void rateMemory(button.dataset.memoryRating));
  });
  document.querySelectorAll("[data-record-tab]").forEach((button) => {
    button.addEventListener("click", () => setRecordTab(button.dataset.recordTab));
  });
  document.querySelector("#export-progress").addEventListener("click", () => void exportProgress());
  document.querySelector("#import-progress").addEventListener("click", () => document.querySelector("#import-progress-file").click());
  document.querySelector("#import-progress-file").addEventListener("change", (event) => {
    const input = event.currentTarget;
    const [file] = input.files || [];
    void importProgressFile(file).finally(() => {
      input.value = "";
    });
  });
  document.querySelector("#plan-day").addEventListener("click", () => setPlanMode("day"));
  document.querySelector("#plan-extra").addEventListener("click", () => setPlanMode("extra"));
  document.querySelector("#plan-days").addEventListener("change", (event) => {
    const nextDays = clampNumber(event.currentTarget.value, 1, 365, 30);
    event.currentTarget.value = String(nextDays);
    currentUserState.prefs.planDays = nextDays;
    if (currentUserState.dailyPlans) {
      delete currentUserState.dailyPlans[todayKey()];
    }
    updateDailyPlanUI();
    void writeUserState();
  });
  document.querySelector("#search-input").addEventListener("input", () => {
    clearTimeout(searchInputTimer);
    searchInputTimer = setTimeout(() => void prepareSearchResults(), 220);
  });
  document.querySelector("#search-library").addEventListener("change", (event) => {
    renderSearchCategoryOptions({ library: event.currentTarget.value, folder: "", setName: "", category: "" });
    renderSearchResults();
    void writeUserState();
  });
  document.querySelector("#search-folder").addEventListener("change", (event) => {
    renderSearchCategoryOptions({
      library: document.querySelector("#search-library").value,
      folder: event.currentTarget.value,
      setName: "",
      category: "",
    });
    renderSearchResults();
    void writeUserState();
  });
  document.querySelector("#search-set").addEventListener("change", (event) => {
    renderSearchCategoryOptions({
      library: document.querySelector("#search-library").value,
      folder: document.querySelector("#search-folder").value,
      setName: event.currentTarget.value,
      category: "",
    });
    renderSearchResults();
    void writeUserState();
  });
  document.querySelector("#search-category").addEventListener("change", () => {
    renderSearchResults();
    void writeUserState();
  });
  document.querySelector("#clear-search").addEventListener("click", () => {
    document.querySelector("#search-input").value = "";
    renderSearchCategoryOptions({ library: "", folder: "", setName: "", category: "" });
    renderSearchResults();
    void writeUserState();
  });
  document.querySelector("#app-status-action").addEventListener("click", async () => {
    setAppStatus("正在重新加载题库数据。", "info");
    const loaded = retryQuestionLoad ? await retryQuestionLoad() : await loadQuestionData({ showLoading: false });
    if (loaded) {
      renderAllDynamicSections();
      if (shell.dataset.view === "exam") renderExam();
    }
  });
  document.querySelector("#topbar-back").addEventListener("click", () => {
    const view = shell.dataset.view;
    if (view === "sheet") {
      closeSheet();
      return;
    }
    if (view === "home") return;
    navigateBack("home");
  });
  document.querySelector("#user-switch").addEventListener("click", (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    loadCurrentUser((currentUserIndex + 1) % users.length).finally(() => {
      button.disabled = false;
    });
  });
  document.querySelector("#submit-exam").addEventListener("click", () => {
    requestExamSubmit();
  });
  document.querySelector("#new-exam").addEventListener("click", async () => {
    stopExamTimer();
    createExamSession();
    const ready = await ensureQuestionsLoaded(examSession?.questionIds || [], "正在准备模拟试卷");
    if (!ready) return;
    renderExam();
    startExamTimer();
  });
  document.querySelector("#exam-prev").addEventListener("click", () => moveExam(-1));
  document.querySelector("#exam-next").addEventListener("click", () => {
    if (examSession?.index >= examSession?.questionIds?.length - 1) {
      openExamAnswerSheet();
      return;
    }
    moveExam(1);
  });
  document.querySelector("#exam-back").addEventListener("click", () => navigateBack("home"));
  document.querySelector("#open-exam-answer-sheet").addEventListener("click", openExamAnswerSheet);
  document.querySelector("#close-exam-answer-sheet").addEventListener("click", closeExamAnswerSheet);
  document.querySelector("#open-exam-scratch").addEventListener("click", () => openToolSheet("exam"));
  document.querySelector("#exam-submit-confirm").addEventListener("click", (event) => {
    if (event.target.id === "exam-submit-confirm") cancelExamSubmit();
  });
  document.querySelector("#exam-confirm-cancel").addEventListener("click", cancelExamSubmit);
  document.querySelector("#exam-confirm-submit").addEventListener("click", () => {
    examConfirmReturnOverlay = null;
    void submitExam();
  });
  document.querySelector("#exam-option-list").addEventListener("click", (event) => {
    const button = event.target.closest(".option-button");
    if (button) chooseExamOption(button);
  });
  document.querySelector("#answer-sheet-grid").addEventListener("click", (event) => {
    const button = event.target.closest("[data-exam-index]");
    if (button) goToExamIndex(button.dataset.examIndex);
  });
  document.querySelector("#answer-toggle").addEventListener("click", () => {
    const analysisCard = document.querySelector("#analysis-card");
    analysisCard.classList.toggle("visible");
    document.querySelector("#answer-toggle").textContent = analysisCard.classList.contains("visible") ? "收起" : "看解析";
  });
  document.querySelector("#next-question").addEventListener("click", () => {
    advanceQuestion();
  });
  document.querySelector("#prev-question").addEventListener("click", () => {
    previousQuestion();
  });
  document.querySelector("#practice-back").addEventListener("click", () => navigateBack("home"));
  document.querySelector("#open-practice-sheet").addEventListener("click", practiceSheetOpen);
  document.querySelector("#close-practice-sheet").addEventListener("click", practiceSheetClose);
  document.querySelector("#practice-sheet-backdrop").addEventListener("click", (event) => {
    if (event.target.id === "practice-sheet-backdrop") practiceSheetClose();
  });
  document.querySelector("#practice-sheet-grid").addEventListener("click", (event) => {
    const button = event.target.closest("[data-practice-index]");
    if (button) goToPracticeIndex(button.dataset.practiceIndex);
  });
  document.querySelector("#submit-practice-session").addEventListener("click", finishPracticeSession);
  document.querySelector("#practice-confirm-cancel").addEventListener("click", cancelPracticeSubmit);
  document.querySelector("#practice-confirm-submit").addEventListener("click", () => {
    practiceConfirmReturnOverlay = null;
    finalizePracticeSession();
  });
  document.querySelector("#practice-result-review").addEventListener("click", reviewPracticeMistakes);
  document.querySelector("#practice-result-home").addEventListener("click", leavePracticeResult);
  document.querySelector("#mark-favorite").addEventListener("click", (event) => {
    const question = currentQuestionObject();
    const progress = getQuestionProgress(question.id);
    progress.favorite = !progress.favorite;
    if (progress.favorite) {
      currentUserState.favorites = moveToFront(currentUserState.favorites, {
        questionId: question.id,
        title: questionTitle(question.id),
        meta: `${question.category} · ${question.source} · 已收藏`,
        pill: "收藏",
        updatedAt: new Date().toISOString(),
      });
    } else {
      currentUserState.favorites = currentUserState.favorites.filter((item) => item.questionId !== question.id);
    }
    event.currentTarget.textContent = progress.favorite ? "已收藏" : "收藏";
    setRecordListsFromState();
    renderPracticeSheet();
    void writeUserState();
  });
  document.querySelector("#mark-wrong").addEventListener("click", (event) => {
    const question = currentQuestionObject();
    const progress = getQuestionProgress(question.id);
    progress.wrong = true;
    progress.wrongCount = Math.max(progress.wrongCount || 0, 1);
    progress.lastPracticedAt = new Date().toISOString();
    progress.lastAnsweredAt = new Date().toISOString();
    progress.nextReviewAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    currentUserState.mistakes = moveToFront(currentUserState.mistakes, {
      questionId: question.id,
      title: questionTitle(question.id),
      meta: `${question.category} · 错 ${progress.wrongCount} 次 · 手动加入`,
      pill: "错题",
      updatedAt: new Date().toISOString(),
    });
    event.currentTarget.textContent = "已记入";
    setRecordListsFromState();
    renderPracticeSheet();
    void writeUserState();
  });
  document.querySelector("#sheet-close").addEventListener("click", closeSheet);
  document.querySelector("#view-sheet").addEventListener("click", (event) => {
    if (event.target.id === "view-sheet") closeSheet();
  });
  document.querySelector("#open-sheet-top").addEventListener("click", () => openToolSheet("practice"));
  document.querySelector("#tool-tab-scratch").addEventListener("click", () => setSheetTool("scratch"));
  document.querySelector("#tool-tab-calculator").addEventListener("click", () => setSheetTool("calculator"));
  document.querySelector("#undo-canvas").addEventListener("click", () => {
    if (canvasHistory.length <= 1) return;
    canvasHistory.pop();
    const previous = canvasHistory[canvasHistory.length - 1];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.putImageData(previous, 0, 0);
    configureCanvasContext();
    document.querySelector("#undo-canvas").disabled = canvasHistory.length <= 1;
  });
  document.querySelector("#eraser-toggle").addEventListener("click", (event) => {
    eraserMode = !eraserMode;
    event.currentTarget.classList.toggle("active", eraserMode);
    event.currentTarget.textContent = eraserMode ? "画笔" : "橡皮";
    configureCanvasContext();
  });
  document.querySelector("#option-list").addEventListener("click", (event) => {
    const button = event.target.closest(".option-button");
    if (button) chooseOption(button);
  });
  document.querySelector("#clear-canvas").addEventListener("click", () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    configureCanvasContext();
    captureCanvasState();
  });
  document.querySelector("#question-image").addEventListener("click", (event) => {
    if (!event.currentTarget.classList.contains("has-real-image")) return;
    event.currentTarget.classList.toggle("expanded");
  });
  document.querySelector("#exam-question-image").addEventListener("click", (event) => {
    if (!event.currentTarget.classList.contains("has-real-image")) return;
    event.currentTarget.classList.toggle("expanded");
  });
  canvas.addEventListener("mousedown", startDrawing);
  canvas.addEventListener("mousemove", draw);
  window.addEventListener("mouseup", stopDrawing);
  canvas.addEventListener("touchstart", startDrawing, { passive: false });
  canvas.addEventListener("touchmove", draw, { passive: false });
  canvas.addEventListener("touchend", stopDrawing);
  canvas.addEventListener("touchcancel", stopDrawing);
  window.addEventListener("resize", resizeCanvasBackingStore);
}

function updateHomeStats() {
  const progress = currentUserState?.progress || {};
  const doneCount = questions.filter((question) => practiceEligibleQuestion(question) && (progress[question.id]?.done || progress[question.id]?.answeredCount > 0)).length;
  document.querySelector("#total-count").textContent = String(questions.length);
  document.querySelector("#done-count").textContent = String(doneCount);
  const mistakeCount = currentUserState?.mistakes?.length || 0;
  const favoriteCount = currentUserState?.favorites?.length || 0;
  const recentCount = currentUserState?.recent?.length || 0;
  const mistakeMeta = document.querySelector('[data-target="mistakes"] small');
  const favoriteMeta = document.querySelector('[data-target="favorites"] small');
  const recentMeta = document.querySelector('[data-target="recent"] small');
  if (mistakeMeta) mistakeMeta.textContent = `已记录 ${mistakeCount} 题`;
  if (favoriteMeta) favoriteMeta.textContent = `重点题 ${favoriteCount} 题`;
  if (recentMeta) recentMeta.textContent = recentCount ? `最近 ${recentCount} 条记录` : "继续上次进度";
  const resume = document.querySelector("#resume-practice");
  const canResume = Boolean(activeSession?.questionIds?.length && !activeSession.submitted);
  resume.hidden = !canResume;
  if (canResume) {
    document.querySelector("#resume-practice-title").textContent = activeSession.title || "继续练习";
    document.querySelector("#resume-practice-progress").textContent = `${(activeSession.index || 0) + 1} / ${activeSession.questionIds.length}`;
  }
  updateDailyPlanUI();
}

function renderAllDynamicSections() {
  renderChapters();
  setRecordListsFromState();
  updateHomeStats();
  renderQuestion();
  renderSearchCategoryOptions({
    library: currentUserState?.prefs?.lastSearchLibrary || "",
    folder: currentUserState?.prefs?.lastSearchFolder || "",
    setName: currentUserState?.prefs?.lastSearchSet || "",
    category: currentUserState?.prefs?.lastSearchCategory || "",
  });
  document.querySelector("#search-input").value = currentUserState?.prefs?.lastSearchQuery || "";
  renderSearchResults();
  setPlanMode(currentUserState?.prefs?.planMode || "day");
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // Static preview can still run without install/offline support.
    });
  });
}

function updateNetworkStatus() {
  const status = document.querySelector("#network-status");
  if (!status) return;
  const offline = navigator.onLine === false;
  status.textContent = offline ? "离线可刷" : "在线";
  status.classList.toggle("offline", offline);
}

async function initApp() {
  const savedIndex = Number(localStorage.getItem(currentUserKey));
  if (Number.isInteger(savedIndex) && savedIndex >= 0 && savedIndex < users.length) {
    currentUserIndex = savedIndex;
  }
  rebuildQuestionIndex();
  setupCalculator();
  bindEvents();
  registerServiceWorker();
  updateNetworkStatus();
  window.addEventListener("online", updateNetworkStatus);
  window.addEventListener("offline", updateNetworkStatus);
  await loadQuestionData({ showLoading: true });
  await loadCurrentUser(currentUserIndex);
  const savedView = currentUserState?.lastView || "home";
  const restoredView =
    savedView === "practice" && activeSession?.questionIds?.length
      ? "practice"
      : savedView === "exam" && examSession?.questionIds?.length
        ? "exam"
        : savedView === "sheet"
          ? activeSession?.questionIds?.length
            ? "practice"
            : examSession?.questionIds?.length
              ? "exam"
              : "home"
          : VALID_VIEWS.has(savedView)
            ? savedView
            : "home";
  if (restoredView === "practice" && activeSession?.questionIds?.length) {
    await ensureQuestionsLoaded(activeSession.questionIds);
  } else if (restoredView === "exam" && examSession?.questionIds?.length) {
    await ensureQuestionsLoaded(examSession.questionIds, "正在恢复模拟试卷");
  } else if (restoredView === "search" && currentUserState?.prefs?.lastSearchQuery) {
    await ensureAllQuestionDataLoaded();
  }
  goTo(restoredView, { history: false });
  initializeAppHistory(restoredView);
}

initApp();
