import { useEffect, useMemo, useRef, useState } from "react";
import { parseChatFile } from "./lib/api";
import type { ParsedChat, ParsedMessage, SearchMatch } from "./types";

function formatDateLabel(dateISO: string) {
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(dateISO));
}

function formatTime(dateISO: string) {
  return new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(dateISO));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightText(text: string, term: string) {
  if (!term.trim()) {
    return text;
  }

  const parts = text.split(new RegExp(`(${escapeRegExp(term)})`, "ig"));

  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <mark key={`${part}-${index}`} className="rounded bg-amber-200 px-0.5 text-slate-900 dark:bg-amber-300">
        {part}
      </mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    )
  );
}

function groupByDate(messages: ParsedMessage[]) {
  return messages.reduce<Array<{ dateISO: string; messages: ParsedMessage[] }>>((groups, message) => {
    const lastGroup = groups[groups.length - 1];

    if (lastGroup && lastGroup.dateISO.slice(0, 10) === message.dateISO.slice(0, 10)) {
      lastGroup.messages.push(message);
      return groups;
    }

    groups.push({ dateISO: message.dateISO, messages: [message] });
    return groups;
  }, []);
}

function buildSearchMatches(messages: ParsedMessage[], term: string) {
  if (!term.trim()) {
    return [] as SearchMatch[];
  }

  const lower = term.toLowerCase();
  const matches: SearchMatch[] = [];

  messages.forEach((message) => {
    const haystack = `${message.sender ?? ""} ${message.content}`.toLowerCase();
    let index = haystack.indexOf(lower);
    while (index !== -1) {
      matches.push({ messageId: message.id, index, length: term.length });
      index = haystack.indexOf(lower, index + term.length);
    }
  });

  return matches;
}

