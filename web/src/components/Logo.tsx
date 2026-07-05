/**
 * Logo da marca: o ícone do app + wordmark com gradiente (Space Grotesk).
 */
export function Logo({ size = 32, withText = true }: { size?: number; withText?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <img
        src="/icon-192.png"
        width={size}
        height={size}
        alt="SIMPLE ArCh"
        className="rounded-lg brand-glow"
        style={{ width: size, height: size }}
      />
      {withText && (
        <span className="brand-text font-display text-lg font-bold tracking-tight">SIMPLE ArCh</span>
      )}
    </span>
  );
}
