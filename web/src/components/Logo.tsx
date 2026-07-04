/**
 * Logo da marca: o ícone do app + wordmark com gradiente. `size` controla o
 * ícone; o texto pode ser ocultado (só ícone) via `withText={false}`.
 */
export function Logo({ size = 28, withText = true }: { size?: number; withText?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <img
        src="/icon-192.png"
        width={size}
        height={size}
        alt="SIMPLE ArCh"
        className="rounded-lg"
        style={{ width: size, height: size }}
      />
      {withText && (
        <span className="brand-text text-lg font-bold tracking-tight">SIMPLE ArCh</span>
      )}
    </span>
  );
}
