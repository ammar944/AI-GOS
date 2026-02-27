interface StreamingCursorProps {
  className?: string
}

export function StreamingCursor({ className }: StreamingCursorProps) {
  return (
    <span
      className={`streaming-cursor${className ? ` ${className}` : ''}`}
      aria-hidden="true"
    />
  )
}
