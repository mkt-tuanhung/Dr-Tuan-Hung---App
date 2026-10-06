
import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-10 max-lg:h-[52px] w-full rounded-xl max-lg:rounded-[14px] border border-slate-200 bg-white px-3.5 py-2 text-[14px] text-slate-900 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-400 transition focus-visible:outline-none focus-visible:border-teal-500 focus-visible:shadow-focus disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60",
        className
      )}
      ref={ref}
      {...props} />
  );
})
Input.displayName = "Input"

export { Input }
