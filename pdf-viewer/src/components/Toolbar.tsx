'use client'

// components/Toolbar.tsx
import React from 'react';
import { Button } from "@/components/ui/button"

interface ToolbarProps {
  numPages: number;
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onDownload: () => void;
  onUndo: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
  numPages,
  scale,
  onZoomIn,
  onZoomOut,
  onDownload,
  onUndo
}) => {
  return (
    <div className="flex justify-between items-center p-4 bg-gray-200">
      <div>
        <span>Total Pages: {numPages}</span>
      </div>
      <div>
        <Button onClick={onZoomOut}>-</Button>
        <span className="mx-2">{Math.round(scale * 100)}%</span>
        <Button onClick={onZoomIn}>+</Button>
        <Button onClick={onDownload} className="ml-2">Download</Button>
        <Button onClick={onUndo} className="ml-2">Undo</Button>
      </div>
    </div>
  );
};

export default Toolbar;