/**
 * Fundo de marca: grade sutil + orbs de glow violeta/azul (Login, Workspaces).
 * Fica atrás do conteúdo (z-0). O container pai precisa de `position: relative`
 * e `overflow: hidden`.
 */
export function AppBackground() {
  return (
    <div className="app-grid pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="glow-orb anim-glow"
        style={{
          top: -180, left: -120, width: 520, height: 520,
          background: 'radial-gradient(circle, rgba(139,92,246,.30), transparent 70%)',
        }}
      />
      <div
        className="glow-orb anim-glow"
        style={{
          bottom: -200, right: -140, width: 600, height: 600, animationDelay: '1.5s',
          background: 'radial-gradient(circle, rgba(59,130,246,.26), transparent 70%)',
        }}
      />
    </div>
  );
}
