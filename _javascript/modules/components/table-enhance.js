/**
 * Enhance tables marked with `.table-enhanced` class (via Kramdown IAL `{: .table-enhanced}`).
 * Adds per-column sorting (auto-detecting number/date/text) and per-column text filtering.
 */

const SORT_ASC = 'asc';
const SORT_DESC = 'desc';

/**
 * Detect the dominant data type of a column by sampling its cell values.
 * @param {string[]} values - text content of cells in the column
 * @returns {'number'|'date'|'text'}
 */
function detectColumnType(values) {
  let numCount = 0;
  let dateCount = 0;
  const total = values.length;

  // ISO-like date: YYYY-MM-DD with optional time / timezone offset (e.g. +0800, +08:00)
  const dateRe = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}(\s|T|$)/;

  for (const v of values) {
    const trimmed = v.trim();
    if (trimmed === '') continue;

    if (!isNaN(trimmed) && trimmed !== '') {
      numCount++;
    } else if (dateRe.test(trimmed) && !isNaN(parseDate(trimmed))) {
      dateCount++;
    }
  }

  // If >50% of non-empty values match a type, use it
  const nonEmpty = values.filter((v) => v.trim() !== '').length || 1;
  if (numCount / nonEmpty > 0.5) return 'number';
  if (dateCount / nonEmpty > 0.5) return 'date';
  return 'text';
}

/**
 * Parse a date string, handling formats like "1991-08-06 +0800" that
 * Date.parse may not accept directly. Normalises bare offsets to ISO 8601.
 * @param {string} str
 * @returns {number} epoch ms, or NaN
 */
function parseDate(str) {
  const t = str.trim();
  // "YYYY-MM-DD +HHMM" or "YYYY-MM-DD +HH:MM" → append T00:00:00 before offset
  const m = t.match(
    /^(\d{4}[-/]\d{1,2}[-/]\d{1,2})\s+([+-]\d{2}:?\d{2})$/
  );
  if (m) {
    const offset = m[2].includes(':') ? m[2] : m[2].slice(0, 3) + ':' + m[2].slice(3);
    return new Date(`${m[1]}T00:00:00${offset}`).getTime();
  }
  return new Date(t).getTime();
}

/**
 * Compare two cell values based on detected type.
 */
function compareCells(a, b, type, direction) {
  let result;

  if (type === 'number') {
    const na = parseFloat(a) || 0;
    const nb = parseFloat(b) || 0;
    result = na - nb;
  } else if (type === 'date') {
    const da = parseDate(a) || 0;
    const db = parseDate(b) || 0;
    result = da - db;
  } else {
    result = a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
  }

  return direction === SORT_DESC ? -result : result;
}

/**
 * Initialise sort & filter on a single table.
 */
