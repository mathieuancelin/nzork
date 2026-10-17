/** Returns a readable excerpt around the first difference between two strings, or null. */
export function firstDiff(a: string, b: string, context = 200): string | null {
  if (a === b) return null
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  const from = Math.max(0, i - context)
  return `at ${i}\n--- ours:\n${a.slice(from, i + context)}\n--- reference:\n${b.slice(from, i + context)}`
}
