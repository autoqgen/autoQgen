/**
 * Barrel import.
 *
 * Importing this module guarantees every schema is registered with Mongoose
 * before any `populate()` runs, which avoids the MissingSchemaError class of
 * bug that the previous project hit with its non-existent Organization model.
 */
export { User, type IUser } from "@/models/User";
export { Organization, type IOrganization } from "@/models/Organization";
export { PasswordResetToken, type IPasswordResetToken } from "@/models/PasswordResetToken";
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
  type IPaperVersionEntry,
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
export { SystemSetting, type ISystemSetting } from "@/models/SystemSetting";
