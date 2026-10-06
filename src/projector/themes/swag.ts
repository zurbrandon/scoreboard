// A string hung in shallow scallops across the full width of the board (the
// Christmas lights, the Valentine's garland). One function gives both the
// string's path — for an svg with viewBox "0 0 100 10" stretched to `box` cqh
// tall — and where each item along it hangs, in % across and cqh down, so the
// items always sit on the string.

export function swag({ swags, top, sag, box, count }: { swags: number; top: number; sag: number; box: number; count: number }) {
  const sagAt = (x: number) => top + sag * Math.sin(Math.PI * ((x * swags) % 1))
  let path = ''
  for (let i = 0; i <= 200; i++) {
    const x = i / 200
    path += `${i ? 'L' : 'M'}${(x * 100).toFixed(2)} ${((sagAt(x) / box) * 10).toFixed(2)} `
  }
  const points = Array.from({ length: count }, (_, i) => {
    const x = (i + 0.5) / count
    return { x: x * 100, y: sagAt(x) }
  })
  return { path, points }
}
