import type { SVGProps } from 'react'

export function FerryIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <path
        d="M3 17.5c1.2.9 2 .9 3.2 0 1.2-.9 2-.9 3.2 0 1.2.9 2 .9 3.2 0 1.2-.9 2-.9 3.2 0 1.2.9 2 .9 3.2 0"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 14l1.4-4.2A2 2 0 0 1 8.3 8.4h7.4a2 2 0 0 1 1.9 1.4L19 14"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M5 14h14" strokeLinecap="round" />
      <path d="M12 8.4V5M9.5 5h5" strokeLinecap="round" />
    </svg>
  )
}

export function SwapIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <path d="M7 4 4 7l3 3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 7h13a3 3 0 0 1 3 3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m17 20 3-3-3-3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 17H7a3 3 0 0 1-3-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function LocationIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <path d="M12 21s-6.5-5.3-6.5-10A6.5 6.5 0 0 1 18.5 11c0 4.7-6.5 10-6.5 10Z" strokeLinejoin="round" />
      <circle cx="12" cy="11" r="2.3" />
    </svg>
  )
}

export function WalkIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <circle cx="13" cy="4.5" r="1.6" />
      <path
        d="M12 8.5 9.5 11l1.5 2 1 5M12 8.5l2.5 1.5L17 12M11 13l-2 5M9.5 11 7 13"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} {...props}>
      <path d="m5 12.5 4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function SunIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <circle cx="12" cy="12" r="4" />
      <path
        d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function MoonIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" strokeLinejoin="round" />
    </svg>
  )
}
