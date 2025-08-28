'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Search, MapPin, X, Sliders, ChevronDown, Bookmark, History, Filter, SortDesc, Loader2, AlertCircle, Zap, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LoadingSpinner } from '@/components/ui/loading'
import { ErrorBoundary, ErrorFallback } from '@/components/ui/error-boundary'
import { cn } from '@/lib/utils'
import { performanceMonitor } from '@/lib/performance-monitor'

interface SearchFilters {
  location: string
  radius: number
  services: string[]
  acceptsInsurance: string[]
  minRating?: number
  verifiedOnly?: boolean
  maxDistance?: number
}

interface EnhancedFacilitySearchProps {
  onSearch: (query: string, filters: SearchFilters) => Promise<void>
  loading?: boolean
  className?: string
  recentSearches?: string[]
  onSaveSearch?: (query: string, filters: SearchFilters) => void
  savedSearches?: Array<{ name: string; query: string; filters: SearchFilters }>
  showAdvancedFeatures?: boolean
  enableGeolocation?: boolean
  onLocationDetected?: (coords: { lat: number; lon: number }) => void
}

export default function EnhancedFacilitySearch({ 
  onSearch, 
  loading = false,
  className,
  recentSearches = [],
  onSaveSearch,
  savedSearches = [],
  showAdvancedFeatures = true,
  enableGeolocation = true,
  onLocationDetected
}: EnhancedFacilitySearchProps) {
  // State management
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [showRecentSearches, setShowRecentSearches] = useState(false)
  const [showSavedSearches, setShowSavedSearches] = useState(false)
  const [isDetectingLocation, setIsDetectingLocation] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [searchPerformance, setSearchPerformance] = useState<{
    lastSearchTime?: number
    avgSearchTime?: number
    searchCount?: number
  }>({})

  const [filters, setFilters] = useState<SearchFilters>({
    location: '',
    radius: 25,
    services: [],
    acceptsInsurance: [],
    minRating: undefined,
    verifiedOnly: false,
    maxDistance: undefined
  })
  
  // Refs for better UX
  const searchInputRef = useRef<HTMLInputElement>(null)
  const locationInputRef = useRef<HTMLInputElement>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  // Performance monitoring
  const measureRender = useMemo(() => {
    return performanceMonitor?.measureRender('EnhancedFacilitySearch')
  }, [])

  useEffect(() => {
    return measureRender?.()
  }, [measureRender])

  // Enhanced search handler with performance tracking
  const handleSearch = useCallback(async () => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    const startTime = Date.now()
    const searchFilters = { ...filters, location }
    
    try {
      await onSearch(query, searchFilters)
      
      const duration = Date.now() - startTime
      setSearchPerformance(prev => ({
        lastSearchTime: duration,
        searchCount: (prev.searchCount || 0) + 1,
        avgSearchTime: prev.avgSearchTime 
          ? (prev.avgSearchTime + duration) / 2 
          : duration
      }))
      
      performanceMonitor?.recordMetric('search.duration', duration, {
        hasQuery: (!!query).toString(),
        hasLocation: (!!location).toString(),
        filterCount: (filters.services.length + filters.acceptsInsurance.length).toString()
      })
      
      setShowRecentSearches(false)
      setShowSavedSearches(false)
    } catch (error) {
      console.error('Search failed:', error)
      performanceMonitor?.recordMetric('search.error', 1, {
        error: error instanceof Error ? error.message : 'unknown'
      })
    }
  }, [query, location, filters, onSearch])

  // Debounced search for real-time results
  const handleInputChange = useCallback((value: string) => {
    setQuery(value)
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    
    // Auto-search after 500ms of no typing (if we have enough context)
    if (value.length >= 3 || location.length >= 3) {
      searchTimeoutRef.current = setTimeout(handleSearch, 500)
    }
  }, [location, handleSearch])

  // Geolocation detection
  const detectLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation not supported')
      return
    }

    setIsDetectingLocation(true)
    setLocationError(null)

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        })
      })

      const { latitude, longitude } = position.coords
      
      // Reverse geocoding to get location name
      try {
        const response = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
        )
        const locationData = await response.json()
        const locationName = `${locationData.city}, ${locationData.principalSubdivision}`
        
        setLocation(locationName)
        onLocationDetected?.({ lat: latitude, lon: longitude })
      } catch (geocodeError) {
        console.warn('Geocoding failed, using coordinates:', geocodeError)
        setLocation(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`)
      }
      
      performanceMonitor?.recordMetric('location.detected', 1)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Location detection failed'
      setLocationError(errorMessage)
      performanceMonitor?.recordMetric('location.error', 1, {
        error: errorMessage
      })
    } finally {
      setIsDetectingLocation(false)
    }
  }, [onLocationDetected])
  
  const handleSaveSearch = useCallback(() => {
    if (onSaveSearch && (query || location)) {
      const searchName = `${query || 'All facilities'} in ${location || 'Any location'}`
      onSaveSearch(searchName, { ...filters, location })
      performanceMonitor?.recordMetric('search.saved', 1)
    }
  }, [query, location, filters, onSaveSearch])
  
  const handleUseSavedSearch = useCallback((savedSearch: { name: string; query: string; filters: SearchFilters }) => {
    setQuery(savedSearch.query)
    setLocation(savedSearch.filters.location)
    setFilters(savedSearch.filters)
    setShowSavedSearches(false)
    performanceMonitor?.recordMetric('search.loaded', 1)
  }, [])
  
  const handleUseRecentSearch = useCallback((recentQuery: string) => {
    setQuery(recentQuery)
    setShowRecentSearches(false)
    searchInputRef.current?.focus()
  }, [])
  
  // Enhanced keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowRecentSearches(false)
        setShowSavedSearches(false)
        setShowFilters(false)
      }
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        handleSearch()
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleSearch])

  // Enhanced service and insurance options
  const serviceOptions = [
    { id: 'residential', label: 'Residential Treatment', popular: true },
    { id: 'detox', label: 'Detoxification', popular: true },
    { id: 'outpatient', label: 'Outpatient', popular: true },
    { id: 'intensive', label: 'Intensive Outpatient', popular: false },
    { id: 'sober-living', label: 'Sober Living', popular: true },
    { id: 'transitional', label: 'Transitional Housing', popular: false },
    { id: 'mental-health', label: 'Mental Health Services', popular: true },
    { id: 'medication', label: 'Medication Assisted Treatment', popular: false },
    { id: 'holistic', label: 'Holistic Treatment', popular: false },
    { id: 'gender-specific', label: 'Gender-Specific Programs', popular: false }
  ]

  const insuranceOptions = [
    { id: 'medicare', label: 'Medicare', popular: true },
    { id: 'medicaid', label: 'Medicaid', popular: true },
    { id: 'private', label: 'Private Insurance', popular: true },
    { id: 'self-pay', label: 'Self-Pay', popular: false },
    { id: 'sliding-scale', label: 'Sliding Scale', popular: false },
    { id: 'payment-assistance', label: 'Payment Assistance', popular: false },
    { id: 'aetna', label: 'Aetna', popular: false },
    { id: 'blue-cross', label: 'Blue Cross Blue Shield', popular: false },
    { id: 'cigna', label: 'Cigna', popular: false },
    { id: 'united', label: 'United Healthcare', popular: false }
  ]

  const quickLocations = [
    'Current Location',
    'Los Angeles, CA',
    'New York, NY', 
    'Chicago, IL',
    'Houston, TX',
    'Phoenix, AZ',
    'Philadelphia, PA',
    'San Antonio, TX'
  ]

  const toggleService = useCallback((service: string) => {
    setFilters(prev => ({
      ...prev,
      services: prev.services.includes(service)
        ? prev.services.filter(s => s !== service)
        : [...prev.services, service]
    }))
  }, [])

  const toggleInsurance = useCallback((insurance: string) => {
    setFilters(prev => ({
      ...prev,
      acceptsInsurance: prev.acceptsInsurance.includes(insurance)
        ? prev.acceptsInsurance.filter(i => i !== insurance)
        : [...prev.acceptsInsurance, insurance]
    }))
  }, [])

  const clearFilters = useCallback(() => {
    setFilters({
      location: '',
      radius: 25,
      services: [],
      acceptsInsurance: [],
      minRating: undefined,
      verifiedOnly: false,
      maxDistance: undefined
    })
    performanceMonitor?.recordMetric('filters.cleared', 1)
  }, [])

  const activeFiltersCount = filters.services.length + 
    filters.acceptsInsurance.length + 
    (filters.minRating ? 1 : 0) + 
    (filters.verifiedOnly ? 1 : 0) + 
    (filters.maxDistance ? 1 : 0)

  return (
    <ErrorBoundary 
      fallback={<ErrorFallback title="Search component error" showDetails={process.env.NODE_ENV === 'development'} />}
    >
      <div className={cn("w-full space-y-4", className)}>
        {/* Main search card */}
        <Card className="bg-white/95 backdrop-blur-sm shadow-xl border-0 overflow-hidden hover:shadow-2xl transition-all duration-300 card-glow-primary">
          <CardContent className="p-4 sm:p-6">
            {/* Search performance indicator */}
            {showAdvancedFeatures && searchPerformance.lastSearchTime && (
              <div className="mb-3 flex items-center justify-between text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  Last search: {searchPerformance.lastSearchTime}ms
                </span>
                {searchPerformance.searchCount && searchPerformance.searchCount > 1 && (
                  <span>
                    Avg: {Math.round(searchPerformance.avgSearchTime || 0)}ms
                  </span>
                )}
              </div>
            )}

            {/* Primary search bar */}
            <div className="flex flex-col lg:flex-row gap-3 mb-4">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  ref={searchInputRef}
                  placeholder="Search facilities, services, or programs... (Ctrl+K)"
                  value={query}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onFocus={() => setShowRecentSearches(recentSearches.length > 0)}
                  onBlur={() => setTimeout(() => setShowRecentSearches(false), 200)}
                  className="pl-12 pr-10 h-12 text-base border-gray-200 focus:border-primary focus:ring-primary/20 bg-gray-50 focus:bg-white transition-all duration-200"
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  disabled={loading}
                />
                {query && !loading && (
                  <button
                    onClick={() => setQuery('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                
                {/* Recent searches dropdown */}
                {showRecentSearches && recentSearches.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-md shadow-lg z-50 mt-1">
                    <div className="p-2 border-b border-gray-100">
                      <p className="text-xs font-medium text-gray-500 flex items-center gap-1">
                        <History className="h-3 w-3" />
                        Recent Searches
                      </p>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {recentSearches.slice(0, 5).map((recent, index) => (
                        <button
                          key={index}
                          onClick={() => handleUseRecentSearch(recent)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors flex items-center gap-2"
                        >
                          <Search className="h-3 w-3 text-gray-400" />
                          {recent}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="lg:w-72 relative">
                <MapPin className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  ref={locationInputRef}
                  placeholder="City, State or ZIP"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="pl-12 pr-20 h-12 text-base border-gray-200 focus:border-primary focus:ring-primary/20 bg-gray-50 focus:bg-white transition-all duration-200"
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  disabled={loading || isDetectingLocation}
                />
                
                {/* Location detection button */}
                {enableGeolocation && (
                  <button
                    onClick={detectLocation}
                    disabled={isDetectingLocation || loading}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                    title="Detect current location"
                  >
                    {isDetectingLocation ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <MapPin className="h-4 w-4" />
                    )}
                  </button>
                )}
              </div>
              
              <div className="flex gap-2 flex-shrink-0">
                {onSaveSearch && (query || location) && (
                  <Button
                    variant="outline"
                    onClick={handleSaveSearch}
                    className="h-12 px-4 border-gray-200 hover:border-primary hover:text-primary transition-all duration-200"
                    title="Save this search"
                    disabled={loading}
                  >
                    <Bookmark className="h-4 w-4" />
                  </Button>
                )}
                
                <Button 
                  onClick={handleSearch} 
                  disabled={loading}
                  variant="gradient"
                  className="h-12 px-6 sm:px-8 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200 hover-lift"
                  leftIcon={loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                >
                  <span className="hidden sm:inline">{loading ? 'Searching...' : 'Search'}</span>
                  <span className="sm:hidden">{loading ? '...' : 'Go'}</span>
                </Button>
              </div>
            </div>

            {/* Location error display */}
            {locationError && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-yellow-800 font-medium">Location detection failed</p>
                  <p className="text-xs text-yellow-700 mt-1">{locationError}</p>
                </div>
                <button
                  onClick={() => setLocationError(null)}
                  className="text-yellow-600 hover:text-yellow-800 ml-auto"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Quick actions row */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              {/* Quick locations - responsive */}
              <div className="flex flex-wrap gap-2">
                <span className="text-sm text-gray-600 font-medium mr-2 hidden sm:inline">Quick:</span>
                {quickLocations.slice(0, window.innerWidth < 640 ? 3 : 5).map((loc) => (
                  <Button
                    key={loc}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (loc === 'Current Location') {
                        detectLocation()
                      } else {
                        setLocation(loc)
                      }
                    }}
                    className="text-xs h-8 text-gray-600 hover:text-primary hover:border-primary transition-colors"
                    disabled={loading || (loc === 'Current Location' && isDetectingLocation)}
                  >
                    {loc === 'Current Location' && isDetectingLocation ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : null}
                    {loc}
                  </Button>
                ))}
              </div>
              
              {/* Saved searches */}
              {savedSearches.length > 0 && (
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSavedSearches(!showSavedSearches)}
                    className="text-sm text-gray-600 hover:text-primary flex items-center gap-1"
                  >
                    <Bookmark className="h-4 w-4" />
                    <span className="hidden sm:inline">Saved ({savedSearches.length})</span>
                    <span className="sm:hidden">({savedSearches.length})</span>
                    <ChevronDown className={cn(
                      "h-3 w-3 transition-transform duration-200",
                      showSavedSearches && "rotate-180"
                    )} />
                  </Button>
                  
                  {showSavedSearches && (
                    <div className="absolute top-full right-0 bg-white border border-gray-200 rounded-md shadow-lg z-50 mt-1 min-w-64">
                      <div className="p-2 border-b border-gray-100">
                        <p className="text-xs font-medium text-gray-500">Saved Searches</p>
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {savedSearches.map((saved, index) => (
                          <button
                            key={index}
                            onClick={() => handleUseSavedSearch(saved)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
                          >
                            <div className="font-medium text-gray-900 truncate">{saved.name}</div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {saved.filters.services.length > 0 && `${saved.filters.services.length} services`}
                              {saved.filters.acceptsInsurance.length > 0 && ` • ${saved.filters.acceptsInsurance.length} insurance`}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Filters toggle and status */}
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 text-gray-600 hover:text-primary p-0 h-auto"
              >
                <Filter className="h-4 w-4" />
                <span className="hidden sm:inline">Advanced Filters</span>
                <span className="sm:hidden">Filters</span>
                <ChevronDown className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  showFilters && "rotate-180"
                )} />
              </Button>
              
              <div className="flex items-center gap-3">
                {activeFiltersCount > 0 && (
                  <>
                    <Badge variant="secondary" className="bg-primary/10 text-primary">
                      {activeFiltersCount} filter{activeFiltersCount !== 1 ? 's' : ''}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      className="text-gray-500 hover:text-gray-700 p-0 h-auto"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Clear
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Advanced filters */}
        {showFilters && (
          <Card className="bg-white/95 backdrop-blur-sm shadow-xl border-0 animate-fade-in-up card-glow-primary">
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-6">
                {/* Search radius */}
                <div>
                  <label className="text-sm font-semibold text-gray-900 mb-3 block">
                    Search Radius: {filters.radius} miles
                  </label>
                  <div className="relative">
                    <input
                      type="range"
                      min="5"
                      max="100"
                      value={filters.radius}
                      onChange={(e) => setFilters({ ...filters, radius: parseInt(e.target.value) })}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>5 mi</span>
                      <span>100 mi</span>
                    </div>
                  </div>
                </div>

                {/* Quality filters */}
                {showAdvancedFeatures && (
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div>
                      <label className="text-sm font-semibold text-gray-900 mb-3 block">
                        Quality Filters
                      </label>
                      <div className="space-y-3">
                        <label className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={filters.verifiedOnly}
                            onChange={(e) => setFilters({ ...filters, verifiedOnly: e.target.checked })}
                            className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary/20 focus:ring-2"
                          />
                          <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors flex items-center gap-1">
                            <Star className="h-3 w-3 text-yellow-500" />
                            Verified facilities only
                          </span>
                        </label>
                        
                        <div>
                          <label className="text-xs font-medium text-gray-700 mb-2 block">
                            Minimum Rating: {filters.minRating || 'Any'}
                          </label>
                          <input
                            type="range"
                            min="1"
                            max="5"
                            step="0.5"
                            value={filters.minRating || 1}
                            onChange={(e) => setFilters({ ...filters, minRating: parseFloat(e.target.value) })}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                          />
                          <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>1⭐</span>
                            <span>5⭐</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-gray-900 mb-3 block">
                        Distance Limit
                      </label>
                      <div>
                        <label className="text-xs font-medium text-gray-700 mb-2 block">
                          Max Distance: {filters.maxDistance || 'Any'} miles
                        </label>
                        <input
                          type="range"
                          min="1"
                          max="50"
                          value={filters.maxDistance || 50}
                          onChange={(e) => setFilters({ ...filters, maxDistance: parseInt(e.target.value) })}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>1 mi</span>
                          <span>50 mi</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Services and Insurance */}
                <div className="grid lg:grid-cols-2 gap-6">
                  {/* Services */}
                  <div>
                    <label className="text-sm font-semibold text-gray-900 mb-3 block">
                      Treatment Services
                    </label>
                    
                    {/* Popular services first */}
                    <div className="mb-3">
                      <p className="text-xs text-gray-500 mb-2">Popular</p>
                      <div className="flex flex-wrap gap-2">
                        {serviceOptions.filter(s => s.popular).map((service) => (
                          <Badge
                            key={service.id}
                            variant={filters.services.includes(service.id) ? "default" : "outline"}
                            className={cn(
                              "cursor-pointer transition-all duration-200",
                              filters.services.includes(service.id) 
                                ? "bg-primary text-white hover:bg-primary/90" 
                                : "hover:border-primary hover:text-primary"
                            )}
                            onClick={() => toggleService(service.id)}
                          >
                            {service.label}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* All services in a scrollable area */}
                    <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar">
                      {serviceOptions.filter(s => !s.popular).map((service) => (
                        <label key={service.id} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={filters.services.includes(service.id)}
                            onChange={() => toggleService(service.id)}
                            className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary/20 focus:ring-2"
                          />
                          <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">
                            {service.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Insurance */}
                  <div>
                    <label className="text-sm font-semibold text-gray-900 mb-3 block">
                      Insurance & Payment
                    </label>
                    
                    {/* Popular insurance first */}
                    <div className="mb-3">
                      <p className="text-xs text-gray-500 mb-2">Most Common</p>
                      <div className="flex flex-wrap gap-2">
                        {insuranceOptions.filter(i => i.popular).map((insurance) => (
                          <Badge
                            key={insurance.id}
                            variant={filters.acceptsInsurance.includes(insurance.id) ? "default" : "outline"}
                            className={cn(
                              "cursor-pointer transition-all duration-200",
                              filters.acceptsInsurance.includes(insurance.id) 
                                ? "bg-green-600 text-white hover:bg-green-700" 
                                : "hover:border-green-600 hover:text-green-600"
                            )}
                            onClick={() => toggleInsurance(insurance.id)}
                          >
                            {insurance.label}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar">
                      {insuranceOptions.filter(i => !i.popular).map((insurance) => (
                        <label key={insurance.id} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={filters.acceptsInsurance.includes(insurance.id)}
                            onChange={() => toggleInsurance(insurance.id)}
                            className="h-4 w-4 text-green-600 border-gray-300 rounded focus:ring-green-600/20 focus:ring-2"
                          />
                          <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">
                            {insurance.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Apply filters button */}
                <div className="flex justify-end pt-4 border-t border-gray-100">
                  <Button 
                    onClick={handleSearch}
                    disabled={loading}
                    className="px-6"
                    leftIcon={loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Filter className="h-4 w-4" />}
                  >
                    Apply Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </ErrorBoundary>
  )
}