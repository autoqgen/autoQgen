/**
 * Barrel import.
 *
 * Importing this module guarantees every schema is registered with Mongoose
 * before any `populate()` runs, which avoids the MissingSchemaError class of
 * bug that the previous project hit with its non-existent Organization model.
 */
export { User, type IUser } from "@/models/User";
export { Organization, type IOrganization } from "@/models/Organization";
export { OrganizationMember, type IOrganizationMember } from "@/models/OrganizationMember";
export { OrganizationInvitation, type IOrganizationInvitation } from "@/models/OrganizationInvitation";
export { Team, type ITeam } from "@/models/Team";
export { PasswordResetToken, type IPasswordResetToken } from "@/models/PasswordResetToken";
export {
  EmailVerificationToken,
  type IEmailVerificationToken,
} from "@/models/EmailVerificationToken";
export { Category, type ICategory } from "@/models/Category";
export { Subject, type ISubject } from "@/models/Subject";
export { Chapter, type IChapter } from "@/models/Chapter";
export { Topic, type ITopic } from "@/models/Topic";
export { Board, type IBoard } from "@/models/Board";
export { Exam, type IExam, EXAM_TYPES, type ExamType } from "@/models/Exam";
export {
  QuestionPaper,
  type IQuestionPaper,
  type IPaperSection,
  type IPaperQuestion,
  type IGenerationSpec,
  type IChapterQuota,
} from "@/models/QuestionPaper";
export { AuditLog, type IAuditLog, AUDIT_ACTIONS, type AuditAction } from "@/models/AuditLog";
export {
  Question,
  type IQuestion,
  type IQuestionAnswer,
  type IQuestionContent,
  type IQuestionOption,
  type IMatchingPair,
} from "@/models/Question";
export { CreativeQuestion, type ICreativeQuestion, type ICreativeQuestionPart } from "@/models/CreativeQuestion";
export { SystemSetting, type ISystemSetting } from "@/models/SystemSetting";
export { QuestionUsage, type IQuestionUsage, PAPER_TYPES, type PaperType } from "@/models/QuestionUsage";
export {
  QuestionPatternTemplate,
  type IQuestionPatternTemplate,
} from "@/models/QuestionPatternTemplate";
export { QuestionEmbedding, type IQuestionEmbedding } from "@/models/QuestionEmbedding";
export {
  PaperSimilarityReview,
  type IPaperSimilarityReview,
  type IResolvedSimilarityPair,
  SIMILARITY_PAIR_DECISIONS,
  type SimilarityPairDecision,
} from "@/models/PaperSimilarityReview";
