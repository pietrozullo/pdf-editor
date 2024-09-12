// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.9.359/pdf.worker.min.js";

// DOM elements
const dropArea = document.getElementById("drop-area");
const fileElem = document.getElementById("fileElem");
const pdfViewer = document.getElementById("pdf-viewer");
const sidebar = document.getElementById("sidebar");
const toggleSidebar = document.getElementById("toggle-sidebar");
const downloadPdfButton = document.getElementById("download-pdf");

// Global variables
let pdfDoc = null;
let pdfData = null;
let currentPage = 1;
let originalFileName = "document.pdf";
let undoStack = [];
const MAX_UNDO_STEPS = 10;

// Event listeners
document.addEventListener("keydown", handleKeyDown);
dropArea.addEventListener("drop", handleDrop);
dropArea.addEventListener("click", () => fileElem.click());
fileElem.addEventListener("change", handleFiles);
toggleSidebar.addEventListener("click", () => sidebar.classList.toggle("hidden"));
downloadPdfButton.addEventListener("click", downloadPdf);

// Hide sidebar initially
document.addEventListener("DOMContentLoaded", () => {
  hideSidebar();
});

// Drag and drop events
["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
  dropArea.addEventListener(eventName, preventDefaults);
  document.body.addEventListener(eventName, preventDefaults);
});

["dragenter", "dragover"].forEach((eventName) => {
  dropArea.addEventListener(eventName, highlight);
});

["dragleave", "drop"].forEach((eventName) => {
  dropArea.addEventListener(eventName, unhighlight);
});

// Functions
function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

function highlight() {
  dropArea.classList.add("highlight");
}

function unhighlight() {
  dropArea.classList.remove("highlight");
}

function handleDrop(e) {
  const files = e.dataTransfer.files;
  handleFiles(files);
}

function handleFiles(files) {
  if (files instanceof FileList) {
    [...files].forEach(uploadFile);
  } else if (files.target && files.target.files) {
    [...files.target.files].forEach(uploadFile);
  }
}

function uploadFile(file) {
  if (file.type !== "application/pdf") {
    alert("Please upload a PDF file.");
    return;
  }

  originalFilename = file.name;
  const reader = new FileReader();
  reader.onload = function (e) {
    pdfData = e.target.result;
    loadPDF(new Uint8Array(pdfData));
    downloadPdfButton.style.display = "inline-block";
  };
  reader.readAsArrayBuffer(file);
}

function loadPDF(data) {
  return pdfjsLib.getDocument(data).promise.then(function (pdf) {
    pdfDoc = pdf;
    const documentNameElement = document.getElementById("document-name");
    documentNameElement.textContent = originalFilename;
    pdfViewer.innerHTML = "";
    sidebar.innerHTML = "";
    const numPages = pdf.numPages;
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      renderPage(pageNum, numPages);
      renderThumbnail(pageNum);
      removeUploadArea();
    }
    setActivePage(Math.min(currentPage, numPages));
    showSidebar(); // Add this line to show the sidebar
  });
}

function showSidebar() {
  sidebar.classList.add("visible");
}

function hideSidebar() {
  sidebar.classList.remove("visible");
}

// Update the toggle sidebar function
toggleSidebar.addEventListener("click", () => {
  sidebar.classList.toggle("visible");
});

function removeUploadArea() {
  dropArea.style.display = "none";
  fileElem.style.display = "none";
}

function renderPage(pageNum, totalPages) {
  pdfDoc.getPage(pageNum).then(function (page) {
    const scale = 1.5;
    const viewport = page.getViewport({ scale: scale });

    const pageContainer = document.createElement("div");
    pageContainer.className = "page-container";
    pageContainer.id = `page-${pageNum}`;
    pageContainer.style.width = `${viewport.width}px`;
    pageContainer.style.height = `${viewport.height}px`;

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    pageContainer.appendChild(canvas);

    const pageNumber = document.createElement("div");
    pageNumber.className = "page-number";
    pageNumber.textContent = `Page ${pageNum} of ${totalPages}`;
    pageContainer.appendChild(pageNumber);

    pdfViewer.appendChild(pageContainer);

    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };
    page.render(renderContext);
  });
}

