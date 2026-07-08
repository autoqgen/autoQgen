import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

import { connectDB } from "@/lib/db";

import Question from "@/models/Question";
import Category from "@/models/Category";
import Subject from "@/models/Subject";
import Chapter from "@/models/Chapter";
import Topic from "@/models/Topic";
import Board from "@/models/Board";
import Exam from "@/models/Exam";
import User from "@/models/User";
import { prepareQuestionPayload } from "./helpers";
import { QuestionType } from "@/types/question";

/* ======================================================
   CHECK OBJECT ID
====================================================== */

const isValidObjectId = (id: string | null | undefined) => {
  if (!id) return false;

  return mongoose.Types.ObjectId.isValid(id);
};

/* ======================================================
   CHECK REQUIRED OBJECT
====================================================== */

async function checkExists(model: any, id: string, label: string) {
  const exists = await model.findById(id);

  if (!exists) {
    throw new Error(`${label} not found.`);
  }

  return exists;
}

/* ======================================================
   DUPLICATE QUESTION CHECK
====================================================== */

async function checkDuplicateQuestion(chapter: string, questionText: string) {
  const exists = await Question.findOne({
    chapter,
    "question.text": questionText.trim(),
  });

  if (exists) {
    throw new Error("Question already exists.");
  }
}

/* ======================================================
   QUESTION TYPE VALIDATION
====================================================== */

function validateQuestionByType(type: string, options: any[], answer: any) {
  switch (type) {
    case QuestionType.MCQ:
      if (!options || options.length < 2) {
        throw new Error("MCQ requires at least 2 options.");
      }

      if (!answer.correctOptions || answer.correctOptions.length !== 1) {
        throw new Error("MCQ requires exactly one correct option.");
      }

      break;

    case QuestionType.MULTIPLE_CORRECT:
      if (!options || options.length < 2) {
        throw new Error("Multiple Correct requires options.");
      }

      if (!answer.correctOptions || answer.correctOptions.length < 2) {
        throw new Error(
          "Multiple Correct requires at least two correct answers.",
        );
      }

      break;

    case QuestionType.TRUE_FALSE:
      if (answer.booleanAnswer === null) {
        throw new Error("True/False requires booleanAnswer.");
      }

      break;

    case QuestionType.WRITTEN:
    case QuestionType.SHORT:
    case QuestionType.FILL_BLANK:
      if (!answer.text) {
        throw new Error("Answer text is required.");
      }

      break;

    default:
      break;
  }
}
export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const body = prepareQuestionPayload(await req.json());

    const {
      category,
      subject,
      chapter,
      topic = null,
      board = null,
      exam = null,

      type,
      difficulty = null,
      language = "bn",

      question,
      options = [],
      answer,
      explanation = "",

      tags = [],
      marks = 1,
      estimatedTime = 60,

      createdBy,
    } = body;

    /* =========================
       REQUIRED FIELDS CHECK
    ========================= */

    if (!category || !subject || !chapter || !type || !question || !answer) {
      return NextResponse.json(
        {
          success: false,
          message:
            "category, subject, chapter, type, question, answer required.",
        },
        { status: 400 },
      );
    }

    if (!createdBy) {
      return NextResponse.json(
        {
          success: false,
          message: "createdBy is required.",
        },
        { status: 400 },
      );
    }

    /* =========================
       OBJECT ID VALIDATION
    ========================= */

    const ids = [category, subject, chapter, topic, board, exam, createdBy];

    for (const id of ids) {
      if (id && !isValidObjectId(id)) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid ObjectId detected.",
          },
          { status: 400 },
        );
      }
    }

    /* =========================
       CHECK EXISTENCE
    ========================= */

    await checkExists(Category, category, "Category");
    await checkExists(Subject, subject, "Subject");
    await checkExists(Chapter, chapter, "Chapter");

    if (topic) await checkExists(Topic, topic, "Topic");
    if (board) await checkExists(Board, board, "Board");
    if (exam) await checkExists(Exam, exam, "Exam");
    await checkExists(User, createdBy, "User");

    /* =========================
       DUPLICATE CHECK
    ========================= */

    await checkDuplicateQuestion(chapter, question.text);

    /* =========================
       TYPE VALIDATION
    ========================= */

    validateQuestionByType(type, options, answer);

    /* =========================
       CREATE QUESTION
    ========================= */

    const newQuestion = await Question.create({
      category,
      subject,
      chapter,
      topic,
      board,
      exam,

      type,
      difficulty,
      language,

      question,
      options,
      answer,
      explanation,

      tags,
      marks,
      estimatedTime,

      createdBy,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Question created successfully.",
        data: newQuestion,
      },
      { status: 201 },
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Internal server error",
      },
      { status: 500 },
    );
  }
}
export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);

    /* =========================
       QUERY PARAMS
    ========================= */

    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");

    const skip = (page - 1) * limit;

    const category = searchParams.get("category");
    const subject = searchParams.get("subject");
    const chapter = searchParams.get("chapter");
    const topic = searchParams.get("topic");
    const board = searchParams.get("board");
    const exam = searchParams.get("exam");

    const type = searchParams.get("type");
    const difficulty = searchParams.get("difficulty");
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    /* =========================
       FILTER BUILD
    ========================= */

    const filter: any = {};

    if (category && isValidObjectId(category)) {
      filter.category = category;
    }

    if (subject && isValidObjectId(subject)) {
      filter.subject = subject;
    }

    if (chapter && isValidObjectId(chapter)) {
      filter.chapter = chapter;
    }

    if (topic && isValidObjectId(topic)) {
      filter.topic = topic;
    }

    if (board && isValidObjectId(board)) {
      filter.board = board;
    }

    if (exam && isValidObjectId(exam)) {
      filter.exam = exam;
    }

    if (type) {
      filter.type = type;
    }

    if (difficulty) {
      filter.difficulty = difficulty;
    }

    if (status) {
      filter.status = status;
    }

    filter.isActive = true;

    /* =========================
       SEARCH FILTER
    ========================= */

    if (search) {
      filter.$or = [
        { "question.text": { $regex: search, $options: "i" } },
        { tags: { $in: [new RegExp(search, "i")] } },
      ];
    }

    /* =========================
       FETCH DATA
    ========================= */

    const questions = await Question.find(filter)
      .populate("category", "name slug")
      .populate("subject", "name slug")
      .populate("chapter", "name chapterNo")
      .populate("topic", "name")
      .populate("board", "name shortName")
      .populate("exam", "name type year")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    /* =========================
       COUNT
    ========================= */

    const total = await Question.countDocuments(filter);

    return NextResponse.json({
      success: true,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      total,
      data: questions,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Internal server error",
      },
      { status: 500 },
    );
  }
}
