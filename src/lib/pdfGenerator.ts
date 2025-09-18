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