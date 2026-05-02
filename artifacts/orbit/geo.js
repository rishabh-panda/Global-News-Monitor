'use strict';

// Hardcoded country → coordinates lookup table (~180 countries)
// ISO 3166-1 alpha-2 → { lat, lng, name, region }
const COUNTRY_COORDS = {
  'AF': { lat: 33.93, lng: 67.71, name: 'Afghanistan', region: 'Central Asia' },
  'AL': { lat: 41.15, lng: 20.17, name: 'Albania', region: 'Europe' },
  'DZ': { lat: 28.03, lng: 1.66, name: 'Algeria', region: 'Africa' },
  'AD': { lat: 42.55, lng: 1.60, name: 'Andorra', region: 'Europe' },
  'AO': { lat: -11.20, lng: 17.87, name: 'Angola', region: 'Africa' },
  'AG': { lat: 17.06, lng: -61.80, name: 'Antigua and Barbuda', region: 'Latin America' },
  'AR': { lat: -38.42, lng: -63.62, name: 'Argentina', region: 'Latin America' },
  'AM': { lat: 40.07, lng: 45.04, name: 'Armenia', region: 'Central Asia' },
  'AU': { lat: -25.27, lng: 133.78, name: 'Australia', region: 'Oceania' },
  'AT': { lat: 47.52, lng: 14.55, name: 'Austria', region: 'Europe' },
  'AZ': { lat: 40.14, lng: 47.58, name: 'Azerbaijan', region: 'Central Asia' },
  'BS': { lat: 25.03, lng: -77.40, name: 'Bahamas', region: 'Latin America' },
  'BH': { lat: 26.00, lng: 50.55, name: 'Bahrain', region: 'Middle East' },
  'BD': { lat: 23.68, lng: 90.36, name: 'Bangladesh', region: 'South Asia' },
  'BB': { lat: 13.19, lng: -59.54, name: 'Barbados', region: 'Latin America' },
  'BY': { lat: 53.71, lng: 27.95, name: 'Belarus', region: 'Europe' },
  'BE': { lat: 50.50, lng: 4.47, name: 'Belgium', region: 'Europe' },
  'BZ': { lat: 17.19, lng: -88.50, name: 'Belize', region: 'Latin America' },
  'BJ': { lat: 9.31, lng: 2.32, name: 'Benin', region: 'Africa' },
  'BT': { lat: 27.51, lng: 90.43, name: 'Bhutan', region: 'South Asia' },
  'BO': { lat: -16.29, lng: -63.59, name: 'Bolivia', region: 'Latin America' },
  'BA': { lat: 43.92, lng: 17.68, name: 'Bosnia and Herzegovina', region: 'Europe' },
  'BW': { lat: -22.33, lng: 24.68, name: 'Botswana', region: 'Africa' },
  'BR': { lat: -14.24, lng: -51.93, name: 'Brazil', region: 'Latin America' },
  'BN': { lat: 4.94, lng: 114.95, name: 'Brunei', region: 'Asia-Pacific' },
  'BG': { lat: 42.73, lng: 25.49, name: 'Bulgaria', region: 'Europe' },
  'BF': { lat: 12.36, lng: -1.53, name: 'Burkina Faso', region: 'Africa' },
  'BI': { lat: -3.37, lng: 29.92, name: 'Burundi', region: 'Africa' },
  'CV': { lat: 16.00, lng: -24.01, name: 'Cabo Verde', region: 'Africa' },
  'KH': { lat: 12.57, lng: 104.99, name: 'Cambodia', region: 'Asia-Pacific' },
  'CM': { lat: 7.37, lng: 12.35, name: 'Cameroon', region: 'Africa' },
  'CA': { lat: 56.13, lng: -106.35, name: 'Canada', region: 'North America' },
  'CF': { lat: 6.61, lng: 20.94, name: 'Central African Republic', region: 'Africa' },
  'TD': { lat: 15.45, lng: 18.73, name: 'Chad', region: 'Africa' },
  'CL': { lat: -35.68, lng: -71.54, name: 'Chile', region: 'Latin America' },
  'CN': { lat: 35.86, lng: 104.19, name: 'China', region: 'Asia-Pacific' },
  'CO': { lat: 4.57, lng: -74.30, name: 'Colombia', region: 'Latin America' },
  'KM': { lat: -11.88, lng: 43.87, name: 'Comoros', region: 'Africa' },
  'CG': { lat: -0.23, lng: 15.83, name: 'Congo', region: 'Africa' },
  'CD': { lat: -4.04, lng: 21.76, name: 'DR Congo', region: 'Africa' },
  'CR': { lat: 9.75, lng: -83.75, name: 'Costa Rica', region: 'Latin America' },
  'CI': { lat: 7.54, lng: -5.55, name: "Côte d'Ivoire", region: 'Africa' },
  'HR': { lat: 45.10, lng: 15.20, name: 'Croatia', region: 'Europe' },
  'CU': { lat: 21.52, lng: -77.78, name: 'Cuba', region: 'Latin America' },
  'CY': { lat: 35.13, lng: 33.43, name: 'Cyprus', region: 'Europe' },
  'CZ': { lat: 49.82, lng: 15.47, name: 'Czech Republic', region: 'Europe' },
  'DK': { lat: 56.26, lng: 9.50, name: 'Denmark', region: 'Europe' },
  'DJ': { lat: 11.83, lng: 42.59, name: 'Djibouti', region: 'Africa' },
  'DM': { lat: 15.41, lng: -61.37, name: 'Dominica', region: 'Latin America' },
  'DO': { lat: 18.74, lng: -70.16, name: 'Dominican Republic', region: 'Latin America' },
  'EC': { lat: -1.83, lng: -78.18, name: 'Ecuador', region: 'Latin America' },
  'EG': { lat: 26.82, lng: 30.80, name: 'Egypt', region: 'Middle East' },
  'SV': { lat: 13.79, lng: -88.90, name: 'El Salvador', region: 'Latin America' },
  'GQ': { lat: 1.65, lng: 10.27, name: 'Equatorial Guinea', region: 'Africa' },
  'ER': { lat: 15.18, lng: 39.78, name: 'Eritrea', region: 'Africa' },
  'EE': { lat: 58.60, lng: 25.01, name: 'Estonia', region: 'Europe' },
  'SZ': { lat: -26.52, lng: 31.47, name: 'Eswatini', region: 'Africa' },
  'ET': { lat: 9.15, lng: 40.49, name: 'Ethiopia', region: 'Africa' },
  'FJ': { lat: -16.58, lng: 179.41, name: 'Fiji', region: 'Oceania' },
  'FI': { lat: 64.00, lng: 26.00, name: 'Finland', region: 'Europe' },
  'FR': { lat: 46.23, lng: 2.21, name: 'France', region: 'Europe' },
  'GA': { lat: -0.80, lng: 11.61, name: 'Gabon', region: 'Africa' },
  'GM': { lat: 13.44, lng: -15.31, name: 'Gambia', region: 'Africa' },
  'GE': { lat: 42.32, lng: 43.36, name: 'Georgia', region: 'Central Asia' },
  'DE': { lat: 51.16, lng: 10.45, name: 'Germany', region: 'Europe' },
  'GH': { lat: 7.95, lng: -1.02, name: 'Ghana', region: 'Africa' },
  'GR': { lat: 39.07, lng: 21.82, name: 'Greece', region: 'Europe' },
  'GD': { lat: 12.12, lng: -61.68, name: 'Grenada', region: 'Latin America' },
  'GT': { lat: 15.78, lng: -90.23, name: 'Guatemala', region: 'Latin America' },
  'GN': { lat: 9.95, lng: -11.61, name: 'Guinea', region: 'Africa' },
  'GW': { lat: 11.80, lng: -15.18, name: 'Guinea-Bissau', region: 'Africa' },
  'GY': { lat: 4.86, lng: -58.93, name: 'Guyana', region: 'Latin America' },
  'HT': { lat: 18.97, lng: -72.29, name: 'Haiti', region: 'Latin America' },
  'HN': { lat: 15.20, lng: -86.24, name: 'Honduras', region: 'Latin America' },
  'HU': { lat: 47.16, lng: 19.50, name: 'Hungary', region: 'Europe' },
  'IS': { lat: 64.96, lng: -19.02, name: 'Iceland', region: 'Europe' },
  'IN': { lat: 20.59, lng: 78.96, name: 'India', region: 'South Asia' },
  'ID': { lat: -0.79, lng: 113.92, name: 'Indonesia', region: 'Asia-Pacific' },
  'IR': { lat: 32.43, lng: 53.69, name: 'Iran', region: 'Middle East' },
  'IQ': { lat: 33.22, lng: 43.68, name: 'Iraq', region: 'Middle East' },
  'IE': { lat: 53.41, lng: -8.24, name: 'Ireland', region: 'Europe' },
  'IL': { lat: 31.05, lng: 34.85, name: 'Israel', region: 'Middle East' },
  'IT': { lat: 41.87, lng: 12.57, name: 'Italy', region: 'Europe' },
  'JM': { lat: 18.11, lng: -77.30, name: 'Jamaica', region: 'Latin America' },
  'JP': { lat: 36.20, lng: 138.25, name: 'Japan', region: 'Asia-Pacific' },
  'JO': { lat: 30.59, lng: 36.24, name: 'Jordan', region: 'Middle East' },
  'KZ': { lat: 48.02, lng: 66.92, name: 'Kazakhstan', region: 'Central Asia' },
  'KE': { lat: -0.02, lng: 37.91, name: 'Kenya', region: 'Africa' },
  'KI': { lat: -3.37, lng: -168.73, name: 'Kiribati', region: 'Oceania' },
  'KP': { lat: 40.34, lng: 127.51, name: 'North Korea', region: 'Asia-Pacific' },
  'KR': { lat: 35.91, lng: 127.77, name: 'South Korea', region: 'Asia-Pacific' },
  'KW': { lat: 29.31, lng: 47.48, name: 'Kuwait', region: 'Middle East' },
  'KG': { lat: 41.20, lng: 74.77, name: 'Kyrgyzstan', region: 'Central Asia' },
  'LA': { lat: 19.86, lng: 102.50, name: 'Laos', region: 'Asia-Pacific' },
  'LV': { lat: 56.88, lng: 24.60, name: 'Latvia', region: 'Europe' },
  'LB': { lat: 33.85, lng: 35.86, name: 'Lebanon', region: 'Middle East' },
  'LS': { lat: -29.61, lng: 28.23, name: 'Lesotho', region: 'Africa' },
  'LR': { lat: 6.43, lng: -9.43, name: 'Liberia', region: 'Africa' },
  'LY': { lat: 26.34, lng: 17.23, name: 'Libya', region: 'Africa' },
  'LI': { lat: 47.14, lng: 9.55, name: 'Liechtenstein', region: 'Europe' },
  'LT': { lat: 55.17, lng: 23.88, name: 'Lithuania', region: 'Europe' },
  'LU': { lat: 49.82, lng: 6.13, name: 'Luxembourg', region: 'Europe' },
  'MG': { lat: -18.77, lng: 46.87, name: 'Madagascar', region: 'Africa' },
  'MW': { lat: -13.25, lng: 34.30, name: 'Malawi', region: 'Africa' },
  'MY': { lat: 4.21, lng: 101.98, name: 'Malaysia', region: 'Asia-Pacific' },
  'MV': { lat: 3.20, lng: 73.22, name: 'Maldives', region: 'South Asia' },
  'ML': { lat: 17.57, lng: -3.99, name: 'Mali', region: 'Africa' },
  'MT': { lat: 35.94, lng: 14.38, name: 'Malta', region: 'Europe' },
  'MH': { lat: 7.13, lng: 171.18, name: 'Marshall Islands', region: 'Oceania' },
  'MR': { lat: 21.01, lng: -10.94, name: 'Mauritania', region: 'Africa' },
  'MU': { lat: -20.35, lng: 57.55, name: 'Mauritius', region: 'Africa' },
  'MX': { lat: 23.63, lng: -102.55, name: 'Mexico', region: 'North America' },
  'FM': { lat: 7.43, lng: 150.55, name: 'Micronesia', region: 'Oceania' },
  'MD': { lat: 47.41, lng: 28.37, name: 'Moldova', region: 'Europe' },
  'MC': { lat: 43.74, lng: 7.40, name: 'Monaco', region: 'Europe' },
  'MN': { lat: 46.86, lng: 103.85, name: 'Mongolia', region: 'Asia-Pacific' },
  'ME': { lat: 42.71, lng: 19.37, name: 'Montenegro', region: 'Europe' },
  'MA': { lat: 31.79, lng: -7.09, name: 'Morocco', region: 'Africa' },
  'MZ': { lat: -18.67, lng: 35.53, name: 'Mozambique', region: 'Africa' },
  'MM': { lat: 21.92, lng: 95.96, name: 'Myanmar', region: 'Asia-Pacific' },
  'NA': { lat: -22.96, lng: 18.49, name: 'Namibia', region: 'Africa' },
  'NR': { lat: -0.52, lng: 166.93, name: 'Nauru', region: 'Oceania' },
  'NP': { lat: 28.39, lng: 84.12, name: 'Nepal', region: 'South Asia' },
  'NL': { lat: 52.13, lng: 5.29, name: 'Netherlands', region: 'Europe' },
  'NZ': { lat: -40.90, lng: 174.89, name: 'New Zealand', region: 'Oceania' },
  'NI': { lat: 12.87, lng: -85.21, name: 'Nicaragua', region: 'Latin America' },
  'NE': { lat: 17.61, lng: 8.08, name: 'Niger', region: 'Africa' },
  'NG': { lat: 9.08, lng: 8.68, name: 'Nigeria', region: 'Africa' },
  'NO': { lat: 60.47, lng: 8.47, name: 'Norway', region: 'Europe' },
  'OM': { lat: 21.51, lng: 55.92, name: 'Oman', region: 'Middle East' },
  'PK': { lat: 30.38, lng: 69.35, name: 'Pakistan', region: 'South Asia' },
  'PW': { lat: 7.52, lng: 134.58, name: 'Palau', region: 'Oceania' },
  'PA': { lat: 8.54, lng: -80.78, name: 'Panama', region: 'Latin America' },
  'PG': { lat: -6.31, lng: 143.96, name: 'Papua New Guinea', region: 'Oceania' },
  'PY': { lat: -23.44, lng: -58.44, name: 'Paraguay', region: 'Latin America' },
  'PE': { lat: -9.19, lng: -75.02, name: 'Peru', region: 'Latin America' },
  'PH': { lat: 12.88, lng: 121.77, name: 'Philippines', region: 'Asia-Pacific' },
  'PL': { lat: 51.92, lng: 19.15, name: 'Poland', region: 'Europe' },
  'PT': { lat: 39.40, lng: -8.22, name: 'Portugal', region: 'Europe' },
  'QA': { lat: 25.35, lng: 51.18, name: 'Qatar', region: 'Middle East' },
  'RO': { lat: 45.94, lng: 24.97, name: 'Romania', region: 'Europe' },
  'RU': { lat: 61.52, lng: 105.32, name: 'Russia', region: 'Europe' },
  'RW': { lat: -1.94, lng: 29.87, name: 'Rwanda', region: 'Africa' },
  'KN': { lat: 17.36, lng: -62.78, name: 'Saint Kitts and Nevis', region: 'Latin America' },
  'LC': { lat: 13.91, lng: -60.98, name: 'Saint Lucia', region: 'Latin America' },
  'VC': { lat: 12.98, lng: -61.29, name: 'Saint Vincent', region: 'Latin America' },
  'WS': { lat: -13.76, lng: -172.10, name: 'Samoa', region: 'Oceania' },
  'SM': { lat: 43.94, lng: 12.46, name: 'San Marino', region: 'Europe' },
  'ST': { lat: 0.19, lng: 6.61, name: 'São Tomé and Príncipe', region: 'Africa' },
  'SA': { lat: 23.89, lng: 45.08, name: 'Saudi Arabia', region: 'Middle East' },
  'SN': { lat: 14.50, lng: -14.45, name: 'Senegal', region: 'Africa' },
  'RS': { lat: 44.02, lng: 21.01, name: 'Serbia', region: 'Europe' },
  'SC': { lat: -4.68, lng: 55.49, name: 'Seychelles', region: 'Africa' },
  'SL': { lat: 8.46, lng: -11.78, name: 'Sierra Leone', region: 'Africa' },
  'SG': { lat: 1.35, lng: 103.82, name: 'Singapore', region: 'Asia-Pacific' },
  'SK': { lat: 48.67, lng: 19.70, name: 'Slovakia', region: 'Europe' },
  'SI': { lat: 46.15, lng: 14.99, name: 'Slovenia', region: 'Europe' },
  'SB': { lat: -9.65, lng: 160.16, name: 'Solomon Islands', region: 'Oceania' },
  'SO': { lat: 5.15, lng: 46.20, name: 'Somalia', region: 'Africa' },
  'ZA': { lat: -30.56, lng: 22.94, name: 'South Africa', region: 'Africa' },
  'SS': { lat: 4.86, lng: 31.57, name: 'South Sudan', region: 'Africa' },
  'ES': { lat: 40.46, lng: -3.75, name: 'Spain', region: 'Europe' },
  'LK': { lat: 7.87, lng: 80.77, name: 'Sri Lanka', region: 'South Asia' },
  'SD': { lat: 12.86, lng: 30.22, name: 'Sudan', region: 'Africa' },
  'SR': { lat: 3.92, lng: -56.03, name: 'Suriname', region: 'Latin America' },
  'SE': { lat: 60.13, lng: 18.64, name: 'Sweden', region: 'Europe' },
  'CH': { lat: 46.82, lng: 8.23, name: 'Switzerland', region: 'Europe' },
  'SY': { lat: 34.80, lng: 38.99, name: 'Syria', region: 'Middle East' },
  'TW': { lat: 23.70, lng: 121.00, name: 'Taiwan', region: 'Asia-Pacific' },
  'TJ': { lat: 38.86, lng: 71.28, name: 'Tajikistan', region: 'Central Asia' },
  'TZ': { lat: -6.37, lng: 34.89, name: 'Tanzania', region: 'Africa' },
  'TH': { lat: 15.87, lng: 100.99, name: 'Thailand', region: 'Asia-Pacific' },
  'TL': { lat: -8.87, lng: 125.73, name: 'Timor-Leste', region: 'Asia-Pacific' },
  'TG': { lat: 8.62, lng: 0.82, name: 'Togo', region: 'Africa' },
  'TO': { lat: -21.18, lng: -175.20, name: 'Tonga', region: 'Oceania' },
  'TT': { lat: 10.69, lng: -61.22, name: 'Trinidad and Tobago', region: 'Latin America' },
  'TN': { lat: 33.89, lng: 9.54, name: 'Tunisia', region: 'Africa' },
  'TR': { lat: 38.96, lng: 35.24, name: 'Turkey', region: 'Europe' },
  'TM': { lat: 38.97, lng: 59.56, name: 'Turkmenistan', region: 'Central Asia' },
  'TV': { lat: -7.11, lng: 177.65, name: 'Tuvalu', region: 'Oceania' },
  'UG': { lat: 1.37, lng: 32.29, name: 'Uganda', region: 'Africa' },
  'UA': { lat: 48.38, lng: 31.17, name: 'Ukraine', region: 'Europe' },
  'AE': { lat: 23.42, lng: 53.85, name: 'United Arab Emirates', region: 'Middle East' },
  'GB': { lat: 51.51, lng: -0.13, name: 'United Kingdom', region: 'Europe' },
  'US': { lat: 37.09, lng: -95.71, name: 'United States', region: 'North America' },
  'UY': { lat: -32.52, lng: -55.77, name: 'Uruguay', region: 'Latin America' },
  'UZ': { lat: 41.38, lng: 64.59, name: 'Uzbekistan', region: 'Central Asia' },
  'VU': { lat: -15.38, lng: 166.96, name: 'Vanuatu', region: 'Oceania' },
  'VE': { lat: 6.42, lng: -66.59, name: 'Venezuela', region: 'Latin America' },
  'VN': { lat: 14.06, lng: 108.28, name: 'Vietnam', region: 'Asia-Pacific' },
  'YE': { lat: 15.55, lng: 48.52, name: 'Yemen', region: 'Middle East' },
  'ZM': { lat: -13.13, lng: 27.85, name: 'Zambia', region: 'Africa' },
  'ZW': { lat: -19.02, lng: 29.15, name: 'Zimbabwe', region: 'Africa' },
  'PS': { lat: 31.95, lng: 35.23, name: 'Palestine', region: 'Middle East' },
  'XK': { lat: 42.60, lng: 20.90, name: 'Kosovo', region: 'Europe' },
  'MK': { lat: 41.61, lng: 21.75, name: 'North Macedonia', region: 'Europe' },
};

