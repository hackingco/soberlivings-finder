'use client'

import { useState } from 'react'
import { Search, MapPin, X, Sliders, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
}

export default function ModernFacilitySearch({ 
  onSearch, 
  loading = false,
  className 
}: ModernFacilitySearchProps) {
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<SearchFilters>({
    location: '',
    radius: 25,
    services: [],
    acceptsInsurance: []
  })

  const handleSearch = () => {
    onSearch(query, { ...filters, location })
  }

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
    <div className={cn("w-full space-y-4", className)}>
      {/* Main search card */}
      <Card className="bg-white/90 backdrop-blur-sm shadow-medium border-0 overflow-hidden hover-lift card-glow-primary">
        <CardContent className="p-6">
          {/* Primary search bar */}
          <div className="flex flex-col lg:flex-row gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                placeholder="Search for treatment facilities, services, or programs..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-12 h-12 text-base border-gray-200 focus:border-primary focus:ring-primary/20 bg-gray-50 focus:bg-white transition-all duration-200"
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            
            <div className="lg:w-64 relative">
              <MapPin className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                placeholder="City, State or ZIP"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="pl-12 h-12 text-base border-gray-200 focus:border-primary focus:ring-primary/20 bg-gray-50 focus:bg-white transition-all duration-200"
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            
            <Button 
              onClick={handleSearch} 
              disabled={loading}
              className="h-12 px-8 btn-gradient text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200 hover-lift"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Searching...
                </div>
              ) : (
                <>
                  <Search className="h-5 w-5 mr-2" />
                  Search
                </>
              )}
            </Button>
          </div>

          {/* Quick location buttons */}
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-sm text-gray-600 font-medium mr-2">Quick locations:</span>
            {quickLocations.map((loc) => (
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