// Minimal RFC 4180 CSV reader. Handles quoted fields, escaped quotes,
// CRLF/LF line endings, a UTF-8 BOM, and comma / semicolon / tab delimiters
// (Excel in some locales saves exports with semicolons).
//
// Pure and dependency-free: runs in the browser (upload preview) and on the
// server (the actual import), and under `node --test`.

export function detectDelimiter(text: string): string {
  const firstLine = text.slice(0, text.search(/\r?\n|$/));
  const counts: [string, number][] = [",", ";", "\t"].map((d) => [d, countOutsideQuotes(firstLine, d)]);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ",";
}

function countOutsideQuotes(line: string, delimiter: string): number {
  let inQuotes = false;
  let n = 0;
  for (const ch of line) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === delimiter && !inQuotes) n++;
  }
  return n;
}

export function parseCsv(input: string): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Drop fully blank lines (trailing newline, spacer rows).
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}
