import JSZip from "jszip";

const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".xlsx", ".odt"];

export interface ExtractedFile {
  name: string;
  data: Blob;
  extension: string;
  safeName: string;
}

export function isValidZip(file: File): boolean {
  return file.name.endsWith(".zip");
}

export async function listZipContents(file: File): Promise<string[]> {
  const zip = await JSZip.loadAsync(file);
  return Object.keys(zip.files).filter(
    (n) => !zip.files[n].dir && ACCEPTED_EXTENSIONS.some((ext) => n.toLowerCase().endsWith(ext))
  );
}

export async function extractFilesFromZip(file: File): Promise<ExtractedFile[]> {
  const zip = await JSZip.loadAsync(file);
  const validFiles = Object.keys(zip.files).filter(
    (n) => !zip.files[n].dir && ACCEPTED_EXTENSIONS.some((ext) => n.toLowerCase().endsWith(ext))
  );

  const extracted: ExtractedFile[] = [];
  for (const fileName of validFiles) {
    const data = await zip.files[fileName].async("blob");
    const extension = fileName.substring(fileName.lastIndexOf(".")).toLowerCase();
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    extracted.push({ name: fileName, data, extension, safeName });
  }

  return extracted;
}
