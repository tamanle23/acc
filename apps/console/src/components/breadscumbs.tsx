import * as React from 'react'
import { Link, useMatches } from '@tanstack/react-router'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadscum'

export function Breadcrumbs() {
  const matches = useMatches()

  // Filter matches that have a pathname and aren't root
  const breadcrumbs = matches
    .filter((match) => match.pathname !== '/')
    .map((match) => {
      // Use loaderData title if present, otherwise format the route ID or path
      const label =
        (match.loaderData as { title?: string } | undefined)?.title ??
        match.id
          .split('/')
          .filter(Boolean)
          .pop()
          ?.replace(/[-_]/g, ' ')

      return {
        id: match.id,
        pathname: match.pathname,
        label: label ? label.charAt(0).toUpperCase() + label.slice(1) : '',
      }
    })
    .filter((crumb) => Boolean(crumb.label))

  if (breadcrumbs.length === 0) return null

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/">Home</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>

        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1

          return (
            <React.Fragment key={crumb.id}>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={crumb.pathname}>{crumb.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
