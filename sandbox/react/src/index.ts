import { serve } from "bun";
import { azure } from "@ai-sdk/azure";
import { streamText, convertToModelMessages, type UIMessage } from "ai";
import index from "./index.html";

const SYSTEM_PROMPT =
  "You are a helpful, concise assistant embedded in a demo chat app. " +
  "Answer clearly and format code in fenced code blocks when relevant.";

async function chatHandler(req: Request): Promise<Response> {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: azure("gpt-5.4"),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
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
