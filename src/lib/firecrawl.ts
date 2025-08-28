import FirecrawlApp from '@mendable/firecrawl-js';

const firecrawlApiKey = process.env.FIRECRAWL_API_KEY;

if (!firecrawlApiKey) {
  console.warn('FIRECRAWL_API_KEY is not set - web scraping will not work');
}

export const firecrawl = firecrawlApiKey 
  ? new FirecrawlApp({ apiKey: firecrawlApiKey })
  : null;

export interface ScrapedFacilityData {
  title?: string;
  description?: string;
  phone?: string;
  address?: string;
  website?: string;
  amenities?: string[];
  programs?: string[];
  capacity?: number;
  acceptedInsurance?: string[];
}

export async function scrapeFacilityWebsite(url: string): Promise<ScrapedFacilityData> {
  try {
    if (!firecrawl) {
      console.warn('Firecrawl not configured - skipping scraping');
      return {};
    }
    
    const result = await firecrawl.scrapeUrl(url, {
      formats: ['markdown', 'extract'],
      extract: {
        schema: {
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            phone: { type: 'string' },
            address: { type: 'string' },
            amenities: { 
              type: 'array',
              items: { type: 'string' }
            },
            programs: {
              type: 'array', 
              items: { type: 'string' }
            },
            capacity: { type: 'number' },
            acceptedInsurance: {
              type: 'array',
              items: { type: 'string' }
            }
          }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any
      }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (result as any).extract || {};
  } catch (error) {
    console.error('Error scraping facility website:', error);
    return {};
  }
}