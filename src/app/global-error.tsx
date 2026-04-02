"use client";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="fr">
      <body>
        <div style={{ padding: "2rem", textAlign: "center" }}>
          <h2>Une erreur est survenue</h2>
          <button onClick={() => unstable_retry()}>Reessayer</button>
        </div>
      </body>
    </html>
  );
}
