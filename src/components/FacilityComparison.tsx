'use client'

import { useState } from 'react'
import { 
  X, 
  Star, 
  Phone, 
  MapPin, 
  Users, 
  DollarSign, 
  Shield, 
  Award,
  Heart,
  Share2,
  Download,
  Printer,
  ArrowUpDown
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { type Facility } from './ModernFacilityCard'

interface FacilityComparisonProps {
  facilities: Facility[]
  onClose: () => void
  onRemoveFacility: (facilityId: string) => void
  onViewDetails: (facility: Facility) => void
  onGetDirections: (facility: Facility) => void
}

interface ComparisonFeature {
  key: string
  label: string
  icon: React.ReactNode
  getValue: (facility: Facility) => string | number | React.ReactNode
  isNumeric?: boolean
}

export default function FacilityComparison({ 
  facilities, 
  onClose, 
  onRemoveFacility,
  onViewDetails,
  onGetDirections 
}: FacilityComparisonProps) {
  const [sortBy, setSortBy] = useState<string>('')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  
  const comparisonFeatures: ComparisonFeature[] = [
    {
      key: 'name',
      label: 'Facility Name',
      icon: <Shield className="h-4 w-4" />,
      getValue: (facility) => facility.name
    },
    {
      key: 'location',
      label: 'Location',
      icon: <MapPin className="h-4 w-4" />,
      getValue: (facility) => `${facility.city}, ${facility.state}`
    },
    {
      key: 'rating',
      label: 'Rating',
      icon: <Star className="h-4 w-4" />,
      isNumeric: true,
      getValue: (facility) => facility.averageRating ? (
        <div className="flex items-center gap-1">
          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
          <span className="font-medium">{facility.averageRating.toFixed(1)}</span>
          <span className="text-xs text-gray-500">({facility.reviewCount} reviews)</span>
        </div>
      ) : 'Not rated'
    },
    {
      key: 'capacity',
      label: 'Capacity',
      icon: <Users className="h-4 w-4" />,
      isNumeric: true,
      getValue: (facility) => facility.capacity ? `${facility.capacity} beds` : 'Not specified'
    },
    {
      key: 'phone',
      label: 'Phone',
      icon: <Phone className="h-4 w-4" />,
      getValue: (facility) => facility.phone ? (
        <a 
          href={`tel:${facility.phone}`}
          className="text-primary hover:text-primary/80 transition-colors"
        >
          {facility.phone}
        </a>
      ) : 'Not available'
    },
    {
      key: 'services',
      label: 'Services',
      icon: <Award className="h-4 w-4" />,
      getValue: (facility) => {
        const services = facility.residentialServices?.split(';').slice(0, 3) || []
        return services.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {services.map((service, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs">
                {service.trim()}
              </Badge>
            ))}
          </div>
        ) : 'Not specified'
      }
    },
    {
      key: 'insurance',
      label: 'Insurance',
      icon: <DollarSign className="h-4 w-4" />,
      getValue: (facility) => {
        const insurance = facility.acceptedInsurance?.slice(0, 3) || []
        return insurance.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {insurance.map((ins, idx) => (
              <Badge key={idx} variant="success" className="text-xs">
                {ins}
              </Badge>
            ))}
          </div>
        ) : 'Not specified'
      }
    },
    {
      key: 'verified',
      label: 'Verification',
      icon: <Shield className="h-4 w-4" />,
      getValue: (facility) => facility.verified ? (
        <Badge variant="success" className="text-xs">
          <Shield className="h-3 w-3 mr-1" />
          Verified
        </Badge>
      ) : (
        <Badge variant="secondary" className="text-xs">
          Unverified
        </Badge>
      )
    }
  ]
  
  const handleSort = (key: string) => {
    if (sortBy === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(key)
      setSortDirection('desc')
    }
  }
  
  const handleExport = () => {
    const data = facilities.map(facility => ({
      name: facility.name,
      location: `${facility.city}, ${facility.state}`,
      phone: facility.phone || 'Not available',
      rating: facility.averageRating?.toFixed(1) || 'Not rated',
      capacity: facility.capacity || 'Not specified',
      verified: facility.verified ? 'Yes' : 'No'
    }))
    
    const csv = [
      Object.keys(data[0]).join(','),
      ...data.map(row => Object.values(row).join(','))
    ].join('\n')
    
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'facility-comparison.csv'
    a.click()
    URL.revokeObjectURL(url)
  }
  
  const handlePrint = () => {
    window.print()
  }
  
  const getBestValue = (feature: ComparisonFeature) => {
    if (!feature.isNumeric) return null
    
    const values = facilities.map(f => {
      const value = feature.getValue(f)
      if (feature.key === 'rating' && typeof value === 'object') {
        return f.averageRating || 0
      }
      if (feature.key === 'capacity') {
        return f.capacity || 0
      }
      return 0
    })
    
    const maxValue = Math.max(...values)
    return values.map((v, idx) => v === maxValue && maxValue > 0 ? idx : -1)
      .filter(idx => idx !== -1)
  }
  
  if (facilities.length === 0) {
    return null
  }
  
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-7xl max-h-[90vh] overflow-hidden bg-white">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b">
          <div>
            <CardTitle className="text-2xl font-bold text-gray-900">
              Facility Comparison
            </CardTitle>
            <p className="text-gray-600 mt-1">
              Comparing {facilities.length} treatment facilities
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="hover:border-primary hover:text-primary"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="hover:border-primary hover:text-primary"
            >
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <div className="overflow-auto max-h-[calc(90vh-120px)] custom-scrollbar">
            <table className="w-full">
              <thead className="bg-gray-50 border-b sticky top-0 z-10">
                <tr>
                  <th className="text-left p-4 font-medium text-gray-900 min-w-[200px]">
                    Feature
                  </th>
                  {facilities.map((facility) => (
                    <th key={facility.id} className="text-left p-4 min-w-[250px]">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-900 line-clamp-2 text-sm">
                            {facility.name}
                          </h3>
                          <p className="text-xs text-gray-500 mt-1">
                            {facility.city}, {facility.state}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onRemoveFacility(facility.id)}
                          className="h-6 w-6 text-gray-400 hover:text-red-500"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              
              <tbody>
                {comparisonFeatures.map((feature, featureIdx) => {
                  const bestValueIndices = getBestValue(feature)
                  
                  return (
                    <tr key={feature.key} className={featureIdx % 2 === 0 ? 'bg-gray-50/50' : 'bg-white'}>
                      <td className="p-4 border-r bg-white sticky left-0 z-5">
                        <div className="flex items-center gap-2">
                          {feature.icon}
                          <span className="font-medium text-gray-900">
                            {feature.label}
                          </span>
                          {feature.isNumeric && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleSort(feature.key)}
                              className="h-5 w-5 text-gray-400 hover:text-gray-600"
                            >
                              <ArrowUpDown className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </td>
                      {facilities.map((facility, facilityIdx) => (
                        <td 
                          key={facility.id} 
                          className={cn(
                            "p-4 text-sm",
                            bestValueIndices?.includes(facilityIdx) && "bg-green-50 border border-green-200"
                          )}
                        >
                          {feature.getValue(facility)}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          
          {/* Action buttons */}
          <div className="border-t bg-gray-50 p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {facilities.map((facility) => (
                <div key={facility.id} className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onViewDetails(facility)}
                    className="flex-1 hover:border-primary hover:text-primary"
                  >
                    View Details
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => onGetDirections(facility)}
                    className="flex-1"
                  >
                    Directions
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
