/**
 * Sync a session to Notion in the background.
 * Never throws — logs errors silently.
 */
export function syncSessionToNotion(session: {
  title: string;
  projet_nom: string;
  date: string;
  duree: number;
  etiquette: string;
  facturable: boolean;
}) {
  fetch("/api/notion/sync-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(session),
  }).catch((err) => {
    console.warn("[syncSessionToNotion] failed:", err);
  });
}
