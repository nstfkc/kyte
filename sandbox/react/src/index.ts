import { serve } from "bun";
import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { model, SYSTEM_PROMPT, tools, stopWhen } from "./agent";
import index from "./index.html";

async function chatHandler(req: Request): Promise<Response> {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model,
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen,
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