function renderThumbnail(pageNum) {
  pdfDoc.getPage(pageNum).then(function (page) {
    const scale = 0.3;
    const viewport = page.getViewport({ scale: scale });

    const thumbnailContainer = document.createElement("div");
    thumbnailContainer.className = "thumbnail-container";
    thumbnailContainer.dataset.pageNum = pageNum;
    thumbnailContainer.addEventListener("click", () => setActivePage(pageNum));

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    canvas.className = "thumbnail";

    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };
    page.render(renderContext);

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-button";
    deleteButton.textContent = "x";
    deleteButton.onclick = (e) => {
      e.stopPropagation();
      deletePage(pageNum);
    };

    thumbnailContainer.appendChild(canvas);
    thumbnailContainer.appendChild(deleteButton);

    sidebar.appendChild(thumbnailContainer);
  });
}

function setActivePage(pageNum) {
  currentPage = pageNum;
  moveToPage(pageNum);
  updateActiveThumbnail();
}

function moveToPage(pageNum) {
  const page = document.getElementById(`page-${pageNum}`);
  if (page) {
    page.scrollIntoView({ behavior: "instant", block: "start" });
  }
}

function updateActiveThumbnail() {
  const thumbnails = document.querySelectorAll(".thumbnail");
  thumbnails.forEach((thumbnail) => {
    const pageNum = parseInt(thumbnail.parentElement.dataset.pageNum);
    if (pageNum === currentPage) {
      thumbnail.classList.add("active");
    } else {
      thumbnail.classList.remove("active");
    }
  });
}

function handleKeyDown(e) {
  if (
    e.key === "Backspace" &&
    document.activeElement.tagName !== "INPUT" &&
    document.activeElement.tagName !== "TEXTAREA"
  ) {
    e.preventDefault();
    deletePage(currentPage);
  }
  if (e.ctrlKey && e.key === "z") {
    e.preventDefault();
    undoLastAction();
  }
}

async function deletePage(pageNum) {
  if (pdfDoc.numPages === 1) {
    alert("Cannot delete the last page of the PDF.");
    return;
  }

  try {
    undoStack.push({
      action: "delete",
      pageNum: pageNum,
      pageData: await pdfDoc.getPage(pageNum).then((page) => page.getViewport({ scale: 1.5 })),
      pdfData: pdfData.slice(0),
    });
    if (undoStack.length > MAX_UNDO_STEPS) {
      undoStack.shift();
    }

    const PDFDoc = await PDFLib.PDFDocument.load(pdfData);
    PDFDoc.removePage(pageNum - 1);

    const pdfBytes = await PDFDoc.save();
    pdfData = pdfBytes.buffer;

    pdfDoc = await pdfjsLib.getDocument(pdfData).promise;

    const deletedPage = document.getElementById(`page-${pageNum}`);
    if (deletedPage) deletedPage.remove();

    const deletedThumbnail = sidebar.children[pageNum - 1];
    if (deletedThumbnail) deletedThumbnail.remove();

    updateRemainingPages(pageNum);

    if (pageNum > pdfDoc.numPages) {
      setActivePage(pdfDoc.numPages);
    } else {
      setActivePage(pageNum);
    }
  } catch (error) {
    console.error("Error deleting page:", error);
    alert("An error occurred while deleting the page. Please try again.");
  }
}

