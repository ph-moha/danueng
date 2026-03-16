export interface SentenceData {
  english: string;
  korean: string;
  details?: string;
}

export interface DayEntry {
  date: string;    // "YYYY-MM-DD"
  suffix?: string; // 같은 날 여러 파일일 때: "2", "3", ...
  title: string;
  count: number;
}

export interface DayFile {
  date: string;
  title: string;
  sentences: SentenceData[];
}

/** DayEntry에서 실제 파일명을 계산 */
export function entryToFilename(entry: DayEntry): string {
  return entry.suffix ? `${entry.date}-${entry.suffix}.json` : `${entry.date}.json`;
}
