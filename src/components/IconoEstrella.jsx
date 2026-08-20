/**
 * Estrella de cinco puntas — motivo recurrente del rediseño constructivista.
 * Usa `currentColor` para heredar el color del padre.
 */
export function IconoEstrella({ className = '', ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
      {...props}
    >
      <path d="M12 1.5l3.09 6.26 6.91 1-5 4.87 1.18 6.88L12 17.27l-6.18 3.24L7 13.63l-5-4.87 6.91-1z" />
    </svg>
  );
}
