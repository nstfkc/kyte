import { useState, useRef, useEffect, type FormEvent } from "react";
import { useChat } from "@ai-sdk/react";
import { Send, Loader2, Bot, User, Sun, Moon, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RenderedApplication, ErrorNote } from "@/components/RenderedApplication";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/use-theme";

export function App() {
  const { messages, sendMessage, status } = useChat();
  const { theme, toggleTheme } = useTheme();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const isStreaming = status === "submitted" || status === "streaming";

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, status]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isStreaming) return;
    sendMessage({ text });
    setInput("");
  }

  return (
    <div className="mx-auto flex h-screen max-w-2xl flex-col">
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <Bot className="size-5 text-primary" />
        <h1 className="text-sm font-semibold">AI Chat · Bun + React</h1>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="ml-auto"
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? (
            <Sun className="size-4" />
          ) : (
            <Moon className="size-4" />
          )}
        </Button>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="mt-24 text-center text-sm text-muted-foreground">
            Ask me anything to get started.
          </div>
        )}

        {messages.map((message) => {
          const isUser = message.role === "user";
          const text = message.parts
            .filter((part) => part.type === "text")
            .map((part) => part.text)
            .join("");
          // Only the last render call matters — a corrected retry supersedes an
          // earlier invalid attempt.
          const lastRender = message.parts
            .filter((part) => part.type === "tool-render_application")
            .at(-1);
          const showBubble = text.length > 0 || (!isUser && !lastRender);

          return (
            <div
              key={message.id}
              className={cn(
                "flex items-start gap-3",
                isUser && "flex-row-reverse",
              )}
            >
              <div
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border",
                  isUser
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground",
                )}
              >
                {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
              </div>
              <div
                className={cn(
                  "flex max-w-[85%] flex-col gap-2",
                  isUser && "items-end",
                )}
              >
                {showBubble && (
                  <div
                    className={cn(
                      "whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm",
                      isUser
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground",
                    )}
                  >
                    {text || (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Loader2 className="size-3 animate-spin" /> thinking…
                      </span>
                    )}
                  </div>
                )}

                {lastRender &&
                  (() => {
                    // Loosely typed on the default UIMessage; the tool verifies
                    // the definition server-side and returns it as `output`.
                    const part = lastRender as {
                      state: string;
                      errorText?: string;
                      output?:
                        | { ok: true; definition: unknown }
                        | { ok: false; error: string };
                    };

                    if (part.state === "output-available" && part.output) {
                      return part.output.ok ? (
                        <RenderedApplication definition={part.output.definition} />
                      ) : (
                        <ErrorNote>{part.output.error}</ErrorNote>
                      );
                    }

                    if (part.state === "output-error") {
                      return <ErrorNote>{part.errorText ?? "Failed to generate UI."}</ErrorNote>;
                    }

                    return (
                      <div className="inline-flex items-center gap-2 rounded-xl border bg-muted px-3 py-2 text-xs text-muted-foreground">
                        <Sparkles className="size-3.5 animate-pulse" /> Generating UI…
                      </div>
                    );
                  })()}
              </div>
            </div>
          );
        })}

        {isStreaming &&
          messages[messages.length - 1]?.role === "user" && (
            <div className="flex items-start gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-muted">
                <Bot className="size-4" />
              </div>
              <div className="rounded-2xl bg-muted px-4 py-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
              </div>
            </div>
          )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 border-t p-4">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message…"
          disabled={isStreaming}
          autoFocus
        />
        <Button type="submit" size="icon" disabled={isStreaming || !input.trim()}>
          {isStreaming ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </Button>
      </form>
    </div>
  );
}
