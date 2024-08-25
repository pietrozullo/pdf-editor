// components/Sidebar.tsx
import React, { useEffect, useState } from 'react';
import { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist/types/src/display/api';
import { Button } from "@/components/ui/button"

interface SidebarProps {
  pdfDoc: PDFDocumentProxy | null;
  onDeletePage: (pageNum: number) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ pdfDoc, onDeletePage }) => {
  const [thumbnails, setThumbnails] = useState<string[]>([]);

  useEffect(() => {
    if (!pdfDoc) return;

    const generateThumbnails = async () => {
      const newThumbnails = [];
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page: PDFPageProxy = await pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale: 0.2 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: context!, viewport }).promise;
        newThumbnails.push(canvas.toDataURL());
      }
      setThumbnails(newThumbnails);
    };

    generateThumbnails();
  }, [pdfDoc]);

  return (
    <div className="w-64 bg-gray-100 overflow-y-auto">
      {thumbnails.map((thumbnail, index) => (
        <div
          key={index}
          className="relative p-2"
        >
          <img src={thumbnail} alt={`Page ${index + 1}`} className="w-full" />
          <Button
            className="absolute top-1 right-1"
            onClick={() => onDeletePage(index + 1)}
          >
            X
          </Button>
        </div>
      ))}
    </div>
  );
};

export default Sidebar;