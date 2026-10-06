/** Importação do CSV de "Impressões e taxa de cliques" exportado do YouTube Studio
 * (Analytics, modo avançado). A API do YouTube não entrega esses números, então
 * este arquivo é a única fonte de CTR de thumbnail. Puro, sem I/O. */

export interface StudioRow {
  videoId: string | null;
  title: string;
  impressions: number;
  /** Fração: 0.064 = 6,4%. */
  ctr: number;
}

const strip = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9% ]+/g, " ").replace(/\s+/g, " ").trim();

/** CSV simples com aspas; detecta o separador (vírgula, ponto e vírgula ou tab) pela linha do cabeçalho. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const delim = [",", ";", "\t"].map((d) => [d, firstLine.split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

export function parseCount(raw: string): number {
  const digits = raw.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

/** "5,32", "5.32", "1.234,5", "6,4%" -> número. */
export function parseDecimal(raw: string): number {
  let s = raw.replace(/[%\s]/g, "");
  const comma = s.lastIndexOf(","), dot = s.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) s = comma > dot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else if (comma >= 0) s = s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

export type StudioParseResult = { ok: true; rows: StudioRow[] } | { ok: false; error: string };

export function parseStudioCsv(text: string): StudioParseResult {
  const table = parseCsv(text);
  if (table.length < 2) return { ok: false, error: "O arquivo está vazio ou não parece um CSV." };
  const header = table[0].map(strip);

  const iImp = header.findIndex((h) => h === "impressoes" || h === "impressions");
  const iCtr = header.findIndex((h) => (h.includes("taxa de cliques") || h.includes("click through") || h.includes("click-through") || h.includes("ctr")) && (h.includes("impress") || h.includes("%")));
  if (iImp < 0 || iCtr < 0) {
    return { ok: false, error: "Não encontrei as colunas de impressões e de taxa de cliques. Exporte o relatório \"Impressões\" e \"Taxa de cliques das impressões\" no modo avançado do YouTube Studio." };
  }
  const iId = header.findIndex((h) => h === "conteudo" || h === "content" || h === "video" || h === "id do video" || h === "video id");
  const iTitle = header.findIndex((h) => h.includes("titulo") || h === "title" || h === "video title");

  const rows: StudioRow[] = [];
  for (const r of table.slice(1)) {
    const id = iId >= 0 ? (r[iId] ?? "").trim() : "";
    const title = iTitle >= 0 ? (r[iTitle] ?? "").trim() : "";
    // Linha de total (sem conteúdo) e linhas sem identificação não entram.
    if (!id && !title) continue;
    if (strip(id) === "total" || strip(title) === "total") continue;
    const ctrPct = parseDecimal(r[iCtr] ?? "");
    rows.push({
      videoId: /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null,
      title,
      impressions: parseCount(r[iImp] ?? ""),
      ctr: ctrPct / 100,
    });
  }
  if (rows.length === 0) return { ok: false, error: "Nenhum vídeo encontrado no arquivo." };
  return { ok: true, rows };
}

export interface KnownVideo { videoId: string; title: string }

/** Liga cada linha do CSV a um vídeo do canal: pelo id do vídeo, ou pelo título exato (sem acento/caixa). */
export function matchStudioRows(rows: StudioRow[], videos: KnownVideo[]): { matched: { videoId: string; impressions: number; ctr: number }[]; unmatched: StudioRow[] } {
  const byId = new Set(videos.map((v) => v.videoId));
  const byTitle = new Map(videos.map((v) => [strip(v.title), v.videoId]));
  const matched: { videoId: string; impressions: number; ctr: number }[] = [];
  const unmatched: StudioRow[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const id = r.videoId && byId.has(r.videoId) ? r.videoId : byTitle.get(strip(r.title)) ?? null;
    if (!id || seen.has(id)) { if (!id) unmatched.push(r); continue; }
    seen.add(id);
    matched.push({ videoId: id, impressions: r.impressions, ctr: r.ctr });
  }
  return { matched, unmatched };
}
