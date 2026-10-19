import { allCoreContent } from '@/lib/content'
import { contentProvider } from '@/lib/cms/content-provider'
import Main from './Main'

export default async function Page() {
  const blogs = await contentProvider.getAllBlogs()
  const posts = allCoreContent(blogs)
  return <Main posts={posts as any} />
}
