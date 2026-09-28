"use client"

import Link from "next/link"
import React from "react"

/**
 * A thin `next/link` wrapper kept so call sites need no change. The store is
 * single-region/single-language, so `href` is used as-is — no locale/country
 * prefix is added (feature 002-remove-locale-prefix).
 */
const LocalizedClientLink = ({
  children,
  href,
  ...props
}: {
  children?: React.ReactNode
  href: string
  className?: string
  onClick?: () => void
  passHref?: true
  [x: string]: unknown
}) => {
  return (
    <Link href={href} {...props}>
      {children}
    </Link>
  )
}

export default LocalizedClientLink
