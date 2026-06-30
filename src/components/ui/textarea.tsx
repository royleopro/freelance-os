import * as React from "react"
import { cn } from "@/lib/utils"

function Textarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-24 w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0F0F0F] px-2.5 py-1 text-base text-white transition-colors outline-none placeholder:text-[#767676] focus-visible:border-brand-accent focus-visible:ring-3 focus-visible:ring-brand-accent/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-red-500 aria-invalid:ring-3 aria-invalid:ring-red-500/20 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
