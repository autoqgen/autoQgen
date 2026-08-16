import { connectDB } from "@/lib/db";
import { SystemSetting, type ISystemSetting } from "@/models";
import type { Model } from "mongoose";

export interface SystemSettingsPayload {
  siteName: string;
  defaultLanguage: string;
  maxQuestionsPerPaper: string;
  defaultPaperQuestions: string;
  allowSelfRegistration: string;
  maintenanceMode: string;
}

export const DEFAULT_SETTINGS: SystemSettingsPayload = {
  siteName: "AutoQgen",
  defaultLanguage: "bn",
  maxQuestionsPerPaper: "100",
  defaultPaperQuestions: "10",
  allowSelfRegistration: "true",
  maintenanceMode: "false",
};

export const settingRepository = {
  async get(): Promise<SystemSettingsPayload> {
    await connectDB();
    const doc = await (SystemSetting as unknown as Model<ISystemSetting>).findOne({ key: "global" });
    if (!doc) return DEFAULT_SETTINGS;
    return {
      siteName: doc.siteName ?? DEFAULT_SETTINGS.siteName,
      defaultLanguage: doc.defaultLanguage ?? DEFAULT_SETTINGS.defaultLanguage,
      maxQuestionsPerPaper: doc.maxQuestionsPerPaper ?? DEFAULT_SETTINGS.maxQuestionsPerPaper,
      defaultPaperQuestions: doc.defaultPaperQuestions ?? DEFAULT_SETTINGS.defaultPaperQuestions,
      allowSelfRegistration: doc.allowSelfRegistration ?? DEFAULT_SETTINGS.allowSelfRegistration,
      maintenanceMode: doc.maintenanceMode ?? DEFAULT_SETTINGS.maintenanceMode,
    };
  },

  async update(input: Partial<SystemSettingsPayload>): Promise<SystemSettingsPayload> {
    await connectDB();
    const item = await (SystemSetting as unknown as Model<ISystemSetting>).findOneAndUpdate(
      { key: "global" },
      { $set: input },
      { new: true, upsert: true }
    );

    return {
      siteName: item?.siteName ?? DEFAULT_SETTINGS.siteName,
      defaultLanguage: item?.defaultLanguage ?? DEFAULT_SETTINGS.defaultLanguage,
      maxQuestionsPerPaper: item?.maxQuestionsPerPaper ?? DEFAULT_SETTINGS.maxQuestionsPerPaper,
      defaultPaperQuestions: item?.defaultPaperQuestions ?? DEFAULT_SETTINGS.defaultPaperQuestions,
      allowSelfRegistration: item?.allowSelfRegistration ?? DEFAULT_SETTINGS.allowSelfRegistration,
      maintenanceMode: item?.maintenanceMode ?? DEFAULT_SETTINGS.maintenanceMode,
    };
  },
};
