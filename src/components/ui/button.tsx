import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "gradient" | "wellness"
  size?: "default" | "sm" | "lg" | "icon" | "xl"
  loading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", loading = false, leftIcon, rightIcon, children, disabled, ...props }, ref) => {
    const isDisabled = disabled || loading
    
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover-lift active:scale-95",
          {
            "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow-md": variant === "default",
            "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm hover:shadow-md": variant === "destructive",
            "border border-input bg-background hover:bg-accent hover:text-accent-foreground shadow-sm hover:shadow-md": variant === "outline",
            "bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-sm hover:shadow-md": variant === "secondary",
            "hover:bg-accent hover:text-accent-foreground": variant === "ghost",
            "text-primary underline-offset-4 hover:underline": variant === "link",
            "bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl transform hover:scale-105": variant === "gradient",
            "bg-gradient-to-r from-green-500 to-teal-500 text-white hover:from-green-600 hover:to-teal-600 shadow-lg hover:shadow-xl transform hover:scale-105": variant === "wellness",
          },
          {
            "h-10 px-4 py-2 gap-2": size === "default",
            "h-9 rounded-md px-3 gap-1.5 text-xs": size === "sm",
            "h-11 rounded-md px-8 gap-2 text-base": size === "lg",
            "h-10 w-10": size === "icon",
            "h-12 rounded-lg px-10 gap-3 text-lg font-semibold": size === "xl",
          },
          className
        )}
        ref={ref}
        disabled={isDisabled}
        {...props}
      >
        {loading ? (
          <>
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            {children && <span>Loading...</span>}
          </>
        ) : (
          <>
            {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
          </>
        )}
      </button>
    )
  }
)
Button.displayName = "Button"

export { Button }