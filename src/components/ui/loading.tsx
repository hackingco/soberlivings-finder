'use client'

import * as React from "react"
import { cn } from "@/lib/utils"

interface LoadingSpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg" | "xl"
  variant?: "default" | "primary" | "secondary"
}

const LoadingSpinner = React.forwardRef<HTMLDivElement, LoadingSpinnerProps>(
  ({ className, size = "md", variant = "default", ...props }, ref) => {
    const sizeClasses = {
      sm: "w-4 h-4 border-2",
      md: "w-6 h-6 border-2",
      lg: "w-8 h-8 border-3",
      xl: "w-12 h-12 border-4"
    }
    
    const variantClasses = {
      default: "border-gray-300 border-t-gray-600",
      primary: "border-primary/30 border-t-primary",
      secondary: "border-secondary/30 border-t-secondary"
    }
    
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-full animate-spin",
          sizeClasses[size],
          variantClasses[variant],
          className
        )}
        {...props}
      />
    )
  }
)
LoadingSpinner.displayName = "LoadingSpinner"

interface LoadingSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "text" | "circular" | "rectangular"
  width?: string | number
  height?: string | number
  animation?: "pulse" | "wave"
}

const LoadingSkeleton = React.forwardRef<HTMLDivElement, LoadingSkeletonProps>(
  ({ className, variant = "rectangular", width, height, animation = "pulse", ...props }, ref) => {
    const variantClasses = {
      text: "rounded",
      circular: "rounded-full",
      rectangular: "rounded-md"
    }
    
    const animationClasses = {
      pulse: "animate-pulse",
      wave: "animate-shimmer"
    }
    
    const style = {
      width: width || (variant === "circular" ? "40px" : "100%"),
      height: height || (variant === "text" ? "1em" : variant === "circular" ? "40px" : "20px")
    }
    
    return (
      <div
        ref={ref}
        className={cn(
          "bg-muted",
          variantClasses[variant],
          animationClasses[animation],
          className
        )}
        style={style}
        {...props}
      />
    )
  }
)
LoadingSkeleton.displayName = "LoadingSkeleton"

interface LoadingDotsProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg"
  color?: "default" | "primary" | "secondary"
}

const LoadingDots = React.forwardRef<HTMLDivElement, LoadingDotsProps>(
  ({ className, size = "md", color = "default", ...props }, ref) => {
    const sizeClasses = {
      sm: "w-1 h-1",
      md: "w-2 h-2", 
      lg: "w-3 h-3"
    }
    
    const colorClasses = {
      default: "bg-gray-400",
      primary: "bg-primary",
      secondary: "bg-secondary"
    }
    
    return (
      <div
        ref={ref}
        className={cn("flex items-center space-x-1", className)}
        {...props}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={cn(
              "rounded-full animate-bounce",
              sizeClasses[size],
              colorClasses[color]
            )}
            style={{
              animationDelay: `${i * 0.1}s`,
              animationDuration: "0.6s"
            }}
          />
        ))}
      </div>
    )
  }
)
LoadingDots.displayName = "LoadingDots"

export { LoadingSpinner, LoadingSkeleton, LoadingDots }
