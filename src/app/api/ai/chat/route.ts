import { NextRequest, NextResponse } from "next/server";
import { extractFilters } from "@/lib/ai/extractFilters";
import { searchQuestions } from "@/lib/ai/searchQuestions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ChatRequestBody {
  message?: string;
}

export async function POST(request: NextRequest) {
  try {
    console.log("========== AI Chat Request ==========");

    const body = (await request.json()) as ChatRequestBody;
    console.log("Request Body:", body);

    const message = body?.message?.trim();
    console.log("User Message:", message);

    if (!message) {
      console.error("Message is empty.");

      return NextResponse.json(
        {
          success: false,
          message: "Please enter a message.",
        },
        { status: 400 },
      );
    }

    console.log("Calling extractFilters...");

    const extraction = await extractFilters(message);

    console.log("Extract Result:");
    console.dir(extraction, { depth: null });

    if (!extraction.success || !extraction.filters) {
      console.error("Filter extraction failed:", extraction);

      return NextResponse.json(
        {
          success: false,
          message:
            extraction.error ??
            "Sorry, I couldn't understand that request. Please try rephrasing it.",
        },
        { status: 200 },
      );
    }

    console.log("Calling searchQuestions...");
    console.log("Filters:");
    console.dir(extraction.filters, { depth: null });

    const result = await searchQuestions(extraction.filters);

    console.log("Search Result:");
    console.dir(result, { depth: null });

    if (result.count === 0) {
      console.warn("No questions found.");

      return NextResponse.json({
        success: true,
        message: "No matching questions found.",
        filters: extraction.filters,
        unresolvedFilters: result.unresolvedFilters,
        count: 0,
        questions: [],
      });
    }

    console.log(`Found ${result.count} questions.`);

    return NextResponse.json({
      success: true,
      message: `Found ${result.count} matching question${
        result.count === 1 ? "" : "s"
      }.`,
      filters: extraction.filters,
      unresolvedFilters: result.unresolvedFilters,
      count: result.count,
      questions: result.questions,
    });
  } catch (error) {
    console.error("========== AI CHAT ERROR ==========");
    console.error(error);

    if (error instanceof Error) {
      console.error("Message:", error.message);
      console.error("Stack:", error.stack);
    } else {
      console.error("Unknown Error:", JSON.stringify(error, null, 2));
    }

    return NextResponse.json(
      {
        success: false,
        message:
          "Something went wrong while searching the question bank. Please try again.",
      },
      { status: 500 },
    );
  }
}
