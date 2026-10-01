import { cn } from "@/lib/utils";

// VoiceWorker wordmark, rendered as inline SVG text (no image assets required).
// Everything uses `currentColor`, so the lockup automatically takes whatever text
// color the surrounding context sets — light on dark panels (auth brand column,
// event banner, dark sidebar) and dark on light surfaces. `mark` renders just the
// square voice mark (app sidebar header); otherwise it renders the mark plus the
// "VoiceWorker" wordmark. Height is controlled by the caller via className (e.g.
// "h-7"); width stays auto so the lockup keeps its aspect ratio.
//
// The wordmark width is pinned with SVG `textLength` so the text can never clip,
// regardless of the font metrics on the platform rendering it.
export function BrandLogo({
  className,
  mark = false,
}: {
  className?: string;
  /** Kept for call-site compatibility; colour now comes from `currentColor`. */
  inverse?: boolean;
  mark?: boolean;
}) {
  if (mark) {
    return (
      <svg
        viewBox="0 0 44 44"
        role="img"
        aria-label="VoiceWorker"
        className={cn("w-auto select-none text-foreground", className)}
      >
        <VoiceMark />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 268 44"
      role="img"
      aria-label="VoiceWorker"
      className={cn("w-auto select-none text-foreground", className)}
    >
      <g transform="translate(2 2)">
        <VoiceMark />
      </g>
      <text
        x="54"
        y="31"
        fontSize="30"
        fontWeight={700}
        fontFamily="inherit"
        fill="currentColor"
        textLength="200"
        lengthAdjust="spacingAndGlyphs"
      >
        VoiceWorker
      </text>
    </svg>
  );
}

// A compact "voice" mark: a rounded square holding a short audio waveform. Drawn
// in a single colour (currentColor) so it reads cleanly at any size.
function VoiceMark() {
  return (
    <>
      <rect
        x="3"
        y="3"
        width="38"
        height="38"
        rx="10"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
      />
      <rect x="11" y="17" width="4.5" height="10" rx="2.25" fill="currentColor" />
      <rect x="19" y="11" width="4.5" height="22" rx="2.25" fill="currentColor" />
      <rect x="27" y="7" width="4.5" height="30" rx="2.25" fill="currentColor" />
      <rect x="35" y="16" width="4.5" height="12" rx="2.25" fill="currentColor" />
    </>
  );
}
