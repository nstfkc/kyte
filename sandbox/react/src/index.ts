import { serve } from "bun";
import { anthropic } from "@ai-sdk/anthropic";
import {
  streamText,
  convertToModelMessages,
  type UIMessage,
} from "ai";
import index from "./index.html";

const SYSTEM_PROMPT =
  "You are a helpful, concise assistant embedded in a demo chat app. " +
  "Answer clearly and format code in fenced code blocks when relevant.";

async function chatHandler(req: Request): Promise<Response> {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: anthropic("claude-sonnet-4-5"),
    system: SYSTEM_PROMPT,
    messages: convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}

const server = serve({
  routes: {
    "/": index,
    "/api/chat": {
      POST: chatHandler,
    },
  },
  development: true,
});

console.log(`🚀 Server running at ${server.url}`);
