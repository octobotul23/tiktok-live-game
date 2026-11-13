import fs from 'node:fs';
import path from 'node:path';

/** Citește un fișier JSON din folderul de date; dacă lipsește sau e stricat, întoarce null. */
export function loadJson(file: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/** Scriere atomică: întâi un fișier temporar, apoi redenumire, ca o oprire bruscă să nu lase un fișier pe jumătate. */
export function saveJson(file: string, data: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

/** Salvează după o pauză (ex. cât tragi de un slider se scrie o singură dată, la final). */
export function debouncedSaver(file: string, get: () => unknown, delayMs = 800): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        saveJson(file, get());
      } catch (err) {
        console.warn(`[store] nu pot salva ${file}:`, err instanceof Error ? err.message : err);
      }
    }, delayMs);
  };
}
