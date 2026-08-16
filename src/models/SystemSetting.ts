import { Schema, model, models, type Document } from "mongoose";

export interface ISystemSetting extends Document {
  key: string;
  siteName: string;
  defaultLanguage: string;
  maxQuestionsPerPaper: string;
  defaultPaperQuestions: string;
  allowSelfRegistration: string;
  maintenanceMode: string;
  updatedAt: Date;
}

const SystemSettingSchema = new Schema<ISystemSetting>(
  {
    key: { type: String, required: true, unique: true, default: "global" },
    siteName: { type: String, required: true, default: "AutoQgen" },
    defaultLanguage: { type: String, required: true, default: "bn" },
    maxQuestionsPerPaper: { type: String, required: true, default: "100" },
    defaultPaperQuestions: { type: String, required: true, default: "10" },
    allowSelfRegistration: { type: String, required: true, default: "true" },
    maintenanceMode: { type: String, required: true, default: "false" },
  },
  { timestamps: true }
);

export const SystemSetting =
  models.SystemSetting || model<ISystemSetting>("SystemSetting", SystemSettingSchema);