function enhanceTable(table) {
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');
  if (!thead || !tbody) return;

  const headers = thead.querySelectorAll('th');
  if (headers.length === 0) return;

  // --- Filter toggle button ---
  const wrapper = table.closest('.table-wrapper');
  if (wrapper) {
    wrapper.style.position = 'relative';
  }

  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.classList.add('table-filter-toggle');
  toggleBtn.setAttribute('aria-label', 'Toggle column filters');
  toggleBtn.title = 'Toggle filters';
  // Funnel / filter SVG icon
  toggleBtn.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>' +
    '</svg>';

  if (wrapper) {
    wrapper.insertBefore(toggleBtn, table);
  } else {
    table.parentNode.insertBefore(toggleBtn, table);
  }

  // --- Filter row (hidden by default) ---
  const filterRow = document.createElement('tr');
  filterRow.classList.add('table-filter-row');

  headers.forEach((_, colIdx) => {
    const td = document.createElement('td');
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Filter…';
    input.setAttribute('aria-label', `Filter column ${colIdx + 1}`);
    input.setAttribute('tabindex', '-1');
    input.addEventListener('input', () => applyFilters());
    td.appendChild(input);
    filterRow.appendChild(td);
  });

  thead.appendChild(filterRow);

  // Toggle filter row visibility
  toggleBtn.addEventListener('click', () => {
    const isVisible = filterRow.classList.toggle('visible');
    toggleBtn.classList.toggle('active', isVisible);

    if (isVisible) {
      // Focus the first filter input
      const firstInput = filterRow.querySelector('input');
      if (firstInput) {
        firstInput.setAttribute('tabindex', '0');
        firstInput.focus();
      }
      filterRow.querySelectorAll('input').forEach((inp) =>
        inp.setAttribute('tabindex', '0')
      );
    } else {
      // Clear all filters and hide
      filterRow.querySelectorAll('input').forEach((inp) => {
        inp.value = '';
        inp.setAttribute('tabindex', '-1');
      });
      applyFilters();
    }
  });

  // --- Sorting ---
  let currentSortCol = -1;
  let currentSortDir = null; // null | 'asc' | 'desc'

  // Save original row order so we can restore it on sort cancel
  const originalRows = Array.from(tbody.querySelectorAll('tr'));

  headers.forEach((th, colIdx) => {
    th.classList.add('sortable');
    th.setAttribute('role', 'button');
    th.setAttribute('tabindex', '0');
    th.setAttribute('aria-sort', 'none');

    const handleSort = () => sortByColumn(colIdx);
    th.addEventListener('click', handleSort);
    th.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleSort();
      }
    });
  });

  function getRows() {
    return Array.from(tbody.querySelectorAll('tr'));
  }

  function getCellText(row, colIdx) {
    const cell = row.children[colIdx];
    return cell ? cell.textContent : '';
  }

  /**
   * Apply all column filters, hiding non-matching rows.
   */
  function applyFilters() {
    const inputs = filterRow.querySelectorAll('input');
    const filters = Array.from(inputs).map((inp) => inp.value.toLowerCase());

    getRows().forEach((row) => {
      const match = filters.every((filterVal, colIdx) => {
        if (!filterVal) return true;
        return getCellText(row, colIdx).toLowerCase().includes(filterVal);
      });
      row.style.display = match ? '' : 'none';
    });

    reapplyStripes();
  }

  /**
   * Sort table rows by the given column index.
   * Cycle: none → asc → desc → none (reset to original order)
   */
  function sortByColumn(colIdx) {
    let dir;
    if (currentSortCol === colIdx) {
      // Same column clicked: asc → desc → null (cancel)
      if (currentSortDir === SORT_ASC) {
        dir = SORT_DESC;
      } else if (currentSortDir === SORT_DESC) {
        dir = null; // cancel sort
      } else {
        dir = SORT_ASC;
      }
    } else {
      dir = SORT_ASC;
    }

    currentSortCol = dir === null ? -1 : colIdx;
    currentSortDir = dir;

    // Update header aria & data attributes
    headers.forEach((th, i) => {
      if (dir !== null && i === colIdx) {
        th.setAttribute('aria-sort', dir === SORT_ASC ? 'ascending' : 'descending');
        th.dataset.sortDir = dir;
      } else {
        th.setAttribute('aria-sort', 'none');
        delete th.dataset.sortDir;
      }
    });

    let rows;

    if (dir === null) {
      // Restore original order
      rows = originalRows.slice();
    } else {
      // Detect type from visible cell values
      rows = getRows();
      const values = rows.map((r) => getCellText(r, colIdx));
      const type = detectColumnType(values);

      rows.sort((a, b) => {
        const va = getCellText(a, colIdx).trim();
        const vb = getCellText(b, colIdx).trim();
        return compareCells(va, vb, type, dir);
      });
    }

    // Re-attach in order
    rows.forEach((row) => tbody.appendChild(row));

    reapplyStripes();
  }

  /**
   * Re-apply zebra-stripe backgrounds to visible rows so they stay consistent
   * after filtering/sorting changes the visible order.
   */
  function reapplyStripes() {
    let visibleIdx = 0;
    getRows().forEach((row) => {
      if (row.style.display === 'none') return;
      row.classList.toggle('even-row', visibleIdx % 2 === 1);
      row.classList.toggle('odd-row', visibleIdx % 2 === 0);
      visibleIdx++;
    });
  }
}

/**
 * Public entry point — call once after DOM is ready.
 */
export function initTableEnhance() {
  const tables = document.querySelectorAll('table.table-enhanced');
  if (tables.length === 0) return;
  tables.forEach((table) => enhanceTable(table));
}
