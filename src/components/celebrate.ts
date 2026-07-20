'use client';

import confetti from 'canvas-confetti';

export function celebrate() {
  confetti({ particleCount: 90, spread: 75, origin: { y: 0.7 } });
}

export function bigCelebrate() {
  const end = Date.now() + 1200;
  (function frame() {
    confetti({ particleCount: 6, angle: 60, spread: 55, origin: { x: 0 } });
    confetti({ particleCount: 6, angle: 120, spread: 55, origin: { x: 1 } });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}
