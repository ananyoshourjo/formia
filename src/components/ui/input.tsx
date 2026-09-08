import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(function Input({ className, type, onChange, onBlur, value, ...props }, forwardedRef) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const pendingSelection = React.useRef<{ value: string; start: number | null; end: number | null } | null>(null)

  React.useImperativeHandle(forwardedRef, () => inputRef.current as HTMLInputElement)

  React.useLayoutEffect(() => {
    const pending = pendingSelection.current
    const input = inputRef.current
    if (!pending) return
    pendingSelection.current = null
    if (!input || document.activeElement !== input || typeof input.setSelectionRange !== "function") return

    const offset = input.value.length - pending.value.length
    const start = pending.start === null ? null : Math.max(0, Math.min(input.value.length, pending.start + offset))
    const end = pending.end === null ? null : Math.max(0, Math.min(input.value.length, pending.end + offset))
    if (start !== null && end !== null) input.setSelectionRange(start, end)
  }, [value])

  return (
    <input
      ref={inputRef}
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-[10px] border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      value={value}
      onChange={(event) => {
        pendingSelection.current = {
          value: event.currentTarget.value,
          start: event.currentTarget.selectionStart,
          end: event.currentTarget.selectionEnd,
        }
        onChange?.(event)
      }}
      onBlur={(event) => {
        pendingSelection.current = null
        onBlur?.(event)
      }}
      {...props}
    />
  )
})

export { Input }
