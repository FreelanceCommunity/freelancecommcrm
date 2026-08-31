import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

const COUNTRY_TIMEZONES: Record<string, string> = {
  'United States': 'America/New_York',
  'US': 'America/New_York',
  'USA': 'America/New_York',
  'United Kingdom': 'Europe/London',
  'UK': 'Europe/London',
  'India': 'Asia/Kolkata',
  'Australia': 'Australia/Sydney',
  'Canada': 'America/Toronto',
  'Germany': 'Europe/Berlin',
  'France': 'Europe/Paris',
  'Japan': 'Asia/Tokyo',
  'China': 'Asia/Shanghai',
  'Brazil': 'America/Sao_Paulo',
  'Mexico': 'America/Mexico_City',
  'South Africa': 'Africa/Johannesburg',
  'New Zealand': 'Pacific/Auckland',
  'Singapore': 'Asia/Singapore',
  'United Arab Emirates': 'Asia/Dubai',
  'UAE': 'Asia/Dubai',
  'Saudi Arabia': 'Asia/Riyadh',
  'Italy': 'Europe/Rome',
  'Spain': 'Europe/Madrid',
  'Netherlands': 'Europe/Amsterdam',
  'Sweden': 'Europe/Stockholm',
  'Switzerland': 'Europe/Zurich',
  'Ireland': 'Europe/Dublin',
  'Argentina': 'America/Argentina/Buenos_Aires',
  'Colombia': 'America/Bogota',
  'Chile': 'America/Santiago',
  'Peru': 'America/Lima',
  'South Korea': 'Asia/Seoul',
  'Indonesia': 'Asia/Jakarta',
  'Malaysia': 'Asia/Kuala_Lumpur',
  'Philippines': 'Asia/Manila',
  'Thailand': 'Asia/Bangkok',
  'Vietnam': 'Asia/Ho_Chi_Minh',
  'Egypt': 'Africa/Cairo',
  'Nigeria': 'Africa/Lagos',
  'Kenya': 'Africa/Nairobi',
  'Turkey': 'Europe/Istanbul',
  'Russia': 'Europe/Moscow',
  'Poland': 'Europe/Warsaw',
  'Belgium': 'Europe/Brussels',
  'Austria': 'Europe/Vienna',
  'Denmark': 'Europe/Copenhagen',
  'Norway': 'Europe/Oslo',
  'Finland': 'Europe/Helsinki',
  'Greece': 'Europe/Athens',
  'Portugal': 'Europe/Lisbon',
  'Israel': 'Asia/Jerusalem',
  'Pakistan': 'Asia/Karachi',
  'Bangladesh': 'Asia/Dhaka',
  'Sri Lanka': 'Asia/Colombo',
  'Nepal': 'Asia/Kathmandu',
};

export default function ClientTimeWidget({ country }: { country?: string | null }) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getClientTimezone = () => {
    if (!country) return null;
    
    // Exact match
    if (COUNTRY_TIMEZONES[country]) {
      return COUNTRY_TIMEZONES[country];
    }
    
    // Case insensitive match
    const lowerCountry = country.trim().toLowerCase();
    const match = Object.keys(COUNTRY_TIMEZONES).find(
      key => key.toLowerCase() === lowerCountry
    );
    
    if (match) {
      return COUNTRY_TIMEZONES[match];
    }
    
    return null;
  };

  const clientTz = getClientTimezone();

  const formatTime = (date: Date, timeZone?: string) => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: timeZone || undefined
      }).format(date);
    } catch (e) {
      return 'Invalid Timezone';
    }
  };

  return (
    <div className="flex flex-col space-y-3 mt-4 border-t pt-4">
      <div className="flex items-start text-sm">
        <Clock className="w-4 h-4 mr-2 mt-0.5 text-muted-foreground" />
        <div className="flex flex-col flex-1">
          <div className="flex justify-between w-full max-w-[200px]">
            <span className="text-muted-foreground">My Local Time:</span>
            <span className="font-medium">{formatTime(time)}</span>
          </div>
          {clientTz ? (
            <div className="flex justify-between w-full max-w-[200px] mt-1.5">
              <span className="text-muted-foreground">Client Time:</span>
              <span className="font-medium text-primary">{formatTime(time, clientTz)}</span>
            </div>
          ) : country ? (
            <div className="flex justify-between w-full max-w-[200px] mt-1 text-xs text-muted-foreground">
              <span>Client Time:</span>
              <span className="text-muted-foreground/70">Unknown ({country})</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
