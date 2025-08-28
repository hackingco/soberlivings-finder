'use client'

import { useState } from 'react'
import { 
  Phone, 
  MapPin, 
  Globe, 
  Star, 
  Users, 
  Shield, 
  ExternalLink,
  Heart,
  Info,
  DollarSign,
  Award,
  Plus,
  Check,
  Share2,
  Clock,
  Calendar
} from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export interface Facility {
  id: string
  name: string
  city: string
  state: string
  zip?: string
  phone?: string
  address?: string
  website?: string
  latitude?: number
  longitude?: number
  residentialServices?: string
  allServices?: string
  description?: string
  capacity?: number
  amenities?: string[]
  acceptedInsurance?: string[]
  programs?: string[]
  verified?: boolean
  averageRating?: number
  reviewCount?: number
  distance?: number
}

interface ModernFacilityCardProps {
  facility: Facility
  onViewDetails: (facility: Facility) => void
  onGetDirections: (facility: Facility) => void
  onCompare?: (facility: Facility) => void
  onShare?: (facility: Facility) => void
  className?: string
  isComparing?: boolean
  isInComparison?: boolean
  showQuickActions?: boolean
}

export default function ModernFacilityCard({ 
  facility, 
  onViewDetails, 
  onGetDirections,
  onCompare,
  onShare,
  className,
  isComparing = false,
  isInComparison = false,
  showQuickActions = true
}: ModernFacilityCardProps) {
  const [isFavorited, setIsFavorited] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const formatServices = (services?: string) => {
    if (!services) return []
    return services.split(';').map(s => s.trim()).filter(Boolean).slice(0, 3)
  }

  const formatInsurance = (insurance?: string[]) => {
    if (!insurance || insurance.length === 0) return []
    return insurance.slice(0, 3)
  }

  const getServiceVariant = (service: string) => {
    if (service.toLowerCase().includes('detox')) return 'destructive'
    if (service.toLowerCase().includes('residential')) return 'success'
    if (service.toLowerCase().includes('outpatient')) return 'info'
    return 'secondary'
  }

  const handleShare = async () => {
    if (onShare) {
      onShare(facility)
    } else if (navigator.share) {
      try {
        await navigator.share({
          title: facility.name,
          text: `Check out ${facility.name} - a treatment facility in ${facility.city}, ${facility.state}`,
          url: window.location.href
        })
      } catch (err) {
        console.log('Error sharing:', err)
      }
    }
  }
  
  return (
    <Card 
      className={cn(
        "group relative overflow-hidden bg-white/95 backdrop-blur-sm shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 border border-gray-100/50",
        isInComparison && "ring-2 ring-indigo-500 ring-opacity-60 bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200",
        "hover:border-indigo-200/50",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      interactive
      hover
    >
      {/* Enhanced gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-100/30 via-purple-100/20 to-pink-100/30 opacity-0 group-hover:opacity-100 transition-all duration-500" />
      
      {/* Animated shimmer effect */}
      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      
      <CardHeader className="relative pb-4">
        <div className="flex justify-between items-start">
          <div className="flex-1 space-y-2">
            {/* Title and verification */}
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <h3 className="font-display text-xl font-bold text-gray-900 group-hover:text-indigo-600 transition-colors duration-300 line-clamp-2">
                  {facility.name}
                </h3>
                
                {/* Location */}
                <div className="flex items-center gap-2 mt-1 text-gray-600">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  <span className="text-sm">
                    {facility.city}, {facility.state} {facility.zip}
                  </span>
                  {facility.distance && (
                    <Badge variant="outline" className="ml-2 text-2xs">
                      {facility.distance.toFixed(1)} mi
                    </Badge>
                  )}
                </div>
              </div>
              
              {/* Enhanced verification badge */}
              {facility.verified && (
                <div className="flex items-center gap-1 bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 px-3 py-1.5 rounded-full text-xs font-semibold border border-emerald-200/50 shadow-sm group-hover:shadow-md transition-all duration-300">
                  <Shield className="h-3.5 w-3.5" />
                  <span>Verified</span>
                </div>
              )}
            </div>

            {/* Rating */}
            {facility.averageRating && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={cn(
                        "h-4 w-4",
                        star <= facility.averageRating!
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-gray-300"
                      )}
                    />
                  ))}
                </div>
                <span className="text-sm font-medium text-gray-900">
                  {facility.averageRating.toFixed(1)}
                </span>
                <span className="text-sm text-gray-500">
                  ({facility.reviewCount} reviews)
                </span>
              </div>
            )}
          </div>
          
          {/* Enhanced favorite button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation()
              setIsFavorited(!isFavorited)
            }}
            className="h-9 w-9 text-gray-400 hover:text-pink-500 hover:bg-pink-50 transition-all duration-300"
          >
            <Heart className={cn(
              "h-4 w-4 transition-all duration-300",
              isFavorited ? "fill-pink-500 text-pink-500 scale-110" : "hover:scale-110"
            )} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="relative space-y-4">
        {/* Description */}
        {facility.description && (
          <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
            {facility.description}
          </p>
        )}

        {/* Services */}
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Services Offered
            </h4>
            <div className="flex flex-wrap gap-2">
              {formatServices(facility.residentialServices).map((service, index) => (
                <Badge
                  key={index}
                  variant={getServiceVariant(service)}
                  className="text-xs"
                >
                  {service}
                </Badge>
              ))}
            </div>
          </div>

          {/* Insurance */}
          {facility.acceptedInsurance && facility.acceptedInsurance.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                Insurance Accepted
              </h4>
              <div className="flex flex-wrap gap-2">
                {formatInsurance(facility.acceptedInsurance).map((insurance, index) => (
                  <Badge
                    key={index}
                    variant="success"
                    className="text-xs"
                  >
                    {insurance}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Capacity and amenities */}
        <div className="grid grid-cols-2 gap-4 pt-2">
          {facility.capacity && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Users className="h-4 w-4 text-gray-400" />
              <span>{facility.capacity} beds</span>
            </div>
          )}
          
          {facility.amenities && facility.amenities.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Award className="h-4 w-4 text-gray-400" />
              <span>{facility.amenities.length} amenities</span>
            </div>
          )}
        </div>

        {/* Contact information */}
        <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-100">
          {facility.phone && (
            <a
              href={`tel:${facility.phone}`}
              className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <Phone className="h-4 w-4" />
              <span>{facility.phone}</span>
            </a>
          )}
          
          {facility.website && (
            <a
              href={facility.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <Globe className="h-4 w-4" />
              <span>Website</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        {/* Quick actions bar - appears on hover */}
        {showQuickActions && isHovered && (
          <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 p-1 flex gap-1 transition-all duration-200 animate-fade-in-up">
            {onShare && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation()
                  handleShare()
                }}
                className="h-8 w-8 text-gray-600 hover:text-blue-600"
                title="Share facility"
              >
                <Share2 className="h-3 w-3" />
              </Button>
            )}
            
            {onCompare && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation()
                  onCompare(facility)
                }}
                className={cn(
                  "h-8 w-8 transition-colors",
                  isInComparison 
                    ? "text-primary bg-primary/10" 
                    : "text-gray-600 hover:text-primary"
                )}
                title={isInComparison ? "Remove from comparison" : "Add to comparison"}
              >
                {isInComparison ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
              </Button>
            )}
          </div>
        )}
        
        {/* Enhanced action buttons */}
        <div className="flex gap-3 pt-4">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={(e) => {
              e.stopPropagation()
              onViewDetails(facility)
            }}
            className="flex-1 group/btn border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 transition-all duration-300 font-medium"
            leftIcon={<Info className="h-4 w-4 group-hover/btn:scale-110 transition-transform duration-300" />}
          >
            View Details
          </Button>
          
          <Button 
            variant="default" 
            size="sm" 
            onClick={(e) => {
              e.stopPropagation()
              onGetDirections(facility)
            }}
            className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-md hover:shadow-lg transition-all duration-300 font-medium border-0"
            leftIcon={<MapPin className="h-4 w-4 group-hover/btn:scale-110 transition-transform duration-300" />}
          >
            Directions
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}