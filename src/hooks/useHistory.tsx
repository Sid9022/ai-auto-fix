import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DiagnosticHistory, CreateHistoryEntry } from '@/types/history';
import { useToast } from '@/hooks/use-toast';

export const useHistory = () => {
  const [history, setHistory] = useState<DiagnosticHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('diagnostic_history')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error('Error fetching history:', error);
      toast({
        title: "Error",
        description: "Failed to load diagnostic history",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addToHistory = async (entry: CreateHistoryEntry) => {
    try {
      const { data, error } = await supabase
        .from('diagnostic_history')
        .insert([{
          ...entry,
          user_id: (await supabase.auth.getUser()).data.user?.id
        }])
        .select()
        .single();

      if (error) throw error;
      
      setHistory(prev => [data, ...prev]);
      toast({
        title: "Saved to History",
        description: "Diagnosis saved (auto-deletes in 7 days unless favorited)",
      });
      
      return data;
    } catch (error) {
      console.error('Error saving to history:', error);
      toast({
        title: "Error",
        description: "Failed to save diagnosis to history",
        variant: "destructive",
      });
    }
  };

  const toggleFavorite = async (id: string, is_favorite: boolean) => {
    try {
      const { error } = await supabase
        .from('diagnostic_history')
        .update({ is_favorite })
        .eq('id', id);

      if (error) throw error;

      setHistory(prev =>
        prev.map(item =>
          item.id === id ? { ...item, is_favorite } : item
        )
      );

      toast({
        title: is_favorite ? "Added to Favorites" : "Removed from Favorites",
        description: is_favorite ? "This diagnosis will not auto-delete" : "This diagnosis will auto-delete in 7 days",
      });
    } catch (error) {
      console.error('Error updating favorite:', error);
      toast({
        title: "Error",
        description: "Failed to update favorite status",
        variant: "destructive",
      });
    }
  };

  const deleteHistoryItem = async (id: string) => {
    try {
      const { error } = await supabase
        .from('diagnostic_history')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setHistory(prev => prev.filter(item => item.id !== id));
      toast({
        title: "Deleted",
        description: "Diagnosis removed from history",
      });
    } catch (error) {
      console.error('Error deleting history item:', error);
      toast({
        title: "Error",
        description: "Failed to delete diagnosis",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  return {
    history,
    loading,
    fetchHistory,
    addToHistory,
    toggleFavorite,
    deleteHistoryItem,
  };
};