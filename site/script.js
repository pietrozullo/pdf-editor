pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.9.359/pdf.worker.min.js";

const dropArea = document.getElementById("drop-area");
const fileElem = document.getElementById("fileElem");
const pdfViewer = document.getElementById("pdf-viewer");
const sidebar = document.getElementById("sidebar");
const toggleSidebar = document.getElementById("toggle-sidebar");
const downloadPdfButton = document.getElementById("download-pdf");

let pdfDoc = null;
let pageNum = 1;
let pdfData = null;
let currentPage = 1;
let originalFileName = "document.pdf";

["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
  dropArea.addEventListener(eventName, preventDefaults, false);
  document.body.addEventListener(eventName, preventDefaults, false);
});

["dragenter", "dragover"].forEach((eventName) => {
  dropArea.addEventListener(eventName, highlight, false);
});

["dragleave", "drop"].forEach((eventName) => {
  dropArea.addEventListener(eventName, unhighlight, false);
});

document.addEventListener("keydown", handleKeyDown);
dropArea.addEventListener("drop", handleDrop, false);
dropArea.addEventListener("click", () => fileElem.click());
fileElem.addEventListener("change", handleFiles);
toggleSidebar.addEventListener("click", () => {
  sidebar.classList.toggle("hidden");
});
downloadPdfButton.addEventListener("click", downloadPdf);

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
  const dt = e.dataTransfer;
  const files = dt.files;
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

  // Store the original filename
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
    pdfViewer.innerHTML = "";
    sidebar.innerHTML = "";
    const numPages = pdf.numPages;
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      renderPage(pageNum, numPages);
      renderThumbnail(pageNum);
    }
    setActivePage(Math.min(currentPage, numPages)); // Set the active page, but don't exceed the number of pages
  });
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
    const scale = 0.2;
    const viewport = page.getViewport({ scale: scale });

    const thumbnailContainer = document.createElement("div");
    thumbnailContainer.className = "thumbnail";
    thumbnailContainer.onclick = (e) => {
      e.preventDefault();
      setActivePage(pageNum);
      scrollToPage(pageNum, false);
    };

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    thumbnailContainer.appendChild(canvas);

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-button";
    deleteButton.textContent = "X";
    deleteButton.onclick = (e) => {
      e.stopPropagation();
      deletePage(pageNum);
    };
    thumbnailContainer.appendChild(deleteButton);

    sidebar.appendChild(thumbnailContainer);

    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };
    page.render(renderContext);
  });
}

function setActivePage(pageNum) {
  currentPage = pageNum;
  updateActiveThumbnail(pageNum);
}

function updateActiveThumbnail(pageNum) {
  const thumbnails = sidebar.getElementsByClassName("thumbnail");
  for (let i = 0; i < thumbnails.length; i++) {
    thumbnails[i].classList.remove("active");
  }
  if (thumbnails.length > 0 && thumbnails[pageNum - 1]) {
    thumbnails[pageNum - 1].classList.add("active");
  }
}

function scrollToPage(pageNum, smooth = true) {
  const pageElement = document.getElementById(`page-${pageNum}`);
  if (pageElement) {
    pageElement.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  }
}

function handleKeyDown(e) {
  if (
    e.key === "Backspace" &&
    document.activeElement.tagName !== "INPUT" &&
    document.activeElement.tagName !== "TEXTAREA"
  ) {
    e.preventDefault(); // Prevent the browser from navigating back
    deletePage(currentPage);
  }
}

// Add these variables to your existing global variables
let undoStack = [];
const MAX_UNDO_STEPS = 10;

