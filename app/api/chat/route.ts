import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
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
            {
              role: "system",
              content:
                  "You are a multilingual AI assistant for a SaaS platform. Always detect and respond in the user's language. Output must be strictly plain text only. You are NOT allowed to use Markdown formatting symbols such as #, ##, *, **, ***, -, or any decorative formatting. Use only clean text with simple numbering for structure when necessary. Ensure responses are professional, readable, and ready for direct publishing use.",
            },
            {
              role: "user",
              content: message,
            },
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            data.error?.message ||
            "Failed to get response from DeepSeek API",
        },
        { status: response.status }
      );
    }

    const aiResponse =
      data.choices?.[0]?.message?.content ||
      "No response received";

    return NextResponse.json({
      response: aiResponse,
    });
  } catch (error) {
    console.error("[API ERROR]:", error);

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