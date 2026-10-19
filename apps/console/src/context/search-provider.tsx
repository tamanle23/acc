import { createContext, useContext, useEffect, useState, useMemo } from 'react'
import { CommandPalette } from '@/components/command-palette/command-palette'

type SearchContextType = {
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
}

const SearchContext = createContext<SearchContextType | null>(null)

type SearchProviderProps = {
  children: React.ReactNode
}

export function SearchProvider({ children }: SearchProviderProps) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  // Optimization: Memoize context value to preserve referential equality and prevent
  // unnecessary re-renders of consumer components when SearchProvider re-renders.
  const contextValue = useMemo<SearchContextType>(
    () => ({ open, setOpen }),
    [open, setOpen]
  )

  return (
    <SearchContext value={contextValue}>
      {children}
      <CommandPalette />
    </SearchContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useSearch = () => {
  const searchContext = useContext(SearchContext)

  if (!searchContext) {
    throw new Error('useSearch has to be used within SearchProvider')
  }

  return searchContext
}
