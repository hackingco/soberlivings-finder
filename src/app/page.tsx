'use client'

import { useState, useEffect } from 'react'
import { 
  Search, 
  Database, 
  Sparkles, 
  MapPin, 
  Shield, 
  Heart,
  TrendingUp,
  CheckCircle,
  ArrowRight,
  Star
} from 'lucide-react'
import ModernFacilitySearch from '@/components/ModernFacilitySearch'
import ModernFacilityCard, { type Facility } from '@/components/ModernFacilityCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

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
      setStats({
        totalFacilities: 1247, // Demo data
        totalSearches: 5892,
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
        body: JSON.stringify({ location: '37.7749,-122.4194' })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        alert(`Successfully imported ${data.imported} facilities!`)
        loadStats()
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 bg-mesh-pattern opacity-50"></div>
      <div className="absolute top-20 left-10 w-72 h-72 bg-gradient-to-r from-blue-400/20 to-purple-600/20 rounded-full blur-3xl animate-float-gentle"></div>
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-gradient-to-r from-purple-400/20 to-green-600/20 rounded-full blur-3xl animate-float-gentle" style={{animationDelay: '2s'}}></div>
      {/* Modern Header */}
      <header className="bg-white/80 backdrop-blur-md shadow-soft border-b border-white/20 sticky top-0 z-50 relative">
        <div className="container-wide py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-gradient-to-br from-primary to-blue-600 rounded-2xl p-3 shadow-lg hover-glow transition-all duration-300 cursor-pointer">
                <Search className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-display font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                  SoberLiving Finder
                </h1>
                <p className="text-gray-600 font-medium">Find residential treatment facilities nationwide</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <Button
                onClick={handleImportData}
                disabled={importing}
                variant="outline"
                className="flex items-center gap-2 border-primary/20 text-primary hover:bg-primary/5 hover-lift transition-all duration-300 backdrop-blur-sm"
              >
                <Database className="h-4 w-4" />
                {importing ? 'Importing...' : 'Import Latest Data'}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container-wide py-16">
        <div className="text-center mb-12 space-y-6 relative z-10">
          <div className="animate-fade-in-up">
            <h2 className="text-5xl md:text-6xl font-display font-bold text-gray-900 leading-tight">
              Find Quality
              <span className="block text-gradient animate-shimmer bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 bg-clip-text text-transparent bg-[length:200%_100%]">Treatment Centers</span>
            </h2>
          </div>
          <p className="text-xl md:text-2xl text-gray-600 max-w-4xl mx-auto leading-relaxed">
            Search thousands of verified residential treatment facilities, sober living homes, 
            and recovery programs. Get detailed information, reviews, and contact details.
          </p>
          
          {/* Trust indicators */}
          <div className="flex items-center justify-center gap-8 mt-8">
            <div className="flex items-center gap-2 text-gray-600">
              <Shield className="h-5 w-5 text-green-600" />
              <span className="font-medium">Verified Facilities</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Sparkles className="h-5 w-5 text-purple-600" />
              <span className="font-medium">AI Enhanced</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <MapPin className="h-5 w-5 text-blue-600" />
              <span className="font-medium">50 States</span>
            </div>
          </div>
        </div>

        {/* Search Section */}
        <div className="max-w-6xl mx-auto mb-16 relative z-10">
          <div className="animate-fade-in-up" style={{animationDelay: '0.3s'}}>
            <ModernFacilitySearch onSearch={handleSearch} loading={loading} />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16 relative z-10">
          <Card className="bg-white/70 backdrop-blur-sm border-white/20 shadow-soft hover:shadow-medium transition-all duration-300 group hover-lift card-glow-primary animate-scale-in">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700">Total Facilities</CardTitle>
              <Database className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900 mb-1">
                {stats.totalFacilities.toLocaleString()}
              </div>
              <p className="text-sm text-gray-600 flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-green-600" />
                Verified treatment centers
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-white/70 backdrop-blur-sm border-white/20 shadow-soft hover:shadow-medium transition-all duration-300 group hover-lift card-glow-primary animate-scale-in" style={{animationDelay: '0.1s'}}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700">AI Enhanced</CardTitle>
              <Sparkles className="h-5 w-5 text-purple-600 group-hover:scale-110 transition-transform animate-pulse-slow" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900 mb-1">100%</div>
              <p className="text-sm text-gray-600 flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-600" />
                Facilities enriched with Firecrawl
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-white/70 backdrop-blur-sm border-white/20 shadow-soft hover:shadow-medium transition-all duration-300 group hover-lift card-glow-primary animate-scale-in" style={{animationDelay: '0.2s'}}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700">Successful Matches</CardTitle>
              <Heart className="h-5 w-5 text-red-500 group-hover:scale-110 transition-transform" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900 mb-1">
                {stats.totalSearches.toLocaleString()}
              </div>
              <p className="text-sm text-gray-600 flex items-center gap-1">
                <Star className="h-3 w-3 text-yellow-600" />
                People helped find treatment
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Results Section */}
      {searchPerformed && (
        <section className="container-wide pb-16 relative z-10">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-3xl font-display font-bold text-gray-900">
                Search Results
              </h3>
              {facilities.length > 0 && (
                <p className="text-gray-600 mt-1">
                  Found {facilities.length} treatment facilities
                </p>
              )}
            </div>
            
            {facilities.length > 0 && (
              <Badge variant="success" className="text-sm px-4 py-2">
                <CheckCircle className="h-4 w-4 mr-2" />
                {facilities.length} facilities found
              </Badge>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                    <div className="flex gap-2">
                      <Skeleton className="h-6 w-20" />
                      <Skeleton className="h-6 w-24" />
                    </div>
                    <div className="flex gap-2 pt-4">
                      <Skeleton className="h-10 flex-1" />
                      <Skeleton className="h-10 flex-1" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : facilities.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
              {facilities.map((facility) => (
                <ModernFacilityCard
                  key={facility.id}
                  facility={facility}
                  onViewDetails={handleViewDetails}
                  onGetDirections={handleGetDirections}
                />
              ))}
            </div>
          ) : (
            <Card className="bg-white/70 backdrop-blur-sm border-white/20 shadow-soft hover-lift">
              <CardContent className="text-center py-16">
                <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-6 shadow-soft">
                  <Search className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No facilities found</h3>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  Try adjusting your search criteria or importing new data to find treatment facilities.
                </p>
                <Button onClick={handleImportData} disabled={importing} className="btn-gradient text-white hover-lift">
                  <Database className="h-4 w-4 mr-2" />
                  Import Latest Data
                </Button>
              </CardContent>
            </Card>
          )}
        </section>
      )}

      {/* Getting Started Section */}
      {!searchPerformed && (
        <section className="container-wide pb-16 relative z-10">
          <Card className="bg-white/70 backdrop-blur-sm border-white/20 shadow-soft hover-lift card-glow-primary">
            <CardContent className="p-8">
              <h3 className="text-2xl font-display font-semibold mb-6 text-center text-gray-900">
                Getting Started
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="bg-primary/10 rounded-lg p-3 flex-shrink-0">
                      <Search className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">🔍 Search Facilities</h4>
                      <p className="text-gray-600 leading-relaxed">
                        Use the search bar above to find treatment facilities by name, location, or services offered.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <div className="bg-green-100 rounded-lg p-3 flex-shrink-0">
                      <Database className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">📊 Import Fresh Data</h4>
                      <p className="text-gray-600 leading-relaxed">
                        Click &quot;Import Latest Data&quot; to fetch the most recent facility information.
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="bg-purple-100 rounded-lg p-3 flex-shrink-0">
                      <Sparkles className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">🤖 AI Enhancement</h4>
                      <p className="text-gray-600 leading-relaxed">
                        Each facility is automatically enhanced with detailed information using advanced AI.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <div className="bg-blue-100 rounded-lg p-3 flex-shrink-0">
                      <MapPin className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">🗺️ Interactive Results</h4>
                      <p className="text-gray-600 leading-relaxed">
                        View detailed facility cards with contact info, services, and get directions instantly.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-8 text-center">
                <Button 
                  onClick={() => handleSearch('', { location: 'San Francisco, CA', radius: 25, services: [], acceptsInsurance: [] })}
                  className="btn-gradient text-white px-8 py-3 text-lg font-medium shadow-lg hover:shadow-xl transition-all duration-200 hover-lift relative overflow-hidden group"
                >
                  <span className="relative z-10">
                    Try a Sample Search
                    <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform duration-200" />
                  </span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Footer */}
      <footer className="bg-gradient-to-r from-gray-900 via-slate-900 to-gray-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-mesh-pattern opacity-10"></div>
        <div className="container-wide py-12 relative z-10">
          <div className="text-center">
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="bg-gradient-to-br from-primary to-blue-600 rounded-xl p-2 shadow-lg">
                <Search className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-2xl font-display font-bold">SoberLiving Finder</h3>
            </div>
            <p className="text-gray-300 max-w-2xl mx-auto leading-relaxed">
              Helping people find quality treatment facilities and sober living homes nationwide. 
              Your journey to recovery starts with finding the right support.
            </p>
            <div className="mt-6 flex items-center justify-center gap-6 text-sm text-gray-400">
              <span className="flex items-center gap-1">
                <Heart className="h-3 w-3 text-red-400" />
                Built with ❤️ for recovery
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-purple-400" />
                Powered by AI
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Shield className="h-3 w-3 text-green-400" />
                Available 24/7
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}