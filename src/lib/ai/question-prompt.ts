import type { AiQuestionType, Difficulty } from "@/types/question";

/**
 * Builds the Gemini prompt for question generation.
 *
 * Pure and deterministic so it can be unit-tested and reviewed without a
 * network call. Taxonomy is passed by NAME only — the application owns the ids
 * and the AI never sees or invents them.
 */

export interface QuestionPromptContext {
  categoryName: string;
  subjectName: string;
  chapterName: string;
  topicName: string | null;
  type: AiQuestionType;
  difficulty: Difficulty | null;
  /** "any" | "bn" | "en" */
  language: "any" | "bn" | "en";
  count: number;
  instruction: string;
}

const TYPE_RULES: Record<AiQuestionType, string> = {
  MCQ: 'Exactly 4 entries in "options". "answer" is an array with exactly ONE string that is copied verbatim from "options".',
  MULTIPLE_CORRECT:
    'Exactly 4 entries in "options". "answer" is an array with TWO to THREE strings, each copied verbatim from "options".',
  TRUE_FALSE:
    '"options" must be exactly ["True", "False"]. "answer" is either ["True"] or ["False"].',
  SHORT:
    '"options" must be an empty array. "answer" is an array with one concise string answer (a few words to one sentence).',
  WRITTEN:
    '"options" must be an empty array. "answer" is an array with one string containing a model answer of 2-5 sentences.',
  FILL_BLANK:
    'The question text must contain a blank written as "_____". "options" must be an empty array. "answer" is an array with one string: the exact word or phrase that fills the blank.',
};

const LANGUAGE_RULES: Record<QuestionPromptContext["language"], string> = {
  any: "Write every question in whichever of Bangla or English best fits the subject; be consistent within each question.",
  bn: "Write every question, every option and every answer in Bangla (বাংলা). Do not use English except for standard technical symbols or units.",
  en: "Write every question, every option and every answer in English.",
};

const DIFFICULTY_RULES: Record<Difficulty, string> = {
  EASY: "Difficulty: EASY — direct recall or a single-step application.",
  MEDIUM: "Difficulty: MEDIUM — requires understanding and a short chain of reasoning.",
  HARD: "Difficulty: HARD — multi-step reasoning or a non-obvious application of the concept.",
  EXPERT: "Difficulty: EXPERT — deep synthesis across ideas in the chapter.",
};

export const QUESTION_SYSTEM_PROMPT = [
  "You are an exam-question author for a school and college question bank.",
  "You produce academically accurate, curriculum-appropriate questions.",
  "You return ONLY a single JSON object. No prose, no markdown, no code fences.",
].join(" ");

export function buildQuestionPrompt(context: QuestionPromptContext): string {
  const scope = [
    `Category: ${context.categoryName}`,
    `Subject: ${context.subjectName}`,
    `Chapter: ${context.chapterName}`,
    context.topicName ? `Topic: ${context.topicName}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const difficultyLine = context.difficulty
    ? DIFFICULTY_RULES[context.difficulty]
    : "Difficulty: mix EASY and MEDIUM sensibly.";

  const difficultyField = context.difficulty
    ? `"difficulty" must be "${context.difficulty}".`
    : '"difficulty" must be one of "EASY", "MEDIUM", "HARD", "EXPERT".';

  const instructionBlock = context.instruction.trim()
    ? `\nAdditional instruction from the user (follow it unless it conflicts with the rules above):\n${context.instruction.trim()}\n`
    : "";

  return [
    `Generate exactly ${context.count} ${context.type} questions.`,
    "",
    "Stay strictly within this scope — do not drift to other chapters or subjects:",
    scope,
    "",
    LANGUAGE_RULES[context.language],
    difficultyLine,
    "",
    "Output shape — a JSON object with a single key \"questions\", an array of objects:",
    "{",
    '  "text": string,            // the question stem',
    `  "type": "${context.type}",  // exactly this value for every item`,
    '  "options": string[],       // see type rule below',
    '  "answer": string[],        // see type rule below',
    '  "difficulty": string,      // see rule below',
    '  "marks": number,           // 1 for MCQ/TRUE_FALSE/FILL_BLANK/SHORT, 2-5 for WRITTEN/MULTIPLE_CORRECT',
    '  "explanation": string      // 1-2 sentences on why the answer is correct',
    "}",
    "",
    `Type rule for ${context.type}: ${TYPE_RULES[context.type]}`,
    difficultyField,
    "",
    "Hard requirements:",
    `- Produce exactly ${context.count} items, all of type ${context.type}.`,
    "- Every question must be a real, meaningful academic question with a definite correct answer.",
    "- Do NOT output placeholder text such as \"Option A\", \"Option B\", \"practice question 1\", \"Sample\", or lorem ipsum.",
    "- Options within one question must be distinct and plausible; wrong options must be believable distractors.",
    "- No duplicate or near-duplicate questions in the set.",
    "- Return valid JSON only. No markdown, no commentary, no trailing text.",
    instructionBlock,
  ].join("\n");
}

