// Fast drop-in replacement for csv-reader 1.0.0 (make.fun csv-reader-speed-01).
//
// Returns exactly what csv-reader 1.0.0's readCsv returns for every input
// {text, header}: {columns, rows, errors}, including all of its broken-CSV
// behaviour (BOM drop, stray CRs, quote junk, unterminated quotes, doubled
// quotes, CR/CRLF inside quotes read as LF, short/long row padding and
// cutting, and its error records in the order met).
//
// Speed comes from never building a field character by character: plain
// fields are a single slice, well-formed quoted fields are located with a
// native indexOf scan and sliced once, and only genuinely messy fields
// (doubled quotes, CRs inside quotes, junk after a closing quote, stray
// CRs) fall back to segment assembly.

const ENDED_COMMA = 0;
const ENDED_BREAK = 1;
const ENDED_END = 2;

export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const n = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let pos = 0;
  let line = 1;
  if (text.charCodeAt(0) === 0xfeff) pos = 1;

  let recordLine = 1;
  let recordRow = null;

  // Result of the most recent field read.
  let fVal = '';
  let fEnded = ENDED_END;
  let fAdded = 0;

  // Reads unquoted characters starting at pos, on top of `prefix` ('' for a
  // plain field, the quoted value for post-quote junk, '"' for the re-read
  // of an unterminated quote). Sets fVal/fEnded/fAdded (fAdded counts only
  // the characters kept by this read, dropped CRs excluded).
  function readUnquoted(prefix) {
    if (prefix === '') {
      // Plain field: the common case, scanned without prefix bookkeeping.
      const start0 = pos;
      let j = pos;
      while (j < n) {
        const cc = text.charCodeAt(j);
        if (cc === 44 || cc === 10 || cc === 13) break;
        j += 1;
      }
      const cj = j < n ? text.charCodeAt(j) : -1;
      if (cj === -1 || cj === 44 || cj === 10 || text.charCodeAt(j + 1) === 10) {
        // No stray CR met before the delimiter (a CR here is half of CRLF).
        fVal = text.slice(start0, j);
        fAdded = j - start0;
        if (cj === -1) { pos = n; fEnded = ENDED_END; }
        else if (cj === 44) { pos = j + 1; fEnded = ENDED_COMMA; }
        else if (cj === 10) { pos = j + 1; line += 1; fEnded = ENDED_BREAK; }
        else { pos = j + 2; line += 1; fEnded = ENDED_BREAK; }
        return;
      }
      // A stray CR is inside: fall through to the segment loop below.
    }
    const start = pos;
    let i = pos;
    let parts = null;
    let segStart = pos;
    let added = 0;
    while (i < n) {
      const c = text.charCodeAt(i);
      if (c === 44) { // ,
        if (parts === null) {
          fVal = prefix + text.slice(start, i);
          fAdded = i - start;
        } else {
          parts.push(text.slice(segStart, i));
          fVal = prefix + parts.join('');
          fAdded = added + (i - segStart);
        }
        pos = i + 1;
        fEnded = ENDED_COMMA;
        return;
      }
      if (c === 10) { // LF
        if (parts === null) {
          fVal = prefix + text.slice(start, i);
          fAdded = i - start;
        } else {
          parts.push(text.slice(segStart, i));
          fVal = prefix + parts.join('');
          fAdded = added + (i - segStart);
        }
        pos = i + 1;
        line += 1;
        fEnded = ENDED_BREAK;
        return;
      }
      if (c === 13) { // CR
        if (text.charCodeAt(i + 1) === 10) { // CRLF
          if (parts === null) {
            fVal = prefix + text.slice(start, i);
            fAdded = i - start;
          } else {
            parts.push(text.slice(segStart, i));
            fVal = prefix + parts.join('');
            fAdded = added + (i - segStart);
          }
          pos = i + 2;
          line += 1;
          fEnded = ENDED_BREAK;
          return;
        }
        // Lone CR outside quotes: dropped, one stray_cr error each.
        if (parts === null) parts = [];
        parts.push(text.slice(segStart, i));
        added += i - segStart;
        errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
        i += 1;
        segStart = i;
        continue;
      }
      i += 1;
    }
    if (parts === null) {
      fVal = prefix + text.slice(start, n);
      fAdded = n - start;
    } else {
      parts.push(text.slice(segStart, n));
      fVal = prefix + parts.join('');
      fAdded = added + (n - segStart);
    }
    pos = n;
    fEnded = ENDED_END;
  }

  // After a quoted field's closing quote (pos is just past it), finishes the
  // field whose quoted value is `value`: comma, line break, end of text, or
  // junk appended as it stands.
  function finishQuoted(value) {
    if (pos >= n) {
      fVal = value;
      fEnded = ENDED_END;
      return;
    }
    const c = text.charCodeAt(pos);
    if (c === 44) {
      pos += 1;
      fVal = value;
      fEnded = ENDED_COMMA;
      return;
    }
    if (c === 10) {
      pos += 1;
      line += 1;
      fVal = value;
      fEnded = ENDED_BREAK;
      return;
    }
    if (c === 13 && text.charCodeAt(pos + 1) === 10) {
      pos += 2;
      line += 1;
      fVal = value;
      fEnded = ENDED_BREAK;
      return;
    }
    readUnquoted(value);
    if (fAdded > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
  }

  // Reads a quoted field whose opening quote is at pos.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    const start = pos + 1;
    const close = text.indexOf('"', start);
    if (close !== -1 && text.charCodeAt(close + 1) !== 34) {
      const value = text.slice(start, close);
      if (value.indexOf('\r') === -1) {
        // Well-formed quoted field: one slice, count any LFs inside.
        let lf = value.indexOf('\n');
        while (lf !== -1) {
          line += 1;
          lf = value.indexOf('\n', lf + 1);
        }
        pos = close + 1;
        finishQuoted(value);
        return;
      }
    }
    // General path: doubled quotes, CRs inside, or no closing quote at all.
    let i = start;
    let segStart = start;
    const parts = [];
    let closed = false;
    while (i < n) {
      const c = text.charCodeAt(i);
      if (c === 34) { // "
        if (text.charCodeAt(i + 1) === 34) {
          parts.push(text.slice(segStart, i), '"');
          i += 2;
          segStart = i;
          continue;
        }
        parts.push(text.slice(segStart, i));
        pos = i + 1;
        closed = true;
        break;
      }
      if (c === 13) { // CR inside quotes: CRLF and lone CR each read as LF
        parts.push(text.slice(segStart, i), '\n');
        line += 1;
        i += text.charCodeAt(i + 1) === 10 ? 2 : 1;
        segStart = i;
        continue;
      }
      if (c === 10) line += 1;
      i += 1;
    }
    if (!closed) {
      // The quote never closes: it is a literal character, and the text
      // after it is read again as unquoted.
      pos = open + 1;
      line = openLine;
      errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
      readUnquoted('"');
      return;
    }
    finishQuoted(parts.join(''));
  }

  while (true) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let quoted = false;
    do {
      quoted = text.charCodeAt(pos) === 34;
      if (quoted) readQuoted();
      else readUnquoted('');
      fields.push(fVal);
    } while (fEnded === ENDED_COMMA);

    // A line that held only stray CRs is left with no characters: no record
    // (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
