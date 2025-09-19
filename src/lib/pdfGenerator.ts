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