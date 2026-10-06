import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[88px] w-full rounded-xl max-lg:rounded-[14px] border border-slate-200 bg-white px-3.5 py-2.5 text-base lg:text-[14px] text-slate-900 placeholder:text-slate-400 transition focus-visible:outline-none focus-visible:border-teal-500 focus-visible:shadow-focus disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60",
        className
      )}
      ref={ref}
      {...props} />
  );
})
Textarea.displayName = "Textarea"

export { Textarea }
