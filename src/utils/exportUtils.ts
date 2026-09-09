import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

export const exportToCSV = (data: any[], fileName: string) => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const csv = XLSX.utils.sheet_to_csv(worksheet);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, `${fileName}.csv`);
};

export const exportToExcel = (data: any[], fileName: string) => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Responses');
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
  saveAs(blob, `${fileName}.xlsx`);
};

export const exportToPDF = async (elementId: string, fileName: string) => {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error('Element not found for PDF export.');
  }

  try {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      throw new Error('Popup blocked. Please allow popups to export to PDF.');
    }

    const headHtml = document.head.innerHTML;
    
    // We clone the element to modify it slightly for printing without affecting the original
    const elementClone = element.cloneNode(true) as HTMLElement;
    
    // Ensure all canvas elements (like charts, if any are canvas) are converted to images or preserved
    // Actually Recharts uses SVG, so outerHTML works natively.
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${fileName}</title>
          ${headHtml}
          <style>
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .print-controls { display: none !important; }
            }
            body { 
              background: #f3f4f6 !important; 
              margin: 0; 
              padding: 0;
              color: black;
            }
            .content-wrapper {
              background: white;
              max-width: 1200px;
              margin: 0 auto;
              padding: 40px;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            }
            .print-controls { 
              position: sticky; 
              top: 0; 
              background: white; 
              padding: 16px 32px; 
              border-bottom: 1px solid #e5e7eb; 
              z-index: 1000; 
              display: flex; 
              justify-content: space-between; 
              align-items: center;
              font-family: system-ui, -apple-system, sans-serif;
              box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
            }
            .print-btn {
              background: #e11d48; 
              color: white; 
              border: none; 
              padding: 10px 20px; 
              border-radius: 8px; 
              font-weight: 700; 
              cursor: pointer; 
              font-size: 14px;
              transition: all 0.2s;
            }
            .print-btn:hover {
              background: #be123c;
            }
            .no-print { display: none !important; }
            #${elementId} {
              box-shadow: none !important;
              border: none !important;
              max-width: 100% !important;
              margin: 0 !important;
            }
          </style>
        </head>
        <body>
          <div class="print-controls">
            <div>
              <h2 style="margin: 0; font-size: 18px; color: #111827;">Report Preview</h2>
              <p style="margin: 4px 0 0; font-size: 13px; color: #6b7280;">Click the button to save as PDF or print</p>
            </div>
            <button class="print-btn" onclick="window.print()">
              Download / Print PDF
            </button>
          </div>
          <div class="content-wrapper">
            ${elementClone.outerHTML}
          </div>
        </body>
      </html>
    `);
    
    printWindow.document.close();
  } catch (err) {
    console.error('PDF export failed:', err);
    throw err;
  }
};
