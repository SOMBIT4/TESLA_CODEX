export function formatPoysha(poysha: number): string {
  const taka = poysha / 100;

  return `৳${Number.isInteger(taka) ? taka : taka.toFixed(2)}`;
}

export function formatTaka(poysha: number): string {
  return `${(poysha / 100).toFixed(2)} Tk`;
}