export function buildCreativeQuestionPrompt(
  context: Omit<QuestionPromptContext, "type" | "count"> & { retryFeedback?: string[] },
): string {
  const scope = [
    `Category: ${context.categoryName}`,
    `Subject: ${context.subjectName}`,
    `Chapter: ${context.chapterName}`,
    context.topicName ? `Topic: ${context.topicName}` : null,
  ].filter(Boolean).join("\n");
  const language = LANGUAGE_RULES[context.language];
  const difficulty = context.difficulty
    ? DIFFICULTY_RULES[context.difficulty]
    : "Use a sensible mix of difficulty levels.";
  const instruction = context.instruction.trim()
    ? `Additional instruction:\n${context.instruction.trim()}`
    : "";
  const retryFeedback = context.retryFeedback?.length
    ? `A previous CQ attempt failed its quality review. Correct every issue before returning a new CQ:\n${context.retryFeedback.map((issue) => `- ${issue}`).join("\n")}`
    : "";
  return [
    "Act as an experienced Bangladeshi secondary-school teacher and examination-board CQ author. Generate exactly one original, academically correct, complete Bangladeshi-style Creative Question (সৃজনশীল প্রশ্ন).",
    scope,
    language,
    difficulty,
    "First invent a concrete, informative stimulus: a plausible everyday event, short story, experiment, observation, data set, or problem scenario. Use specific people/things/actions/observations and enough evidence to reason from. Do not use a generic textbook paragraph, a bare definition, or a scenario unrelated to the selected chapter/topic. Prefer a simple, focused, familiar curriculum scenario over unnecessary numbers or several unrelated events. Prefer qualitative evidence unless a calculation is essential; never invent exact scientific constants, measurements, or real-world thresholds. For experiments, describe a physically plausible setup, keep other conditions controlled, and explain how any quantitative outcome was measured.",
    "The stimulus is the center of the entire CQ. Build all four parts from details, observations, or a problem in that exact stimulus. Keep the same people, objects, quantities and situation throughout. Each part must explicitly refer to or unmistakably rely on that context; reject generic questions that would fit any chapter. Even the knowledge item should identify a concept shown in the scenario, not introduce a disconnected fact.",
    "Create a connected progression, not four independent questions:",
    "ক (জ্ঞানমূলক, exactly 1 mark): ask for a concise definition, fact, concept or identification needed to understand the stimulus. Keep the question tied to a named element or event in the stimulus.",
    "খ (অনুধাবনমূলক, exactly 2 marks): ask why/how a specific observation in the stimulus happens; answer with the concept/reason and a brief explanation.",
    "গ (প্রয়োগমূলক, exactly 3 marks): apply the concept from ক/খ to explain a specific event/problem in the stimulus; require reasoning or a process, not recall alone.",
    "ঘ (উচ্চতর দক্ষতা/বিশ্লেষণমূলক, exactly 4 marks): extend/change/compare/evaluate the stimulus situation; reason through cause and effect, predict an outcome, or reach a justified conclusion using evidence from the stimulus and the same concept chain.",
    "Parts খ, গ, ঘ must build on the concept introduced by ক, with increasing reasoning demand. Avoid repeated wording, duplicate answers, four definitions, or unrelated prompts. A student should recognize one coherent chain: stimulus → concept → explanation → application → analysis.",
    "Question types may be MCQ, MULTIPLE_CORRECT, TRUE_FALSE, SHORT, WRITTEN, or FILL_BLANK. Choose the type that genuinely assesses that part's cognitive level. Prefer SHORT/WRITTEN for explanatory গ/ঘ; use objective types there only when they truly require application/analysis rather than guessing or recall.",
    "Answer every part correctly and at a depth proportional to marks: ক one precise direct answer; খ concept plus a brief reason; গ explain the relevant process/cause and apply it to the scenario; ঘ give a reasoned analysis with cause/effect and a conclusion or likely outcome. Do not give one-word answers to explanatory prompts. Match the answer to exactly what its question asks (do not answer with a related but different definition/process/outcome). Ensure answers are self-contained and consistent with the stimulus and curriculum.",
    "Scientific and mathematical accuracy is mandatory. Check every claim, unit, value, calculation, and predicted result in the stimulus, question, and answer. Do not invent precise constants or measurements unless they are reliable and necessary; when using given data, preserve its measurement basis and units (for example, grams per 100 mL is not automatically grams per 100 g). Any experiment that reports measured quantities must describe a plausible way to measure them. Do not claim approximate values are exactly equal. Distinguish a process/rate from an equilibrium property: faster dissolving does not automatically mean greater solubility. Solubility trends are substance-specific; do not claim every solid becomes more soluble at higher temperature, or explain an equilibrium-solubility change solely by faster molecular motion/collisions. In experiments, vary one factor at a time; if multiple factors change, do not claim which one caused an observation. Avoid predictions requiring unstated conditions or unsupported specialized assumptions.",
    "Before returning, internally audit: stimulus is specific and useful; every part depends on its context; the concept chain and cognitive levels are correct; the four questions are distinct and progressive; facts and answers are accurate; answer depth matches marks; no generic or context-free item remains. If any check fails, rewrite the CQ before responding.",
    "Return one JSON object with exactly one stimulus and exactly four ordered part objects in this shape:",
    '{"stimulus":"...","parts":[{"label":"ক","cognitiveLevel":"knowledge","marks":1,"type":"WRITTEN","text":"...","options":[],"answer":["complete answer"],"difficulty":"MEDIUM","explanation":"..."},{"label":"খ","cognitiveLevel":"understanding","marks":2,"type":"WRITTEN","text":"...","options":[],"answer":["complete answer"],"difficulty":"MEDIUM","explanation":"..."},{"label":"গ","cognitiveLevel":"application","marks":3,"type":"WRITTEN","text":"...","options":[],"answer":["complete explanatory answer"],"difficulty":"MEDIUM","explanation":"..."},{"label":"ঘ","cognitiveLevel":"higher_order","marks":4,"type":"WRITTEN","text":"...","options":[],"answer":["complete analytical answer"],"difficulty":"MEDIUM","explanation":"..."}]}',
    'Valid type-specific shape: MCQ has exactly four distinct option strings and answer has exactly one exact option string; MULTIPLE_CORRECT has four options and two or three exact correct option strings; TRUE_FALSE has answer ["True"] or ["False"]; SHORT/WRITTEN have a substantial answer string; FILL_BLANK has "_____" in text and the exact missing term as answer.',
    "Use Bengali labels exactly ক, খ, গ, ঘ, cognitiveLevel exactly knowledge, understanding, application, higher_order, and marks exactly 1, 2, 3, 4 in that order. Set type per part; never flatten the CQ into a single question.",
    retryFeedback,
    instruction,
    "Return valid JSON only, without markdown or surrounding prose.",
  ].filter(Boolean).join("\n\n");
}

