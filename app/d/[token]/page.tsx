import { DownloadPage } from '@/components/download-page'

export const metadata = {
  title: 'Your download',
  // Not indexed: a delivery link is for one buyer, and a search engine
  // finding it would defeat the point of it expiring.
  robots: { index: false, follow: false },
}

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  return <DownloadPage token={token} />
}
