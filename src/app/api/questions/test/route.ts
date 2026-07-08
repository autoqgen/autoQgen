import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/db";

// Register all models for populate
import "@/models/Category";
import "@/models/Subject";
import "@/models/Chapter";
import "@/models/Topic";
import "@/models/Board";
import "@/models/Exam";

import Question from "@/models/Question";

export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);

    const category = searchParams.get("category");
    const subject = searchParams.get("subject");
    const chapter = searchParams.get("chapter");
    const type = searchParams.get("type");

    const filter: any = {
      isActive: true,
    };

    if (category) filter.category = category;
    if (subject) filter.subject = subject;
    if (chapter) filter.chapter = chapter;
    if (type) filter.type = type;

    const questions = await Question.find(filter)
      .populate("category", "name slug")
      .populate("subject", "name slug")
      .populate("chapter", "name chapterNo")
      .populate("topic", "name")
      .populate("board", "name shortName")
      .populate("exam", "name year")
      .select(
        "question options answer type difficulty marks category subject chapter topic board exam",
      )
      .lean();

    return NextResponse.json({
      success: true,
      total: questions.length,
      data: questions,
    });
  } catch (error: any) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: error.message,
      },
      {
        status: 500,
      },
    );
  }
}
