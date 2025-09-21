import { useState, useEffect } from 'react';
import { Star, Clock, Calendar, Download, Trash2, RefreshCw, Search } from 'lucide-react';
import { useHistory } from '@/hooks/useHistory';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { generatePDF } from '@/lib/pdfGenerator';
import { useToast } from '@/hooks/use-toast';
import { DiagnosticHistory } from '@/types/history';

export default function History() {
  const { user } = useAuth();
  const { history, loading, toggleFavorite, deleteHistoryItem } = useHistory();
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  useEffect(() => {
    document.title = 'Diagnostic History - AI Vehicle Diagnostic';
    
    // Set meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'View your vehicle diagnostic history with detailed analysis results and recommendations.');
    }
  }, []);

  const filteredHistory = history.filter(item =>
    item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.predicted_fault.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getDaysRemaining = (expiresAt: string, isFavorite: boolean) => {
    if (isFavorite) return null;
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return Math.max(0, days);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'outline';
    }
  };

  const handleGeneratePDF = async (item: DiagnosticHistory) => {
    try {
      await generatePDF({
        description: item.description,
        primaryDiagnosis: {
          fault: item.predicted_fault,
          confidence: item.confidence,
          severity: item.severity as 'low' | 'medium' | 'high',
          explanation: item.explanation,
          actions: item.recommended_actions
        },
        alternatives: item.alternatives || [],
        pdfContent: item.pdf_content || null
      });
      
      toast({
        title: "PDF Generated",
        description: "Diagnostic report downloaded successfully",
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: "Failed to generate PDF report",
        variant: "destructive",
      });
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <Alert>
          <AlertDescription>
            Please sign in to view your diagnostic history.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-2">Diagnostic History</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          View your past vehicle diagnoses. Records auto-delete after 7 days unless favorited.
        </p>
      </div>

      <div className="mb-4 sm:mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder={isMobile ? "Search history..." : "Search your diagnostic history..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 text-base"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 sm:py-12">
          <RefreshCw className="h-5 w-5 sm:h-6 sm:w-6 animate-spin text-primary" />
          <span className="ml-2 text-sm sm:text-base text-muted-foreground">Loading history...</span>
        </div>
      ) : filteredHistory.length === 0 ? (
        <Card>
          <CardContent className="py-8 sm:py-12 text-center">
            <Clock className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-base sm:text-lg font-semibold mb-2">No diagnostic history yet</h3>
            <p className="text-sm sm:text-base text-muted-foreground px-4">
              {searchTerm ? 'No results found for your search.' : 'Start diagnosing your vehicle to build your history.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {filteredHistory.map((item) => {
            const daysRemaining = getDaysRemaining(item.expires_at, item.is_favorite);
            const isExpired = daysRemaining === 0 && !item.is_favorite;
            const isExpanded = expandedCard === item.id;
            
            return (
              <Card key={item.id} className={`transition-all ${isExpired ? 'opacity-60' : ''}`}>
                <CardHeader className="pb-3 sm:pb-6">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base sm:text-lg flex flex-col sm:flex-row sm:items-center gap-2">
                        <span className="truncate">{item.predicted_fault}</span>
                        <Badge variant={getSeverityColor(item.severity)} className="self-start sm:self-auto">
                          {item.severity}
                        </Badge>
                      </CardTitle>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground mt-2">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
                          <span>{new Date(item.created_at).toLocaleDateString()}</span>
                        </div>
                        <div>Confidence: {item.confidence}%</div>
                        {daysRemaining !== null && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
                            <span>{daysRemaining > 0 ? `${daysRemaining} days left` : 'Expires today'}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 self-start sm:self-auto">
                      <Button
                        variant="ghost"
                        size={isMobile ? "sm" : "sm"}
                        onClick={() => toggleFavorite(item.id, !item.is_favorite)}
                        className="h-8 w-8 sm:h-9 sm:w-9 p-0"
                      >
                        <Star className={`h-3 w-3 sm:h-4 sm:w-4 ${item.is_favorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size={isMobile ? "sm" : "sm"}
                        onClick={() => handleGeneratePDF(item)}
                        className="h-8 w-8 sm:h-9 sm:w-9 p-0"
                      >
                        <Download className="h-3 w-3 sm:h-4 sm:w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size={isMobile ? "sm" : "sm"}
                        onClick={() => deleteHistoryItem(item.id)}
                        className="h-8 w-8 sm:h-9 sm:w-9 p-0"
                      >
                        <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    <div>
                      <strong className="text-xs sm:text-sm">Symptoms:</strong>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">{item.description}</p>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedCard(isExpanded ? null : item.id)}
                      className="p-0 h-auto text-primary hover:no-underline text-xs sm:text-sm"
                    >
                      {isExpanded ? 'Show less' : 'Show details'}
                    </Button>
                    
                    {isExpanded && (
                      <div className="space-y-3 pt-3 border-t">
                        <div>
                          <strong className="text-xs sm:text-sm">Analysis:</strong>
                          <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">{item.explanation}</p>
                        </div>
                        
                        {item.recommended_actions.length > 0 && (
                          <div>
                            <strong className="text-xs sm:text-sm">Recommended Actions:</strong>
                            <ul className="list-disc list-inside text-xs sm:text-sm text-muted-foreground mt-1 space-y-1 pl-2">
                              {item.recommended_actions.map((action, index) => (
                                <li key={index} className="leading-relaxed">{action}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {item.alternatives && item.alternatives.length > 0 && (
                          <div>
                            <strong className="text-xs sm:text-sm">Alternative Possibilities:</strong>
                            <div className="mt-1 space-y-2">
                              {item.alternatives.map((alt: { fault: string; confidence: number }, index: number) => (
                                <div key={index} className="text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                  <Badge variant="outline" className="text-xs self-start sm:self-auto">{alt.confidence}%</Badge>
                                  <span className="text-muted-foreground leading-relaxed">{alt.fault}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}