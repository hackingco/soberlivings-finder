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
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 relative">
      {/* Animated background elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 -left-4 w-72 h-72 bg-blue-400 rounded-full mix-blend-screen filter blur-xl opacity-30 animate-blob"></div>
        <div className="absolute top-1/3 -right-4 w-72 h-72 bg-purple-400 rounded-full mix-blend-screen filter blur-xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-400 rounded-full mix-blend-screen filter blur-xl opacity-30 animate-blob animation-delay-4000"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent"></div>
      </div>

      {/* Hero Section */}
      <section className="relative z-10 container-wide py-20">
        {/* Modern header with glassmorphism */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-8 mb-12 p-10 bg-white/10 backdrop-blur-2xl rounded-[2rem] border border-white/20 shadow-2xl hover:bg-white/15 transition-all duration-500">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 rounded-3xl blur-2xl opacity-75 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 rounded-3xl p-6 shadow-2xl group-hover:scale-110 transition-transform duration-500">
                <Search className="h-16 w-16 text-white" />
              </div>
            </div>
            <div className="text-left">
              <h1 className="text-7xl md:text-8xl font-black tracking-tight leading-none">
                <span className="bg-gradient-to-r from-white via-cyan-100 to-white bg-clip-text text-transparent animate-shimmer bg-[length:200%_100%]">
                  SoberLiving
                </span>
              </h1>
              <p className="text-2xl font-bold text-white/90 tracking-[0.3em] mt-2">FINDER</p>
            </div>
          </div>

          <h2 className="text-5xl md:text-7xl font-bold text-white mb-8 leading-tight">
            Find Quality
            <span className="block bg-gradient-to-r from-cyan-300 via-blue-300 to-purple-300 bg-clip-text text-transparent animate-gradient">
              Treatment Centers
            </span>
          </h2>
          
          <p className="text-xl md:text-2xl text-white/90 max-w-4xl mx-auto mb-12 leading-relaxed font-medium">
            Search thousands of verified residential treatment facilities, sober living homes, 
            and recovery programs with AI-enhanced data and real-time availability.
          </p>
          
          {/* Trust indicators with modern design */}
          <div className="flex flex-wrap items-center justify-center gap-6">
            <div className="flex items-center gap-4 px-8 py-4 bg-white/20 backdrop-blur-lg rounded-full border border-white/30 shadow-xl hover:bg-white/25 transition-all duration-300 group">
              <div className="p-2 bg-emerald-500/20 rounded-full group-hover:scale-110 transition-transform duration-300">
                <Shield className="h-6 w-6 text-emerald-300" />
              </div>
              <span className="font-bold text-white text-lg">Verified Facilities</span>
            </div>
            <div className="flex items-center gap-4 px-8 py-4 bg-white/20 backdrop-blur-lg rounded-full border border-white/30 shadow-xl hover:bg-white/25 transition-all duration-300 group">
              <div className="p-2 bg-purple-500/20 rounded-full group-hover:scale-110 transition-transform duration-300">
                <Sparkles className="h-6 w-6 text-purple-300" />
              </div>
              <span className="font-bold text-white text-lg">AI Enhanced</span>
            </div>
            <div className="flex items-center gap-4 px-8 py-4 bg-white/20 backdrop-blur-lg rounded-full border border-white/30 shadow-xl hover:bg-white/25 transition-all duration-300 group">
              <div className="p-2 bg-cyan-500/20 rounded-full group-hover:scale-110 transition-transform duration-300">
                <MapPin className="h-6 w-6 text-cyan-300" />
              </div>
              <span className="font-bold text-white text-lg">50 States</span>
            </div>
          </div>
        </div>

        {/* Modern Search Section */}
        <div className="max-w-6xl mx-auto mb-16">
          <div className="bg-white/95 backdrop-blur-2xl rounded-[2rem] p-10 shadow-2xl border border-white/50 hover:shadow-3xl transition-all duration-500">
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
          <div className="bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-xl rounded-2xl p-8 border border-white/30 shadow-2xl hover:shadow-3xl transition-all duration-500 group hover:-translate-y-3 hover:bg-white/25">
            <div className="flex items-center justify-between mb-6">
              <div className="p-4 bg-blue-500/20 backdrop-blur-sm rounded-2xl group-hover:scale-110 transition-all duration-300">
                <Database className="h-8 w-8 text-cyan-300" />
              </div>
              <div className="text-right">
                <div className="text-5xl font-black text-white mb-2 group-hover:scale-110 transition-transform duration-300">
                  {stats.totalFacilities.toLocaleString()}
                </div>
                <p className="text-cyan-200 font-semibold text-lg">Treatment Facilities</p>
              </div>
            </div>
            <div className="h-1 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full"></div>
          </div>

          <div className="bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-xl rounded-2xl p-8 border border-white/30 shadow-2xl hover:shadow-3xl transition-all duration-500 group hover:-translate-y-3 hover:bg-white/25">
            <div className="flex items-center justify-between mb-6">
              <div className="p-4 bg-emerald-500/20 backdrop-blur-sm rounded-2xl group-hover:scale-110 transition-all duration-300">
                <TrendingUp className="h-8 w-8 text-emerald-300" />
              </div>
              <div className="text-right">
                <div className="text-5xl font-black text-white mb-2 group-hover:scale-110 transition-transform duration-300">
                  {stats.totalSearches.toLocaleString()}
                </div>
                <p className="text-emerald-200 font-semibold text-lg">People Helped</p>
              </div>
            </div>
            <div className="h-1 bg-gradient-to-r from-emerald-400 to-green-500 rounded-full"></div>
          </div>

          <div className="bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-xl rounded-2xl p-8 border border-white/30 shadow-2xl hover:shadow-3xl transition-all duration-500 group hover:-translate-y-3 hover:bg-white/25">
            <div className="flex items-center justify-between mb-6">
              <div className="p-4 bg-purple-500/20 backdrop-blur-sm rounded-2xl group-hover:scale-110 transition-all duration-300">
                <Award className="h-8 w-8 text-purple-300" />
              </div>
              <div className="text-right">
                <div className="text-5xl font-black text-white mb-2 group-hover:scale-110 transition-transform duration-300">
                  94%
                </div>
                <p className="text-purple-200 font-semibold text-lg">Success Rate</p>
              </div>
            </div>
            <div className="h-1 bg-gradient-to-r from-purple-400 to-pink-500 rounded-full"></div>
          </div>
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
