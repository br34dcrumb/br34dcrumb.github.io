import type { IconMap, SocialLink, Site } from '@/types'

export const SITE: Site = {
  title: 'br34d',
  description:
    'Electronics tinkerer and a hardware security enthusiast from India.',
  href: 'https://br34dcrumb.github.io/',
  author: 'br34dcrumb',
  locale: 'en-US',
  featuredPostCount: 0,
  postsPerPage: 100, // high number to keep everythig in a single page, I might not write that much :)
}

// Page links
export const NAV_LINKS: SocialLink[] = [
  {
    href: '/',
    label: 'home',
  },
  {
    href: '/blog',
    label: 'blog',
  },
  {
    href: '/projects',
    label: 'projects',
  },
  {
    href: '/about',
    label: 'about',
  },
]

// My links
export const SOCIAL_LINKS: SocialLink[] = [
  {
    href: 'https://github.com/br34dcrumb',
    label: 'GitHub',
  },
  {
    href: 'https://twitter.com/_br34d_',
    label: 'Twitter',
  },
  {
    href: 'https://linkedin.com/in/anikaitpanigrahi/',
    label: 'LinkedIn',
  },
  {
    href: 'mailto:br34dcrumb@proton.me',
    label: 'Email',
  },
  {
    href: '/rss.xml',
    label: 'RSS',
  },
]

// ICONS
export const ICON_MAP: IconMap = {
  Website: 'lucide:globe',
  GitHub: 'lucide:github',
  LinkedIn: 'lucide:linkedin',
  Twitter: 'lucide:twitter',
  Email: 'lucide:mail',
  Resume: 'lucide:file-text',
  RSS: 'lucide:rss',
}

// Travel Page. `name` must match the country name in src/lib/world.json to
// light up on the globe; coordinates are the city shown on the stamp.
export const PLACES = [
  {
    name: 'India',
    iso: 'IN',
    city: 'New Delhi',
    lat: 28.6139,
    lon: 77.209,
    utc: 'UTC+05:30',
    home: true,
  },
  {
    name: 'United Arab Emirates',
    iso: 'AE',
    city: 'Abu Dhabi',
    lat: 24.4539,
    lon: 54.3773,
    utc: 'UTC+04:00',
  },
  {
    name: 'Thailand',
    iso: 'TH',
    city: 'Bangkok',
    lat: 13.7563,
    lon: 100.5018,
    utc: 'UTC+07:00',
  },
  {
    name: 'Singapore',
    iso: 'SG',
    city: 'Singapore',
    lat: 1.3521,
    lon: 103.8198,
    utc: 'UTC+08:00',
  },
]

export const visitedCountries = PLACES.map((p) => p.name)

// Study Page
export const STUDIES = [
  {
    title: 'Electronics and Computer Engineering',
    institution: 'Amrita University',
    link: 'https://www.amrita.edu/',
    date: '2022 - 2026',
  },
]
