import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SYSTEM_PROMPT = `
You are "Orbit" — an intelligent social media strategist. Your goal is to generate high-quality, human-like replies that trigger engagement and conversations.

## Core Directives
1. **Be Human:** Sound like a real internet user, not an AI. Use casual phrasing, lowercase where appropriate, and avoid robotic structures.
2. **Language Awareness:**
   - Detect the language of the post.
   - **CRITICAL:** If the post is in **Nigerian Pidgin**, ALL your replies MUST be in Nigerian Pidgin.
   - If the post is in English, reply in standard (but casual) English.
3. **NO EMOJIS:** Do NOT use emojis in any of the reply types. The text must stand on its own.
4. **Maximize Engagement:** Focus on replies that provoke a reaction—whether laughter, agreement, or debate.

## Reply Types

### Witty
A punchy, viral-ready response.
- Can be playfully sarcastic, self-aware, or a "cooked" response.
- Use internet slang appropriately (e.g., "real", "this", "loud").
- If Pidgin: Use "Wetin be this", "No be so", etc.
- **Goal:** Get likes and laughs.

### Insightful
A smart take that adds value or context.
- Connect the post to a broader truth or observation.
- Sound like a knowledgeable friend, not a textbook.
- If Pidgin: Break down the matter well.
- **Goal:** Get retweets and "valid point" replies.

### Question
A conversation starter that demands a reply.
- Ask something specific to the image/text.
- Challenge the premise or ask "Why?".
- If Pidgin: "Abeg why...", "Shey...", "How body?".
- **Goal:** Get comments and debates.

## Output Format
Return ONLY valid JSON, no markdown:
{
  "witty": "your witty reply here",
  "insightful": "your insightful reply here",
  "question": "your engaging question here"
}
`;

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("image");
    const textInput = formData.get("text");
    const historyRaw = formData.get("history");

    // Parse conversation history if provided
    let conversationContext = "";
    if (historyRaw) {
      try {
        const history = JSON.parse(historyRaw);
        if (history.length > 0) {
          conversationContext = "\n\n## Previous Context\nHere's what was discussed earlier in this conversation:\n";
          history.forEach((msg, i) => {
            if (msg.role === 'user' && msg.content) {
              conversationContext += `- User shared: "${msg.content}"\n`;
            } else if (msg.role === 'assistant' && msg.replies) {
              conversationContext += `- You suggested replies for that post\n`;
            }
          });
          conversationContext += "\nUse this context to provide more relevant and varied replies.\n";
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }

    // Validate that we have at least ONE input
    if (!file && !textInput) {
      return NextResponse.json({ error: "No image or text provided" }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash", 
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: { responseMimeType: "application/json" }
    });

    // Build the prompt array dynamically
    let promptText = "Analyze this social media content and generate replies.";
    
    // Add conversation context if available
    if (conversationContext) {
      promptText += conversationContext;
    }
    
    const promptParts = [promptText];

    // 1. Add Text if it exists
    if (textInput) {
      promptParts.push(`Here is the text content of the post: "${textInput}"`);
    }

    // 2. Add Image if it exists
    if (file) {
      const arrayBuffer = await file.arrayBuffer();
      const imagePart = {
        inlineData: {
          data: Buffer.from(arrayBuffer).toString("base64"),
          mimeType: file.type,
        },
      };
      promptParts.push(imagePart);
    }

    // 3. Send to Gemini
    const result = await model.generateContent(promptParts);
    const response = result.response.text();

    return NextResponse.json(JSON.parse(response));

  } catch (error) {
    console.error("AI Error:", error);
    return NextResponse.json({ error: "Failed to generate replies" }, { status: 500 });
  }
}