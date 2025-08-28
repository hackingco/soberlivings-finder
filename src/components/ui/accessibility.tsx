'use client'

import * as React from "react"
import { cn } from "@/lib/utils"

interface SkipToContentProps {
  href?: string
  children?: React.ReactNode
}

export function SkipToContent({ href = "#main-content", children = "Skip to main content" }: SkipToContentProps) {
  return (
    <a
      href={href}
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 z-50 bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium transition-all duration-200 focus:ring-2 focus:ring-primary-foreground focus:ring-offset-2 focus:ring-offset-primary"
    >
      {children}
    </a>
  )
}

interface LiveRegionProps extends React.HTMLAttributes<HTMLDivElement> {
  politeness?: 'polite' | 'assertive' | 'off'
  atomic?: boolean
  relevant?: 'additions' | 'removals' | 'text' | 'all'
}

export const LiveRegion = React.forwardRef<HTMLDivElement, LiveRegionProps>(
  ({ className, politeness = 'polite', atomic = false, relevant = 'all', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("sr-only", className)}
        aria-live={politeness}
        aria-atomic={atomic}
        aria-relevant={relevant}
        {...props}
      />
    )
  }
)
LiveRegion.displayName = "LiveRegion"

interface ScreenReaderOnlyProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode
}

export function ScreenReaderOnly({ children, className, ...props }: ScreenReaderOnlyProps) {
  return (
    <span className={cn("sr-only", className)} {...props}>
      {children}
    </span>
  )
}

interface ProgressIndicatorProps {
  value: number
  max?: number
  label?: string
  description?: string
  variant?: 'default' | 'success' | 'warning' | 'error'
  showPercentage?: boolean
  className?: string
}

export function ProgressIndicator({
  value,
  max = 100,
  label,
  description,
  variant = 'default',
  showPercentage = true,
  className
}: ProgressIndicatorProps) {
  const percentage = Math.round((value / max) * 100)
  
  const variantClasses = {
    default: 'bg-primary',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500'
  }
  
  return (
    <div className={cn("w-full", className)}>
      {(label || showPercentage) && (
        <div className="flex justify-between items-center mb-2">
          {label && (
            <span className="text-sm font-medium text-gray-700">
              {label}
            </span>
          )}
          {showPercentage && (
            <span className="text-sm text-gray-500">
              {percentage}%
            </span>
          )}
        </div>
      )}
      
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className={cn(
            "h-full transition-all duration-300 ease-out rounded-full",
            variantClasses[variant]
          )}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-label={label}
          aria-describedby={description ? `progress-desc-${label}` : undefined}
        />
      </div>
      
      {description && (
        <p 
          id={`progress-desc-${label}`}
          className="text-xs text-gray-500 mt-1"
        >
          {description}
        </p>
      )}
    </div>
  )
}

interface FocusTrapProps {
  children: React.ReactNode
  enabled?: boolean
  restoreFocus?: boolean
}

export function FocusTrap({ children, enabled = true, restoreFocus = true }: FocusTrapProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const previouslyFocusedElement = React.useRef<HTMLElement | null>(null)
  
  React.useEffect(() => {
    if (!enabled) return
    
    previouslyFocusedElement.current = document.activeElement as HTMLElement
    
    const focusableElements = containerRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    
    if (!focusableElements || focusableElements.length === 0) return
    
    const firstElement = focusableElements[0] as HTMLElement
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement
    
    firstElement.focus()
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement.focus()
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement.focus()
        }
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      
      if (restoreFocus && previouslyFocusedElement.current) {
        previouslyFocusedElement.current.focus()
      }
    }
  }, [enabled, restoreFocus])
  
  return <div ref={containerRef}>{children}</div>
}

interface KeyboardShortcutsProps {
  shortcuts: Array<{
    key: string
    description: string
    action: () => void
    combo?: string[]
  }>
  enabled?: boolean
}

export function KeyboardShortcuts({ shortcuts, enabled = true }: KeyboardShortcutsProps) {
  React.useEffect(() => {
    if (!enabled) return
    
    const handleKeyDown = (e: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const combo = shortcut.combo || [shortcut.key]
        const isMatch = combo.every(key => {
          switch (key.toLowerCase()) {
            case 'ctrl':
            case 'control':
              return e.ctrlKey
            case 'shift':
              return e.shiftKey
            case 'alt':
              return e.altKey
            case 'meta':
            case 'cmd':
              return e.metaKey
            default:
              return e.key.toLowerCase() === key.toLowerCase()
          }
        })
        
        if (isMatch) {
          e.preventDefault()
          shortcut.action()
          break
        }
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [shortcuts, enabled])
  
  return null
}

interface HighContrastModeProps {
  children: React.ReactNode
}

export function HighContrastMode({ children }: HighContrastModeProps) {
  const [highContrast, setHighContrast] = React.useState(false)
  
  React.useEffect(() => {
    // Check for user preference
    const preferHighContrast = window.matchMedia('(prefers-contrast: high)').matches
    setHighContrast(preferHighContrast)
    
    // Listen for changes
    const mediaQuery = window.matchMedia('(prefers-contrast: high)')
    const handleChange = (e: MediaQueryListEvent) => setHighContrast(e.matches)
    
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])
  
  return (
    <div className={cn(highContrast && "high-contrast")}>
      {children}
    </div>
  )
}

interface ReducedMotionProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function ReducedMotion({ children, fallback }: ReducedMotionProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false)
  
  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)
    
    const handleChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])
  
  return prefersReducedMotion && fallback ? fallback : children
}

export { cn }
