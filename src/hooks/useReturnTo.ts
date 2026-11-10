import { useLocation } from "react-router-dom"

const LABELS: Readonly<Record<string, string>> = {
  wines: "Wine",
  reviews: "Review",
  articles: "Article",
  producers: "Producer",
  grapes: "Grape",
  regions: "Region",
  countries: "Country",
  categories: "Category",
  "wine-packages": "Wine Package",
  // Root path "/" — dashboard
  "": "Dashboard",
}

export interface ReturnTarget {
  path: string
  label: string
}

export function useReturnTo(): ReturnTarget | null {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const returnTo = params.get("returnTo")

  if (!returnTo) return null

  // Root path "/" is the dashboard
  if (returnTo === "/") return { path: returnTo, label: "Dashboard" }

  const segments = returnTo.split("/").filter(Boolean)
  const sourceType = segments[0] || "page"
  const label = LABELS[sourceType] || sourceType

  return { path: returnTo, label }
}

