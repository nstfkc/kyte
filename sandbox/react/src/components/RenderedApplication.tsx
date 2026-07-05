import { Component, type ReactNode } from "react";
import { Runtime, Wrapper, applicationDefinition } from "@kyte/react";
import { AlertTriangle } from "lucide-react";
import { catalog } from "@/catalog";

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
      <AlertTriangle className="size-3.5 shrink-0" />
      {children}
    </div>
  );
}

// Catches render-time errors (e.g. a catalog component used incorrectly) so a
// bad generated UI shows an error instead of crashing the chat.
class RenderErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return <ErrorNote>Failed to render: {this.state.error.message}</ErrorNote>;
    }
    return this.props.children;
  }
}

/**
 * Renders a kyte ApplicationDefinition (already verified server-side by the
 * render_application tool) live inside the chat. Re-validates defensively.
 */
export function RenderedApplication({ definition }: { definition: unknown }) {
  const result = applicationDefinition.safeParse(definition);
  if (!result.success) {
    return <ErrorNote>The generated UI didn't match the expected format.</ErrorNote>;
  }

  return (
    <div className="kyte-render rounded-xl border bg-card p-4 text-card-foreground">
      <RenderErrorBoundary key={JSON.stringify(definition)}>
        <Runtime catalog={catalog}>
          <Wrapper definition={result.data} />
        </Runtime>
      </RenderErrorBoundary>
    </div>
  );
}
