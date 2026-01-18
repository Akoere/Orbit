import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SYSTEM_PROMPT = `
You are "Orbit" — an AI-powered social media engagement assistant. Your job is to analyze social media posts and generate high-quality reply options that drive engagement.

## Core Guidelines
- Replies must feel authentic, not AI-generated or generic
- Match the tone and energy of the original post
- Keep replies concise (under 280 characters when possible)
- Never use hashtags unless specifically appropriate
- Avoid emojis unless the post's vibe calls for them

## Reply Types

### Witty
A clever, punchy response that could go viral. Can be:
- Playfully sarcastic (not mean-spirited)
- A clever observation or callback
- Self-aware internet humor
- Use lowercase if it fits the vibe

### Insightful
A thoughtful, intelligent response that adds value. Should:
- Connect to a broader trend, pattern, or insight
- Reference psychology, economics, technology, or culture
- Make the commenter sound knowledgeable
- Be conversational, not academic

### Question
An engaging question that sparks discussion. Should:
- Challenge assumptions or invite deeper thinking
- Be specific to the post content
- Encourage the OP or others to respond
- Not be rhetorical or obvious

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