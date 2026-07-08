import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Category from "@/models/Category";
import Subject from "@/models/Subject";
import Chapter from "@/models/Chapter";
import Topic from "@/models/Topic";
import Board from "@/models/Board";
import Exam from "@/models/Exam";
import User from "@/models/User";
import Question from "@/models/Question";
import { prepareQuestionPayload } from "../helpers";
const isValidObjectId = (id: string | null | undefined) => {
  if (!id) return false;

  return mongoose.Types.ObjectId.isValid(id);
};

async function checkExists(model: any, id: string, label: string) {
  const exists = await model.findById(id);

  if (!exists) {
    throw new Error(`${label} not found.`);
  }

  return exists;
}
/* =====================================================
   DUPLICATE QUESTION CHECK
===================================================== */

async function checkDuplicateQuestion(chapter: string, questionText: string) {
  const exists = await Question.findOne({
    chapter,
    "question.text": questionText.trim(),
  });

  if (exists) {
    throw new Error("Question already exists.");
  }
}
/* =====================================================
   QUESTION TYPE VALIDATION
===================================================== */

function validateQuestionByType(type: string, options: any[], answer: any) {
  switch (type) {
    case "MCQ":
      if (!options || options.length < 2) {
        throw new Error("MCQ requires at least 2 options.");
      }

      if (!answer.correctOptions || answer.correctOptions.length !== 1) {
        throw new Error("MCQ requires exactly one correct option.");
      }

      break;

    case "MULTIPLE_CORRECT":
      if (!options || options.length < 2) {
        throw new Error("Multiple Correct requires options.");
      }

      if (!answer.correctOptions || answer.correctOptions.length < 2) {
        throw new Error(
          "Multiple Correct requires at least two correct answers.",
        );
      }

      break;

    case "TRUE_FALSE":
      if (answer.booleanAnswer === null) {
        throw new Error("True/False requires booleanAnswer.");
      }

      break;

    case "WRITTEN":
    case "SHORT":
    case "FILL_BLANK":
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

    const body = await req.json();

    const { questions } = body;

    /* =====================================================
       BODY VALIDATION
    ===================================================== */

    if (!Array.isArray(questions)) {
      return NextResponse.json(
        {
          success: false,
          message: "questions must be an array.",
        },
        { status: 400 },
      );
    }

    if (questions.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Question array cannot be empty.",
        },
        { status: 400 },
      );
    }

    /* =====================================================
       VALIDATE ALL QUESTIONS
    ===================================================== */
    const validQuestions: any[] = [];
    const errors: any[] = [];
    const seenQuestions = new Set<string>();

    for (let index = 0; index < questions.length; index++) {
      try {
        const item = prepareQuestionPayload(questions[index]);
        const key = `${item.chapter}_${item.question.text.trim().toLowerCase()}`;

        if (seenQuestions.has(key)) {
          throw new Error("Duplicate question found in bulk request.");
        }

        seenQuestions.add(key);
        // Required fields
        if (
          !item.category ||
          !item.subject ||
          !item.chapter ||
          !item.type ||
          !item.question ||
          !item.answer ||
          !item.createdBy
        ) {
          throw new Error("Required fields are missing.");
        }

        // ObjectId validation
        const ids = [
          item.category,
          item.subject,
          item.chapter,
          item.topic,
          item.board,
          item.exam,
          item.createdBy,
        ];

        for (const id of ids) {
          if (id && !isValidObjectId(id)) {
            throw new Error("Invalid ObjectId detected.");
          }
        }

        // Relation validation
        await checkExists(Category, item.category, "Category");
        await checkExists(Subject, item.subject, "Subject");
        await checkExists(Chapter, item.chapter, "Chapter");

        if (item.topic) {
          await checkExists(Topic, item.topic, "Topic");
        }

        if (item.board) {
          await checkExists(Board, item.board, "Board");
        }

        if (item.exam) {
          await checkExists(Exam, item.exam, "Exam");
        }

        await checkExists(User, item.createdBy, "User");

        // Duplicate check
        await checkDuplicateQuestion(item.chapter, item.question.text);

        // Question type validation
        validateQuestionByType(item.type, item.options, item.answer);

        validQuestions.push(item);
      } catch (error: any) {
        errors.push({
          index,
          question: questions[index]?.question?.text || "",
          message: error.message,
        });
      }
    }

    /* =====================================================
   INSERT VALID QUESTIONS
===================================================== */

    if (validQuestions.length > 0) {
      await Question.insertMany(validQuestions, {
        ordered: false,
      });
    }

    /* =====================================================
   RESPONSE
===================================================== */

    return NextResponse.json({
      success: true,
      message: `${validQuestions.length} questions imported successfully.`,
      total: questions.length,
      inserted: validQuestions.length,
      failed: errors.length,
      errors,
    });
  } catch (error: any) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: error.message || "Internal Server Error",
      },
      { status: 500 },
    );
  }
}
