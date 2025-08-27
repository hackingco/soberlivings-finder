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
  Award
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
  className?: string
}

export default function ModernFacilityCard({ 
  facility, 
  onViewDetails, 
  onGetDirections,
  className 
}: ModernFacilityCardProps) {
  const [isFavorited, setIsFavorited] = useState(false)

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

  return (
    <Card className={cn(
      "group relative overflow-hidden bg-white shadow-soft hover:shadow-large transition-all duration-300 hover:-translate-y-1 border border-gray-100",
      className
    )}>
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-purple-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <CardHeader className="relative pb-4">
        <div className="flex justify-between items-start">
          <div className="flex-1 space-y-2">
            {/* Title and verification */}
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <h3 className="font-display text-xl font-semibold text-gray-900 group-hover:text-primary transition-colors duration-200 line-clamp-2">
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
              
              {/* Verification badge */}
              {facility.verified && (
                <div className="flex items-center gap-1 bg-green-50 text-green-700 px-2 py-1 rounded-full text-xs font-medium border border-green-200">
                  <Shield className="h-3 w-3" />
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
          
          {/* Favorite button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation()
              setIsFavorited(!isFavorited)
            }}
            className="h-8 w-8 text-gray-400 hover:text-red-500"
          >
            <Heart className={cn(
              "h-4 w-4 transition-colors",
              isFavorited ? "fill-red-500 text-red-500" : ""
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

        {/* Action buttons */}
        <div className="flex gap-2 pt-4">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={(e) => {
              e.stopPropagation()
              onViewDetails(facility)
            }}
            className="flex-1 group/btn"
          >
            <Info className="h-4 w-4 mr-2 group-hover/btn:text-primary transition-colors" />
            View Details
          </Button>
          
          <Button 
            variant="default" 
            size="sm" 
            onClick={(e) => {
              e.stopPropagation()
              onGetDirections(facility)
            }}
            className="flex-1"
          >
            <MapPin className="h-4 w-4 mr-2" />
            Directions
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}