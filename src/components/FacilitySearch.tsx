'use client'

import { useState } from 'react'
import { Search, MapPin, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'

interface SearchFilters {
  location: string
  radius: number
  services: string[]
  acceptsInsurance: string[]
}

interface FacilitySearchProps {
  onSearch: (query: string, filters: SearchFilters) => void
  loading?: boolean
}

export default function FacilitySearch({ onSearch, loading = false }: FacilitySearchProps) {
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

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Main search bar */}
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search for treatment facilities..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-10"
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="City, State or ZIP"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="pl-10 w-48"
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch} disabled={loading}>
              {loading ? 'Searching...' : 'Search'}
            </Button>
          </div>

          {/* Filter toggle */}
          <div className="flex justify-between items-center">
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              Advanced Filters
            </Button>
            
            {(filters.services.length > 0 || filters.acceptsInsurance.length > 0) && (
              <div className="text-sm text-muted-foreground">
                {filters.services.length + filters.acceptsInsurance.length} filters applied
              </div>
            )}
          </div>

          {/* Advanced filters */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-muted/50 rounded-lg">
              {/* Search radius */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Search Radius: {filters.radius} miles
                </label>
                <input
                  type="range"
                  min="5"
                  max="100"
                  value={filters.radius}
                  onChange={(e) => setFilters({ ...filters, radius: parseInt(e.target.value) })}
                  className="w-full"
                />
              </div>

              {/* Services */}
              <div>
                <label className="text-sm font-medium mb-2 block">Services</label>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {serviceOptions.map((service) => (
                    <label key={service} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={filters.services.includes(service)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFilters({ ...filters, services: [...filters.services, service] })
                          } else {
                            setFilters({ 
                              ...filters, 
                              services: filters.services.filter(s => s !== service) 
                            })
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{service}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Insurance */}
              <div>
                <label className="text-sm font-medium mb-2 block">Insurance Accepted</label>
                <div className="space-y-2">
                  {insuranceOptions.map((insurance) => (
                    <label key={insurance} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={filters.acceptsInsurance.includes(insurance)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFilters({ ...filters, acceptsInsurance: [...filters.acceptsInsurance, insurance] })
                          } else {
                            setFilters({ 
                              ...filters, 
                              acceptsInsurance: filters.acceptsInsurance.filter(i => i !== insurance) 
                            })
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{insurance}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Quick location buttons */}
              <div>
                <label className="text-sm font-medium mb-2 block">Quick Locations</label>
                <div className="flex flex-wrap gap-2">
                  {['Current Location', 'San Francisco, CA', 'Los Angeles, CA', 'Chicago, IL', 'New York, NY'].map((loc) => (
                    <Button
                      key={loc}
                      variant="outline"
                      size="sm"
                      onClick={() => setLocation(loc === 'Current Location' ? '' : loc)}
                    >
                      {loc}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}