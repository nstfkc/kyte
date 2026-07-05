import { Runtime, Wrapper, applicationDefinition } from "@kyte/react";
import { AlertTriangle } from "lucide-react";

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
      <AlertTriangle className="size-3.5 shrink-0" />
      {children}
    </div>
  );
}

/**
 * Renders a kyte ApplicationDefinition (already verified server-side by the
 * render_application tool) live inside the chat. Re-validates defensively.
 */
export function RenderedApplication({ definition }: { definition: unknown }) {
  // return <pre className="text-wrap">{JSON.stringify(definition, null, 2)}</pre>;
  const result = applicationDefinition.safeParse(definition);
  if (!result.success) {
    return <ErrorNote>The generated UI didn't match the expected format.</ErrorNote>;
  }

  return (
    <div className="kyte-render rounded-xl border bg-card p-4 text-card-foreground">
      <Runtime>
        <Wrapper definition={result.data} />
      </Runtime>
    </div>
  );
}
