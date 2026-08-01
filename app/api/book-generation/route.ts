import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { prompt, chapters, niches } = await request.json();

    if (!prompt || !chapters || !niches) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    // Read from the environment only — a hardcoded fallback would ship the key
    // inside the repo. Set DEEPSEEK_API_KEY in .env.local.
    const apiKey = process.env.DEEPSEEK_API_KEY?.trim();

    if (!apiKey) {
      return NextResponse.json(
        { error: "DEEPSEEK_API_KEY is not set. Add it to .env.local and restart." },
        { status: 500 }
      );
    }

    const bookPrompt = `Create a detailed outline and first chapter for a book with the following specifications:

Title Concept: ${prompt}
Number of Chapters: ${chapters}
Niches/Genres: ${niches}

Please provide:
1. Book title suggestion
2. Brief description (2-3 sentences)
3. Chapter outline for all ${chapters} chapters
4. Full text of Chapter 1 (approximately 500-1000 words)

Format the response clearly with headers and sections.`;

    const response = await fetch(
      "https://api.deepseek.com/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            // ✅ SYSTEM ROLE ADDED (IMPORTANT FIX)
            {
              role: "system",
              content:
                 "You are a professional Amazon KDP book generator. Your output must be structured using ONLY plain text. Use numbered headings like: 1. Title, 2. Description, 3. Chapter Outline, 4. Chapter 1. Do NOT use Markdown (#, **, *, or ---). Do not add emojis. Ensure formatting is clean and publication-ready.",
            },
            {
              role: "user",
              content: bookPrompt,
            },
          ],
          temperature: 0.8,
          max_tokens: 4000,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            data.error?.message ||
            "Failed to generate book",
        },
        { status: response.status }
      );
    }

    const bookContent =
      data.choices?.[0]?.message?.content ||
      "No content generated";

    return NextResponse.json({
      content: bookContent,
    });
  } catch (error) {
    console.error("[BOOK API ERROR]:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Internal server error",
      },
      { status: 500 }
    );
  }
}