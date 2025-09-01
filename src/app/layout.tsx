import './globals.css'
import { Inter } from 'next/font/google'
import { TRPCProvider } from '@/lib/trpc-provider'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Forager RAG',
  description: 'Vectorless RAG implementation for document processing',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <TRPCProvider>
          {children}
        </TRPCProvider>
      </body>
    </html>
  )
}