async function undoLastAction() {
  if (undoStack.length === 0) {
    console.log("Nothing to undo");
    return;
  }

  const lastAction = undoStack.pop();

  if (lastAction.action === "delete") {
    try {
      pdfData = lastAction.pdfData;
      pdfDoc = await pdfjsLib.getDocument(pdfData).promise;

      const pageContainer = document.createElement("div");
      pageContainer.className = "page-container";
      pageContainer.id = `page-${lastAction.pageNum}`;
      pageContainer.style.width = `${lastAction.pageData.width}px`;
      pageContainer.style.height = `${lastAction.pageData.height}px`;

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      canvas.height = lastAction.pageData.height;
      canvas.width = lastAction.pageData.width;

      pageContainer.appendChild(canvas);

      const pageNumber = document.createElement("div");
      pageNumber.className = "page-number";
      pageNumber.textContent = `Page ${lastAction.pageNum} of ${pdfDoc.numPages}`;
      pageContainer.appendChild(pageNumber);

      const nextPage = document.getElementById(`page-${lastAction.pageNum}`);
      if (nextPage) {
        pdfViewer.insertBefore(pageContainer, nextPage);
      } else {
        pdfViewer.appendChild(pageContainer);
      }

      const page = await pdfDoc.getPage(lastAction.pageNum);
      const renderContext = {
        canvasContext: context,
        viewport: lastAction.pageData,
      };
      await page.render(renderContext);

      const thumbnailContainer = document.createElement("div");
      thumbnailContainer.className = "thumbnail-container";
      thumbnailContainer.dataset.pageNum = lastAction.pageNum;

      const thumbnailCanvas = document.createElement("canvas");
      const thumbnailContext = thumbnailCanvas.getContext("2d");
      const thumbnailViewport = page.getViewport({ scale: 0.3 });
      thumbnailCanvas.height = thumbnailViewport.height;
      thumbnailCanvas.width = thumbnailViewport.width;
      thumbnailCanvas.className = "thumbnail";

      thumbnailContainer.appendChild(thumbnailCanvas);

      const deleteButton = document.createElement("button");
      deleteButton.className = "delete-button";
      deleteButton.textContent = "X";
      deleteButton.onclick = (e) => {
        e.stopPropagation();
        deletePage(lastAction.pageNum);
      };
      thumbnailContainer.appendChild(deleteButton);

      const nextThumbnail = sidebar.querySelector(
        `.thumbnail-container[data-page-num="${lastAction.pageNum}"]`
      );
      if (nextThumbnail) {
        sidebar.insertBefore(thumbnailContainer, nextThumbnail);
      } else {
        sidebar.appendChild(thumbnailContainer);
      }

      const thumbnailRenderContext = {
        canvasContext: thumbnailContext,
        viewport: thumbnailViewport,
      };
      await page.render(thumbnailRenderContext);

      thumbnailContainer.addEventListener("click", () => {
        setActivePage(lastAction.pageNum);
      });

      updateRemainingPages(lastAction.pageNum);

      setActivePage(lastAction.pageNum);
    } catch (error) {
      console.error("Error undoing last action:", error);
      alert("An error occurred while undoing the last action. Please try again.");
    }
  }
}

function updateRemainingPages(startPageNum) {
  const pages = Array.from(pdfViewer.children);
  const thumbnails = Array.from(sidebar.children);

  for (let i = startPageNum - 1; i < pages.length; i++) {
    const page = pages[i];
    const thumbnail = thumbnails[i];
    const newPageNum = i + 1;

    page.id = `page-${newPageNum}`;
    const pageNumber = page.querySelector(".page-number");
    if (pageNumber) pageNumber.textContent = `Page ${newPageNum} of ${pdfDoc.numPages}`;

    if (thumbnail) {
      thumbnail.dataset.pageNum = newPageNum;
      thumbnail.onclick = (e) => {
        e.preventDefault();
        setActivePage(newPageNum);
      };
      const deleteButton = thumbnail.querySelector(".delete-button");
      if (deleteButton) {
        deleteButton.onclick = (e) => {
          e.stopPropagation();
          deletePage(newPageNum);
        };
      }
    }
  }
}

function downloadPdf() {
  if (pdfData) {
    const blob = new Blob([pdfData], { type: "application/pdf" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filenameParts = originalFilename.split(".");
    const filenameWithoutExtension = filenameParts.slice(0, -1).join(".");
    const extension = filenameParts[filenameParts.length - 1];
    const newFilename = `${filenameWithoutExtension}_edited_${timestamp}.${extension}`;

    link.download = newFilename;
    link.click();
    
    // Capture the download event
    posthog.capture('pdf_downloaded');
    
    URL.revokeObjectURL(link.href);
  } else {
    alert("No PDF loaded to download.");
  }
}

// Intersection Observer setup
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const pageNum = parseInt(entry.target.id.split("-")[1]);
        if (pageNum !== currentPage) {
          setActivePage(pageNum);
        }
      }
    });
  },
  { threshold: 0.5 }
);

const mutationObserver = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === "childList") {
      mutation.addedNodes.forEach((node) => {
        if (node.classList && node.classList.contains("page-container")) {
          observer.observe(node);
        }
      });
    }
  });
});

mutationObserver.observe(pdfViewer, { childList: true });


let parallaxEnabled = true;
document.addEventListener('mousemove', (e) => {
  if (!parallaxEnabled) return;

  const mouseX = (e.clientX / window.innerWidth - 0.5) * 2; // -1 to 1
  const mouseY = (e.clientY / window.innerHeight - 0.5) * 2; // -1 to 1

  const rotateX = mouseY * -10; // Rotation around X-axis
  const rotateY = mouseX * 10; // Rotation around Y-axis
  const translateZ = 50; // Gives a bit of a "push" effect

  pdfViewer.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(${translateZ * (1 - Math.abs(mouseX))}px)`;
});