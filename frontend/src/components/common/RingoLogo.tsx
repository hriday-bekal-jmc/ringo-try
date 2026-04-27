interface Props {
  size?: number;
  color?: string;
  className?: string;
}

/**
 * RINGO logotype — circular apple ring with up-right directional arrow.
 * The shape is stroke-only (no fill) to work on any background.
 * Defaults to the brand coral-red; pass color="white" for dark backgrounds.
 */
export default function RingoLogo({ size = 48, color = '#E05540', className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* ── Main circle (apple body ring) ── */}
      <circle cx="45" cy="64" r="29" stroke={color} strokeWidth="6" strokeLinecap="round" />

      {/* ── Left apple bump ── */}
      <path
        d="M45 35 C41 25 27 27 29 38"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
      />

      {/* ── Right apple bump ── */}
      <path
        d="M45 35 C49 25 63 27 61 38"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
      />

      {/* ── Arrow shaft (diagonal upper-right) ── */}
      <line
        x1="65"
        y1="35"
        x2="85"
        y2="13"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
      />

      {/* ── Arrow L-head ── */}
      <path
        d="M75 13 L85 13 L85 24"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
