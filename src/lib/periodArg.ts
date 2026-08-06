function getPeriodArg(): string | null {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--period" || arg === "-p") return args[i + 1] ?? null;
    if (arg?.startsWith("--period=")) return arg.slice("--period=".length);
  }
  return null;
}

/** Resolves the target period (YYYYMM) from --period/-p, defaulting to the current month. */
export function resolvePeriod(): string {
  const periodArg = getPeriodArg();
  if (periodArg) {
    if (!/^\d{6}$/.test(periodArg)) {
      throw new Error(
        `Format --period harus YYYYMM, contoh: 202608 (diterima: "${periodArg}")`,
      );
    }
    return periodArg;
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}${month}`;
}
