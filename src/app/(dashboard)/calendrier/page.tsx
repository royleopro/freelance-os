"use client";

import { useEffect, useState, useCallback } from "react";
import { signIn, useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Repeat,
  Trash2,
  Video,
  X,
} from "lucide-react";

interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  description: string;
  colorId: string | null;
  allDay: boolean;
  conferenceLink: string | null;
  recurringEventId: string | null;
}

interface CreateEventForm {
  date: string;
  startTime: string;
  endTime: string;
}

type ViewMode = "month" | "week";

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const HOURS = Array.from({ length: 15 }, (_, i) => i + 8);

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(start: string, end: string) {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours === 0) return `${minutes}min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h${minutes.toString().padStart(2, "0")}`;
}

function isSameDay(d1: Date, d2: Date) {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function isToday(date: Date) {
  return isSameDay(date, new Date());
}

function getMonday(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function toDateInputValue(d: Date) {
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
}

function toTimeInputValue(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

function getTzOffset() {
  const offsetMin = new Date().getTimezoneOffset();
  const sign = offsetMin <= 0 ? "+" : "-";
  const absH = Math.floor(Math.abs(offsetMin) / 60)
    .toString()
    .padStart(2, "0");
  const absM = (Math.abs(offsetMin) % 60).toString().padStart(2, "0");
  return `${sign}${absH}:${absM}`;
}

function getMonthGrid(year: number, month: number): Date[][] {
  const firstDay = new Date(year, month, 1);
  const monday = getMonday(firstDay);
  const weeks: Date[][] = [];

  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + w * 7 + d);
      week.push(date);
    }
    weeks.push(week);
  }

  const lastWeek = weeks[5];
  if (lastWeek[0].getMonth() !== month) {
    weeks.pop();
  }

  return weeks;
}

