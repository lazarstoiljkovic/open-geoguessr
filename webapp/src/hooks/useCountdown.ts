import { useEffect, useState } from 'react';

// Both clients compute remaining time from the server's startedAt timestamp,
// so the display is always identical regardless of network jitter or local drift.
export default function useCountdown(totalSeconds: number, active: boolean, startedAt?: number | null): number {
  const compute = (total: number, start?: number | null) => {
    if (!start) return total;
    return Math.max(0, total - Math.floor((Date.now() - start) / 1000));
  };

  const [remaining, setRemaining] = useState(() => compute(totalSeconds, startedAt));

  // Reset immediately when a new round arrives
  useEffect(() => {
    setRemaining(compute(totalSeconds, startedAt));
  }, [totalSeconds, startedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tick every second by re-deriving from startedAt — never decrement blindly
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setRemaining(compute(totalSeconds, startedAt)), 1000);
    return () => clearInterval(id);
  }, [active, totalSeconds, startedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  return remaining;
}
