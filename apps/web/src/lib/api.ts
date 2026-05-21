import type { ParsedChat } from "../types";

export async function parseChatFile(file: File): Promise<ParsedChat> {
  const formData = new FormData();
  formData.append("file", file, file.name);
  formData.append("sourceName", file.name);

  const response = await fetch("/api/parse", {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error ?? "No se pudo procesar el archivo.");
  }

  return response.json();
}