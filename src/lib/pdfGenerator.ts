import jsPDF from 'jspdf';

export interface PDFReportData {
  predictedFault: string;
  confidence: number;
  severity: string;
  explanation: string;
  recommendedActions: string;
  pdfContent?: string;
  description: string;
}

export class PDFReportGenerator {
  private doc: jsPDF;
  private currentY: number = 20;
  private pageHeight: number = 280;
  private margin: number = 20;

  constructor() {
    this.doc = new jsPDF();
  }

  private addText(text: string, fontSize: number = 10, isBold: boolean = false, maxWidth: number = 170) {
    this.doc.setFontSize(fontSize);
    this.doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    
    const lines = this.doc.splitTextToSize(text, maxWidth);
    
    for (const line of lines) {
      if (this.currentY > this.pageHeight) {
        this.doc.addPage();
        this.currentY = 20;
      }
      this.doc.text(line, this.margin, this.currentY);
      this.currentY += (fontSize * 0.35) + 2; // Better line spacing
    }
  }

  private parsePlainTextContent(content: string): void {
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (!line) {
        this.currentY += 4; // Blank line spacing
        continue;
      }
      
      // Check if line is a section header (all caps)
      if (line === line.toUpperCase() && line.length > 3 && !line.startsWith('-') && !line.match(/^\d+\./)) {
        this.currentY += 8; // Space before section
        this.addText(line, 12, true);
        this.currentY += 4; // Space after section header
      }
      // Check if line starts with dash (bullet point)
      else if (line.startsWith('-')) {
        const bulletText = line.substring(1).trim();
        this.addText(`• ${bulletText}`, 10, false);
        this.currentY += 2;
      }
      // Check if line starts with number (numbered list)
      else if (line.match(/^\d+\./)) {
        this.addText(line, 10, false);
        this.currentY += 2;
      }
      // Regular paragraph text
      else {
        this.addText(line, 10, false);
        this.currentY += 3;
      }
    }
  }

  private addSection(title: string, content: string) {
    this.currentY += 5;
    this.addText(title, 12, true);
    this.currentY += 3;
    this.addText(content, 10, false);
    this.currentY += 8;
  }

  private addHeader() {
    // Header
    this.doc.setFontSize(18);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('VEHICLE DIAGNOSTIC REPORT', this.margin, this.currentY);
    this.currentY += 10;
    
    // Add line
    this.doc.setLineWidth(0.5);
    this.doc.line(this.margin, this.currentY, 190, this.currentY);
    this.currentY += 10;
    
    // Report metadata
    const reportId = Math.random().toString(36).substr(2, 9).toUpperCase();
    const date = new Date().toLocaleDateString();
    
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(`Report ID: ${reportId}`, this.margin, this.currentY);
    this.doc.text(`Generated: ${date}`, 120, this.currentY);
    this.currentY += 15;
  }

  private addFooter() {
    const pageCount = this.doc.getNumberOfPages();
    
    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i);
      this.doc.setFontSize(8);
      this.doc.setFont('helvetica', 'italic');
      
      const disclaimerText = 'This AI-powered diagnostic report is for informational purposes only. Professional mechanical inspection is recommended.';
      this.doc.text(disclaimerText, this.margin, 285, { maxWidth: 170 });
      
      this.doc.text(`Page ${i} of ${pageCount}`, 180, 290);
    }
  }

  generatePDF(data: PDFReportData): void {
    this.addHeader();

    if (data.pdfContent && data.pdfContent.trim()) {
      // Use AI-generated plain text content
      this.parsePlainTextContent(data.pdfContent);
    } else {
      // Fallback to basic report structure
      this.addSection('EXECUTIVE SUMMARY', 
        `Primary Fault: ${data.predictedFault}\n` +
        `Severity Level: ${data.severity.toUpperCase()}\n` +
        `Confidence Level: ${data.confidence}%`
      );

      this.addSection('PROBLEM DESCRIPTION',
        `Symptoms Reported: ${data.description}\n` +
        `Analysis Date: ${new Date().toLocaleDateString()}\n` +
        `Diagnostic Method: AI-Powered Analysis`
      );

      this.addSection('DETAILED DIAGNOSIS', data.explanation);

      this.addSection('RECOMMENDED SOLUTION', data.recommendedActions);

      this.addSection('SAFETY CONSIDERATIONS',
        'Please consult with a qualified mechanic for proper diagnosis and repair. ' +
        'Do not ignore warning signs or continue driving if the issue affects vehicle safety.'
      );

      this.addSection('DISCLAIMER',
        'This AI-powered diagnostic report is for informational purposes only. ' +
        'Professional mechanical inspection is recommended for accurate diagnosis and safe repairs. ' +
        'The AI system provides estimates based on symptom patterns and may not account for all variables.'
      );
    }

    this.addFooter();

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `Vehicle_Diagnostic_Report_${timestamp}.pdf`;
    
    this.doc.save(filename);
  }
}