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

  constructor() {
    this.doc = new jsPDF();
  }

  generatePDF(data: PDFReportData) {
    const { description, predictedFault, confidence, severity, explanation, recommendedActions, pdfContent } = data;
    
    // Use the comprehensive PDF content if available, otherwise fall back to basic format
    if (pdfContent && pdfContent.trim().length > 100) {
      this.generateComprehensivePDF(pdfContent, predictedFault);
    } else {
      this.generateBasicPDF(data);
    }
  }

  private generateComprehensivePDF(pdfContent: string, predictedFault: string) {
    // Set up the PDF with professional styling
    this.doc.setFontSize(22);
    this.doc.setFont("helvetica", "bold");
    this.doc.text('VEHICLE DIAGNOSTIC REPORT', 20, 25);
    
    this.doc.setFontSize(10);
    this.doc.setFont("helvetica", "normal");
    this.doc.text(`Generated on: ${new Date().toLocaleDateString('en-US', { 
      year: 'numeric', month: 'long', day: 'numeric' 
    })}`, 20, 35);
    
    let yPosition = 50;
    const pageHeight = this.doc.internal.pageSize.height;
    const margin = 20;
    const lineHeight = 6;
    
    // Split content into lines and process each line
    const lines = pdfContent.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines but add some spacing
      if (line === '') {
        yPosition += lineHeight * 0.5;
        continue;
      }
      
      // Check if we need a new page
      if (yPosition > pageHeight - 30) {
        this.doc.addPage();
        yPosition = 20;
      }
      
      // Handle section headers (UPPERCASE lines)
      if (line === line.toUpperCase() && line.length > 3 && !line.includes(':') && !line.includes('$')) {
        this.doc.setFont("helvetica", "bold");
        this.doc.setFontSize(12);
        yPosition += lineHeight;
        this.doc.text(line, margin, yPosition);
        yPosition += lineHeight * 1.2;
        this.doc.setFont("helvetica", "normal");
        this.doc.setFontSize(10);
        continue;
      }
      
      // Handle subsection headers (lines ending with colon)
      if (line.endsWith(':') && line.length < 50) {
        this.doc.setFont("helvetica", "bold");
        this.doc.text(line, margin, yPosition);
        yPosition += lineHeight;
        this.doc.setFont("helvetica", "normal");
        continue;
      }
      
      // Handle bullet points and numbered lists
      if (line.startsWith('- ') || /^\d+\./.test(line)) {
        const splitLine = this.doc.splitTextToSize(line, 170);
        for (let j = 0; j < splitLine.length; j++) {
          if (yPosition > pageHeight - 30) {
            this.doc.addPage();
            yPosition = 20;
          }
          this.doc.text(splitLine[j], margin + (j > 0 ? 10 : 0), yPosition);
          yPosition += lineHeight;
        }
        continue;
      }
      
      // Handle regular text
      const splitLine = this.doc.splitTextToSize(line, 170);
      for (let j = 0; j < splitLine.length; j++) {
        if (yPosition > pageHeight - 30) {
          this.doc.addPage();
          yPosition = 20;
        }
        this.doc.text(splitLine[j], margin, yPosition);
        yPosition += lineHeight;
      }
    }
    
    // Add footer with page numbers (skip for now due to API limitations)
    // Note: Page numbering would require additional complexity with current jsPDF version
    
    // Save with descriptive filename
    const filename = `diagnostic-report-${predictedFault.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`;
    this.doc.save(filename);
  }

  private generateBasicPDF(data: PDFReportData) {
    const { description, predictedFault, confidence, severity, explanation, recommendedActions } = data;
    
    // Set up the PDF content
    this.doc.setFontSize(20);
    this.doc.text('Vehicle Diagnostic Report', 20, 20);
    
    this.doc.setFontSize(12);
    let yPosition = 40;
    
    // Problem Description
    this.doc.text('Problem Description:', 20, yPosition);
    yPosition += 10;
    const splitDescription = this.doc.splitTextToSize(description, 170);
    this.doc.text(splitDescription, 20, yPosition);
    yPosition += splitDescription.length * 5 + 10;
    
    // Primary Diagnosis
    this.doc.text(`Primary Diagnosis: ${predictedFault}`, 20, yPosition);
    yPosition += 10;
    this.doc.text(`Confidence: ${Math.round(confidence * 100)}%`, 20, yPosition);
    yPosition += 10;
    this.doc.text(`Severity: ${severity.toUpperCase()}`, 20, yPosition);
    yPosition += 15;
    
    // Explanation
    this.doc.text('Explanation:', 20, yPosition);
    yPosition += 10;
    const splitExplanation = this.doc.splitTextToSize(explanation, 170);
    this.doc.text(splitExplanation, 20, yPosition);
    yPosition += splitExplanation.length * 5 + 15;
    
    // Recommended Actions
    this.doc.text('Recommended Actions:', 20, yPosition);
    yPosition += 10;
    const splitActions = this.doc.splitTextToSize(recommendedActions, 170);
    this.doc.text(splitActions, 20, yPosition);
    
    // Save the PDF
    const filename = `diagnostic-report-${new Date().toISOString().split('T')[0]}.pdf`;
    this.doc.save(filename);
  }
}

export const generatePDF = (data: {
  description: string;
  primaryDiagnosis: {
    fault: string;
    confidence: number;
    severity: 'low' | 'medium' | 'high';
    explanation: string;
    actions: string[];
  };
  alternatives: any[];
  pdfContent: string | null;
}) => {
  const reportData: PDFReportData = {
    predictedFault: data.primaryDiagnosis.fault,
    confidence: data.primaryDiagnosis.confidence,
    severity: data.primaryDiagnosis.severity,
    explanation: data.primaryDiagnosis.explanation,
    recommendedActions: data.primaryDiagnosis.actions.join('. '),
    description: data.description,
    pdfContent: data.pdfContent || undefined
  };
  
  const pdfGenerator = new PDFReportGenerator();
  pdfGenerator.generatePDF(reportData);
};