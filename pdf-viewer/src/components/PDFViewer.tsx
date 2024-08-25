"use client";

import React, { useState, useEffect, useRef } from "react";
import { PDFDocument } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api";
import Toolbar from "./Toolbar";
import Sidebar from "./Sidebar";

const pdfcdn = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfcdn;

const PDFViewer: React.FC = () => {
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const [scale, setScale] = useState(1);
  const [originalFilename, setOriginalFilename] = useState("document.pdf");
  const [undoStack, setUndoStack] = useState<ArrayBuffer[]>([]);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pdfData) {
      loadPDF(pdfData);
    }
  }, [pdfData]);

  useEffect(() => {
    if (pdfDoc) {
      renderAllPages();
    }
  }, [pdfDoc, scale]);

  const loadPDF = async (data: ArrayBuffer, filename?: string) => {
    try {
      const pdf = await pdfjsLib.getDocument(data).promise;
      setPdfDoc(pdf);
      if (filename) setOriginalFilename(filename);
    } catch (error) {
      console.error("Error loading PDF:", error);
      alert("Failed to load PDF. Please try again with a different file.");
    }
  };

  const deletePage = async (pageToDelete: number) => {
    if (!pdfDoc || pdfDoc.numPages === 1 || !pdfData) return;

    setUndoStack((prev) => [...prev, pdfData.slice(0)]);

    try {
      const pdfDoc2 = await PDFDocument.load(pdfData);
      pdfDoc2.removePage(pageToDelete - 1);
      const pdfBytes = await pdfDoc2.save();
      const newPdfData = pdfBytes.buffer;

      setPdfData(newPdfData);
    } catch (error) {
      console.error("Error deleting page:", error);
      alert("Failed to delete page. Please try again.");
    }
  };

  const undoLastAction = () => {
    if (undoStack.length === 0) return;
    const lastPdfData = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setPdfData(lastPdfData);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result instanceof ArrayBuffer) {
          setPdfData(e.target.result);
          setOriginalFilename(file.name);
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && file.type === "application/pdf") {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result instanceof ArrayBuffer) {
          setPdfData(e.target.result);
          setOriginalFilename(file.name);
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (
      event.key === "Backspace" &&
      document.activeElement?.tagName !== "INPUT" &&
      document.activeElement?.tagName !== "TEXTAREA"
    ) {
      event.preventDefault();
      deletePage(1); // Delete the first page since we're not tracking the current page
    }
  };

  const downloadPDF = () => {
    if (!pdfData) return;
    const blob = new Blob([pdfData], { type: "application/pdf" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filenameParts = originalFilename.split(".");
    const filenameWithoutExtension = filenameParts.slice(0, -1).join(".");
    const extension = filenameParts[filenameParts.length - 1];
    link.download = `${filenameWithoutExtension}_edited_${timestamp}.${extension}`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handlePromptClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const renderAllPages = async () => {
    if (!pdfDoc) return;

    const pagePromises = Array.from({ length: pdfDoc.numPages }, async (_, i) => {
      await renderPage(i + 1);
    });

    await Promise.all(pagePromises);
  };

  const renderPage = async (pageNumber: number) => {
    if (!pdfDoc) return;

    const page = await pdfDoc.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const canvas = canvasRefs.current[pageNumber - 1];
    if (!canvas) return;

    const context = canvas.getContext("2d");
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderContext = {
      canvasContext: context!,
      viewport: viewport,
    };

    await page.render(renderContext).promise;
  };

  return (
    <div
      className="flex flex-col h-screen"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <Toolbar
        numPages={pdfDoc?.numPages || 0}
        scale={scale}
        onZoomIn={() => setScale((prev) => Math.min(prev + 0.1, 2))}
        onZoomOut={() => setScale((prev) => Math.max(prev - 0.1, 0.5))}
        onDownload={downloadPDF}
        onUndo={undoLastAction}
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar pdfDoc={pdfDoc} onDeletePage={deletePage} />
        <div
          className="flex-1 overflow-auto p-4 bg-gray-100"
          onClick={handlePromptClick}
        >
          {!pdfDoc && (
            <div className="text-center">
              <p className="text-xl font-semibold mb-2">
                Drag and drop a PDF file here
              </p>
              <p className="text-gray-500">or click to select a file</p>
            </div>
          )}
          {pdfDoc && (
            <div className="space-y-4">
              {Array.from({ length: pdfDoc.numPages }, (_, i) => (
                <canvas
                  key={i}
                  ref={(canvas) => (canvasRefs.current[i] = canvas)}
                  className="mx-auto border border-gray-200 shadow-md"
                />
              ))}
            </div>
          )}
        </div>
      </div>
      <input
        type="file"
        accept=".pdf"
        onChange={handleFileUpload}
        className="hidden"
        ref={fileInputRef}
      />
    </div>
  );
};

export default PDFViewer;