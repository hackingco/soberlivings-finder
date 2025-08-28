/**
 * Progressive data loading utilities for large datasets
 * Implements virtual scrolling, lazy loading, and intelligent prefetching
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'

interface ProgressiveLoaderOptions<T> {
  pageSize: number
  prefetchPages?: number
  maxCachedPages?: number
  loadingDelay?: number
  enableVirtualScrolling?: boolean
  estimatedItemHeight?: number
  containerHeight?: number
}

interface LoadedPage<T> {
  pageIndex: number
  data: T[]
  loadedAt: number
  isLoading: boolean
  error?: Error
}

interface ProgressiveLoaderState<T> {
  pages: Map<number, LoadedPage<T>>
  totalItems: number
  isLoading: boolean
  error?: Error
  loadedItemCount: number
  visibleRange: { start: number; end: number }
}

/**
 * Hook for progressive data loading with virtual scrolling support
 */
export function useProgressiveLoader<T>(
  loadData: (page: number, pageSize: number) => Promise<{ data: T[]; total: number }>,
  options: ProgressiveLoaderOptions<T>
) {
  const {
    pageSize,
    prefetchPages = 2,
    maxCachedPages = 10,
    loadingDelay = 100,
    enableVirtualScrolling = false,
    estimatedItemHeight = 100,
    containerHeight = 600,
  } = options

  const [state, setState] = useState<ProgressiveLoaderState<T>>({
    pages: new Map(),
    totalItems: 0,
    isLoading: false,
    error: undefined,
    loadedItemCount: 0,
    visibleRange: { start: 0, end: 0 },
  })

  const loadingTimeouts = useRef<Map<number, NodeJS.Timeout>>(new Map())
  const abortControllers = useRef<Map<number, AbortController>>(new Map())

  // Load a specific page
  const loadPage = useCallback(async (pageIndex: number, immediate = false) => {
    // Cancel any existing timeout for this page
    const existingTimeout = loadingTimeouts.current.get(pageIndex)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
      loadingTimeouts.current.delete(pageIndex)
    }

    // Cancel any existing request for this page
    const existingController = abortControllers.current.get(pageIndex)
    if (existingController) {
      existingController.abort()
      abortControllers.current.delete(pageIndex)
    }

    const loadPageData = async () => {
      const controller = new AbortController()
      abortControllers.current.set(pageIndex, controller)

      setState(prev => ({
        ...prev,
        pages: new Map(prev.pages).set(pageIndex, {
          pageIndex,
          data: [],
          loadedAt: Date.now(),
          isLoading: true,
        }),
        isLoading: true,
      }))

      try {
        const result = await loadData(pageIndex, pageSize)
        
        if (controller.signal.aborted) return

        setState(prev => {
          const newPages = new Map(prev.pages)
          newPages.set(pageIndex, {
            pageIndex,
            data: result.data,
            loadedAt: Date.now(),
            isLoading: false,
          })

          // Clean up old pages if we exceed the cache limit
          if (newPages.size > maxCachedPages) {
            const sortedPages = Array.from(newPages.entries())
              .sort(([, a], [, b]) => a.loadedAt - b.loadedAt)
            
            // Remove oldest pages
            const pagesToRemove = sortedPages.slice(0, newPages.size - maxCachedPages)
            pagesToRemove.forEach(([pageKey]) => {
              newPages.delete(pageKey)
            })
          }

          return {
            ...prev,
            pages: newPages,
            totalItems: result.total,
            isLoading: Array.from(newPages.values()).some(p => p.isLoading),
            loadedItemCount: Array.from(newPages.values())
              .reduce((sum, p) => sum + p.data.length, 0),
          }
        })
      } catch (error) {
        if (controller.signal.aborted) return

        setState(prev => ({
          ...prev,
          pages: new Map(prev.pages).set(pageIndex, {
            pageIndex,
            data: [],
            loadedAt: Date.now(),
            isLoading: false,
            error: error instanceof Error ? error : new Error('Load failed'),
          }),
          isLoading: Array.from(prev.pages.values()).some(p => p.isLoading),
          error: error instanceof Error ? error : new Error('Load failed'),
        }))
      } finally {
        abortControllers.current.delete(pageIndex)
      }
    }

    if (immediate) {
      await loadPageData()
    } else {
      const timeout = setTimeout(loadPageData, loadingDelay)
      loadingTimeouts.current.set(pageIndex, timeout)
    }
  }, [loadData, pageSize, loadingDelay, maxCachedPages])

  // Load initial page
  useEffect(() => {
    loadPage(0, true)
  }, [loadPage])

  // Get flattened data for display
  const flatData = useMemo(() => {
    const sortedPages = Array.from(state.pages.entries())
      .sort(([a], [b]) => a - b)
    
    return sortedPages.reduce<T[]>((acc, [, page]) => {
      return acc.concat(page.data)
    }, [])
  }, [state.pages])

  // Virtual scrolling calculations
  const virtualScrollInfo = useMemo(() => {
    if (!enableVirtualScrolling) {
      return {
        visibleItems: flatData,
        startIndex: 0,
        endIndex: flatData.length - 1,
        totalHeight: flatData.length * estimatedItemHeight,
        offsetY: 0,
      }
    }

    const itemsPerPage = Math.ceil(containerHeight / estimatedItemHeight)
    const bufferSize = Math.max(1, Math.floor(itemsPerPage * 0.5))
    
    const startIndex = Math.max(0, state.visibleRange.start - bufferSize)
    const endIndex = Math.min(
      flatData.length - 1,
      state.visibleRange.end + bufferSize
    )
    
    const visibleItems = flatData.slice(startIndex, endIndex + 1)
    const totalHeight = state.totalItems * estimatedItemHeight
    const offsetY = startIndex * estimatedItemHeight

    return {
      visibleItems,
      startIndex,
      endIndex,
      totalHeight,
      offsetY,
    }
  }, [
    flatData,
    state.visibleRange,
    state.totalItems,
    enableVirtualScrolling,
    containerHeight,
    estimatedItemHeight,
  ])

  // Load more pages based on current visible range
  const loadVisiblePages = useCallback((scrollTop = 0) => {
    if (state.totalItems === 0) return

    let visibleStart = 0
    let visibleEnd = Math.ceil(containerHeight / estimatedItemHeight) - 1

    if (enableVirtualScrolling) {
      visibleStart = Math.floor(scrollTop / estimatedItemHeight)
      visibleEnd = visibleStart + Math.ceil(containerHeight / estimatedItemHeight)
    }

    // Update visible range
    setState(prev => ({
      ...prev,
      visibleRange: { start: visibleStart, end: visibleEnd },
    }))

    // Calculate which pages we need
    const startPage = Math.floor(visibleStart / pageSize)
    const endPage = Math.floor(visibleEnd / pageSize)

    // Load visible pages and prefetch
    const pagesToLoad = new Set<number>()
    
    // Add visible pages
    for (let page = startPage; page <= endPage; page++) {
      pagesToLoad.add(page)
    }
    
    // Add prefetch pages
    for (let i = 1; i <= prefetchPages; i++) {
      if (endPage + i < Math.ceil(state.totalItems / pageSize)) {
        pagesToLoad.add(endPage + i)
      }
    }

    // Load pages that aren't already loaded or loading
    pagesToLoad.forEach(pageIndex => {
      const page = state.pages.get(pageIndex)
      if (!page || (!page.isLoading && page.data.length === 0 && !page.error)) {
        loadPage(pageIndex)
      }
    })
  }, [
    state.totalItems,
    state.pages,
    containerHeight,
    estimatedItemHeight,
    enableVirtualScrolling,
    pageSize,
    prefetchPages,
    loadPage,
  ])

  // Handle scroll events for virtual scrolling
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    if (!enableVirtualScrolling) return
    
    const scrollTop = event.currentTarget.scrollTop
    loadVisiblePages(scrollTop)
  }, [enableVirtualScrolling, loadVisiblePages])

  // Load next page manually
  const loadNextPage = useCallback(() => {
    const maxLoadedPage = Math.max(-1, ...Array.from(state.pages.keys()))
    const nextPage = maxLoadedPage + 1
    const totalPages = Math.ceil(state.totalItems / pageSize)
    
    if (nextPage < totalPages) {
      loadPage(nextPage, true)
    }
  }, [state.pages, state.totalItems, pageSize, loadPage])

  // Reload a specific page
  const reloadPage = useCallback((pageIndex: number) => {
    setState(prev => {
      const newPages = new Map(prev.pages)
      newPages.delete(pageIndex)
      return { ...prev, pages: newPages }
    })
    loadPage(pageIndex, true)
  }, [loadPage])

  // Clear all data and reload from start
  const reset = useCallback(() => {
    // Cancel all pending timeouts and requests
    loadingTimeouts.current.forEach(timeout => clearTimeout(timeout))
    loadingTimeouts.current.clear()
    
    abortControllers.current.forEach(controller => controller.abort())
    abortControllers.current.clear()

    setState({
      pages: new Map(),
      totalItems: 0,
      isLoading: false,
      error: undefined,
      loadedItemCount: 0,
      visibleRange: { start: 0, end: 0 },
    })

    loadPage(0, true)
  }, [loadPage])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      loadingTimeouts.current.forEach(timeout => clearTimeout(timeout))
      abortControllers.current.forEach(controller => controller.abort())
    }
  }, [])

  return {
    // Data
    data: flatData,
    visibleData: virtualScrollInfo.visibleItems,
    totalItems: state.totalItems,
    loadedItems: state.loadedItemCount,
    
    // State
    isLoading: state.isLoading,
    error: state.error,
    hasMore: state.loadedItemCount < state.totalItems,
    
    // Virtual scrolling
    virtualScrollInfo,
    handleScroll,
    
    // Actions
    loadNextPage,
    reloadPage,
    reset,
    loadVisiblePages,
  }
}

