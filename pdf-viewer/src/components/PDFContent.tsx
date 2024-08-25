'use client'

import React, { useEffect, useRef } from 'react'
import { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'

interface PDFContentProps {
  pdfDoc: PDFDocumentProxy | null
  scale: number
}

const PDFContent: React.FC<PDFContentProps> = ({ pdfDoc, scale }) => {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const renderPages = async () => {
      if (pdfDoc && containerRef.current) {
        containerRef.current.innerHTML = ''
        for (let i = 1; i <= pdfDoc.numPages; i++) {
          const page: PDFPageProxy = await pdfDoc.getPage(i)
          const viewport = page.getViewport({ scale })
          const canvas = document.createElement('canvas')
          const context = canvas.getContext('2d')
          canvas.height = viewport.height
          canvas.width = viewport.width

          const renderContext = {
            canvasContext: context!,
            viewport: viewport
          }
          await page.render(renderContext).promise
          containerRef.current.appendChild(canvas)
        }
      }
    }

    renderPages()
  }, [pdfDoc, scale])

  return (
    <div className="flex-1 overflow-auto bg-gray-300 p-4">
      <div ref={containerRef} className="flex flex-col items-center space-y-4">
        {/* Pages will be rendered here */}
      </div>
    </div>
  )
}

export default PDFContent