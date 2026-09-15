/**
 * Geometría del anillo de click: radios, halo y trazos.
 * Node-safe: solo primitivos y CanvasRenderingContext2D.
 */
export function paintClickRing(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const radius = Math.max(16, Math.min(width, height) * 0.025);

  ctx.beginPath();
  ctx.arc(x, y, radius * 1.9, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(220, 38, 38, 0.18)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(5, radius * 0.28);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(3, radius * 0.18);
  ctx.strokeStyle = '#dc2626';
  ctx.stroke();
}