/**
 * Component for virtual scrolling container
 */
interface VirtualScrollContainerProps {
  height: number
  totalHeight: number
  offsetY: number
  onScroll: (event: React.UIEvent<HTMLDivElement>) => void
  children: React.ReactNode
  className?: string
}

export function VirtualScrollContainer({
  height,
  totalHeight,
  offsetY,
  onScroll,
  children,
  className = '',
}: VirtualScrollContainerProps) {
  return (
    <div
      className={`overflow-auto ${className}`}
      style={{ height }}
      onScroll={onScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${offsetY}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

/**
 * Utility for batching API requests
 */
export class RequestBatcher<T, R> {
  private queue: Array<{
    params: T
    resolve: (result: R) => void
    reject: (error: Error) => void
  }> = []
  
  private timer?: NodeJS.Timeout
  private readonly batchSize: number
  private readonly delay: number
  private readonly batchProcessor: (batch: T[]) => Promise<R[]>

  constructor(
    batchProcessor: (batch: T[]) => Promise<R[]>,
    batchSize = 10,
    delay = 100
  ) {
    this.batchProcessor = batchProcessor
    this.batchSize = batchSize
    this.delay = delay
  }

  async add(params: T): Promise<R> {
    return new Promise((resolve, reject) => {
      this.queue.push({ params, resolve, reject })

      if (this.queue.length >= this.batchSize) {
        this.processBatch()
      } else {
        this.scheduleProcessing()
      }
    })
  }

  private scheduleProcessing() {
    if (this.timer) {
      clearTimeout(this.timer)
    }

    this.timer = setTimeout(() => {
      this.processBatch()
    }, this.delay)
  }

  private async processBatch() {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = undefined
    }

    const batch = this.queue.splice(0, this.batchSize)
    if (batch.length === 0) return

    try {
      const results = await this.batchProcessor(batch.map(item => item.params))
      
      batch.forEach((item, index) => {
        if (results[index] !== undefined) {
          item.resolve(results[index])
        } else {
          item.reject(new Error('No result for batch item'))
        }
      })
    } catch (error) {
      batch.forEach(item => {
        item.reject(error instanceof Error ? error : new Error('Batch processing failed'))
      })
    }
  }
}