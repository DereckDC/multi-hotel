/**
 * Reportes en PDF con forma de tabla (listados del panel), con la marca de Roomia PMS.
 * A4 horizontal, encabezado con título y filtros, tabla que se corta sola en varias páginas
 * repitiendo la fila de títulos, y número de página al pie.
 */
import { jsPDF } from 'jspdf';
import { useBrandFont } from './pdfFonts';
import { PDF_COLORS } from './brandTheme';

export interface ReportColumn {
  title: string;
  /** Ancho relativo de la columna (se reparte el ancho útil de la hoja) */
  weight: number;
  align?: 'left' | 'right' | 'center';
}

export interface TableReport {
  title: string;
  /** Línea bajo el título: filtros aplicados, establecimiento… */
  subtitle?: string;
  columns: ReportColumn[];
  rows: string[][];
  /** Texto cuando no hay filas */
  emptyText?: string;
}

const MARGIN = 12;
const LINE = 3.6;
const CELL_PAD = 1.8;

export async function buildTableReport(report: TableReport): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const font = await useBrandFont(doc);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const usable = pageW - MARGIN * 2;
  const totalWeight = report.columns.reduce((sum, c) => sum + c.weight, 0);
  const widths = report.columns.map(c => (c.weight / totalWeight) * usable);
  const generated = new Date().toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' });

  const header = () => {
    doc.setFillColor(...PDF_COLORS.navy);
    doc.rect(0, 0, pageW, 16, 'F');
    doc.setFont(font, 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text('ROOMIA PMS', MARGIN, 10.2);
    doc.setFont(font, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.onNavy);
    doc.text(`Generado el ${generated}`, pageW - MARGIN, 10.2, { align: 'right' });

    doc.setFont(font, 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...PDF_COLORS.ink);
    doc.text(report.title, MARGIN, 26);
    let y = 26;
    if (report.subtitle) {
      doc.setFont(font, 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...PDF_COLORS.muted);
      doc.text(report.subtitle, MARGIN, 31.5);
      y = 31.5;
    }
    return y + 6;
  };

  const tableHead = (y: number) => {
    doc.setFont(font, 'bold');
    doc.setFontSize(7.5);
    const lines = report.columns.map((c, i) => doc.splitTextToSize(c.title.toUpperCase(), widths[i] - CELL_PAD * 2) as string[]);
    const h = Math.max(...lines.map(l => l.length)) * LINE + CELL_PAD * 2;
    doc.setFillColor(...PDF_COLORS.soft);
    doc.rect(MARGIN, y, usable, h, 'F');
    doc.setDrawColor(...PDF_COLORS.borderStrong);
    doc.line(MARGIN, y + h, MARGIN + usable, y + h);
    doc.setTextColor(...PDF_COLORS.muted);
    let x = MARGIN;
    report.columns.forEach((c, i) => {
      drawCell(lines[i], x, y, widths[i], c.align);
      x += widths[i];
    });
    return y + h;
  };

  const drawCell = (lines: string[], x: number, y: number, w: number, align: ReportColumn['align'] = 'left') => {
    const tx = align === 'right' ? x + w - CELL_PAD : align === 'center' ? x + w / 2 : x + CELL_PAD;
    lines.forEach((line, j) => doc.text(line, tx, y + CELL_PAD + LINE * (j + 0.8), { align }));
  };

  let y = tableHead(header());

  if (report.rows.length === 0) {
    doc.setFont(font, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...PDF_COLORS.muted);
    doc.text(report.emptyText || 'Sin registros.', MARGIN + CELL_PAD, y + 8);
  }

  report.rows.forEach((row, rowIndex) => {
    doc.setFont(font, 'normal');
    doc.setFontSize(8);
    const lines = row.map((cell, i) => doc.splitTextToSize(cell || '—', widths[i] - CELL_PAD * 2) as string[]);
    const h = Math.max(...lines.map(l => l.length)) * LINE + CELL_PAD * 2;
    if (y + h > pageH - MARGIN - 6) {
      doc.addPage();
      y = tableHead(header());
      doc.setFont(font, 'normal');
      doc.setFontSize(8);
    }
    if (rowIndex % 2 === 1) {
      doc.setFillColor(250, 251, 252);
      doc.rect(MARGIN, y, usable, h, 'F');
    }
    doc.setTextColor(...PDF_COLORS.ink);
    let x = MARGIN;
    report.columns.forEach((c, i) => {
      drawCell(lines[i], x, y, widths[i], c.align);
      x += widths[i];
    });
    doc.setDrawColor(...PDF_COLORS.border);
    doc.line(MARGIN, y + h, MARGIN + usable, y + h);
    y += h;
  });

  // Pie con número de página
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFont(font, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...PDF_COLORS.muted);
    doc.text(`${report.rows.length} ${report.rows.length === 1 ? 'registro' : 'registros'}`, MARGIN, pageH - 6);
    doc.text(`Página ${page} de ${pages}`, pageW - MARGIN, pageH - 6, { align: 'right' });
  }
  return doc;
}
