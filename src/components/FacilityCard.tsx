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
  Info
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

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

interface FacilityCardProps {
  facility: Facility
  onViewDetails: (facility: Facility) => void
  onGetDirections: (facility: Facility) => void
}

export default function FacilityCard({ facility, onViewDetails, onGetDirections }: FacilityCardProps) {
  const [isFavorited, setIsFavorited] = useState(false)

  const formatServices = (services?: string) => {
    if (!services) return []
    return services.split(';').map(s => s.trim()).filter(Boolean).slice(0, 3)
  }

  const formatInsurance = (insurance?: string[]) => {
    if (!insurance || insurance.length === 0) return []
    return insurance.slice(0, 3)
  }

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="text-lg mb-1 flex items-center gap-2">
              {facility.name}
              {facility.verified && (
                <Shield className="h-4 w-4 text-green-600" />
              )}
            </CardTitle>
            <div className="flex items-center text-sm text-muted-foreground gap-4">
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {facility.city}, {facility.state} {facility.zip}
                {facility.distance && (
                  <span className="ml-2 bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs">
                    {facility.distance.toFixed(1)} mi
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {facility.averageRating && (
              <div className="flex items-center gap-1 text-sm">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <span className="font-medium">{facility.averageRating.toFixed(1)}</span>
                <span className="text-muted-foreground">({facility.reviewCount})</span>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsFavorited(!isFavorited)}
              className="h-8 w-8"
            >
              <Heart className={`h-4 w-4 ${isFavorited ? 'fill-red-500 text-red-500' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Description */}
        {facility.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {facility.description}
          </p>
        )}

        {/* Services */}
        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
            <Users className="h-3 w-3" />
            Services
          </h4>
          <div className="flex flex-wrap gap-1">
            {formatServices(facility.residentialServices).map((service, index) => (
              <span
                key={index}
                className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full"
              >
                {service}
              </span>
            ))}
          </div>
        </div>

        {/* Insurance */}
        {facility.acceptedInsurance && facility.acceptedInsurance.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
              <Shield className="h-3 w-3" />
              Insurance Accepted
            </h4>
            <div className="flex flex-wrap gap-1">
              {formatInsurance(facility.acceptedInsurance).map((insurance, index) => (
                <span
                  key={index}
                  className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full"
                >
                  {insurance}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Capacity */}
        {facility.capacity && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-3 w-3" />
            <span>Capacity: {facility.capacity} residents</span>
          </div>
        )}

        {/* Contact Information */}
        <div className="flex flex-wrap gap-4 text-sm">
          {facility.phone && (
            <a
              href={`tel:${facility.phone}`}
              className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
            >
              <Phone className="h-3 w-3" />
              {facility.phone}
            </a>
          )}
          {facility.website && (
            <a
              href={facility.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
            >
              <Globe className="h-3 w-3" />
              Website
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onViewDetails(facility)}
            className="flex-1"
          >
            <Info className="h-4 w-4 mr-1" />
            View Details
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onGetDirections(facility)}
          >
            <MapPin className="h-4 w-4 mr-1" />
            Directions
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}