'use client'

import * as React from "react"
import { cn } from "@/lib/utils"

interface TouchFriendlyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  variant?: "primary" | "secondary" | "outline" | "ghost"
  size?: "sm" | "md" | "lg" | "xl"
  fullWidth?: boolean
}

export const TouchFriendlyButton = React.forwardRef<HTMLButtonElement, TouchFriendlyButtonProps>(
  ({ className, variant = "primary", size = "md", fullWidth = false, children, ...props }, ref) => {
    const variantClasses = {
      primary: "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80",
      secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 active:bg-secondary/70",
      outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground active:bg-accent/80",
      ghost: "hover:bg-accent hover:text-accent-foreground active:bg-accent/80"
    }
    
    const sizeClasses = {
      sm: "h-10 px-4 text-sm min-h-[44px]", // Meets touch target guidelines
      md: "h-12 px-6 text-base min-h-[48px]",
      lg: "h-14 px-8 text-lg min-h-[52px]",
      xl: "h-16 px-10 text-xl min-h-[56px]"
    }
    
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-lg font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          "touch-manipulation", // Optimizes touch events
          "active:scale-95 hover:scale-105", // Touch feedback
          variantClasses[variant],
          sizeClasses[size],
          fullWidth && "w-full",
          className
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)
TouchFriendlyButton.displayName = "TouchFriendlyButton"

interface SwipeCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  onTap?: () => void
  swipeThreshold?: number
}

export const SwipeCard = React.forwardRef<HTMLDivElement, SwipeCardProps>(
  ({ className, children, onSwipeLeft, onSwipeRight, onTap, swipeThreshold = 50, ...props }, ref) => {
    const [startX, setStartX] = React.useState(0)
    const [startY, setStartY] = React.useState(0)
    const [currentX, setCurrentX] = React.useState(0)
    const [isDragging, setIsDragging] = React.useState(false)
    const cardRef = React.useRef<HTMLDivElement>(null)
    
    const handleTouchStart = (e: React.TouchEvent) => {
      const touch = e.touches[0]
      setStartX(touch.clientX)
      setStartY(touch.clientY)
      setCurrentX(touch.clientX)
      setIsDragging(false)
    }
    
    const handleTouchMove = (e: React.TouchEvent) => {
      if (!startX) return
      
      const touch = e.touches[0]
      const diffX = touch.clientX - startX
      const diffY = touch.clientY - startY
      
      // Only trigger swipe for horizontal movement
      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 10) {
        setIsDragging(true)
        setCurrentX(touch.clientX)
        
        // Visual feedback during swipe
        if (cardRef.current) {
          cardRef.current.style.transform = `translateX(${diffX * 0.2}px) rotate(${diffX * 0.05}deg)`
          cardRef.current.style.opacity = `${1 - Math.abs(diffX) * 0.001}`
        }
      }
    }
    
    const handleTouchEnd = () => {
      if (!startX) return
      
      const diffX = currentX - startX
      
      if (Math.abs(diffX) > swipeThreshold) {
        if (diffX > 0 && onSwipeRight) {
          onSwipeRight()
        } else if (diffX < 0 && onSwipeLeft) {
          onSwipeLeft()
        }
      } else if (!isDragging && onTap) {
        onTap()
      }
      
      // Reset visual state
      if (cardRef.current) {
        cardRef.current.style.transform = 'translateX(0) rotate(0deg)'
        cardRef.current.style.opacity = '1'
      }
      
      setStartX(0)
      setStartY(0)
      setCurrentX(0)
      setIsDragging(false)
    }
    
    return (
      <div
        ref={cardRef}
        className={cn(
          "touch-manipulation transition-all duration-200 cursor-pointer",
          "select-none", // Prevents text selection during swipe
          className
        )}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        {...props}
      >
        {children}
      </div>
    )
  }
)
SwipeCard.displayName = "SwipeCard"

interface PullToRefreshProps {
  children: React.ReactNode
  onRefresh: () => Promise<void>
  refreshThreshold?: number
  className?: string
}

export function PullToRefresh({ 
  children, 
  onRefresh, 
  refreshThreshold = 80,
  className 
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = React.useState(0)
  const [isRefreshing, setIsRefreshing] = React.useState(false)
  const [startY, setStartY] = React.useState(0)
  const containerRef = React.useRef<HTMLDivElement>(null)
  
  const handleTouchStart = (e: React.TouchEvent) => {
    if (containerRef.current?.scrollTop === 0) {
      setStartY(e.touches[0].clientY)
    }
  }
  
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!startY || containerRef.current?.scrollTop !== 0) return
    
    const currentY = e.touches[0].clientY
    const distance = Math.max(0, currentY - startY)
    
    if (distance > 0) {
      e.preventDefault()
      setPullDistance(Math.min(distance, refreshThreshold * 1.5))
    }
  }
  
  const handleTouchEnd = async () => {
    if (pullDistance >= refreshThreshold && !isRefreshing) {
      setIsRefreshing(true)
      try {
        await onRefresh()
      } finally {
        setIsRefreshing(false)
      }
    }
    
    setPullDistance(0)
    setStartY(0)
  }
  
  const refreshProgress = Math.min(pullDistance / refreshThreshold, 1)
  
  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-auto", className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div 
        className="absolute top-0 left-0 right-0 flex items-center justify-center transition-all duration-200 z-10"
        style={{
          height: `${Math.min(pullDistance, refreshThreshold)}px`,
          opacity: refreshProgress
        }}
      >
        <div className="flex items-center gap-2 text-primary">
          <div 
            className={cn(
              "w-5 h-5 border-2 border-primary border-t-transparent rounded-full transition-transform duration-200",
              isRefreshing ? "animate-spin" : "",
              refreshProgress >= 1 ? "rotate-180" : ""
            )}
            style={{ transform: `rotate(${refreshProgress * 180}deg)` }}
          />
          <span className="text-sm font-medium">
            {isRefreshing ? "Refreshing..." : pullDistance >= refreshThreshold ? "Release to refresh" : "Pull to refresh"}
          </span>
        </div>
      </div>
      
      {/* Content */}
      <div 
        style={{ 
          transform: `translateY(${isRefreshing ? refreshThreshold : pullDistance}px)`,
          transition: isRefreshing ? 'transform 0.3s ease' : 'none'
        }}
      >
        {children}
      </div>
    </div>
  )
}