// Modify the deletePage function
async function deletePage(pageNum) {
  if (pdfDoc.numPages === 1) {
    alert("Cannot delete the last page of the PDF.");
    return;
  }

  try {
    // Store the current state for undo
    undoStack.push({
      action: "delete",
      pageNum: pageNum,
      pageData: await pdfDoc.getPage(pageNum).then((page) => page.getViewport({ scale: 1.5 })),
      pdfData: pdfData.slice(0), // Create a copy of the current PDF data
    });
    if (undoStack.length > MAX_UNDO_STEPS) {
      undoStack.shift(); // Remove the oldest action if we exceed the max
    }

    const PDFDoc = await PDFLib.PDFDocument.load(pdfData);
    PDFDoc.removePage(pageNum - 1);

    const pdfBytes = await PDFDoc.save();
    pdfData = pdfBytes.buffer;

    // Update the pdfDoc without reloading
    pdfDoc = await pdfjsLib.getDocument(pdfData).promise;

    // Remove the deleted page from the viewer
    const deletedPage = document.getElementById(`page-${pageNum}`);
    if (deletedPage) deletedPage.remove();

    // Remove the deleted thumbnail
    const deletedThumbnail = sidebar.children[pageNum - 1];
    if (deletedThumbnail) deletedThumbnail.remove();

    // Update page numbers and IDs for remaining pages
    updateRemainingPages(pageNum);

    // Adjust currentPage if necessary
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

// Add this new function for the undo functionality
// Modify the undoLastAction function
async function undoLastAction() {
  if (undoStack.length === 0) {
    console.log("Nothing to undo");
    return;
  }

  const lastAction = undoStack.pop();

  if (lastAction.action === "delete") {
    try {
      // Restore the PDF data
      pdfData = lastAction.pdfData;
      pdfDoc = await pdfjsLib.getDocument(pdfData).promise;

      // Insert the page back into the viewer
      const pageContainer = document.createElement("div");
      pageContainer.className = "page-container";
      pageContainer.id = `page-${lastAction.pageNum}`;

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      canvas.height = lastAction.pageData.height;
      canvas.width = lastAction.pageData.width;

      pageContainer.appendChild(canvas);

      const pageNumber = document.createElement("div");
      pageNumber.className = "page-number";
      pageNumber.textContent = `Page ${lastAction.pageNum} of ${pdfDoc.numPages}`;
      pageContainer.appendChild(pageNumber);

      // Find the correct position to insert the page
      const nextPage = document.getElementById(`page-${lastAction.pageNum + 1}`);
      if (nextPage) {
        pdfViewer.insertBefore(pageContainer, nextPage);
      } else {
        pdfViewer.appendChild(pageContainer);
      }

      // Render the page
      const page = await pdfDoc.getPage(lastAction.pageNum);
      const renderContext = {
        canvasContext: context,
        viewport: lastAction.pageData,
      };
      await page.render(renderContext);

      // Insert the thumbnail back
      const thumbnailContainer = document.createElement("div");
      thumbnailContainer.className = "thumbnail";
      thumbnailContainer.onclick = (e) => {
        e.preventDefault();
        setActivePage(lastAction.pageNum);
        scrollToPage(lastAction.pageNum, false);
      };

      const thumbnailCanvas = document.createElement("canvas");
      const thumbnailContext = thumbnailCanvas.getContext("2d");
      const thumbnailViewport = page.getViewport({ scale: 0.2 });
      thumbnailCanvas.height = thumbnailViewport.height;
      thumbnailCanvas.width = thumbnailViewport.width;

      thumbnailContainer.appendChild(thumbnailCanvas);

      const deleteButton = document.createElement("button");
      deleteButton.className = "delete-button";
      deleteButton.textContent = "X";
      deleteButton.onclick = (e) => {
        e.stopPropagation();
        deletePage(lastAction.pageNum);
      };
      thumbnailContainer.appendChild(deleteButton);

      // Find the correct position to insert the thumbnail
      const nextThumbnail = sidebar.children[lastAction.pageNum - 1];
      if (nextThumbnail) {
        sidebar.insertBefore(thumbnailContainer, nextThumbnail);
      } else {
        sidebar.appendChild(thumbnailContainer);
      }

      // Render the thumbnail
      const thumbnailRenderContext = {
        canvasContext: thumbnailContext,
        viewport: thumbnailViewport,
      };
      await page.render(thumbnailRenderContext);

      // Update page numbers and IDs for all pages
      updateRemainingPages(1);

      setActivePage(lastAction.pageNum);
      scrollToPage(lastAction.pageNum, false);
    } catch (error) {
      console.error("Error undoing last action:", error);
      alert("An error occurred while undoing the last action. Please try again.");
    }
  }
}

// Add this event listener for the Ctrl+Z shortcut
document.addEventListener("keydown", function (e) {
  if (e.ctrlKey && e.key === "z") {
    e.preventDefault(); // Prevent the browser's default undo action
    undoLastAction();
  }
});

function updateRemainingPages(deletedPageNum) {
  const pages = pdfViewer.children;
  const thumbnails = sidebar.children;

  for (let i = deletedPageNum - 1; i < pages.length; i++) {
    const page = pages[i];
    const thumbnail = thumbnails[i];
    const newPageNum = i + 1;

    // Update page
    page.id = `page-${newPageNum}`;
    const pageNumber = page.querySelector(".page-number");
    if (pageNumber) pageNumber.textContent = `Page ${newPageNum} of ${pdfDoc.numPages}`;

    // Update thumbnail
    if (thumbnail) {
      thumbnail.onclick = (e) => {
        e.preventDefault();
        setActivePage(newPageNum);
        scrollToPage(newPageNum, false);
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

function updateActiveThumbnail(pageNum) {
  const thumbnails = sidebar.getElementsByClassName("thumbnail");
  for (let i = 0; i < thumbnails.length; i++) {
    thumbnails[i].classList.remove("active");
  }
  if (thumbnails.length > 0 && thumbnails[pageNum - 1]) {
    thumbnails[pageNum - 1].classList.add("active");
  }
}

function downloadPdf() {
  if (pdfData) {
    const blob = new Blob([pdfData], { type: "application/pdf" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);

    // Generate the new filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filenameParts = originalFilename.split(".");
    const filenameWithoutExtension = filenameParts.slice(0, -1).join(".");
    const extension = filenameParts[filenameParts.length - 1];
    const newFilename = `${filenameWithoutExtension}_edited_${timestamp}.${extension}`;

    link.download = newFilename;
    link.click();
    URL.revokeObjectURL(link.href);
  } else {
    alert("No PDF loaded to download.");
  }
}

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const pageNum = parseInt(entry.target.id.split("-")[1]);
        // Only update if it's different from the current page
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
