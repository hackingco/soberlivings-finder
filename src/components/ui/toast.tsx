'use client'

import * as React from "react"
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react"
import { cn } from "@/lib/utils"

export interface ToastProps {
  id?: string
  title?: string
  description?: string
  variant?: "default" | "success" | "error" | "warning" | "info"
  duration?: number
  onClose?: () => void
  action?: React.ReactNode
  persistent?: boolean
}

const toastVariants = {
  default: {
    bg: "bg-background border border-border",
    icon: null,
    iconColor: ""
  },
  success: {
    bg: "bg-green-50 border border-green-200",
    icon: CheckCircle,
    iconColor: "text-green-600"
  },
  error: {
    bg: "bg-red-50 border border-red-200", 
    icon: AlertCircle,
    iconColor: "text-red-600"
  },
  warning: {
    bg: "bg-yellow-50 border border-yellow-200",
    icon: AlertTriangle,
    iconColor: "text-yellow-600"
  },
  info: {
    bg: "bg-blue-50 border border-blue-200",
    icon: Info,
    iconColor: "text-blue-600"
  }
}

const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  ({ title, description, variant = "default", onClose, action, persistent = false, ...props }, ref) => {
    const [isVisible, setIsVisible] = React.useState(true)
    const [isExiting, setIsExiting] = React.useState(false)
    
    const variantConfig = toastVariants[variant]
    const IconComponent = variantConfig.icon
    
    const handleClose = React.useCallback(() => {
      setIsExiting(true)
      setTimeout(() => {
        setIsVisible(false)
        onClose?.()
      }, 150)
    }, [onClose])
    
    React.useEffect(() => {
      if (!persistent) {
        const timer = setTimeout(handleClose, 5000)
        return () => clearTimeout(timer)
      }
    }, [persistent, handleClose])
    
    if (!isVisible) return null
    
    return (
      <div
        ref={ref}
        className={cn(
          "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md p-4 shadow-lg transition-all duration-300",
          variantConfig.bg,
          isExiting ? "animate-slide-out-right opacity-0" : "animate-slide-in-right",
          "hover:shadow-xl"
        )}
        {...props}
      >
        <div className="flex items-start space-x-3 flex-1">
          {IconComponent && (
            <IconComponent className={cn("h-5 w-5 mt-0.5 flex-shrink-0", variantConfig.iconColor)} />
          )}
          <div className="flex-1">
            {title && (
              <div className="text-sm font-semibold text-foreground">
                {title}
              </div>
            )}
            {description && (
              <div className="text-sm text-muted-foreground mt-1">
                {description}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {action}
          <button
            onClick={handleClose}
            className="opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none p-1 rounded-sm"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
        </div>
      </div>
    )
  }
)
Toast.displayName = "Toast"

// Toast Provider Context
interface ToastContextType {
  toast: (props: Omit<ToastProps, 'id'>) => string
  dismiss: (id: string) => void
  dismissAll: () => void
}

const ToastContext = React.createContext<ToastContextType | null>(null)

interface ToastProviderProps {
  children: React.ReactNode
  maxToasts?: number
}

export function ToastProvider({ children, maxToasts = 5 }: ToastProviderProps) {
  const [toasts, setToasts] = React.useState<(ToastProps & { id: string })[]>([])
  
  const toast = React.useCallback((props: Omit<ToastProps, 'id'>) => {
    const id = Math.random().toString(36).substring(2)
    
    setToasts(current => {
      const newToasts = [...current, { ...props, id }]
      return newToasts.slice(-maxToasts)
    })
    
    return id
  }, [maxToasts])
  
  const dismiss = React.useCallback((id: string) => {
    setToasts(current => current.filter(toast => toast.id !== id))
  }, [])
  
  const dismissAll = React.useCallback(() => {
    setToasts([])
  }, [])
  
  return (
    <ToastContext.Provider value={{ toast, dismiss, dismissAll }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex max-h-screen w-full flex-col-reverse space-y-4 space-y-reverse sm:bottom-auto sm:right-4 sm:top-4 sm:flex-col sm:space-y-4">
        {toasts.map((toastProps) => (
          <Toast
            key={toastProps.id}
            {...toastProps}
            onClose={() => dismiss(toastProps.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = React.useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

export { Toast }
