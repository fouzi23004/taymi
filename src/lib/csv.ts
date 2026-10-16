/**
 * Build a CSV file and trigger a download.
 * French Excel expects ";" as separator, so it follows the UI language.
 */
export function downloadCSV(filename: string, header: string[], rows: (string | number)[][], lang: string) {
  const sep = lang.startsWith('fr') ? ';' : ','
  const escape = (v: string | number) => {
    const s = String(v ?? '')
    return /["\n\r;,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const body = [header, ...rows].map((r) => r.map(escape).join(sep)).join('\r\n')
  const blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
