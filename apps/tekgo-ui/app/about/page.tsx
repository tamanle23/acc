/* eslint-disable prettier/prettier */
 
 
import { Authors, allAuthors } from '@/lib/content'
import { PortableTextRenderer } from '@/components/PortableTextRenderer'
import AuthorLayout from '@/layouts/AuthorLayout'
import { coreContent } from '@/lib/content'
import { genPageMetadata } from 'app/seo'

export const metadata = genPageMetadata({ title: 'About' })

export default function Page() {
  const author = allAuthors.find((p) => p.slug === 'default') as Authors
  const mainContent = coreContent(author as any)

  return (
    <>
      <AuthorLayout content={mainContent as any}>
        <PortableTextRenderer content={author.portableTextBody} />
      </AuthorLayout>
    </>
  )
}
