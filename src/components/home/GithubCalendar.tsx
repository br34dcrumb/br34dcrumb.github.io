'use client'

import { Skeleton } from '@/components/ui/skeleton'
import {
  type FunctionComponent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import Calendar, {
  type Props as ActivityCalendarProps,
} from 'react-activity-calendar'

// Adopted from https://github.com/grubersjoe/react-github-calendar
// Copyright (c) 2019 Jonathan Gruber, MIT License

interface Props extends Omit<ActivityCalendarProps, 'data' | 'theme'> {
  username: string
}

async function fetchCalendarData(username: string): Promise<ApiResponse> {
  const response = await fetch(
    `https://github-contributions-api.jogruber.de/v4/${username}?y=last`,
  )
  const data: ApiResponse | ApiErrorResponse = await response.json()

  if (!response.ok) {
    throw Error(
      `Fetching GitHub contribution data for "${username}" failed: ${
        (data as ApiErrorResponse).error
      }`,
    )
  }

  return data as ApiResponse
}

const GithubCalendar: FunctionComponent<Props> = ({ username, ...props }) => {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchData = useCallback(() => {
    setLoading(true)
    setError(null)
    fetchCalendarData(username)
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false))
  }, [username])

  useEffect(fetchData, [fetchData])

  // Size the cells so the whole year fits the card instead of scrolling.
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [blockSize, setBlockSize] = useState(12)
  const blockMargin = blockSize < 8 ? 2 : 3
  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const fit = Math.floor(entry.contentRect.width / 54) - 3
      setBlockSize(Math.max(5, Math.min(14, fit)))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [data])

  if (error) {
    return (
      <p className="text-muted-foreground text-sm">
        <span className="text-glitch-a">ERR</span> contribution feed is down.
        it'll be back.
      </p>
    )
  }

  if (loading || !data) {
    return <Skeleton className="h-40 w-full rounded-none" />
  }

  const days = selectLastNDays(data.contributions, 365)
  const total = days.reduce((sum, d) => sum + d.count, 0)
  const active = days.filter((d) => d.count > 0).length

  return (
    <div className="flex flex-col gap-4">
      <div
        ref={scrollerRef}
        className="[&_.react-activity-calendar\\_\\_legend-month]:fill-muted-foreground [&_.react-activity-calendar\\_\\_legend-month]:text-[11px] max-w-full"
      >
        <Calendar
          data={days}
          theme={{
            // level 0 has to read as an empty cell, not as background
            dark: ['#232a23', '#c6ff3d'],
          }}
          colorScheme="dark"
          blockSize={blockSize}
          blockMargin={blockMargin}
          blockRadius={0}
          {...props}
          maxLevel={4}
          hideTotalCount
          hideColorLegend
        />
      </div>
      <p className="text-muted-foreground flex flex-wrap gap-x-6 gap-y-1 text-xs">
        <span>
          <span className="text-phosphor">{total}</span> contributions in the
          last year
        </span>
        <span>
          <span className="text-foreground">{active}</span> active days
        </span>
      </p>
    </div>
  )
}

interface Activity {
  date: string
  count: number
  level: 0 | 1 | 2 | 3 | 4
}

interface ApiResponse {
  total: {
    [year: number]: number
    [year: string]: number
  }
  contributions: Array<Activity>
}

interface ApiErrorResponse {
  error: string
}

const selectLastNDays = (contributions: Activity[], days: number) => {
  const today = new Date()
  const startDate = new Date(today)
  startDate.setDate(today.getDate() - days)

  return contributions.filter((activity) => {
    const activityDate = new Date(activity.date)
    return activityDate >= startDate && activityDate <= today
  })
}

export default GithubCalendar