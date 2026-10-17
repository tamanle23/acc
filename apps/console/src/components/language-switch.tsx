import { Check, Languages } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const languages = [
  { label: 'English', value: 'en' },
  { label: 'Vietnamese', value: 'vi' },
] as const

export function LanguageSwitch() {
  const { i18n } = useTranslation()
  const currentLang = languages.find((l) => l.value === i18n.language)
  const currentLanguageLabel = currentLang ? currentLang.label : i18n.language

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant='ghost'
          size='icon'
          className='scale-95 rounded-full'
          aria-label={`Select language (current: ${currentLanguageLabel})`}
        >
          <Languages className='size-[1.2rem]' />
          <span className='sr-only'>Toggle language</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        {languages.map((language) => (
          <DropdownMenuItem
            key={language.value}
            onClick={() => i18n.changeLanguage(language.value)}
            aria-label={language.label}
          >
            {language.label}
            <Check
              size={14}
              className={cn('ms-auto', i18n.language !== language.value && 'hidden')}
            />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
