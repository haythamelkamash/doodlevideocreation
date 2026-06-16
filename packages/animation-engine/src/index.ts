/**
 * Animation Engine
 * Handles hand-draw SVG path animation, timing sequencing, and playback.
 */

export type DrawEffect = 'pencil' | 'marker' | 'brush';
export type HandType = 'left' | 'right';
export type EasingType = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'spring';

export interface DrawAnimationOptions {
  svgElement: SVGElement;
  paths: SVGPathElement[];
  effect: DrawEffect;
  hand: HandType;
  duration: number; // ms per path segment
  easing: EasingType;
  onProgress?: (progress: number) => void;
  onComplete?: () => void;
}

// ─── Easing Functions ─────────────────────────────────────────────────────────

const easings: Record<EasingType, (t: number) => number> = {
  'linear': (t) => t,
  'ease-in': (t) => t * t * t,
  'ease-out': (t) => 1 - Math.pow(1 - t, 3),
  'ease-in-out': (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  'spring': (t) => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
};

// ─── Draw Effect Stroke Configs ───────────────────────────────────────────────

const effectStrokes: Record<DrawEffect, { strokeWidth: number; opacity: number; linecap: string }> = {
  pencil: { strokeWidth: 1.5, opacity: 0.85, linecap: 'round' },
  marker: { strokeWidth: 4, opacity: 0.95, linecap: 'square' },
  brush: { strokeWidth: 6, opacity: 0.75, linecap: 'round' },
};

// ─── Hand Offset (adds slight natural imperfection) ───────────────────────────

function applyHandNoise(x: number, y: number, hand: HandType, t: number): [number, number] {
  const jitter = hand === 'right' ? Math.sin(t * 47) * 0.3 : Math.cos(t * 43) * 0.3;
  return [x + jitter, y + jitter * 0.5];
}

// ─── Core Draw Animation ──────────────────────────────────────────────────────

export class DrawAnimation {
  private rafId: number | null = null;
  private startTime: number | null = null;
  private maskPaths: Map<SVGPathElement, SVGPathElement> = new Map();

  constructor(private options: DrawAnimationOptions) {}

  /**
   * Prepare clip masks for each path so we can reveal them progressively.
   */
  private setupMasks() {
    const { svgElement, paths, effect } = this.options;
    const ns = 'http://www.w3.org/2000/svg';

    const defs = svgElement.querySelector('defs') ?? svgElement.insertBefore(
      document.createElementNS(ns, 'defs'),
      svgElement.firstChild
    );

    const stroke = effectStrokes[effect];

    for (const path of paths) {
      const length = path.getTotalLength();
      const maskPath = path.cloneNode(true) as SVGPathElement;
      const maskId = `draw-mask-${Math.random().toString(36).slice(2)}`;

      const clipPath = document.createElementNS(ns, 'clipPath');
      clipPath.setAttribute('id', maskId);
      clipPath.appendChild(maskPath);
      defs.appendChild(clipPath);

      // Use stroke-dasharray trick for path reveal
      path.style.strokeDasharray = `${length}`;
      path.style.strokeDashoffset = `${length}`;
      path.style.strokeWidth = `${stroke.strokeWidth}`;
      path.style.opacity = `${stroke.opacity}`;
      path.style.strokeLinecap = stroke.linecap as string;
      path.style.transition = 'none';

      this.maskPaths.set(path, maskPath);
    }
  }

  play(): Promise<void> {
    return new Promise((resolve) => {
      this.setupMasks();
      const { paths, duration, easing, onProgress, onComplete } = this.options;
      const easeFn = easings[easing];
      const totalPaths = paths.length;
      const durationPerPath = duration / totalPaths;

      this.startTime = null;

      const animate = (timestamp: number) => {
        if (!this.startTime) this.startTime = timestamp;
        const elapsed = timestamp - this.startTime;
        const totalDuration = duration;
        const globalProgress = Math.min(elapsed / totalDuration, 1);

        for (let i = 0; i < paths.length; i++) {
          const path = paths[i];
          const pathStart = i / totalPaths;
          const pathEnd = (i + 1) / totalPaths;

          if (globalProgress < pathStart) {
            // not started yet
            const length = path.getTotalLength();
            path.style.strokeDashoffset = `${length}`;
          } else if (globalProgress >= pathEnd) {
            // completed
            path.style.strokeDashoffset = '0';
          } else {
            // in progress
            const pathProgress = (globalProgress - pathStart) / (pathEnd - pathStart);
            const easedProgress = easeFn(pathProgress);
            const length = path.getTotalLength();
            path.style.strokeDashoffset = `${length * (1 - easedProgress)}`;
          }
        }

        onProgress?.(globalProgress);

        if (globalProgress < 1) {
          this.rafId = requestAnimationFrame(animate);
        } else {
          onComplete?.();
          resolve();
        }
      };

      this.rafId = requestAnimationFrame(animate);
    });
  }

  stop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  reset() {
    this.stop();
    for (const path of this.options.paths) {
      const length = path.getTotalLength();
      path.style.strokeDashoffset = `${length}`;
    }
  }
}

// ─── Fade Animation ───────────────────────────────────────────────────────────

export function fadeIn(element: HTMLElement | SVGElement, duration: number, easing: EasingType = 'ease-in-out'): Promise<void> {
  return new Promise((resolve) => {
    const easeFn = easings[easing];
    let start: number | null = null;
    element.style.opacity = '0';

    const animate = (timestamp: number) => {
      if (!start) start = timestamp;
      const t = Math.min((timestamp - start) / duration, 1);
      element.style.opacity = `${easeFn(t)}`;
      if (t < 1) requestAnimationFrame(animate);
      else resolve();
    };

    requestAnimationFrame(animate);
  });
}

// ─── Slide Animation ──────────────────────────────────────────────────────────

export type SlideDirection = 'left' | 'right' | 'up' | 'down';

export function slideIn(
  element: HTMLElement | SVGElement,
  direction: SlideDirection,
  duration: number,
  easing: EasingType = 'ease-out'
): Promise<void> {
  const offsets: Record<SlideDirection, [string, string]> = {
    left: ['translateX(-60px)', 'translateX(0)'],
    right: ['translateX(60px)', 'translateX(0)'],
    up: ['translateY(-60px)', 'translateY(0)'],
    down: ['translateY(60px)', 'translateY(0)'],
  };

  const [from, to] = offsets[direction];
  const easeFn = easings[easing];
  let start: number | null = null;

  return new Promise((resolve) => {
    element.style.transform = from;
    element.style.opacity = '0';

    const animate = (timestamp: number) => {
      if (!start) start = timestamp;
      const t = Math.min((timestamp - start) / duration, 1);
      const et = easeFn(t);
      const dist = 60;
      const sign = direction === 'right' || direction === 'down' ? 1 : -1;
      const axis = direction === 'left' || direction === 'right' ? 'X' : 'Y';
      element.style.transform = `translate${axis}(${sign * dist * (1 - et)}px)`;
      element.style.opacity = `${et}`;
      if (t < 1) requestAnimationFrame(animate);
      else resolve();
    };

    requestAnimationFrame(animate);
  });
}

// ─── Zoom Animation ───────────────────────────────────────────────────────────

export function zoomIn(element: HTMLElement | SVGElement, duration: number, easing: EasingType = 'spring'): Promise<void> {
  const easeFn = easings[easing];
  let start: number | null = null;

  return new Promise((resolve) => {
    element.style.transform = 'scale(0.3)';
    element.style.opacity = '0';

    const animate = (timestamp: number) => {
      if (!start) start = timestamp;
      const t = Math.min((timestamp - start) / duration, 1);
      const et = easeFn(t);
      element.style.transform = `scale(${0.3 + et * 0.7})`;
      element.style.opacity = `${Math.min(et * 2, 1)}`;
      if (t < 1) requestAnimationFrame(animate);
      else resolve();
    };

    requestAnimationFrame(animate);
  });
}

// ─── Rotate Animation ─────────────────────────────────────────────────────────

export function rotateIn(element: HTMLElement | SVGElement, degrees: number, duration: number, easing: EasingType = 'ease-in-out'): Promise<void> {
  const easeFn = easings[easing];
  let start: number | null = null;

  return new Promise((resolve) => {
    element.style.transform = `rotate(${degrees}deg)`;
    element.style.opacity = '0';

    const animate = (timestamp: number) => {
      if (!start) start = timestamp;
      const t = Math.min((timestamp - start) / duration, 1);
      const et = easeFn(t);
      element.style.transform = `rotate(${degrees * (1 - et)}deg)`;
      element.style.opacity = `${et}`;
      if (t < 1) requestAnimationFrame(animate);
      else resolve();
    };

    requestAnimationFrame(animate);
  });
}

// ─── Sequencer ────────────────────────────────────────────────────────────────

export interface AnimationStep {
  elementId: string;
  element: HTMLElement | SVGElement;
  type: 'draw' | 'fade' | 'slide' | 'zoom' | 'rotate';
  startTime: number; // ms from sequence start
  duration: number;
  easing: EasingType;
  drawOptions?: Omit<DrawAnimationOptions, 'svgElement' | 'paths'> & { paths: SVGPathElement[] };
  slideDirection?: SlideDirection;
  rotateDegrees?: number;
}

export class AnimationSequencer {
  private rafId: number | null = null;
  private startTime: number | null = null;
  private completed = new Set<string>();

  constructor(private steps: AnimationStep[]) {}

  play(onProgress?: (time: number) => void): Promise<void> {
    return new Promise((resolve) => {
      const maxTime = Math.max(...this.steps.map((s) => s.startTime + s.duration));
      this.startTime = null;

      const tick = (timestamp: number) => {
        if (!this.startTime) this.startTime = timestamp;
        const elapsed = timestamp - this.startTime;

        for (const step of this.steps) {
          if (this.completed.has(step.elementId)) continue;
          if (elapsed < step.startTime) continue;
          this.completed.add(step.elementId);
          this.runStep(step);
        }

        onProgress?.(elapsed);

        if (elapsed < maxTime) {
          this.rafId = requestAnimationFrame(tick);
        } else {
          resolve();
        }
      };

      this.rafId = requestAnimationFrame(tick);
    });
  }

  private runStep(step: AnimationStep) {
    switch (step.type) {
      case 'fade':
        fadeIn(step.element, step.duration, step.easing);
        break;
      case 'slide':
        slideIn(step.element, step.slideDirection ?? 'left', step.duration, step.easing);
        break;
      case 'zoom':
        zoomIn(step.element, step.duration, step.easing);
        break;
      case 'rotate':
        rotateIn(step.element, step.rotateDegrees ?? 360, step.duration, step.easing);
        break;
    }
  }

  stop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  reset() {
    this.stop();
    this.completed.clear();
    this.startTime = null;
  }
}

// ─── SVG Path Extractor ───────────────────────────────────────────────────────

/**
 * Extract all <path> elements from an SVG string, sorted by a data-draw-order attribute.
 * Used to determine the order in which strokes should be drawn.
 */
export function extractAnimatablePaths(svgString: string): { d: string; drawOrder: number }[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const paths = Array.from(doc.querySelectorAll('path'));
  return paths
    .map((p, i) => ({
      d: p.getAttribute('d') ?? '',
      drawOrder: parseInt(p.getAttribute('data-draw-order') ?? `${i}`, 10),
    }))
    .sort((a, b) => a.drawOrder - b.drawOrder)
    .filter((p) => p.d);
}

// ─── Timing Calculator ────────────────────────────────────────────────────────

/**
 * Estimate draw duration for an SVG path based on its length.
 * ~100px per second at normal speed.
 */
export function estimateDrawDuration(pathLength: number, speed: number = 1): number {
  const BASE_SPEED_PX_PER_MS = 0.1; // 100px/s
  return pathLength / (BASE_SPEED_PX_PER_MS * speed);
}
