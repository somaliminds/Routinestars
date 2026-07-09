/**
 * TimeTimerWedge — the de-facto standard SEN-classroom visual countdown.
 *
 * Renders a circle in which a coloured wedge represents the time REMAINING.
 * The wedge starts at 12 o'clock and sweeps clockwise. As time elapses,
 * the wedge shrinks back toward 12 o'clock — exactly mirroring the
 * physical Time Timer device used in special-needs education globally.
 *
 * Visual conventions (matching StepCard's existing colour language):
 *   - Remaining wedge: red (#EF4444) — calm "this is your time"
 *   - Elapsed area:    soft pink (#FCE7F3) — non-alarming background
 *   - Overtime:        amber (#D97706) — informational, never red, so
 *                       running over isn't perceived as failure
 *
 * Props:
 *   progress:   0..1 — fraction of allocated time elapsed
 *   isOvertime: when true, switches palette to amber
 *   size:      diameter in dp (default 96)
 *
 * Built with react-native-svg's arc path so the wedge is a single
 * primitive rather than a stack of rotated rectangles — geometrically
 * stable at every angle.
 */
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

interface TimeTimerWedgeProps {
  progress: number;
  isOvertime?: boolean;
  size?: number;
}

const COLOR_REMAINING = '#EF4444';
const COLOR_ELAPSED = '#FCE7F3';
const COLOR_OVERTIME_REMAINING = '#D97706';
const COLOR_OVERTIME_ELAPSED = '#FEF3C7';
const COLOR_RING = '#FFFFFF';

/**
 * Build an SVG path for a circular sector (pie slice).
 *
 * Sector starts at the 12 o'clock position (angle 0°) and sweeps
 * CLOCKWISE by `sweepDegrees`. For a wedge representing TIME REMAINING,
 * the caller passes (1 - elapsedFraction) * 360 as sweepDegrees.
 *
 * Returns the SVG `d` attribute string. cx/cy/r are the centre and
 * radius of the parent circle.
 */
function sectorPath(cx: number, cy: number, r: number, sweepDegrees: number): string {
  // Clamp to avoid floating-point edge cases at 0 and 360 that produce
  // degenerate arcs (a 360° arc is identical to a 0° arc in SVG; both
  // collapse to no fill).
  const sweep = Math.max(0, Math.min(359.999, sweepDegrees));
  if (sweep <= 0) return '';

  // Convert clockwise-from-12 angle to standard SVG coords (which use
  // counter-clockwise from 3 o'clock, +x axis).
  const startAngle = -Math.PI / 2; // 12 o'clock
  const endAngle = startAngle + (sweep * Math.PI) / 180;

  const startX = cx + r * Math.cos(startAngle);
  const startY = cy + r * Math.sin(startAngle);
  const endX = cx + r * Math.cos(endAngle);
  const endY = cy + r * Math.sin(endAngle);

  const largeArc = sweep > 180 ? 1 : 0;

  return `M ${cx} ${cy} L ${startX} ${startY} A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY} Z`;
}

export function TimeTimerWedge({ progress, isOvertime = false, size = 96 }: TimeTimerWedgeProps) {
  const clamped = Math.max(0, Math.min(1, progress));
  const remainingDegrees = (1 - clamped) * 360;
  const remainingColor = isOvertime ? COLOR_OVERTIME_REMAINING : COLOR_REMAINING;
  const elapsedColor = isOvertime ? COLOR_OVERTIME_ELAPSED : COLOR_ELAPSED;

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 2; // 2px inset so the white outer ring is fully visible

  return (
    <View
      style={{ width: size, height: size }}
      accessibilityLabel={
        isOvertime
          ? 'Time is up — over by a little'
          : `${Math.round((remainingDegrees / 360) * 100)} percent of time remaining`
      }
      accessibilityRole="image"
    >
      <Svg width={size} height={size}>
        {/* Background circle — represents elapsed area */}
        <Circle cx={cx} cy={cy} r={r} fill={elapsedColor} />
        {/* Remaining-time wedge, drawn as a clockwise-from-12 sector */}
        {remainingDegrees > 0 && (
          <Path d={sectorPath(cx, cy, r, remainingDegrees)} fill={remainingColor} />
        )}
        {/* Thin outer ring for definition against the lavender background */}
        <Circle cx={cx} cy={cy} r={r} stroke={COLOR_RING} strokeWidth={2} fill="none" />
      </Svg>
    </View>
  );
}
