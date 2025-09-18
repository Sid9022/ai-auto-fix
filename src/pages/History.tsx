import { useState, useEffect } from 'react';
import { Star, Clock, Calendar, Download, Trash2, RefreshCw, Search } from 'lucide-react';
import { useHistory } from '@/hooks/useHistory';
import { useAuth } from '@/hooks/useAuth';
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
      <div className="container mx-auto px-4 py-8">
        <Alert>
          <AlertDescription>
            Please sign in to view your diagnostic history.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-primary mb-2">Diagnostic History</h1>
        <p className="text-muted-foreground">
          View your past vehicle diagnoses. Records auto-delete after 7 days unless favorited.
        </p>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search your diagnostic history..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading history...</span>
        </div>
      ) : filteredHistory.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No diagnostic history yet</h3>
            <p className="text-muted-foreground">
              {searchTerm ? 'No results found for your search.' : 'Start diagnosing your vehicle to build your history.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredHistory.map((item) => {
            const daysRemaining = getDaysRemaining(item.expires_at, item.is_favorite);
            const isExpired = daysRemaining === 0 && !item.is_favorite;
            const isExpanded = expandedCard === item.id;
            
            return (
              <Card key={item.id} className={`transition-all ${isExpired ? 'opacity-60' : ''}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <span className="truncate">{item.predicted_fault}</span>
                        <Badge variant={getSeverityColor(item.severity)}>
                          {item.severity}
                        </Badge>
                      </CardTitle>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {new Date(item.created_at).toLocaleDateString()}
                        </div>
                        <div>Confidence: {item.confidence}%</div>
                        {daysRemaining !== null && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {daysRemaining > 0 ? `${daysRemaining} days left` : 'Expires today'}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleFavorite(item.id, !item.is_favorite)}
                      >
                        <Star className={`h-4 w-4 ${item.is_favorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleGeneratePDF(item)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteHistoryItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <strong className="text-sm">Symptoms:</strong>
                      <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedCard(isExpanded ? null : item.id)}
                      className="p-0 h-auto text-primary hover:no-underline"
                    >
                      {isExpanded ? 'Show less' : 'Show details'}
                    </Button>
                    
                    {isExpanded && (
                      <div className="space-y-3 pt-3 border-t">
                        <div>
                          <strong className="text-sm">Analysis:</strong>
                          <p className="text-sm text-muted-foreground mt-1">{item.explanation}</p>
                        </div>
                        
                        {item.recommended_actions.length > 0 && (
                          <div>
                            <strong className="text-sm">Recommended Actions:</strong>
                            <ul className="list-disc list-inside text-sm text-muted-foreground mt-1 space-y-1">
                              {item.recommended_actions.map((action, index) => (
                                <li key={index}>{action}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {item.alternatives && item.alternatives.length > 0 && (
                          <div>
                            <strong className="text-sm">Alternative Possibilities:</strong>
                            <div className="mt-1 space-y-2">
                              {item.alternatives.map((alt: any, index: number) => (
                                <div key={index} className="text-sm">
                                  <Badge variant="outline" className="mr-2">{alt.confidence}%</Badge>
                                  <span className="text-muted-foreground">{alt.fault}</span>
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