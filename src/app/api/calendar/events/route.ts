import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { google, type calendar_v3 } from "googleapis";
import { NextResponse } from "next/server";

function getAuthClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.calendar({ version: "v3", auth });
}

function extractConferenceLink(event: calendar_v3.Schema$Event): string | null {
  if (event.hangoutLink) return event.hangoutLink;
  if (event.conferenceData?.entryPoints) {
    const videoEntry = event.conferenceData.entryPoints.find(
      (ep) => ep.entryPointType === "video"
    );
    if (videoEntry?.uri) return videoEntry.uri;
  }
  return null;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.accessToken) {
    return NextResponse.json(
      { error: "Non connecté à Google" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const now = new Date();
  const timeMin =
    searchParams.get("timeMin") ||
    new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const timeMax =
    searchParams.get("timeMax") ||
    new Date(now.getFullYear(), now.getMonth() + 3, 0).toISOString();

  const calendar = getAuthClient(session.accessToken);

  try {
    const response = await calendar.events.list({
      calendarId: "primary",
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 500,
    });

    const events = (response.data.items || []).map((event) => ({
      id: event.id,
      summary: event.summary || "(Sans titre)",
      start: event.start?.dateTime || event.start?.date || "",
      end: event.end?.dateTime || event.end?.date || "",
      description: event.description || "",
      colorId: event.colorId || null,
      allDay: !event.start?.dateTime,
      conferenceLink: extractConferenceLink(event),
      recurringEventId: event.recurringEventId || null,
    }));

    return NextResponse.json(events);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erreur Google Calendar";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.accessToken) {
    return NextResponse.json(
      { error: "Non connecté à Google" },
      { status: 401 }
    );
  }

  const body = await request.json();
  const { summary, description, startDateTime, endDateTime, allDay, addMeet } =
    body as {
      summary: string;
      description?: string;
      startDateTime: string;
      endDateTime: string;
      allDay: boolean;
      addMeet: boolean;
    };

  const calendar = getAuthClient(session.accessToken);

  try {
    const timeZone = "Europe/Paris";

    const requestBody: calendar_v3.Schema$Event = {
      summary,
      description: description || undefined,
    };

    if (allDay) {
      requestBody.start = { date: startDateTime.split("T")[0] };
      requestBody.end = { date: endDateTime.split("T")[0] };
    } else {
      requestBody.start = { dateTime: startDateTime, timeZone };
      requestBody.end = { dateTime: endDateTime, timeZone };
    }

    if (addMeet) {
      requestBody.conferenceData = {
        createRequest: {
          requestId: `meet-${Date.now()}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      };
    }

    const response = await calendar.events.insert({
      calendarId: "primary",
      conferenceDataVersion: addMeet ? 1 : 0,
      requestBody,
    });

    return NextResponse.json(response.data);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erreur création événement";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.accessToken) {
    return NextResponse.json(
      { error: "Non connecté à Google" },
      { status: 401 }
    );
  }

  const body = await request.json();
  const {
    eventId,
    summary,
    description,
    startDateTime,
    endDateTime,
    allDay,
  } = body as {
    eventId: string;
    summary: string;
    description?: string;
    startDateTime: string;
    endDateTime: string;
    allDay: boolean;
  };

  const calendar = getAuthClient(session.accessToken);
  const timeZone = "Europe/Paris";

  try {
    const requestBody: calendar_v3.Schema$Event = {
      summary,
      description: description || "",
    };

    if (allDay) {
      requestBody.start = { date: startDateTime.split("T")[0] };
      requestBody.end = { date: endDateTime.split("T")[0] };
    } else {
      requestBody.start = { dateTime: startDateTime, timeZone };
      requestBody.end = { dateTime: endDateTime, timeZone };
    }

    const response = await calendar.events.patch({
      calendarId: "primary",
      eventId,
      requestBody,
    });

    return NextResponse.json(response.data);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erreur modification événement";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.accessToken) {
    return NextResponse.json(
      { error: "Non connecté à Google" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");

  if (!eventId) {
    return NextResponse.json(
      { error: "eventId manquant" },
      { status: 400 }
    );
  }

  const calendar = getAuthClient(session.accessToken);

  try {
    await calendar.events.delete({
      calendarId: "primary",
      eventId,
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erreur suppression événement";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
