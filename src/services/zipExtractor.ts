import JSZip from "jszip";

const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".xlsx", ".odt"];

export interface ExtractedFile {
  /** Nome original do arquivo (apenas o nome, sem caminho) */
  name: string;
  /** Caminho completo dentro do ZIP (ex: "pasta/subpasta/arquivo.pdf") */
  fullPath: string;
  /** Pasta de origem dentro do ZIP (ex: "pasta/subpasta") */
  folder: string;
  data: Blob;
  extension: string;
  /** Nome seguro para uso em storage (sem acentos/especiais) */
  safeName: string;
}

/**
 * Normaliza um nome removendo acentos e caracteres especiais,
 * mantendo letras, números, pontos, hífens e underscores.
 */
function normalizeName(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_");
}

export function isValidZip(file: File): boolean {
  return file.name.endsWith(".zip");
}

/**
 * Retorna true se o entry deve ser ignorado (pastas, arquivos do macOS, thumbs, etc.)
 */
function shouldSkip(entry: JSZip.JSZipObject): boolean {
  if (entry.dir) return true;
  const name = entry.name;
  // Ignorar metadados do macOS e Windows
  if (name.startsWith("__MACOSX/") || name.includes("/.DS_Store") || name.endsWith(".DS_Store")) return true;
  if (name.toLowerCase() === "thumbs.db") return true;
  return false;
}

function getExtension(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx >= 0 ? filename.substring(idx).toLowerCase() : "";
}

function getFileName(fullPath: string): string {
  const parts = fullPath.split("/");
  return parts[parts.length - 1];
}

function getFolder(fullPath: string): string {
  const parts = fullPath.split("/");
  if (parts.length <= 1) return "";
  return parts.slice(0, -1).join("/");
}

export async function listZipContents(file: File): Promise<string[]> {
  const zip = await JSZip.loadAsync(file);
  const results: string[] = [];

  zip.forEach((relativePath, entry) => {
    if (shouldSkip(entry)) return;
    const ext = getExtension(relativePath);
    if (ACCEPTED_EXTENSIONS.includes(ext)) {
      results.push(relativePath);
    }
  });

  return results;
}

export async function extractFilesFromZip(file: File): Promise<ExtractedFile[]> {
  const zip = await JSZip.loadAsync(file);
  const extracted: ExtractedFile[] = [];

  const entries: { path: string; entry: JSZip.JSZipObject }[] = [];
  zip.forEach((relativePath, entry) => {
    if (shouldSkip(entry)) return;
    const ext = getExtension(relativePath);
    if (ACCEPTED_EXTENSIONS.includes(ext)) {
      entries.push({ path: relativePath, entry });
    }
  });

  for (const { path, entry } of entries) {
    const data = await entry.async("blob");
    const fileName = getFileName(path);
    const extension = getExtension(fileName);
    const folder = getFolder(path);
    const safeName = folder
      ? `${normalizeName(folder)}/${normalizeName(fileName)}`
      : normalizeName(fileName);

    extracted.push({
      name: fileName,
      fullPath: path,
      folder,
      data,
      extension,
      safeName,
    });
  }

  console.log(`[ZIP] ${extracted.length} arquivo(s) extraído(s):`, extracted.map(f => f.fullPath));

  return extracted;
}
