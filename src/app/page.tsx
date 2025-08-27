'use client'

import { useState, useEffect } from 'react'
import { MapPin, Search, Database, Sparkles } from 'lucide-react'
import FacilitySearch from '@/components/FacilitySearch'
import FacilityCard, { type Facility } from '@/components/FacilityCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface SearchFilters {
  location: string
  radius: number
  services: string[]
  acceptsInsurance: string[]
}

export default function HomePage() {
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [searchPerformed, setSearchPerformed] = useState(false)
  const [stats, setStats] = useState({
    totalFacilities: 0,
    totalSearches: 0,
    lastUpdate: null as string | null
  })

  // Load initial stats
  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      // This would be an API call to get database stats
      setStats({
        totalFacilities: 0,
        totalSearches: 0,
        lastUpdate: new Date().toISOString()
      })
    } catch (error) {
      console.error('Failed to load stats:', error)
    }
  }

  const handleSearch = async (query: string, filters: SearchFilters) => {
    setLoading(true)
    setSearchPerformed(true)
    
    try {
      const searchParams = new URLSearchParams({
        q: query,
        location: filters.location,
        radius: filters.radius.toString(),
        services: filters.services.join(','),
        insurance: filters.acceptsInsurance.join(',')
      })
      
      const response = await fetch(`/api/facilities/search?${searchParams}`)
      const data = await response.json()
      
      if (response.ok) {
        setFacilities(data.facilities || [])
      } else {
        console.error('Search failed:', data.error)
        setFacilities([])
      }
    } catch (error) {
      console.error('Search error:', error)
      setFacilities([])
    } finally {
      setLoading(false)
    }
  }

  const handleImportData = async () => {
    setImporting(true)
    
    try {
      const response = await fetch('/api/facilities/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: '37.7749,-122.4194' }) // SF coordinates
      })
      
      const data = await response.json()
      
      if (response.ok) {
        alert(`Successfully imported ${data.imported} facilities!`)
        loadStats() // Refresh stats
      } else {
        alert(`Import failed: ${data.error}`)
      }
    } catch (error) {
      console.error('Import error:', error)
      alert('Import failed. Please try again.')
    } finally {
      setImporting(false)
    }
  }

  const handleViewDetails = (facility: Facility) => {
    // Open facility details modal or navigate to details page
    window.open(`/facility/${facility.id}`, '_blank')
  }

  const handleGetDirections = (facility: Facility) => {
    if (facility.latitude && facility.longitude) {
      const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${facility.latitude},${facility.longitude}`
      window.open(mapsUrl, '_blank')
    } else if (facility.address) {
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(facility.address + ', ' + facility.city + ', ' + facility.state)}`
      window.open(mapsUrl, '_blank')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-600 rounded-lg p-2">
                <Search className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">SoberLiving Finder</h1>
                <p className="text-sm text-gray-600">Find residential treatment facilities nationwide</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <Button
                onClick={handleImportData}
                disabled={importing}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Database className="h-4 w-4" />
                {importing ? 'Importing...' : 'Import Latest Data'}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="text-center mb-8">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Find Quality Treatment Centers
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Search thousands of verified residential treatment facilities, sober living homes, 
            and recovery programs. Get detailed information, reviews, and contact details.
          </p>
        </div>

        {/* Search Section */}
        <div className="mb-8">
          <FacilitySearch onSearch={handleSearch} loading={loading} />
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Facilities</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalFacilities.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Verified treatment centers</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">AI Enhanced</CardTitle>
              <Sparkles className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">100%</div>
              <p className="text-xs text-muted-foreground">Facilities enriched with Firecrawl</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Coverage</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">50</div>
              <p className="text-xs text-muted-foreground">States covered</p>
            </CardContent>
          </Card>
        </div>

        {/* Results Section */}
        {searchPerformed && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900">
                Search Results
                {facilities.length > 0 && (
                  <span className="text-lg font-normal text-gray-600 ml-2">
                    ({facilities.length} facilities found)
                  </span>
                )}
              </h3>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Searching facilities...</p>
              </div>
            ) : facilities.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {facilities.map((facility) => (
                  <FacilityCard
                    key={facility.id}
                    facility={facility}
                    onViewDetails={handleViewDetails}
                    onGetDirections={handleGetDirections}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No facilities found</h3>
                <p className="text-gray-600 mb-4">
                  Try adjusting your search criteria or importing new data.
                </p>
                <Button onClick={handleImportData} disabled={importing}>
                  <Database className="h-4 w-4 mr-2" />
                  Import Latest Data
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Getting Started */}
        {!searchPerformed && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-xl font-semibold mb-4">Getting Started</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-2">🔍 Search Facilities</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Use the search bar above to find treatment facilities by name, location, or services offered.
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-2">📊 Import Fresh Data</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Click &quot;Import Latest Data&quot; to fetch the most recent facility information from FindTreatment.gov.
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-2">🤖 AI Enhancement</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Each facility is automatically enhanced with detailed information scraped from their websites using Firecrawl.
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-2">🗺️ Interactive Results</h4>
                <p className="text-sm text-gray-600 mb-3">
                  View detailed facility cards with contact info, services, ratings, and get directions with one click.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}