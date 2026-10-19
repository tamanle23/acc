import { useState, useEffect } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { ChevronDown, Check, Sparkles, ShieldCheck } from 'lucide-react'
import { zodResolver } from '@hookform/resolvers/zod'
import { fonts } from '@/config/fonts'
import { showSubmittedData } from '@/lib/show-submitted-data'
import { cn } from '@/lib/utils'
import { useFont } from '@/context/font-provider'
import { useTheme, type AccentColor } from '@/context/theme-provider'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'

const appearanceFormSchema = z.object({
  theme: z.enum(['light', 'dark', 'acrylic', 'obsidian']),
  font: z.enum(fonts),
  accentColor: z.enum(['violet', 'azure', 'emerald', 'rose', 'amber']),
  glassIntensity: z.number().min(0).max(100),
  glassFallback: z.boolean(),
  wallpaper: z.enum(['liquid', 'mesh', 'none']),
})

type AppearanceFormValues = z.infer<typeof appearanceFormSchema>

const ACCENT_OPTIONS: { id: AccentColor; label: string; name: string; hex: string; class: string }[] = [
  { id: 'violet', label: 'Aurora', name: 'Aurora Violet', hex: '#8b5cf6', class: 'bg-[#8b5cf6]' },
  { id: 'azure', label: 'Sky', name: 'Sky Azure', hex: '#0ea5e9', class: 'bg-[#0ea5e9]' },
  { id: 'emerald', label: 'Jade', name: 'Jade Emerald', hex: '#10b981', class: 'bg-[#10b981]' },
  { id: 'rose', label: 'Quartz', name: 'Quartz Rose', hex: '#f43f5e', class: 'bg-[#f43f5e]' },
  { id: 'amber', label: 'Sovereign', name: 'Sovereign Amber', hex: '#f59e0b', class: 'bg-[#f59e0b]' },
]

