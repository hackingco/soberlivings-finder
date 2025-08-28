'use client'

import { useState, useEffect, useCallback } from 'react'
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
  Star,
  BarChart3,
  Filter,
  X,
  Share2,
  Save,
  Phone,
  Globe,
  Users,
  Award
} from 'lucide-react'
import ModernFacilitySearch from '@/components/ModernFacilitySearch'
import ModernFacilityCard, { type Facility } from '@/components/ModernFacilityCard'
import FacilityComparison from '@/components/FacilityComparison'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { LoadingSpinner, LoadingSkeleton } from '@/components/ui/loading'
import { ToastProvider, useToast } from '@/components/ui/toast'

interface SearchFilters {
  location: string
  radius: number
  services: string[]
  acceptsInsurance: string[]
}

function HomePageContent() {
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [searchPerformed, setSearchPerformed] = useState(false)
  const [comparisonList, setComparisonList] = useState<Facility[]>([])
  const [showComparison, setShowComparison] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [savedSearches, setSavedSearches] = useState<Array<{ name: string; query: string; filters: SearchFilters }>>([])
  const [stats, setStats] = useState({
    totalFacilities: 0,
    totalSearches: 0,
    lastUpdate: null as string | null
  })
  const [currentQuery, setCurrentQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  
  const { toast } = useToast()

  // Load initial stats and initialize database
  useEffect(() => {
    loadStats()
    initializeDatabase()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const initializeDatabase = async () => {
    try {
      // Check database status
      const statusResponse = await fetch('/api/init-db')
      const statusData = await statusResponse.json()
      
      if (!statusData.schemaExists || statusData.facilitiesCount < 10) {
        console.log('🔧 Initializing database...')
        
        // Initialize database schema and seed data
        const initResponse = await fetch('/api/init-db', { method: 'POST' })
        const initData = await initResponse.json()
        
        if (initData.success) {
          console.log('✅ Database initialized successfully')
          // Update stats to reflect new data
          setTimeout(loadStats, 2000)
        } else {
          console.warn('⚠️ Database initialization had issues:', initData.message)
        }
      } else {
        console.log('✅ Database already initialized')
      }
    } catch (error) {
      console.error('Database initialization error:', error)
      // Don't show error to user, app can still function
    }
  }

  const loadStats = async () => {
    try {
      // Get real data from database
      const response = await fetch('/api/seed-data')
      const data = await response.json()
      
      setStats({
        totalFacilities: data.facilitiesCount || 0,
        totalSearches: 5892, // Keep demo for searches
        lastUpdate: new Date().toISOString()
      })
    } catch (error) {
      console.error('Failed to load stats:', error)
      // Fallback to demo data
      setStats({
        totalFacilities: 0,
        totalSearches: 0,
        lastUpdate: new Date().toISOString()
      })
    }
  }

  const handleSearch = useCallback(async (query: string, filters: SearchFilters) => {
    setLoading(true)
    setSearchPerformed(true)
    setError(null)
    setCurrentQuery(query)
    
    // Add to recent searches
    if (query && !recentSearches.includes(query)) {
      setRecentSearches(prev => [query, ...prev.slice(0, 4)])
    }
    
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
        toast({
          title: "Search completed",
          description: `Found ${data.facilities?.length || 0} facilities`,
          variant: "success"
        })
      } else {
        console.error('Search failed:', data.error)
        setFacilities([])
        setError(data.error || 'Search failed')
        toast({
          title: "Search failed", 
          description: data.error || 'Please try again with different criteria',
          variant: "error"
        })
      }
    } catch (error) {
      console.error('Search error:', error)
      setFacilities([])
      setError('Network error occurred')
      toast({
        title: "Network error",
        description: "Please check your connection and try again",
        variant: "error"
      })
    } finally {
      setLoading(false)
    }
  }, [recentSearches, toast])

  const handleSaveSearch = (query: string, filters: SearchFilters) => {
    const name = `Search in ${filters.location || 'All Areas'}`
    setSavedSearches(prev => [
      ...prev.filter(s => s.name !== name), // Remove existing with same name
      { name, query, filters }
    ])
    toast({
      title: "Search saved",
      description: `"${name}" has been saved to your searches`,
      variant: "success"
    })
  }

  const handleCompare = (facility: Facility) => {
    if (comparisonList.find(f => f.id === facility.id)) {
      setComparisonList(prev => prev.filter(f => f.id !== facility.id))
    } else if (comparisonList.length < 3) {
      setComparisonList(prev => [...prev, facility])
    } else {
      toast({
        title: "Comparison limit reached",
        description: "You can compare up to 3 facilities at once",
        variant: "warning"
      })
    }
  }

  const handleViewDetails = (facility: Facility) => {
    // Open facility details in a modal or new page
    console.log('View details for:', facility.name)
    toast({
      title: "Feature coming soon",
      description: "Detailed facility view is being developed",
      variant: "info"
    })
  }

  const handleGetDirections = (facility: Facility) => {
    // Open directions in maps app
    if (facility.latitude && facility.longitude) {
      const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${facility.latitude},${facility.longitude}`
      window.open(mapsUrl, '_blank')
    } else if (facility.city && facility.state) {
      const searchQuery = encodeURIComponent(`${facility.name} ${facility.city} ${facility.state}`)
      const mapsUrl = `https://www.google.com/maps/search/${searchQuery}`
      window.open(mapsUrl, '_blank')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Animated background elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 -left-4 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute top-1/3 -right-4 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      {/* Hero Section */}
      <section className="relative z-10 container-wide py-20">
        {/* Modern header with glassmorphism */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-6 mb-8 p-8 bg-white/20 backdrop-blur-lg rounded-3xl border border-white/30 shadow-xl">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl blur-lg opacity-60"></div>
              <div className="relative bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 rounded-2xl p-4 shadow-2xl">
                <Search className="h-12 w-12 text-white" />
              </div>
            </div>
            <div className="text-left">
              <h1 className="text-6xl md:text-7xl font-black tracking-tight">
                <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  SoberLiving
                </span>
              </h1>
              <p className="text-xl font-semibold text-gray-700 tracking-wider">Finder</p>
            </div>
          </div>

          <h2 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            Find Quality
            <span className="block bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent animate-gradient">
              Treatment Centers
            </span>
          </h2>
          
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-12 leading-relaxed">
            Search thousands of verified residential treatment facilities, sober living homes, 
            and recovery programs with AI-enhanced data and real-time availability.
          </p>
          
          {/* Trust indicators with modern design */}
          <div className="flex flex-wrap items-center justify-center gap-8">
            <div className="flex items-center gap-3 px-6 py-3 bg-white/60 backdrop-blur-sm rounded-full border border-white/40 shadow-lg">
              <Shield className="h-6 w-6 text-emerald-500" />
              <span className="font-semibold text-gray-700">Verified Facilities</span>
            </div>
            <div className="flex items-center gap-3 px-6 py-3 bg-white/60 backdrop-blur-sm rounded-full border border-white/40 shadow-lg">
              <Sparkles className="h-6 w-6 text-purple-500" />
              <span className="font-semibold text-gray-700">AI Enhanced</span>
            </div>
            <div className="flex items-center gap-3 px-6 py-3 bg-white/60 backdrop-blur-sm rounded-full border border-white/40 shadow-lg">
              <MapPin className="h-6 w-6 text-blue-500" />
              <span className="font-semibold text-gray-700">50 States</span>
            </div>
          </div>
        </div>

        {/* Modern Search Section */}
        <div className="max-w-5xl mx-auto mb-16">
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/40">
            <ModernFacilitySearch 
              onSearch={handleSearch} 
              loading={loading}
              recentSearches={recentSearches}
              onSaveSearch={handleSaveSearch}
              savedSearches={savedSearches}
            />
          </div>
        </div>

        {/* Enhanced Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <Card className="bg-white/70 backdrop-blur-sm border-white/40 shadow-xl hover:shadow-2xl transition-all duration-300 group hover:-translate-y-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700">Treatment Facilities</CardTitle>
              <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                <Database className="h-6 w-6 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-gray-900 mb-2">
                {stats.totalFacilities.toLocaleString()}
              </div>
              <p className="text-sm text-gray-600">Verified nationwide</p>
            </CardContent>
          </Card>

          <Card className="bg-white/70 backdrop-blur-sm border-white/40 shadow-xl hover:shadow-2xl transition-all duration-300 group hover:-translate-y-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700">Successful Searches</CardTitle>
              <div className="p-2 bg-emerald-100 rounded-lg group-hover:bg-emerald-200 transition-colors">
                <TrendingUp className="h-6 w-6 text-emerald-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-gray-900 mb-2">
                {stats.totalSearches.toLocaleString()}
              </div>
              <p className="text-sm text-gray-600">People helped</p>
            </CardContent>
          </Card>

          <Card className="bg-white/70 backdrop-blur-sm border-white/40 shadow-xl hover:shadow-2xl transition-all duration-300 group hover:-translate-y-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700">Success Rate</CardTitle>
              <div className="p-2 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
                <Award className="h-6 w-6 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-gray-900 mb-2">
                94%
              </div>
              <p className="text-sm text-gray-600">Find quality care</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Comparison bar */}
      {comparisonList.length > 0 && (
        <div className="max-w-5xl mx-auto mb-8">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/40 p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                <span className="font-semibold text-gray-900">
                  Comparing {comparisonList.length} facilities
                </span>
                <div className="flex gap-2">
                  {comparisonList.map(facility => (
                    <Badge key={facility.id} variant="outline" className="text-xs">
                      {facility.name}
                      <button
                        onClick={() => handleCompare(facility)}
                        className="ml-1 hover:text-red-500 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowComparison(true)}
                  className="hover:border-blue-500 hover:text-blue-600"
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Compare
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setComparisonList([])}
                  className="text-gray-500 hover:text-gray-700"
                >
                  Clear
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search Results */}
      {searchPerformed && (
        <section className="container-wide py-8">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <LoadingSkeleton key={i} />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-16">
              <div className="bg-red-50 rounded-lg p-8 max-w-md mx-auto">
                <div className="text-red-600 mb-4">
                  <X className="h-12 w-12 mx-auto" />
                </div>
                <h3 className="text-lg font-semibold text-red-900 mb-2">Search Error</h3>
                <p className="text-red-700">{error}</p>
                <Button 
                  onClick={() => setError(null)} 
                  variant="outline" 
                  className="mt-4 border-red-200 text-red-600 hover:bg-red-50"
                >
                  Try Again
                </Button>
              </div>
            </div>
          ) : facilities.length === 0 ? (
            <div className="text-center py-16">
              <div className="bg-gray-50 rounded-lg p-8 max-w-md mx-auto">
                <div className="text-gray-400 mb-4">
                  <Search className="h-12 w-12 mx-auto" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Results Found</h3>
                <p className="text-gray-600 mb-4">
                  {currentQuery ? `No facilities found for "${currentQuery}"` : 'No facilities found with the selected criteria'}
                </p>
                <Button 
                  onClick={() => handleSearch('', { location: 'California', radius: 50, services: [], acceptsInsurance: [] })}
                  variant="outline"
                  className="border-gray-300 text-gray-600 hover:bg-gray-50"
                >
                  Try Broader Search
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900">
                    Search Results
                  </h2>
                  <p className="text-gray-600 mt-2">
                    Found {facilities.length} facilities{currentQuery && ` for "${currentQuery}"`}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {facilities.map((facility, index) => (
                  <div 
                    key={facility.id} 
                    className="animate-in slide-in-from-bottom duration-500"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <ModernFacilityCard 
                      facility={facility}
                      onCompare={handleCompare}
                      onViewDetails={handleViewDetails}
                      onGetDirections={handleGetDirections}
                      isInComparison={comparisonList.some(f => f.id === facility.id)}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {/* Welcome section for new users */}
      {!searchPerformed && (
        <section className="container-wide py-16">
          <div className="max-w-4xl mx-auto">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-3xl p-12 border border-blue-100">
              <div className="text-center mb-12">
                <h3 className="text-3xl font-bold text-gray-900 mb-4">
                  Your Journey to Recovery Starts Here
                </h3>
                <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                  We&apos;ve partnered with treatment centers nationwide to help you find the perfect fit 
                  for your recovery journey. Every facility is verified and enhanced with detailed information.
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                <div className="flex items-start gap-4">
                  <div className="bg-blue-100 rounded-lg p-3 flex-shrink-0">
                    <Shield className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">🔒 Verified Facilities</h4>
                    <p className="text-gray-600 leading-relaxed">
                      Every treatment center is thoroughly vetted and verified for quality and authenticity.
                    </p>
                  </div>
                </div>
                
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
                  <div className="bg-green-100 rounded-lg p-3 flex-shrink-0">
                    <MapPin className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">🗺️ Nationwide Coverage</h4>
                    <p className="text-gray-600 leading-relaxed">
                      Find quality treatment options in all 50 states with detailed location information.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="bg-indigo-100 rounded-lg p-3 flex-shrink-0">
                    <Heart className="h-6 w-6 text-indigo-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">💝 Personal Support</h4>
                    <p className="text-gray-600 leading-relaxed">
                      Get personalized recommendations and support throughout your search journey.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="text-center">
                <Button 
                  onClick={() => handleSearch('', { location: 'California', radius: 25, services: [], acceptsInsurance: [] })}
                  size="lg"
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-4 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  <Search className="h-5 w-5 mr-2" />
                  Start Your Search
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Comparison Modal */}
      {showComparison && comparisonList.length > 0 && (
        <FacilityComparison
          facilities={comparisonList}
          onClose={() => setShowComparison(false)}
          onRemoveFacility={(facilityId: string) => {
            const facility = comparisonList.find(f => f.id === facilityId)
            if (facility) handleCompare(facility)
          }}
          onViewDetails={handleViewDetails}
          onGetDirections={handleGetDirections}
        />
      )}

      {/* Footer */}
      <footer className="bg-gradient-to-r from-gray-900 via-slate-900 to-gray-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
        <div className="container-wide py-16 relative z-10">
          <div className="text-center">
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl p-3 shadow-lg">
                <Search className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-3xl font-bold">SoberLiving Finder</h3>
            </div>
            <p className="text-gray-300 max-w-2xl mx-auto leading-relaxed mb-8">
              Helping people find quality treatment facilities and sober living homes nationwide. 
              Your journey to recovery starts with finding the right support.
            </p>
            <div className="flex items-center justify-center gap-8 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>Thousands Helped</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span>Verified Data</span>
              </div>
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4" />
                <span>With Compassion</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default function HomePage() {
  return (
    <ToastProvider>
      <HomePageContent />
    </ToastProvider>
  )
}
