"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class FormiaErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Formia renderer error", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
        <section className="w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-sm" role="alert">
          <h1 className="text-base font-medium">Formia needs to restart this view</h1>
          <p className="mt-2 text-sm text-muted-foreground">An unexpected interface error occurred. Your project files were not changed.</p>
          <button
            type="button"
            className="mt-5 rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            onClick={() => window.location.reload()}
          >
            Reload Formia
          </button>
        </section>
      </main>
    );
  }
}