function getWeekDays(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function eventsForDay(events: CalendarEvent[], date: Date) {
  return events.filter((e) => {
    const start = new Date(e.start);
    if (e.allDay) {
      const end = new Date(e.end);
      return date >= new Date(start.toDateString()) && date < end;
    }
    return isSameDay(start, date);
  });
}

// ─── Event Modal (create / edit) ────────────────────────
function EventModal({
  event,
  initial,
  onClose,
  onSaved,
  onDeleted,
}: {
  event?: CalendarEvent;
  initial?: CreateEventForm;
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: (eventId: string) => void;
}) {
  const isEdit = !!event;

  const [summary, setSummary] = useState(event?.summary || "");
  const [date, setDate] = useState(() => {
    if (event) return toDateInputValue(new Date(event.start));
    return initial?.date || toDateInputValue(new Date());
  });
  const [startTime, setStartTime] = useState(() => {
    if (event && !event.allDay) return toTimeInputValue(event.start);
    return initial?.startTime || "09:00";
  });
  const [endTime, setEndTime] = useState(() => {
    if (event && !event.allDay) return toTimeInputValue(event.end);
    return initial?.endTime || "10:00";
  });
  const [allDay, setAllDay] = useState(event?.allDay || false);
  const [description, setDescription] = useState(event?.description || "");
  const [addMeet, setAddMeet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSave() {
    if (!summary.trim()) return;
    setSaving(true);

    const tz = getTzOffset();
    const startDateTime = allDay
      ? `${date}T00:00:00`
      : `${date}T${startTime}:00${tz}`;
    const endDate = allDay
      ? new Date(new Date(date).getTime() + 86400000)
          .toISOString()
          .split("T")[0]
      : date;
    const endDateTime = allDay
      ? `${endDate}T00:00:00`
      : `${date}T${endTime}:00${tz}`;

    try {
      if (isEdit) {
        const res = await fetch("/api/calendar/events", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId: event.id,
            summary: summary.trim(),
            description: description.trim() || undefined,
            startDateTime,
            endDateTime,
            allDay,
          }),
        });
        if (res.ok) {
          toast.success("Événement modifié");
          onSaved();
          onClose();
        } else {
          const data = await res.json().catch(() => null);
          toast.error(data?.error || "Erreur lors de la modification");
        }
      } else {
        const res = await fetch("/api/calendar/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            summary: summary.trim(),
            description: description.trim() || undefined,
            startDateTime,
            endDateTime,
            allDay,
            addMeet,
          }),
        });
        if (res.ok) {
          toast.success("Événement créé");
          onSaved();
          onClose();
        } else {
          const data = await res.json().catch(() => null);
          toast.error(data?.error || "Erreur lors de la création");
        }
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!event) return;
    setDeleting(true);

    try {
      const res = await fetch(
        `/api/calendar/events?eventId=${encodeURIComponent(event.id)}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        toast.success("Événement supprimé");
        onDeleted?.(event.id);
        onClose();
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || "Erreur lors de la suppression");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-[#2A2A2A] bg-[#111111] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">
            {isEdit ? "Modifier l'événement" : "Nouvel événement"}
          </h3>
          <button
            onClick={onClose}
            className="text-[#666] hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Recurring warning */}
        {event?.recurringEventId && (
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[#2A2A2A] px-3 py-2">
            <Repeat className="h-3.5 w-3.5 text-[#888] shrink-0" />
            <span className="text-[11px] text-[#888]">
              Cet événement fait partie d&apos;une série récurrente — seule
              cette occurrence sera modifiée/supprimée
            </span>
          </div>
        )}

        <div className="space-y-3">
          {/* Titre */}
          <input
            type="text"
            placeholder="Titre de l'événement"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            autoFocus
            className="w-full rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] px-3 py-2 text-sm text-white placeholder-[#555] outline-none focus:border-[#0ACF83] transition"
          />

          {/* Date */}
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] px-3 py-2 text-sm text-white outline-none focus:border-[#0ACF83] transition [color-scheme:dark]"
          />

          {/* Journée entière toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <div
              className={`relative h-5 w-9 rounded-full transition ${allDay ? "bg-[#0ACF83]" : "bg-[#2A2A2A]"}`}
              onClick={() => setAllDay(!allDay)}
            >
              <div
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${allDay ? "translate-x-4" : "translate-x-0.5"}`}
              />
            </div>
            <span className="text-xs text-[#999]">Journée entière</span>
          </label>

          {/* Time pickers */}
          {!allDay && (
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[10px] text-[#666] mb-1 block">
                  Début
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] px-3 py-2 text-sm text-white outline-none focus:border-[#0ACF83] transition [color-scheme:dark]"
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-[#666] mb-1 block">
                  Fin
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] px-3 py-2 text-sm text-white outline-none focus:border-[#0ACF83] transition [color-scheme:dark]"
                />
              </div>
            </div>
          )}

          {/* Description */}
          <textarea
            placeholder="Description (optionnel)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] px-3 py-2 text-sm text-white placeholder-[#555] outline-none focus:border-[#0ACF83] transition resize-none"
          />

          {/* Conference link (read-only in edit mode) */}
          {isEdit && event.conferenceLink && (
            <a
              href={event.conferenceLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg bg-[rgba(10,207,131,0.1)] border border-[rgba(10,207,131,0.2)] px-3 py-2 text-xs text-[#0ACF83] transition hover:bg-[rgba(10,207,131,0.2)]"
            >
              <Video className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{event.conferenceLink}</span>
            </a>
          )}

          {/* Google Meet toggle (create only) */}
          {!isEdit && (
            <label className="flex items-center gap-2 cursor-pointer">
              <div
                className={`relative h-5 w-9 rounded-full transition ${addMeet ? "bg-[#0ACF83]" : "bg-[#2A2A2A]"}`}
                onClick={() => setAddMeet(!addMeet)}
              >
                <div
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${addMeet ? "translate-x-4" : "translate-x-0.5"}`}
                />
              </div>
              <Video className="h-3.5 w-3.5 text-[#999]" />
              <span className="text-xs text-[#999]">
                Ajouter un lien Google Meet
              </span>
            </label>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            {/* Delete (edit only) */}
            {isEdit && !confirmDelete && (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 text-xs text-[#EF4444] hover:text-[#f87171] transition"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Supprimer
              </button>
            )}

            {/* Delete confirmation */}
            {isEdit && confirmDelete && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#EF4444]">
                  Supprimer cet événement ?
                </span>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="rounded px-2 py-1 text-xs text-[#888] hover:text-white transition"
                >
                  Annuler
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="rounded bg-[#EF4444] px-2 py-1 text-xs font-medium text-white transition hover:bg-[#dc2626] disabled:opacity-40"
                >
                  {deleting ? "..." : "Confirmer"}
                </button>
              </div>
            )}

            {/* Save / Create */}
            <button
              onClick={handleSave}
              disabled={!summary.trim() || saving}
              className="ml-auto rounded-lg bg-[#0ACF83] px-4 py-2 text-sm font-medium text-[#0A0A0A] transition hover:bg-[#09b874] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving
                ? isEdit
                  ? "Enregistrement..."
                  : "Création..."
                : isEdit
                  ? "Enregistrer les modifications"
                  : "Créer l'événement"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Event pill (month view) ────────────────────────────
function EventPill({
  event,
  today,
  onClick,
}: {
  event: CalendarEvent;
  today: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] leading-tight transition flex items-center gap-1 cursor-pointer ${
        today
          ? "bg-[rgba(10,207,131,0.2)] text-[#0ACF83]"
          : "bg-[#1A1A1A] border border-[#2A2A2A] text-white"
      }`}
    >
      {event.conferenceLink && (
        <Video className="h-2.5 w-2.5 shrink-0 text-[#0ACF83]" />
      )}
      <span className="truncate">
        {!event.allDay && (
          <span className="text-[#666] mr-1">{formatTime(event.start)}</span>
        )}
        {event.summary}
      </span>
    </button>
  );
}

// ─── Join button (inline) ───────────────────────────────
function JoinButton({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 rounded bg-[#0ACF83] px-1.5 py-0.5 text-[10px] font-medium text-[#0A0A0A] transition hover:bg-[#09b874] shrink-0"
    >
      <Video className="h-2.5 w-2.5" />
      Rejoindre
    </a>
  );
}

// ─── Month View ─────────────────────────────────────────
function MonthView({
  year,
  month,
  events,
  onClickDay,
  onClickEvent,
}: {
  year: number;
  month: number;
  events: CalendarEvent[];
  onClickDay: (date: Date) => void;
  onClickEvent: (event: CalendarEvent) => void;
}) {
  const weeks = getMonthGrid(year, month);

  return (
    <div className="grid grid-cols-7 gap-px bg-[#1A1A1A] rounded-lg overflow-hidden border border-[#2A2A2A]">
      {DAYS.map((day) => (
        <div
          key={day}
          className="bg-[#0A0A0A] px-2 py-2 text-center text-xs font-medium text-[#666]"
        >
          {day}
        </div>
      ))}
      {weeks.flat().map((date, i) => {
        const dayEvents = eventsForDay(events, date);
        const isCurrentMonth = date.getMonth() === month;
        const today = isToday(date);
        const maxVisible = 2;

        return (
          <div
            key={i}
            onClick={() => onClickDay(date)}
            className={`bg-[#0A0A0A] min-h-[100px] p-1.5 cursor-pointer hover:bg-[#111] transition ${
              !isCurrentMonth ? "opacity-30" : ""
            } ${today ? "!bg-[#1A1A1A] ring-1 ring-inset ring-[#0ACF83]" : ""}`}
          >
            <div
              className={`text-xs mb-1 ${
                today ? "text-[#0ACF83] font-bold" : "text-[#888]"
              }`}
            >
              {date.getDate()}
            </div>
            <div className="flex flex-col gap-0.5">
              {dayEvents.slice(0, maxVisible).map((event) => (
                <div key={event.id} className="flex items-center gap-0.5">
                  <div className="flex-1 min-w-0">
                    <EventPill
                      event={event}
                      today={today}
                      onClick={() => onClickEvent(event)}
                    />
                  </div>
                  {event.conferenceLink && (
                    <JoinButton href={event.conferenceLink} />
                  )}
                </div>
              ))}
              {dayEvents.length > maxVisible && (
                <span className="text-[10px] text-[#666] pl-1">
                  +{dayEvents.length - maxVisible}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Week View ──────────────────────────────────────────
function WeekView({
  monday,
  events,
  onClickSlot,
  onClickEvent,
}: {
  monday: Date;
  events: CalendarEvent[];
  onClickSlot: (date: Date, hour: number) => void;
  onClickEvent: (event: CalendarEvent) => void;
}) {
  const days = getWeekDays(monday);

  return (
    <div className="rounded-lg border border-[#2A2A2A] overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] bg-[#0A0A0A]">
        <div className="border-b border-r border-[#2A2A2A] p-2" />
        {days.map((date, i) => {
          const today = isToday(date);
          const dayEvents = eventsForDay(events, date).filter((e) => e.allDay);
          return (
            <div
              key={i}
              className={`border-b border-r border-[#2A2A2A] p-2 text-center last:border-r-0 ${
                today ? "bg-[#1A1A1A]" : ""
              }`}
            >
              <div className="text-[10px] text-[#666] uppercase">{DAYS[i]}</div>
              <div
                className={`text-sm font-medium ${
                  today ? "text-[#0ACF83]" : "text-white"
                }`}
              >
                {date.getDate()}
              </div>
              {dayEvents.map((e) => (
                <button
                  key={e.id}
                  onClick={() => onClickEvent(e)}
                  className="mt-1 w-full truncate rounded bg-[rgba(10,207,131,0.15)] px-1 py-0.5 text-[10px] text-[#0ACF83] cursor-pointer"
                >
                  {e.summary}
                </button>
              ))}
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] relative">
        {/* Hour labels */}
        <div className="bg-[#0A0A0A]">
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="h-14 border-b border-r border-[#2A2A2A] flex items-start justify-end pr-2 pt-0.5"
            >
              <span className="text-[10px] text-[#555]">
                {hour.toString().padStart(2, "0")}h
              </span>
            </div>
          ))}
        </div>

        {/* Day columns */}
        {days.map((date, dayIndex) => {
          const today = isToday(date);
          const dayEvents = eventsForDay(events, date).filter(
            (e) => !e.allDay
          );

          return (
            <div
              key={dayIndex}
              className={`relative ${today ? "bg-[#1A1A1A]" : "bg-[#0A0A0A]"}`}
            >
              {/* Hour rows — clickable slots */}
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  onClick={() => onClickSlot(date, hour)}
                  className="h-14 border-b border-r border-[#2A2A2A] last:border-r-0 cursor-pointer hover:bg-[rgba(10,207,131,0.04)] transition"
                />
              ))}

              {/* Events */}
              {dayEvents.map((event) => {
                const start = new Date(event.start);
                const end = new Date(event.end);
                const startHour =
                  start.getHours() + start.getMinutes() / 60;
                const endHour = end.getHours() + end.getMinutes() / 60;
                const top = (startHour - 8) * 56;
                const height = Math.max((endHour - startHour) * 56, 20);

                if (startHour < 8 || startHour >= 22) return null;

                return (
                  <button
                    key={event.id}
                    onClick={() => onClickEvent(event)}
                    className={`absolute left-0.5 right-0.5 rounded px-1.5 py-0.5 text-left overflow-hidden transition-opacity hover:opacity-90 cursor-pointer ${
                      today
                        ? "bg-[rgba(10,207,131,0.2)] border border-[#0ACF83]"
                        : "bg-[#1A1A1A] border border-[#2A2A2A]"
                    }`}
                    style={{ top: `${top}px`, height: `${height}px` }}
                  >
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] font-medium text-white truncate">
                        {event.summary}
                      </span>
                      {event.conferenceLink && (
                        <Video className="h-3 w-3 shrink-0 text-[#0ACF83]" />
                      )}
                    </div>
                    <div className="text-[10px] text-[#888]">
                      {formatTime(event.start)} – {formatTime(event.end)}
                    </div>
                    {event.conferenceLink && height >= 56 && (
                      <div className="mt-0.5">
                        <JoinButton href={event.conferenceLink} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────
export default function CalendrierPage() {
  const { data: session, status } = useSession();
  const [view, setView] = useState<ViewMode>("month");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalEvent, setModalEvent] = useState<CalendarEvent | undefined>();
  const [modalInitial, setModalInitial] = useState<
    CreateEventForm | undefined
  >();

  // Month navigation
  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Week navigation
  const [weekMonday, setWeekMonday] = useState(() => getMonday(new Date()));

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      let timeMin: string;
      let timeMax: string;

      if (view === "month") {
        const firstDay = new Date(year, month, 1);
        const mon = getMonday(firstDay);
        timeMin = mon.toISOString();
        const lastDay = new Date(year, month + 1, 0);
        const endSunday = new Date(lastDay);
        endSunday.setDate(lastDay.getDate() + (7 - lastDay.getDay()));
        timeMax = endSunday.toISOString();
      } else {
        timeMin = weekMonday.toISOString();
        const sunday = new Date(weekMonday);
        sunday.setDate(weekMonday.getDate() + 7);
        timeMax = sunday.toISOString();
      }

      const res = await fetch(
        `/api/calendar/events?timeMin=${timeMin}&timeMax=${timeMax}`
      );
      if (res.ok) {
        setEvents(await res.json());
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [view, year, month, weekMonday]);

  useEffect(() => {
    if (session?.accessToken) {
      fetchEvents();
    }
  }, [session, fetchEvents]);

  function prevMonth() {
    setCurrentDate(new Date(year, month - 1, 1));
  }
  function nextMonth() {
    setCurrentDate(new Date(year, month + 1, 1));
  }
  function prevWeek() {
    const d = new Date(weekMonday);
    d.setDate(d.getDate() - 7);
    setWeekMonday(d);
  }
  function nextWeek() {
    const d = new Date(weekMonday);
    d.setDate(d.getDate() + 7);
    setWeekMonday(d);
  }

  function openCreateModal(initial?: CreateEventForm) {
    setModalEvent(undefined);
    setModalInitial(initial);
    setModalOpen(true);
  }

  function openEditModal(event: CalendarEvent) {
    setModalEvent(event);
    setModalInitial(undefined);
    setModalOpen(true);
  }

  function handleClickDay(date: Date) {
    openCreateModal({
      date: toDateInputValue(date),
      startTime: "09:00",
      endTime: "10:00",
    });
  }

  function handleClickSlot(date: Date, hour: number) {
    openCreateModal({
      date: toDateInputValue(date),
      startTime: `${hour.toString().padStart(2, "0")}:00`,
      endTime: `${(hour + 1).toString().padStart(2, "0")}:00`,
    });
  }

  function handleDeleted(eventId: string) {
    setEvents((prev) => prev.filter((e) => e.id !== eventId));
  }

  const monthLabel = currentDate.toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });

  const weekDays = getWeekDays(weekMonday);
  const weekLabel = `${weekDays[0].getDate()} ${weekDays[0].toLocaleDateString("fr-FR", { month: "short" })} – ${weekDays[6].getDate()} ${weekDays[6].toLocaleDateString("fr-FR", { month: "short", year: "numeric" })}`;

  // ─── Not connected to Google ─────────────────────────
  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-pulse text-[#666] text-sm">Chargement...</div>
      </div>
    );
  }

  if (!session?.accessToken) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1A1A1A] border border-[#2A2A2A]">
          <CalendarDays className="h-8 w-8 text-[#666]" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold text-white mb-1">
            Google Calendar
          </h2>
          <p className="text-sm text-[#888]">
            Connecte ton compte pour voir tes événements
          </p>
        </div>
        <button
          onClick={() => signIn("google")}
          className="mt-2 flex items-center gap-2 rounded-lg bg-[#0ACF83] px-5 py-2.5 text-sm font-medium text-[#0A0A0A] transition hover:bg-[#09b874]"
        >
          <CalendarDays className="h-4 w-4" />
          Connecter Google Calendar
        </button>
      </div>
    );
  }

  // ─── Connected ────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Event modal (create / edit) */}
      {modalOpen && (
        <EventModal
          event={modalEvent}
          initial={modalInitial}
          onClose={() => setModalOpen(false)}
          onSaved={fetchEvents}
          onDeleted={handleDeleted}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {view === "month" ? (
            <>
              <button
                onClick={prevMonth}
                className="rounded-md p-1.5 text-[#888] hover:bg-[#1A1A1A] hover:text-white transition"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <h2 className="text-base font-semibold text-white capitalize min-w-[160px] text-center">
                {monthLabel}
              </h2>
              <button
                onClick={nextMonth}
                className="rounded-md p-1.5 text-[#888] hover:bg-[#1A1A1A] hover:text-white transition"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={prevWeek}
                className="rounded-md p-1.5 text-[#888] hover:bg-[#1A1A1A] hover:text-white transition"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <h2 className="text-base font-semibold text-white min-w-[220px] text-center">
                {weekLabel}
              </h2>
              <button
                onClick={nextWeek}
                className="rounded-md p-1.5 text-[#888] hover:bg-[#1A1A1A] hover:text-white transition"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}
          {loading && (
            <span className="text-xs text-[#666] animate-pulse">
              Chargement...
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => openCreateModal()}
            className="flex items-center gap-1.5 rounded-lg bg-[#0ACF83] px-3 py-1.5 text-xs font-medium text-[#0A0A0A] transition hover:bg-[#09b874]"
          >
            <Plus className="h-3.5 w-3.5" />
            Événement
          </button>

          <div className="flex rounded-lg bg-[#1A1A1A] border border-[#2A2A2A] p-0.5">
            <button
              onClick={() => setView("month")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                view === "month"
                  ? "bg-[#0ACF83] text-[#0A0A0A]"
                  : "text-[#888] hover:text-white"
              }`}
            >
              Mois
            </button>
            <button
              onClick={() => setView("week")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                view === "week"
                  ? "bg-[#0ACF83] text-[#0A0A0A]"
                  : "text-[#888] hover:text-white"
              }`}
            >
              Semaine
            </button>
          </div>
        </div>
      </div>

      {/* Calendar */}
      {view === "month" ? (
        <MonthView
          year={year}
          month={month}
          events={events}
          onClickDay={handleClickDay}
          onClickEvent={openEditModal}
        />
      ) : (
        <WeekView
          monday={weekMonday}
          events={events}
          onClickSlot={handleClickSlot}
          onClickEvent={openEditModal}
        />
      )}
    </div>
  );
}