// Reverse map: country name (lowercased) → ISO alpha-2
const COUNTRY_NAMES = {};
for (const [code, info] of Object.entries(COUNTRY_COORDS)) {
  COUNTRY_NAMES[info.name.toLowerCase()] = code;
}

// Common aliases
const ALIASES = {
  'usa': 'US', 'united states of america': 'US', 'america': 'US',
  'uk': 'GB', 'britain': 'GB', 'great britain': 'GB', 'england': 'GB',
  'uae': 'AE', 'south korea': 'KR', 'north korea': 'KP',
  'czech republic': 'CZ', 'czechia': 'CZ', 'ivory coast': 'CI',
  'democratic republic of congo': 'CD', 'dr congo': 'CD',
};
for (const [alias, code] of Object.entries(ALIASES)) {
  COUNTRY_NAMES[alias] = code;
}

// TLD → country code
const TLD_MAP = {
  '.us': 'US', '.gov': 'US', '.mil': 'US', '.gb': 'GB', '.uk': 'GB',
  '.de': 'DE', '.fr': 'FR', '.it': 'IT', '.es': 'ES', '.ru': 'RU',
  '.cn': 'CN', '.jp': 'JP', '.au': 'AU', '.in': 'IN', '.br': 'BR',
  '.ca': 'CA', '.mx': 'MX', '.kr': 'KR', '.tr': 'TR', '.sa': 'SA',
  '.ae': 'AE', '.za': 'ZA', '.ng': 'NG', '.eg': 'EG', '.pk': 'PK',
  '.nl': 'NL', '.be': 'BE', '.se': 'SE', '.no': 'NO', '.dk': 'DK',
  '.fi': 'FI', '.pl': 'PL', '.ua': 'UA', '.pt': 'PT', '.gr': 'GR',
  '.sg': 'SG', '.my': 'MY', '.th': 'TH', '.id': 'ID', '.il': 'IL',
  '.tw': 'TW', '.bd': 'BD', '.nz': 'NZ', '.ch': 'CH', '.at': 'AT',
};

// Region → list of country codes
const REGION_COUNTRIES = {};
for (const [code, info] of Object.entries(COUNTRY_COORDS)) {
  if (!REGION_COUNTRIES[info.region]) REGION_COUNTRIES[info.region] = [];
  REGION_COUNTRIES[info.region].push(code);
}

function getCoords(code) {
  if (!code) return null;
  return COUNTRY_COORDS[code.toUpperCase()] || null;
}

function inferCountryFromText(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  const names = Object.keys(COUNTRY_NAMES).sort((a, b) => b.length - a.length);
  for (const name of names) {
    if (lower.includes(name)) return COUNTRY_NAMES[name];
  }
  return null;
}

function inferCountryFromUrl(url) {
  if (!url) return null;
  try {
    const hostname = new URL(url).hostname;
    const parts = hostname.split('.');
    if (parts.length >= 2) {
      const tld = '.' + parts[parts.length - 1];
      return TLD_MAP[tld] || null;
    }
  } catch { /* invalid URL */ }
  return null;
}

module.exports = { COUNTRY_COORDS, COUNTRY_NAMES, REGION_COUNTRIES, TLD_MAP, getCoords, inferCountryFromText, inferCountryFromUrl };