export function buildCreativeQuestionReviewPrompt(input: {
  categoryName: string;
  subjectName: string;
  chapterName: string;
  topicName: string | null;
  stimulus: string;
  parts: {
    label: string;
    cognitiveLevel: string;
    marks: number;
    type: string;
    text: string;
    options: string[];
    answer: string[];
  }[];
}): string {
  return [
    "You are a strict independent reviewer of a newly generated Bangladeshi school Creative Question (CQ). Do not rewrite or assume quality; audit the supplied content as an examiner.",
    `Curriculum scope: ${input.categoryName} / ${input.subjectName} / ${input.chapterName}${input.topicName ? ` / ${input.topicName}` : ""}.`,
    "Be skeptical and fail closed: pass only facts and conclusions that are supported by the supplied scenario or reliable standard curriculum knowledge. If uncertain whether a scientific claim, scenario, or prediction is correct, mark it as an issue instead of guessing. Check factual correctness in every stimulus detail, question, and answer, including units, numerical calculations, cause/effect and experimental design. Independently recompute numerical work step by step and verify each value uses the correct measurement basis and units; do not treat approximate numbers as equal when the difference changes the conclusion. If observations only bound an unknown threshold (for example, no motion at 5 N but motion at 7 N), report only that it lies in the interval; never invent a midpoint or exact minimum. A stated equal push does not prove equal starting speed or energy unless the stimulus supplies the necessary duration/impulse conditions. Do not infer material properties such as friction coefficients solely from a material name unless the scenario provides evidence. For solubility, verify the specific solute's equilibrium behavior and distinguish it from dissolving rate; higher temperature does not universally increase every solid's solubility, and faster molecular motion/collisions alone do not explain a change in equilibrium solubility. Confirm the scenario is physically plausible and that each reported measurement could actually be obtained with the described setup; a numeric observation without a plausible measurement method is unsupported. An experiment should control other variables or the CQ must not attribute an effect to only one of several changing variables. Flag invented precise constants, unsupported thresholds, unstated initial conditions, speculative mechanisms, and predictions that depend on conditions the stimulus does not provide. Distinguish a process/rate from an equilibrium property (such as dissolving rate vs solubility). Check that each answer directly answers its exact question, not just a related concept. Check relevance to curriculum scope, whether the stimulus is a specific meaningful scenario with enough information to ask these questions, and whether every question is directly anchored in or requires reasoning about that exact stimulus (not merely the same chapter).",
    "Check progression: ক asks stimulus-related basic knowledge/identification (1 mark); খ explains a stimulus observation/why/how (2); গ applies the established concept to a specific stimulus event (3); ঘ extends or changes the same situation and requires justified analysis/prediction/evaluation (4). Check that each builds logically on prior parts, is distinct, and that answer correctness and explanatory depth match the marks.",
    "Do not fail ক merely because the definition is generally known if it explicitly identifies a concept used in this stimulus. Do fail generic/context-free parts, unrelated chapter questions, mismatched levels, repetition, unsupported conclusions, scientifically inaccurate data/reasoning, answers that do not answer their corresponding questions, or underdeveloped 3/4-mark explanatory answers.",
    "CQ to audit:",
    JSON.stringify({ stimulus: input.stimulus, parts: input.parts }),
    'Return JSON only: {"pass":boolean,"issues":["specific actionable issue"],"partIssues":[[],[],[],[]]}. pass may be true only if ALL checks pass. issues must be an empty array on pass. partIssues must always have exactly four arrays in ক/খ/গ/ঘ order.',
  ].join("\n\n");
}
