import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const warnings = [];

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

function resolveInside(relativePath) {
  const resolved = path.resolve(root, String(relativePath || "").replaceAll("/", path.sep));
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    fail(`Path escapes the repository: ${relativePath}`);
  }
  return resolved;
}

function readJson(relativePath) {
  const fullPath = resolveInside(relativePath);
  if (!fs.existsSync(fullPath)) {
    fail(`Missing JSON file: ${relativePath}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch (error) {
    fail(`Invalid JSON in ${relativePath}: ${error.message}`);
    return null;
  }
}

function firstAnswer(question) {
  return Array.isArray(question?.answer) ? question.answer[0] || "" : question?.answer || "";
}

function isReferenceOnly(question) {
  return Boolean(
    question?.referenceOnly === true ||
      question?.practiceMode === "reference-only" ||
      question?.answerRevealed ||
      question?.questionType === "image-only" ||
      (!question?.options?.length && question?.images?.length),
  );
}

function isReviewOnly(question) {
  return Boolean(
    question?.practiceMode === "review-only" ||
      question?.reviewOnly === true ||
      question?.importNotes?.some(
        (note) => String(note).startsWith("audit_") || note === "auto_audit_suspected_incomplete_question",
      ),
  );
}

function isPracticeEligible(question) {
  return Boolean(
    !isReferenceOnly(question) &&
      !isReviewOnly(question) &&
      question?.options?.length >= 2 &&
      firstAnswer(question),
  );
}

function optionKey(option, index) {
  if (typeof option === "object" && option) return String(option.key || String.fromCharCode(65 + index)).trim();
  return String.fromCharCode(65 + index);
}

function optionText(option) {
  return String(typeof option === "object" && option ? option.text || "" : option || "").trim();
}

const index = readJson("data/index.json");
if (!index) process.exit(1);

const chunkPaths = [...new Set(index.questionChunks || [])];
if (!chunkPaths.length) fail("data/index.json does not list question chunks.");

const questions = [];
const actualChunkById = new Map();
for (const chunkPath of chunkPaths) {
  const payload = readJson(chunkPath);
  if (!Array.isArray(payload)) {
    fail(`Question chunk is not an array: ${chunkPath}`);
    continue;
  }
  for (const question of payload) {
    questions.push(question);
    if (actualChunkById.has(question?.id)) fail(`Duplicate question id: ${question?.id}`);
    actualChunkById.set(question?.id, chunkPath);
  }
}

if (questions.length !== index.totalQuestions) {
  fail(`Question count mismatch: index=${index.totalQuestions}, chunks=${questions.length}`);
}

const catalog = readJson(index.catalog);
if (!Array.isArray(catalog)) fail("Question catalog is not an array.");
if (Array.isArray(catalog) && catalog.length !== questions.length) {
  fail(`Catalog count mismatch: catalog=${catalog.length}, chunks=${questions.length}`);
}

const catalogById = new Map();
for (const item of Array.isArray(catalog) ? catalog : []) {
  if (catalogById.has(item?.id)) fail(`Duplicate catalog id: ${item?.id}`);
  catalogById.set(item?.id, item);
}

const counts = { practice: 0, review: 0, reference: 0 };
const suspiciousStem = /正确答案\s*[:：]|标准答案\s*[:：]|参考答案\s*[:：]|答案\s*(?:为|是)\s*[A-H](?![A-Z])|\bP\d+\s*[-~～至]\s*\d+\b/i;
const forbiddenPracticeTags = new Set(["整题截图", "答案外露", "仅资料查看"]);

for (const question of questions) {
  const id = String(question?.id || "").trim();
  if (!id) {
    fail("Question without an id.");
    continue;
  }

  const catalogItem = catalogById.get(id);
  if (!catalogItem) fail(`${id}: missing from catalog.`);
  if (catalogItem?.dataChunk !== actualChunkById.get(id)) {
    fail(`${id}: catalog points to ${catalogItem?.dataChunk}, actual chunk is ${actualChunkById.get(id)}.`);
  }

  const reference = isReferenceOnly(question);
  const review = isReviewOnly(question);
  const practice = isPracticeEligible(question);
  const stateCount = Number(reference) + Number(review) + Number(practice);
  if (stateCount !== 1) fail(`${id}: question must belong to exactly one of practice/review/reference.`);

  const expectedCatalogMode = reference ? "reference-only" : review ? "review-only" : "practice";
  if (catalogItem?.practiceMode !== expectedCatalogMode) {
    fail(`${id}: catalog mode ${catalogItem?.practiceMode} does not match ${expectedCatalogMode}.`);
  }
  if (Boolean(catalogItem?.practiceEligible) !== practice) {
    fail(`${id}: catalog practiceEligible is inconsistent.`);
  }

  if (reference) counts.reference += 1;
  if (review) counts.review += 1;
  if (practice) counts.practice += 1;

  if (question?.practiceEligible === true && !practice) fail(`${id}: explicitly eligible but quarantined.`);
  if ((reference || review) && question?.practiceEligible === true) fail(`${id}: quarantined item cannot be practice eligible.`);

  for (const imagePath of question?.images || []) {
    const fullPath = resolveInside(imagePath);
    if (!fs.existsSync(fullPath)) fail(`${id}: missing image ${imagePath}.`);
  }

  if (!practice) continue;

  const stem = String(question.question || question.text || "").trim();
  if (stem.length < 6) fail(`${id}: practice stem is missing or too short.`);
  if (suspiciousStem.test(stem)) fail(`${id}: practice stem contains a likely answer marker or document index.`);
  if (question.answerRevealed) fail(`${id}: answer-revealing content entered practice.`);
  if (question.questionType === "image-only") fail(`${id}: image-only content entered practice.`);
  if ((question.tags || []).some((tag) => forbiddenPracticeTags.has(String(tag)))) {
    fail(`${id}: screenshot/reference tag entered practice.`);
  }

  const options = question.options || [];
  if (options.length < 2) fail(`${id}: practice question has fewer than two options.`);
  const keys = options.map(optionKey);
  if (new Set(keys).size !== keys.length) fail(`${id}: duplicate option keys.`);
  options.forEach((option, optionIndex) => {
    if (!optionText(option)) fail(`${id}: option ${keys[optionIndex]} is empty.`);
  });

  const answers = Array.isArray(question.answer) ? question.answer : [question.answer].filter(Boolean);
  if (question.questionType === "single" && answers.length !== 1) fail(`${id}: single choice must have exactly one answer.`);
  answers.forEach((answer) => {
    if (!keys.includes(String(answer))) fail(`${id}: answer ${answer} is not an option key.`);
  });
  if (String(question.analysis || "").trim().length < 6) fail(`${id}: practice analysis is missing or too short.`);
}

if (catalogById.size !== actualChunkById.size) fail("Catalog and chunk id sets differ.");

const reviewRows = readJson("data/import-review.json");
if (Array.isArray(reviewRows)) {
  const reviewIds = new Set(questions.filter(isReviewOnly).map((question) => question.id));
  const recorded = new Set();
  for (const row of reviewRows) {
    const id = row?.id || row?.questionId;
    if (!id) fail("Import review row without an id.");
    if (recorded.has(id)) fail(`Duplicate import review row: ${id}`);
    recorded.add(id);
    if (!reviewIds.has(id)) fail(`Import review row is not review-only: ${id}`);
  }
  for (const id of reviewIds) if (!recorded.has(id)) fail(`Review-only question missing from import review: ${id}`);
}

const sourceStatus = readJson("data/source-import-status.json");
if (sourceStatus) {
  if (sourceStatus.questionTotal !== questions.length) fail("Source ledger question total is stale.");
  if (sourceStatus.sourceTotal !== sourceStatus.sources?.length) fail("Source ledger source total is stale.");
  const statusCounts = {};
  const sourceQuestionCounts = { questions: 0, practice: 0, review: 0, reference: 0 };
  for (const source of sourceStatus.sources || []) {
    statusCounts[source.status] = (statusCounts[source.status] || 0) + 1;
    const classified = (source.practice || 0) + (source.review || 0) + (source.reference || 0);
    if ((source.questions || 0) !== classified) fail(`Source ledger classification is incomplete: ${source.path}`);
    sourceQuestionCounts.questions += source.questions || 0;
    sourceQuestionCounts.practice += source.practice || 0;
    sourceQuestionCounts.review += source.review || 0;
    sourceQuestionCounts.reference += source.reference || 0;
  }
  for (const key of new Set([...Object.keys(statusCounts), ...Object.keys(sourceStatus.statusCounts || {})])) {
    if ((statusCounts[key] || 0) !== (sourceStatus.statusCounts?.[key] || 0)) fail(`Source ledger status count is stale: ${key}`);
  }
  if (sourceQuestionCounts.questions !== questions.length) fail("Source ledger does not account for every question.");
  if (sourceQuestionCounts.practice !== counts.practice) fail("Source ledger practice total does not match question classification.");
  if (sourceQuestionCounts.review !== counts.review) fail("Source ledger review total does not match question classification.");
  if (sourceQuestionCounts.reference !== counts.reference) fail("Source ledger reference total does not match question classification.");
}

for (const shard of index.shards || []) {
  const payload = readJson(shard.path);
  if (Array.isArray(payload) && payload.length !== shard.questionCount) fail(`Shard count is stale: ${shard.path}`);
}
if ((index.categories || []).reduce((sum, item) => sum + item.questionCount, 0) !== questions.length) {
  fail("Category totals do not match the question total.");
}
if ((index.libraries || []).reduce((sum, item) => sum + item.questionCount, 0) !== questions.length) {
  fail("Library totals do not match the question total.");
}

const ocrImages = questions.filter((question) => question.questionType === "image-only" && String(question.ocrText || "").trim());
const pendingOcr = questions.filter((question) => question.questionType === "image-only" && !String(question.ocrText || "").trim());
const lowConfidenceOcr = ocrImages.filter((question) => Number(question.ocrConfidence || 0) < 0.9);
if (lowConfidenceOcr.length) fail(`${lowConfidenceOcr.length} OCR records are below the 0.90 confidence floor.`);
if (pendingOcr.length) warn(`${pendingOcr.length} image references still need OCR; they remain reference-only.`);
if (ocrImages.some((question) => question.ocrReviewed !== true)) {
  warn(`${ocrImages.filter((question) => question.ocrReviewed !== true).length} OCR records are machine-read and not marked as human-reviewed.`);
}

warnings.forEach((message) => console.warn(`WARN: ${message}`));
if (failures.length) {
  failures.forEach((message) => console.error(`ERROR: ${message}`));
  console.error(`Validation failed with ${failures.length} error(s).`);
  process.exit(1);
}

console.log(
  `Validation passed: ${questions.length} total, ${counts.practice} practice, ${counts.review} review-only, ${counts.reference} reference-only, ${ocrImages.length} OCR-searchable images.`,
);
