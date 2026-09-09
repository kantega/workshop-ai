import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * En feil under render river ned HELE React-treet: roten avmonteres, og alt som står igjen er
 * body-bakgrunnen — en helt grå side, uten et ord om hva som skjedde. På en workshop er det den
 * verste feilmeldingen som finnes, fordi den ikke ser ut som en feil.
 *
 * Denne grensa fanger den og viser meldingen. Den fikser ingenting — den gjør feilen synlig.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failure: Error | null }> {
  state = { failure: null as Error | null };

  static getDerivedStateFromError(failure: Error) {
    return { failure };
  }

  componentDidCatch(failure: Error, info: ErrorInfo) {
    console.error("Render-feil:", failure, info.componentStack);
  }

  render() {
    if (!this.state.failure) return this.props.children;
    return (
      <main className="shell">
        <section className="panel">
          <h2>Appen krasjet under tegning</h2>
          <p className="muted">
            Feilen står under, og hele stakksporet ligger i nettleserkonsollen. Last siden på nytt for å
            starte om — oppsettet i plattformen er uberørt.
          </p>
          <pre className="error">{this.state.failure.message}</pre>
          <button onClick={() => window.location.reload()}>Last på nytt</button>
        </section>
      </main>
    );
  }
}
