import { AxiosError } from 'axios'
import { toast } from 'sonner'
import { getErrorMessage } from '@/core/utils/error-extractor'

export function handleServerError(error: unknown) {
  // eslint-disable-next-line no-console
  console.log(error)

  if (
    error &&
    typeof error === 'object' &&
    'status' in error &&
    Number(error.status) === 204
  ) {
    toast.error('Content not found.')
    return
  }

  if (error instanceof AxiosError) {
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'] || error.response.headers['Retry-After']
      const errMsg = retryAfter 
        ? `Rate limit exceeded. Please wait ${retryAfter} seconds before retrying.`
        : 'Rate limit exceeded. Please wait a moment before trying again.'
      toast.error(errMsg, { duration: 5000 })
      return
    }
  }

  const errMsg = getErrorMessage(error, 'Something went wrong!')
  toast.error(errMsg)
}
