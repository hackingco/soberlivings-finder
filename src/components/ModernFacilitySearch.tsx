'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, MapPin, X, Sliders, ChevronDown, Bookmark, History, Filter, SortDesc } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LoadingSpinner } from '@/components/ui/loading'
import { cn } from '@/lib/utils'

interface SearchFilters {
  location: string
  radius: number
  services: string[]
  acceptsInsurance: string[]
}

interface ModernFacilitySearchProps {
  onSearch: (query: string, filters: SearchFilters) => void
  loading?: boolean
  className?: string
  recentSearches?: string[]
  onSaveSearch?: (query: string, filters: SearchFilters) => void
  savedSearches?: Array<{ name: string; query: string; filters: SearchFilters }>
}

export default function ModernFacilitySearch({ 
  onSearch, 
  loading = false,
  className,
  recentSearches = [],
  onSaveSearch,
  savedSearches = []
}: ModernFacilitySearchProps) {
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [showRecentSearches, setShowRecentSearches] = useState(false)
  const [showSavedSearches, setShowSavedSearches] = useState(false)
  const [filters, setFilters] = useState<SearchFilters>({
    location: '',
    radius: 25,
    services: [],
    acceptsInsurance: []
  })
  
  const searchInputRef = useRef<HTMLInputElement>(null)
  const locationInputRef = useRef<HTMLInputElement>(null)

  const handleSearch = () => {
    const searchFilters = { ...filters, location }
    onSearch(query, searchFilters)
    setShowRecentSearches(false)
    setShowSavedSearches(false)
  }
  
  const handleSaveSearch = () => {
    if (onSaveSearch && (query || location)) {
      const searchName = `${query || 'All facilities'} in ${location || 'Any location'}`
      onSaveSearch(searchName, { ...filters, location })
    }
  }
  
  const handleUseSavedSearch = (savedSearch: { name: string; query: string; filters: SearchFilters }) => {
    setQuery(savedSearch.query)
    setLocation(savedSearch.filters.location)
    setFilters(savedSearch.filters)
    setShowSavedSearches(false)
  }
  
  const handleUseRecentSearch = (recentQuery: string) => {
    setQuery(recentQuery)
    setShowRecentSearches(false)
    if (searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }
  
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
    }
    
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const serviceOptions = [
    'Residential Treatment',
    'Detoxification',
    'Outpatient',
    'Intensive Outpatient',
    'Sober Living',
    'Transitional Housing',
    'Mental Health Services',
    'Medication Assisted Treatment'
  ]

  const insuranceOptions = [
    'Medicare',
    'Medicaid',
    'Private Insurance',
    'Self-Pay',
    'Sliding Scale',
    'Payment Assistance'
  ]

  const quickLocations = [
    'Current Location',
    'San Francisco, CA',
    'Los Angeles, CA', 
    'Chicago, IL',
    'New York, NY',
    'Houston, TX'
  ]

  const toggleService = (service: string) => {
    setFilters(prev => ({
      ...prev,
      services: prev.services.includes(service)
        ? prev.services.filter(s => s !== service)
        : [...prev.services, service]
    }))
  }

  const toggleInsurance = (insurance: string) => {
    setFilters(prev => ({
      ...prev,
      acceptsInsurance: prev.acceptsInsurance.includes(insurance)
        ? prev.acceptsInsurance.filter(i => i !== insurance)
        : [...prev.acceptsInsurance, insurance]
    }))
  }

  const clearFilters = () => {
    setFilters({
      location: '',
      radius: 25,
      services: [],
      acceptsInsurance: []
    })
  }

  const activeFiltersCount = filters.services.length + filters.acceptsInsurance.length

  return (
    <div className={cn("w-full space-y-3 sm:space-y-4", className)}>
      {/* Main search card - Mobile Optimized */}
      <Card className="bg-white/90 backdrop-blur-sm shadow-medium border-0 overflow-hidden hover-lift card-glow-primary">
        <CardContent className="p-3 sm:p-4 lg:p-6">
          {/* Primary search bar - Mobile Responsive */}
          <div className="flex flex-col lg:flex-row gap-3 sm:gap-4 mb-3 sm:mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                ref={searchInputRef}
                placeholder="Search facilities, services..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setShowRecentSearches(recentSearches.length > 0)}
                onBlur={() => setTimeout(() => setShowRecentSearches(false), 200)}
                className="pl-10 sm:pl-12 pr-8 sm:pr-10 h-10 sm:h-12 text-sm sm:text-base border-gray-200 focus:border-primary focus:ring-primary/20 bg-gray-50 focus:bg-white transition-all duration-200"
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
              {query && (
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
            
            <div className="w-full lg:w-64 relative">
              <MapPin className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 h-4 sm:h-5 w-4 sm:w-5 text-gray-400" />
              <Input
                ref={locationInputRef}
                placeholder="City, State or ZIP"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="pl-10 sm:pl-12 h-10 sm:h-12 text-sm sm:text-base border-gray-200 focus:border-primary focus:ring-primary/20 bg-gray-50 focus:bg-white transition-all duration-200"
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            
            <div className="flex gap-2 w-full lg:w-auto">
              {onSaveSearch && (query || location) && (
                <Button
                  variant="outline"
                  onClick={handleSaveSearch}
                  className="h-10 sm:h-12 px-3 sm:px-4 border-gray-200 hover:border-primary hover:text-primary transition-all duration-200"
                  title="Save this search"
                >
                  <Bookmark className="h-3.5 sm:h-4 w-3.5 sm:w-4" />
                </Button>
              )}
              
              <Button 
                onClick={handleSearch} 
                loading={loading}
                variant="gradient"
                className="h-10 sm:h-12 px-4 sm:px-8 text-white text-sm sm:text-base font-medium shadow-lg hover:shadow-xl transition-all duration-200 hover-lift flex-1 lg:flex-none"
                leftIcon={!loading ? <Search className="h-4 sm:h-5 w-4 sm:w-5" /> : undefined}
              >
                {loading ? 'Searching...' : 'Search'}
              </Button>
            </div>
          </div>

          {/* Quick actions and saved searches */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-gray-600 font-medium mr-2">Quick locations:</span>
              {quickLocations.slice(0, 4).map((loc) => (
                <Button
                  key={loc}
                  variant="outline"
                  size="sm"
                  onClick={() => setLocation(loc === 'Current Location' ? '' : loc)}
                  className="text-xs h-8 text-gray-600 hover:text-primary hover:border-primary transition-colors"
                >
                  {loc}
                </Button>
              ))}
            </div>
            
            {savedSearches.length > 0 && (
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSavedSearches(!showSavedSearches)}
                  className="text-sm text-gray-600 hover:text-primary flex items-center gap-1"
                >
                  <Bookmark className="h-4 w-4" />
                  Saved ({savedSearches.length})
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
                            {saved.filters.acceptsInsurance.length > 0 && ` • ${saved.filters.acceptsInsurance.length} insurance types`}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Filters toggle */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 text-gray-600 hover:text-primary p-0 h-auto"
            >
              <Sliders className="h-4 w-4" />
              Advanced Filters
              <ChevronDown className={cn(
                "h-4 w-4 transition-transform duration-200",
                showFilters && "rotate-180"
              )} />
            </Button>
            
            <div className="flex items-center gap-3">
              {activeFiltersCount > 0 && (
                <>
                  <Badge variant="secondary" className="bg-primary/10 text-primary">
                    {activeFiltersCount} filter{activeFiltersCount !== 1 ? 's' : ''} applied
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
        <Card className="bg-white/90 backdrop-blur-sm shadow-medium border-0 animate-fade-in-up card-glow-primary">
          <CardContent className="p-6">
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

              <div className="grid md:grid-cols-2 gap-6">
                {/* Services */}
                <div>
                  <label className="text-sm font-semibold text-gray-900 mb-3 block">
                    Treatment Services
                  </label>
                  <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                    {serviceOptions.map((service) => (
                      <label key={service} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={filters.services.includes(service)}
                          onChange={() => toggleService(service)}
                          className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary/20 focus:ring-2"
                        />
                        <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">
                          {service}
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
                  <div className="space-y-2">
                    {insuranceOptions.map((insurance) => (
                      <label key={insurance} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={filters.acceptsInsurance.includes(insurance)}
                          onChange={() => toggleInsurance(insurance)}
                          className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary/20 focus:ring-2"
                        />
                        <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">
                          {insurance}
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
                  className="px-6"
                >
                  Apply Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}