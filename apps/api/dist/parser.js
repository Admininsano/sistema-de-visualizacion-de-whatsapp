const START_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2})(?:\s*([ap])\.\s*m\.|\s*([ap])\.?\s*m\.?)?\s+-\s+(.*)$/i;
function normalizeYear(year) {
    if (year.length === 2) {
        const value = Number(year);
        return value >= 70 ? 1900 + value : 2000 + value;
    }
    return Number(year);
}
function pad(value) {
    return String(value).padStart(2, "0");
}
function toIso(datePart) {
    let hour = Number(datePart.hour);
    const minute = Number(datePart.minute);
    const meridiem = datePart.meridiem?.toLowerCase();
    if (meridiem === "p" && hour < 12) {
        hour += 12;
    }
    else if (meridiem === "a" && hour === 12) {
        hour = 0;
    }
    const year = normalizeYear(datePart.year);
    const month = Number(datePart.month);
    const day = Number(datePart.day);
    const dateISO = `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00`;
    return {
        iso: dateISO,
        dateLabel: `${pad(day)}/${pad(month)}/${year}`,
        timeLabel: `${pad(hour % 24)}:${pad(minute)}`
    };
}
function isMediaPlaceholder(content) {
    return /<media omitted>|imagen omitida|audio omitido|archivo omitido|video omitido/i.test(content);
}
export function parseWhatsAppExport(source, sourceName = "chat") {
    const lines = source.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    const messages = [];
    const participants = new Set();
    let current = null;
    for (const line of lines) {
        const match = line.match(START_RE);
        if (match) {
            const day = match[1] ?? "";
            const month = match[2] ?? "";
            const year = match[3] ?? "";
            const hour = match[4] ?? "";
            const minute = match[5] ?? "";
            const meridiemA = match[6];
            const meridiemB = match[7];
            const remainder = match[8] ?? "";
            const dateData = toIso({
                day,
                month,
                year,
                hour,
                minute,
                meridiem: meridiemA ?? meridiemB
            });
            const separatorIndex = remainder.indexOf(":");
            const sender = separatorIndex > 0 ? remainder.slice(0, separatorIndex).trim() : null;
            const content = separatorIndex > 0 ? remainder.slice(separatorIndex + 1).trimStart() : remainder.trim();
            const kind = sender ? (isMediaPlaceholder(content) ? "media" : "message") : "system";
            const message = {
                id: messages.length,
                dateISO: dateData.iso,
                dateLabel: dateData.dateLabel,
                timeLabel: dateData.timeLabel,
                sender,
                content,
                raw: remainder,
                kind,
                isFromMe: false
            };
            current = message;
            messages.push(message);
            if (sender) {
                participants.add(sender);
            }
            continue;
        }
        if (current) {
            current.content = `${current.content}\n${line}`;
            current.raw = `${current.raw}\n${line}`;
            if (current.kind === "message" && isMediaPlaceholder(current.content)) {
                current.kind = "media";
            }
        }
    }
    const ordered = messages
        .map((message) => ({ ...message }))
        .sort((left, right) => left.dateISO.localeCompare(right.dateISO));
    const firstSender = ordered.find((message) => message.sender)?.sender ?? null;
    for (const message of ordered) {
        if (message.sender && firstSender) {
            message.isFromMe = message.sender === firstSender;
        }
    }
    return {
        sourceName,
        participants: Array.from(participants).sort((left, right) => left.localeCompare(right)),
        messageCount: ordered.length,
        firstMessageAt: ordered[0]?.dateISO ?? null,
        lastMessageAt: ordered[ordered.length - 1]?.dateISO ?? null,
        messages: ordered
    };
}
