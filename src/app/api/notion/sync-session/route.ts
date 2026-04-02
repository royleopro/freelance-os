import { NextRequest, NextResponse } from "next/server";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

interface SyncSessionBody {
  title: string;
  projet_nom: string;
  date: string;
  duree: number;
  etiquette: string;
  facturable: boolean;
}

function getEnvOrThrow(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`${key} non configuree`);
  return val;
}

async function notionFetch(path: string, options: RequestInit = {}) {
  const apiKey = getEnvOrThrow("NOTION_API_KEY");

  const res = await fetch(`${NOTION_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Notion API ${res.status}: ${text}`);
  }

  return res.json();
}

async function findProjetPageId(projetNom: string): Promise<string | null> {
  if (!projetNom) return null;

  try {
    const projetsDbId = getEnvOrThrow("NOTION_DATABASE_PROJETS_ID");
    const result = await notionFetch(`/databases/${projetsDbId}/query`, {
      method: "POST",
      body: JSON.stringify({
        filter: {
          property: "Name",
          title: { equals: projetNom },
        },
        page_size: 1,
      }),
    });

    if (result.results?.length > 0) {
      return result.results[0].id;
    }

    // Retry with case-insensitive contains
    const result2 = await notionFetch(`/databases/${projetsDbId}/query`, {
      method: "POST",
      body: JSON.stringify({
        filter: {
          property: "Name",
          title: { contains: projetNom },
        },
        page_size: 1,
      }),
    });

    return result2.results?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SyncSessionBody;
    const { title, projet_nom, date, duree, etiquette, facturable } = body;

    // Lookup project in Notion
    const projetPageId = await findProjetPageId(projet_nom);

    // Build properties
    const properties: Record<string, unknown> = {
      Title: {
        title: [{ text: { content: title } }],
      },
      "Time (decimal hour)": {
        number: duree,
      },
      Date: {
        date: { start: date },
      },
      Facturable: {
        checkbox: facturable,
      },
      Étiquettes: {
        multi_select: [{ name: etiquette }],
      },
    };

    if (projetPageId) {
      properties["PROJETS"] = {
        relation: [{ id: projetPageId }],
      };
    }

    const heuresDbId = getEnvOrThrow("NOTION_DATABASE_HEURES_ID");
    await notionFetch("/pages", {
      method: "POST",
      body: JSON.stringify({
        parent: { database_id: heuresDbId },
        properties,
      }),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("[notion/sync-session]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
