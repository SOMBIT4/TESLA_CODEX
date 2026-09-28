export function formatPoysha(poysha: number): string {
  const taka = poysha / 100;

  return `৳${Number.isInteger(taka) ? taka : taka.toFixed(2)}`;
}
