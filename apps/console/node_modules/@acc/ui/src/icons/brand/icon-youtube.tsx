import { type SVGProps } from 'react'
import { cn } from '../../lib/utils'

export function IconYoutube({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      role='img'
      viewBox='0 0 24 24'
      xmlns='http://www.w3.org/2000/svg'
      width='24'
      height='24'
      className={cn('[&>path]:stroke-current', className)}
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      {...props}
    >
      <title>YouTube</title>
      <path strokeWidth='0' d='M0 0h24v24H0z' fill='none' />
      <rect x='2' y='5' width='20' height='14' rx='4' />
      <polygon points='10 9 15 12 10 15 10 9' fill='currentColor' strokeWidth='0' />
    </svg>
  )
}
