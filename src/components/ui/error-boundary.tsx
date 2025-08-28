'use client'

import React, { Component, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorInfo?: React.ErrorInfo
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
  showErrorDetails?: boolean
}

/**
 * Enhanced Error Boundary with user-friendly fallback UI
 * and error reporting capabilities
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo
    })

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo)
    }

    // In production, you might want to send this to an error reporting service
    if (process.env.NODE_ENV === 'production') {
      // Example: Send to error reporting service
      this.reportError(error, errorInfo)
    }
  }

  private reportError = (error: Error, errorInfo: React.ErrorInfo) => {
    // This would typically send to a service like Sentry, LogRocket, etc.
    try {
      if (typeof window !== 'undefined' && 'fetch' in window) {
        fetch('/api/error-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href
          })
        }).catch(err => console.error('Failed to report error:', err))
      }
    } catch (reportingError) {
      console.error('Error reporting failed:', reportingError)
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined })
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleGoHome = () => {
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-lg">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto mb-4 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <CardTitle className="text-xl font-semibold text-gray-900">
                Something went wrong
              </CardTitle>
              <p className="text-sm text-gray-600 mt-2">
                We encountered an unexpected error. Please try again or contact support if the problem persists.
              </p>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Error details in development */}
              {this.props.showErrorDetails && process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                  <p className="text-xs font-mono text-red-800 break-all">
                    {this.state.error.message}
                  </p>
                  {this.state.error.stack && (
                    <details className="mt-2">
                      <summary className="text-xs text-red-600 cursor-pointer">
                        Stack trace
                      </summary>
                      <pre className="text-xs text-red-800 mt-1 whitespace-pre-wrap break-all">
                        {this.state.error.stack}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className="space-y-3">
                <Button 
                  onClick={this.handleRetry}
                  className="w-full"
                  variant="default"
                  leftIcon={<RefreshCw className="h-4 w-4" />}
                >
                  Try Again
                </Button>

                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    onClick={this.handleReload}
                    variant="outline"
                    size="sm"
                    leftIcon={<RefreshCw className="h-4 w-4" />}
                  >
                    Reload Page
                  </Button>

                  <Button 
                    onClick={this.handleGoHome}
                    variant="outline"
                    size="sm"
                    leftIcon={<Home className="h-4 w-4" />}
                  >
                    Go Home
                  </Button>
                </div>

                <Button 
                  onClick={() => {
                    const subject = encodeURIComponent('Error Report - Sober Livings Finder')
                    const body = encodeURIComponent(`
I encountered an error on the Sober Livings Finder website:

Error: ${this.state.error?.message || 'Unknown error'}
Time: ${new Date().toISOString()}
Page: ${window.location.href}

Please help me resolve this issue.
                    `.trim())
                    window.location.href = `mailto:support@example.com?subject=${subject}&body=${body}`
                  }}
                  variant="ghost"
                  size="sm"
                  className="w-full text-gray-600"
                  leftIcon={<Mail className="h-4 w-4" />}
                >
                  Contact Support
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Hook version of Error Boundary for functional components
 */
export function useErrorHandler() {
  return (error: Error, errorInfo?: React.ErrorInfo) => {
    if (process.env.NODE_ENV === 'development') {
      console.error('useErrorHandler caught error:', error, errorInfo)
    }
    
    // Could dispatch to a global error state or reporting service
    throw error // Re-throw to be caught by Error Boundary
  }
}

/**
 * Higher-order component for wrapping components with error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  )

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`
  
  return WrappedComponent
}

/**
 * Simple error fallback component for smaller UI elements
 */
export function ErrorFallback({ 
  error, 
  resetError,
  title = "Something went wrong",
  showDetails = false
}: {
  error?: Error
  resetError?: () => void
  title?: string
  showDetails?: boolean
}) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
      <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
      <h3 className="font-medium text-red-800 mb-1">{title}</h3>
      <p className="text-sm text-red-600 mb-3">
        {error?.message || "An unexpected error occurred"}
      </p>
      
      {showDetails && error?.stack && (
        <details className="mb-3 text-left">
          <summary className="text-xs text-red-600 cursor-pointer">
            Error details
          </summary>
          <pre className="text-xs text-red-700 mt-1 whitespace-pre-wrap break-all bg-red-100 p-2 rounded">
            {error.stack}
          </pre>
        </details>
      )}
      
      {resetError && (
        <Button 
          onClick={resetError}
          variant="outline"
          size="sm"
          className="text-red-700 border-red-300 hover:bg-red-100"
        >
          Try again
        </Button>
      )}
    </div>
  )
}