export default function App() {
  const [chat, setChat] = useState<ParsedChat | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [participant, setParticipant] = useState("all");
  const [selfParticipant, setSelfParticipant] = useState("auto");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains("dark"));
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    if (chat?.participants.length) {
      setSelfParticipant((current) => (current === "auto" ? chat.participants[0] : current));
    }
  }, [chat]);

  const decoratedMessages = useMemo(() => {
    if (!chat) {
      return [] as ParsedMessage[];
    }

    return chat.messages.map((message) => ({
      ...message,
      isFromMe: selfParticipant !== "auto" && message.sender === selfParticipant
    }));
  }, [chat, selfParticipant]);

  const filteredMessages = useMemo(() => {
    if (!chat) {
      return [] as ParsedMessage[];
    }

    return decoratedMessages.filter((message) => {
      const matchesParticipant = participant === "all" || message.sender === participant;
      const messageDate = message.dateISO.slice(0, 10);
      const matchesStart = !startDate || messageDate >= startDate;
      const matchesEnd = !endDate || messageDate <= endDate;
      const matchesQuery = !query.trim() || `${message.sender ?? ""} ${message.content}`.toLowerCase().includes(query.toLowerCase());

      return matchesParticipant && matchesStart && matchesEnd && matchesQuery;
    });
  }, [chat, decoratedMessages, participant, startDate, endDate, query]);

  const groupedMessages = useMemo(() => groupByDate(filteredMessages), [filteredMessages]);
  const matches = useMemo(() => buildSearchMatches(filteredMessages, query), [filteredMessages, query]);
  const matchCount = matches.length;

  useEffect(() => {
    if (!scrollRef.current || !filteredMessages.length) {
      return;
    }

    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [chat, filteredMessages.length]);

  const handleFile = async (file: File) => {
    setLoading(true);
    setError(null);
    setFileName(file.name);

    try {
      const parsed = await parseChatFile(file);
      setChat(parsed);
      setQuery("");
      setParticipant("all");
      setSelfParticipant("auto");
      setStartDate("");
      setEndDate("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo abrir el archivo.");
      setChat(null);
    } finally {
      setLoading(false);
    }
  };

  const participants = chat?.participants ?? [];
  const stats = chat
    ? [
        { label: "Mensajes", value: chat.messageCount.toLocaleString("es-ES") },
        { label: "Participantes", value: chat.participants.length.toString() },
        { label: "Coincidencias", value: matchCount.toLocaleString("es-ES") }
      ]
    : [];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.18),_transparent_28%),linear-gradient(180deg,_#eff6ff_0%,_#dbeafe_100%)] text-slate-900 transition-colors dark:bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.12),_transparent_26%),linear-gradient(180deg,_#0f172a_0%,_#111827_100%)] dark:text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-4 px-4 py-4 lg:px-6 lg:py-6">
        <header className="overflow-hidden rounded-[28px] border border-white/50 bg-white/75 p-4 shadow-glass backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/70">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-400">WhatsApp Chat Visualizer</p>
              <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-4xl">Reconstruye conversaciones exportadas como si fueran WhatsApp Web</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
                Sube un `.txt` exportado desde WhatsApp, interpreta fechas, horas, remitentes, mensajes multilinea y navega la conversación con búsqueda, filtros y modo oscuro.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 self-start lg:self-auto">
              <button
                type="button"
                onClick={() => setDarkMode((value) => !value)}
                className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {darkMode ? "Modo claro" : "Modo oscuro"}
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-600"
              >
                Importar .txt
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-500/20 dark:text-emerald-300"
              >
                Exportar PDF
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,text/plain"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void handleFile(file);
                  }
                }}
              />
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950/40">
              <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Buscar</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Palabra clave, emoji o nombre"
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </label>

            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950/40">
              <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Participante</span>
              <select value={participant} onChange={(event) => setParticipant(event.target.value)} className="w-full bg-transparent outline-none">
                <option value="all">Todos</option>
                {participants.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950/40">
              <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Mi lado</span>
              <select value={selfParticipant} onChange={(event) => setSelfParticipant(event.target.value)} className="w-full bg-transparent outline-none">
                <option value="auto">Auto</option>
                {participants.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950/40">
              <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Desde</span>
              <input value={startDate} onChange={(event) => setStartDate(event.target.value)} type="date" className="w-full bg-transparent outline-none" />
            </label>

            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950/40">
              <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Hasta</span>
              <input value={endDate} onChange={(event) => setEndDate(event.target.value)} type="date" className="w-full bg-transparent outline-none" />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            {(stats.length
              ? stats
              : [
                  { label: "Mensajes", value: "0" },
                  { label: "Participantes", value: "0" },
                  { label: "Coincidencias", value: "0" }
                ]
            ).map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/60 bg-white/70 px-4 py-3 backdrop-blur dark:border-slate-700/60 dark:bg-slate-950/40">
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">{item.label}</div>
                <div className="mt-1 text-lg font-bold">{item.value}</div>
              </div>
            ))}
            {fileName ? (
              <div className="rounded-2xl border border-white/60 bg-white/70 px-4 py-3 backdrop-blur dark:border-slate-700/60 dark:bg-slate-950/40">
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Archivo</div>
                <div className="mt-1 max-w-[320px] truncate text-sm font-semibold">{fileName}</div>
              </div>
            ) : null}
          </div>
        </header>

        <main className="grid flex-1 gap-4 xl:grid-cols-[1.08fr_0.92fr]">
          <section className="overflow-hidden rounded-[30px] border border-white/50 bg-white/80 shadow-glass backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/75">
            <div className="flex items-center justify-between border-b border-slate-200/70 px-5 py-4 dark:border-slate-700/70">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">Conversación</div>
                <div className="mt-1 text-lg font-bold">{chat ? chat.sourceName : "Importa un archivo para comenzar"}</div>
              </div>
              <div className="text-sm text-slate-500">{filteredMessages.length.toLocaleString("es-ES")} mensajes visibles</div>
            </div>

            <div ref={scrollRef} className="h-[calc(100vh-340px)] overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.08),_transparent_20%),linear-gradient(180deg,_rgba(255,255,255,0.35),_rgba(255,255,255,0.14))] p-4 dark:bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_20%),linear-gradient(180deg,_rgba(15,23,42,0.92),_rgba(15,23,42,0.82))] sm:p-6">
              {!chat ? (
                <div className="flex min-h-[380px] flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-white/60 p-10 text-center dark:border-slate-700 dark:bg-slate-950/30">
                  <div className="max-w-xl">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500 text-2xl font-black text-white">WA</div>
                    <h2 className="mt-5 text-2xl font-black">Carga una exportación de WhatsApp</h2>
                    <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                      El sistema detecta formatos con fechas, horas, nombres y mensajes multilinea. Mantiene emojis, caracteres especiales y separadores por fecha.
                    </p>
                  </div>
                </div>
              ) : groupedMessages.length ? (
                <div className="space-y-5">
                  {groupedMessages.map((group) => (
                    <div key={group.dateISO} className="space-y-3">
                      <div className="sticky top-0 z-10 flex justify-center py-2">
                        <span className="rounded-full bg-slate-900/85 px-4 py-1.5 text-xs font-semibold tracking-wide text-white shadow-lg dark:bg-white/90 dark:text-slate-900">
                          {formatDateLabel(group.dateISO)}
                        </span>
                      </div>

                      {group.messages.map((message) => {
                        const isMine = message.isFromMe;
                        const bubbleClass = isMine
                          ? "ml-auto rounded-br-md bg-emerald-500 text-white"
                          : message.kind === "system"
                            ? "mx-auto max-w-xl rounded-2xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200"
                            : "mr-auto rounded-bl-md bg-white text-slate-900 shadow-md dark:bg-slate-800 dark:text-slate-100";

                        return (
                          <article key={message.id} className={`flex max-w-[92%] flex-col gap-1 ${isMine ? "ml-auto items-end" : "mr-auto items-start"}`}>
                            {!isMine && message.sender ? <div className="ml-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">{message.sender}</div> : null}
                            <div className={`max-w-full rounded-[24px] px-4 py-3 text-sm leading-6 whitespace-pre-wrap ${bubbleClass} animate-fadeUp`}>
                              {message.kind === "media" ? (
                                <div className="mb-2 inline-flex rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-current opacity-80">
                                  Archivo o multimedia
                                </div>
                              ) : null}
                              {highlightText(message.content, query)}
                              <div className={`mt-2 flex justify-end text-[11px] ${isMine ? "text-emerald-100" : "text-slate-400 dark:text-slate-400"}`}>
                                {formatTime(message.dateISO)}
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex min-h-[220px] items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-white/50 p-8 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-950/30">
                  No hay mensajes que coincidan con los filtros actuales.
                </div>
              )}
            </div>
          </section>

          <aside className="grid gap-4 xl:sticky xl:top-6 xl:self-start">
            <section className="overflow-hidden rounded-[30px] border border-white/50 bg-white/80 shadow-glass backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/75">
              <div className="border-b border-slate-200/70 px-5 py-4 dark:border-slate-700/70">
                <div className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">Buscador inteligente</div>
                <div className="mt-1 text-lg font-bold">Resultados resaltados dentro del chat</div>
              </div>
              <div className="space-y-3 p-5">
                <div className="rounded-2xl bg-slate-950 px-4 py-3 text-sm text-white dark:bg-slate-800">
                  {query.trim() ? `${matchCount} coincidencias para “${query}”` : "Escribe una palabra clave para explorar la conversación."}
                </div>
                <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
                  {query.trim() && filteredMessages.length ? (
                    filteredMessages.slice(0, 12).map((message) => (
                      <div key={message.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950/30">
                        <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">{message.sender ?? "Sistema"}</span>
                          <span>{message.dateLabel}</span>
                        </div>
                        <p className="mt-2 max-h-24 overflow-hidden whitespace-pre-wrap text-slate-700 dark:text-slate-200">{highlightText(message.content, query)}</p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700">
                      Sube un archivo y utiliza el buscador para encontrar mensajes, emojis o nombres.
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-[30px] border border-white/50 bg-white/80 shadow-glass backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/75">
              <div className="border-b border-slate-200/70 px-5 py-4 dark:border-slate-700/70">
                <div className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">Estado</div>
                <div className="mt-1 text-lg font-bold">Procesamiento y rendimiento</div>
              </div>
              <div className="space-y-3 p-5 text-sm text-slate-600 dark:text-slate-300">
                <p>Parsing lineal en backend para mantener buen rendimiento incluso con chats grandes.</p>
                <p>Compatible con saltos de línea, emojis y caracteres especiales exportados por WhatsApp.</p>
                <p>La vista es responsive y conserva una estructura similar a WhatsApp Web.</p>
                {loading ? <div className="rounded-2xl bg-emerald-500/10 px-4 py-3 text-emerald-700 dark:text-emerald-300">Procesando archivo...</div> : null}
                {error ? <div className="rounded-2xl bg-red-500/10 px-4 py-3 text-red-700 dark:text-red-300">{error}</div> : null}
              </div>
            </section>
          </aside>
        </main>
      </div>
    </div>
  );
}