export function AppearanceForm() {
  const { font, setFont } = useFont()
  const {
    theme,
    setTheme,
    accentColor,
    setAccentColor,
    glassIntensity,
    setGlassIntensity,
    previewGlassIntensity,
    glassFallback,
    setGlassFallback,
    wallpaper,
    setWallpaper,
  } = useTheme()

  const [previewIntensity, setPreviewIntensity] = useState<number>(glassIntensity ?? 20)

  // Flag to determine if settings should be sent to server on update, 
  // or applied immediately to the client UI.
  const isServerSide = false

  const normalizedTheme = (theme === 'system' ? 'light' : theme) as 'light' | 'dark' | 'acrylic' | 'obsidian'

  const defaultValues: Partial<AppearanceFormValues> = {
    theme: normalizedTheme,
    font,
    accentColor: accentColor ?? 'violet',
    glassIntensity: glassIntensity ?? 20,
    glassFallback: glassFallback ?? false,
    wallpaper: wallpaper ?? 'liquid',
  }

  const form = useForm<AppearanceFormValues>({
    resolver: zodResolver(appearanceFormSchema),
    defaultValues,
  })

  // Sync external theme/accent changes to form
  useEffect(() => {
    if (theme && form.getValues('theme') !== theme) {
      form.setValue('theme', (theme === 'system' ? 'light' : theme) as any)
    }
  }, [theme, form])

  useEffect(() => {
    if (accentColor && form.getValues('accentColor') !== accentColor) {
      form.setValue('accentColor', accentColor)
    }
  }, [accentColor, form])

  // Watch for immediate client-side UI updates
  const formValues = form.watch()
  useEffect(() => {
    if (!isServerSide) {
      if (formValues.font && formValues.font !== font) setFont(formValues.font)
    }
  }, [formValues.font, isServerSide, font, setFont])

  function onSubmit(data: AppearanceFormValues) {
    if (isServerSide) {
      if (data.font !== font) setFont(data.font)
      if (data.theme !== theme) setTheme(data.theme)
      if (data.accentColor !== accentColor) setAccentColor(data.accentColor)
      if (data.glassFallback !== glassFallback) setGlassFallback(data.glassFallback)
      if (data.glassIntensity !== undefined && data.glassIntensity !== glassIntensity) {
        setGlassIntensity(data.glassIntensity)
      }
      if (data.wallpaper && data.wallpaper !== wallpaper) {
        setWallpaper(data.wallpaper)
      }
      showSubmittedData(data)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-8'>
        {/* Font Selection */}
        <FormField
          control={form.control}
          name='font'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Font</FormLabel>
              <div className='relative w-max'>
                <FormControl>
                  <select
                    className={cn(
                      buttonVariants({ variant: 'outline' }),
                      'w-[200px] appearance-none font-normal capitalize',
                      'dark:bg-background dark:hover:bg-background'
                    )}
                    {...field}
                  >
                    {fonts.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </FormControl>
                <ChevronDown className='absolute end-3 top-2.5 h-4 w-4 opacity-50' />
              </div>
              <FormDescription className='font-manrope'>
                Set the font you want to use in the dashboard.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Theme Presets */}
        <FormField
          control={form.control}
          name='theme'
          render={({ field }) => (
            <FormItem>
              <div className='flex items-center gap-2'>
                <FormLabel>Theme Presets</FormLabel>
                <span className='inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary'>
                  <Sparkles className='size-3' /> Flagship Glass
                </span>
              </div>
              <FormDescription>
                Select between classic opaque themes and flagship Liquid Glass refraction presets.
              </FormDescription>
              <FormMessage />
              <RadioGroup
                value={field.value}
                onValueChange={(val) => {
                  field.onChange(val)
                  setTheme(val as 'light' | 'dark' | 'acrylic' | 'obsidian')
                }}
                className='grid max-w-2xl grid-cols-2 gap-4 pt-2 sm:grid-cols-4'
              >
                {/* Light */}
                <FormItem>
                  <FormLabel className='[&:has([data-state=checked])>div]:border-primary cursor-pointer'>
                    <FormControl>
                      <RadioGroupItem value='light' className='sr-only' />
                    </FormControl>
                    <div className='items-center rounded-xl border-2 border-muted p-1 hover:border-accent transition-all'>
                      <div className='space-y-2 rounded-lg bg-[#f4f4f5] p-2'>
                        <div className='space-y-1.5 rounded-md bg-white p-2 shadow-xs border border-slate-200'>
                          <div className='h-2 w-12 rounded-sm bg-slate-200' />
                          <div className='h-2 w-16 rounded-sm bg-slate-200' />
                        </div>
                        <div className='flex items-center space-x-2 rounded-md bg-white p-1.5 shadow-xs border border-slate-200'>
                          <div className='h-3 w-3 rounded-full bg-slate-200' />
                          <div className='h-2 w-14 rounded-sm bg-slate-200' />
                        </div>
                      </div>
                    </div>
                    <span className='block w-full p-1.5 text-center text-xs font-medium'>
                      Light
                    </span>
                  </FormLabel>
                </FormItem>

                {/* Light Frosted Acrylic */}
                <FormItem>
                  <FormLabel className='[&:has([data-state=checked])>div]:border-primary cursor-pointer'>
                    <FormControl>
                      <RadioGroupItem value='acrylic' className='sr-only' />
                    </FormControl>
                    <div className='items-center rounded-xl border-2 border-muted p-1 hover:border-accent transition-all'>
                      <div className='space-y-2 rounded-lg bg-gradient-to-br from-blue-50/60 to-purple-50/60 p-2'>
                        <div className='space-y-1.5 rounded-md bg-white/70 backdrop-blur-md border border-white/50 p-2 shadow-xs'>
                          <div className='h-2 w-12 rounded-sm bg-blue-200/80' />
                          <div className='h-2 w-16 rounded-sm bg-purple-200/80' />
                        </div>
                        <div className='flex items-center space-x-2 rounded-md bg-white/70 backdrop-blur-md border border-white/50 p-1.5 shadow-xs'>
                          <div className='h-3 w-3 rounded-full bg-indigo-300' />
                          <div className='h-2 w-14 rounded-sm bg-slate-300' />
                        </div>
                      </div>
                    </div>
                    <span className='block w-full p-1.5 text-center text-xs font-semibold text-primary'>
                      Acrylic Glass
                    </span>
                  </FormLabel>
                </FormItem>

                {/* Dark */}
                <FormItem>
                  <FormLabel className='[&:has([data-state=checked])>div]:border-primary cursor-pointer'>
                    <FormControl>
                      <RadioGroupItem value='dark' className='sr-only' />
                    </FormControl>
                    <div className='items-center rounded-xl border-2 border-muted bg-popover p-1 hover:border-accent transition-all'>
                      <div className='space-y-2 rounded-lg bg-slate-950 p-2'>
                        <div className='space-y-1.5 rounded-md bg-slate-900 border border-slate-800 p-2 shadow-xs'>
                          <div className='h-2 w-12 rounded-sm bg-slate-700' />
                          <div className='h-2 w-16 rounded-sm bg-slate-700' />
                        </div>
                        <div className='flex items-center space-x-2 rounded-md bg-slate-900 border border-slate-800 p-1.5 shadow-xs'>
                          <div className='h-3 w-3 rounded-full bg-slate-700' />
                          <div className='h-2 w-14 rounded-sm bg-slate-700' />
                        </div>
                      </div>
                    </div>
                    <span className='block w-full p-1.5 text-center text-xs font-medium'>
                      Dark
                    </span>
                  </FormLabel>
                </FormItem>

                {/* Dark Obsidian */}
                <FormItem>
                  <FormLabel className='[&:has([data-state=checked])>div]:border-primary cursor-pointer'>
                    <FormControl>
                      <RadioGroupItem value='obsidian' className='sr-only' />
                    </FormControl>
                    <div className='items-center rounded-xl border-2 border-muted bg-popover p-1 hover:border-accent transition-all'>
                      <div className='space-y-2 rounded-lg bg-[#07090e] p-2'>
                        <div className='space-y-1.5 rounded-md bg-slate-900/60 backdrop-blur-md border border-white/15 p-2 shadow-[0_2px_10px_rgba(0,0,0,0.5)]'>
                          <div className='h-2 w-12 rounded-sm bg-indigo-400/60' />
                          <div className='h-2 w-16 rounded-sm bg-violet-400/60' />
                        </div>
                        <div className='flex items-center space-x-2 rounded-md bg-slate-900/60 backdrop-blur-md border border-white/15 p-1.5 shadow-xs'>
                          <div className='h-3 w-3 rounded-full bg-violet-400/80 shadow-[0_0_8px_rgba(139,92,246,0.6)]' />
                          <div className='h-2 w-14 rounded-sm bg-slate-600' />
                        </div>
                      </div>
                    </div>
                    <span className='block w-full p-1.5 text-center text-xs font-semibold text-primary'>
                      Dark Obsidian
                    </span>
                  </FormLabel>
                </FormItem>
              </RadioGroup>
            </FormItem>
          )}
        />

        {/* Ambient Accent Colors */}
        <FormField
          control={form.control}
          name='accentColor'
          render={({ field }) => (
            <FormItem className='space-y-3'>
              <FormLabel>Ambient Accent Color</FormLabel>
              <FormDescription>
                Select an ambient color to tint glass caustics, specular rings, and interactive highlights.
              </FormDescription>
              <FormMessage />
              <RadioGroup
                value={field.value}
                onValueChange={(val) => {
                  field.onChange(val)
                  setAccentColor(val as AccentColor)
                }}
                className='grid max-w-lg grid-cols-5 gap-3 pt-1'
              >
                {ACCENT_OPTIONS.map((opt) => (
                  <FormItem key={opt.id}>
                    <FormLabel className='[&:has([data-state=checked])>div]:border-primary [&:has([data-state=checked])>div]:ring-2 [&:has([data-state=checked])>div]:ring-primary/40 cursor-pointer flex flex-col items-center gap-1.5'>
                      <FormControl>
                        <RadioGroupItem value={opt.id} className='sr-only' />
                      </FormControl>
                      <div className='relative flex size-10 items-center justify-center rounded-xl border-2 border-border/80 p-0.5 transition-all hover:scale-105'>
                        <div
                          className={cn('size-full rounded-lg shadow-inner flex items-center justify-center', opt.class)}
                        >
                          {field.value === opt.id && (
                            <Check className='size-4 text-white drop-shadow-md stroke-[2.5]' />
                          )}
                        </div>
                      </div>
                      <span className='text-[11px] font-medium text-foreground/80 text-center leading-tight'>
                        {opt.label}
                      </span>
                    </FormLabel>
                  </FormItem>
                ))}
              </RadioGroup>
            </FormItem>
          )}
        />

        {/* Accessibility Solid Fallback Switch */}
        <FormField
          control={form.control}
          name='glassFallback'
          render={({ field }) => (
            <FormItem className='max-w-2xl rounded-2xl border border-border/70 bg-card/60 p-4 shadow-sm backdrop-blur-md flex flex-row items-center justify-between gap-4'>
              <div className='space-y-0.5'>
                <div className='flex items-center gap-2'>
                  <ShieldCheck className='size-4 text-primary' />
                  <FormLabel className='text-sm font-semibold'>
                    High-Contrast Solid Fallback
                  </FormLabel>
                </div>
                <FormDescription className='text-xs leading-relaxed text-muted-foreground'>
                  Replaces all translucent glass and blur filters with solid, high-contrast surfaces complying with WCAG 2.2 AA. Also triggers automatically when your OS requests reduced transparency.
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={(checked) => {
                    field.onChange(checked)
                    setGlassFallback(checked)
                  }}
                  aria-label='Toggle High-Contrast Solid Fallback'
                />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Liquid Glass Intensity Slider & Live Preview */}
        <FormField
          control={form.control}
          name='glassIntensity'
          render={({ field }) => (
            <FormItem className='max-w-xl space-y-3'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <FormLabel>Liquid Glass Intensity</FormLabel>
                  {glassFallback && (
                    <span className='text-[11px] text-amber-500 dark:text-amber-400 font-medium'>
                      (Inactive: Solid Fallback Active)
                    </span>
                  )}
                </div>
                <span className='rounded-md border border-white/30 dark:border-white/15 bg-white/40 dark:bg-white/10 px-2 py-0.5 text-xs font-semibold backdrop-blur-md'>
                  {glassFallback ? '0%' : `${previewIntensity}%`}
                </span>
              </div>
              <FormControl>
                <Slider
                  min={0}
                  max={100}
                  step={5}
                  disabled={glassFallback}
                  value={[previewIntensity]}
                  onValueChange={(vals) => {
                    const val = vals[0] ?? 20
                    field.onChange(val)
                    setPreviewIntensity(val)
                    previewGlassIntensity(val)
                  }}
                  onValueCommit={(vals) => {
                    const val = vals[0] ?? 20
                    setGlassIntensity(val)
                  }}
                  className='py-2'
                />
              </FormControl>
              <FormDescription>
                Dynamically adjust the frosted blur, translucency, and specular refraction of glass surfaces across the console.
              </FormDescription>

              {/* Live Interactive Liquid Glass Preview Card */}
              <div
                className={cn(
                  'mt-2 relative overflow-hidden rounded-2xl p-5 border transition-[backdrop-filter,background-color,border-color,box-shadow] duration-150',
                  glassFallback
                    ? 'bg-card border-border shadow-md'
                    : 'border-[rgba(255,255,255,calc(0.2+var(--glass-intensity,0.2)*0.45))] dark:border-[rgba(255,255,255,calc(0.08+var(--glass-intensity,0.2)*0.18))] bg-[rgba(255,255,255,calc(0.15+var(--glass-intensity,0.2)*0.5))] dark:bg-[rgba(15,23,42,calc(0.2+var(--glass-intensity,0.2)*0.5))] backdrop-blur-[var(--glass-blur,8px)] shadow-[0_8px_32px_0_rgba(0,0,0,0.08),inset_0_1px_1.5px_0_rgba(255,255,255,var(--glass-specular-alpha,0.3))] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.4),inset_0_1px_1px_0_rgba(255,255,255,calc(var(--glass-specular-alpha,0.2)*0.65))]'
                )}
              >
                {/* Specular gloss sheen gradient */}
                {!glassFallback && (
                  <div className='pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-[rgba(255,255,255,calc(var(--glass-specular-alpha,0.3)*0.55))] via-white/5 to-transparent' />
                )}

                <div className='relative z-10 flex flex-col gap-4'>
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-2'>
                      <span
                        className='size-2.5 rounded-full animate-pulse'
                        style={{ backgroundColor: ACCENT_OPTIONS.find((a) => a.id === (formValues.accentColor || accentColor))?.hex || '#8b5cf6' }}
                      />
                      <span className='text-xs font-semibold tracking-wide uppercase text-foreground/80'>
                        Live Glass Preview
                      </span>
                    </div>
                    <div className='flex items-center gap-2'>
                      <span className='rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium capitalize text-primary'>
                        {formValues.theme || theme}
                      </span>
                      <span className='rounded-full border border-white/40 dark:border-white/15 bg-white/30 dark:bg-white/10 px-2 py-0.5 text-[11px] font-mono font-medium text-foreground'>
                        {glassFallback ? 'Solid Mode' : `${previewIntensity}% Intensity`}
                      </span>
                    </div>
                  </div>

                  {/* Live metrics */}
                  <div className='grid grid-cols-3 gap-2 py-1'>
                    <div className='rounded-xl border border-white/25 dark:border-white/10 bg-white/20 dark:bg-white/5 p-2 text-center backdrop-blur-xs'>
                      <div className='text-[10px] text-muted-foreground uppercase font-medium'>Blur</div>
                      <div className='text-sm font-bold font-mono text-foreground'>
                        {glassFallback ? '0px (Solid)' : `${Math.round((previewIntensity / 100) * 36)}px`}
                      </div>
                    </div>
                    <div className='rounded-xl border border-white/25 dark:border-white/10 bg-white/20 dark:bg-white/5 p-2 text-center backdrop-blur-xs'>
                      <div className='text-[10px] text-muted-foreground uppercase font-medium'>Opacity</div>
                      <div className='text-sm font-bold font-mono text-foreground'>
                        {glassFallback ? '100%' : `${Math.round(15 + (previewIntensity / 100) * 50)}%`}
                      </div>
                    </div>
                    <div className='rounded-xl border border-white/25 dark:border-white/10 bg-white/20 dark:bg-white/5 p-2 text-center backdrop-blur-xs'>
                      <div className='text-[10px] text-muted-foreground uppercase font-medium'>Refraction</div>
                      <div className='text-sm font-bold font-mono text-foreground'>
                        {glassFallback ? '0% (Opaque)' : `${Math.round((0.15 + (previewIntensity / 100) * 0.8) * 100)}%`}
                      </div>
                    </div>
                  </div>

                  <p className='text-xs text-foreground/75 leading-relaxed'>
                    {glassFallback
                      ? 'Solid fallback active: Surfaces are rendered with 100% opaque contrast compliant with WCAG 2.2 AA.'
                      : 'Move the slider above or change the ambient accent color to see real-time optical blur, light refraction, and edge specular sheen dynamically transform on this card.'}
                  </p>

                  <div className='flex items-center gap-2 pt-1'>
                    <button
                      type='button'
                      className='liquid-glass-interactive px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer shadow-xs border'
                      style={{
                        borderColor: 'var(--glass-accent-border, rgba(255,255,255,0.2))',
                      }}
                    >
                      Interactive Glass Button
                    </button>
                    <span className='text-[11px] text-muted-foreground'>
                      Accent border & caustics active
                    </span>
                  </div>
                </div>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Ambient Glass Background (Wallpaper) */}
        <FormField
          control={form.control}
          name='wallpaper'
          render={({ field }) => (
            <FormItem className='space-y-3'>
              <FormLabel>Ambient Glass Background</FormLabel>
              <FormDescription>
                Choose an ambient wallpaper underneath the glass layer to test blur and refraction.
              </FormDescription>
              <FormMessage />
              <RadioGroup
                onValueChange={(val) => {
                  field.onChange(val)
                  setWallpaper(val as 'liquid' | 'mesh' | 'none')
                }}
                defaultValue={field.value}
                className='grid max-w-xl grid-cols-3 gap-4 pt-1'
              >
                <FormItem>
                  <FormLabel className='[&:has([data-state=checked])>div]:border-primary cursor-pointer'>
                    <FormControl>
                      <RadioGroupItem value='liquid' className='sr-only' />
                    </FormControl>
                    <div className='items-center rounded-xl border-2 border-white/20 dark:border-white/10 p-1 hover:border-accent transition-all'>
                      <div className='h-20 rounded-lg overflow-hidden relative border border-white/20'>
                        <img
                          src={theme === 'dark' || theme === 'obsidian' ? '/images/liquid-glass-bg.jpg' : '/images/liquid-glass-bg-light.jpg'}
                          alt='Liquid Caustic'
                          className='h-full w-full object-cover'
                        />
                        <div className='absolute inset-0 bg-black/20 flex items-center justify-center'>
                          <span className='rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white font-medium backdrop-blur-xs'>
                            Liquid Caustic
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className='block w-full p-2 text-center text-xs font-medium'>
                      Liquid Caustic (Dynamic)
                    </span>
                  </FormLabel>
                </FormItem>
                <FormItem>
                  <FormLabel className='[&:has([data-state=checked])>div]:border-primary cursor-pointer'>
                    <FormControl>
                      <RadioGroupItem value='mesh' className='sr-only' />
                    </FormControl>
                    <div className='items-center rounded-xl border-2 border-white/20 dark:border-white/10 p-1 hover:border-accent transition-all'>
                      <div className='h-20 rounded-lg bg-gradient-to-tr from-indigo-500/30 via-pink-500/25 to-sky-400/30 flex items-center justify-center border border-white/20'>
                        <span className='rounded bg-white/40 dark:bg-black/40 px-1.5 py-0.5 text-[10px] font-medium backdrop-blur-xs'>
                          Mesh Glow
                        </span>
                      </div>
                    </div>
                    <span className='block w-full p-2 text-center text-xs font-medium'>
                      Ambient Mesh
                    </span>
                  </FormLabel>
                </FormItem>
                <FormItem>
                  <FormLabel className='[&:has([data-state=checked])>div]:border-primary cursor-pointer'>
                    <FormControl>
                      <RadioGroupItem value='none' className='sr-only' />
                    </FormControl>
                    <div className='items-center rounded-xl border-2 border-white/20 dark:border-white/10 p-1 hover:border-accent transition-all'>
                      <div className='h-20 rounded-lg bg-muted/40 flex items-center justify-center border border-white/10'>
                        <span className='rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground font-medium'>
                          Clean
                        </span>
                      </div>
                    </div>
                    <span className='block w-full p-2 text-center text-xs font-medium'>
                      Minimalist
                    </span>
                  </FormLabel>
                </FormItem>
              </RadioGroup>
            </FormItem>
          )}
        />

        {isServerSide && <Button type='submit'>Update</Button>}
      </form>
    </Form>
  )
}
