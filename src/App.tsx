import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from './components/Header';
import { FilterBar } from './components/FilterBar';
import { EmailCard } from './components/EmailCard';
import { EmailDrawer } from './components/EmailDrawer';
import { apiService } from './services/api';
import { EmailCampaign, FilterOptions } from './types/email';
import { Search, Loader } from 'lucide-react';

function App() {
  const [selectedEmail, setSelectedEmail] = useState<EmailCampaign | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [currentLimit, setCurrentLimit] = useState(50);
  const [availableFilters, setAvailableFilters] = useState({
    brands: ['All Brands'],
    themes: ['All Themes'],
    designLevels: ['All Levels']
  });
  const [filters, setFilters] = useState<FilterOptions>({
    brand: 'All Brands',
    dateRange: 'All Time',
    theme: 'All Themes',
    designLevel: 'All Levels'
  });

  // Fetch campaigns and filters on component mount and when filters change
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      setCurrentLimit(50); // Reset limit when filters change
      
      try {
        // Fetch campaigns and filters in parallel
        const [campaignsResponse, filtersResponse] = await Promise.all([
          apiService.getCampaigns(filters, searchQuery, 50), // Show 50 campaigns by default
          apiService.getFilters()
        ]);
        
        setCampaigns(campaignsResponse.campaigns);
        setHasMore(campaignsResponse.hasMore);
        setAvailableFilters(filtersResponse);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load email campaigns. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [searchQuery, filters]);

  const loadMoreCampaigns = async () => {
    if (loadingMore || !hasMore) return;
    
    setLoadingMore(true);
    try {
      const newLimit = currentLimit + 50;
      const campaignsResponse = await apiService.getCampaigns(filters, searchQuery, newLimit);
      
      setCampaigns(campaignsResponse.campaigns);
      setHasMore(campaignsResponse.hasMore);
      setCurrentLimit(newLimit);
    } catch (err) {
      console.error('Error loading more campaigns:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleEmailClick = async (email: EmailCampaign) => {
    setSelectedEmail(email);
    setIsDrawerOpen(true);
    setIsLoadingDetails(true);
    
    // Fetch detailed campaign data with storeleads info
    try {
      console.log('Fetching details for campaign:', email.id);
      const response = await apiService.getCampaignDetails(email.id);
      console.log('Received detailed campaign data:', response.campaign);
      
      // Merge the detailed data with the original email data to ensure no fields are lost
      const mergedData = {
        ...email,
        ...response.campaign
      };
      
      console.log('Setting merged campaign data:', mergedData);
      setSelectedEmail(mergedData);
    } catch (error) {
      console.error('Error fetching campaign details:', error);
      // Keep the basic email data if detailed fetch fails
      console.log('Keeping original email data due to error');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setIsLoadingDetails(false);
    setTimeout(() => setSelectedEmail(null), 300);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <FilterBar 
        filters={filters}
        onFiltersChange={setFilters}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        availableFilters={availableFilters}
      />
      
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Loading State */}
        {loading && (
          <motion.div 
            className="text-center py-24"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="w-32 h-32 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-8">
              <Loader className="w-16 h-16 text-gray-400 animate-spin" />
            </div>
            <h3 className="text-2xl font-semibold text-gray-900 mb-4">Loading campaigns...</h3>
            <p className="text-gray-600 max-w-md mx-auto text-lg leading-relaxed">
              Fetching email campaigns from our database.
            </p>
          </motion.div>
        )}

        {/* Error State */}
        {error && !loading && (
          <motion.div 
            className="text-center py-24"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="w-32 h-32 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-8">
              <Search className="w-16 h-16 text-red-400" />
            </div>
            <h3 className="text-2xl font-semibold text-gray-900 mb-4">Something went wrong</h3>
            <p className="text-gray-600 max-w-md mx-auto text-lg leading-relaxed mb-6">
              {error}
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </motion.div>
        )}

        {/* Email Grid - Milled Style */}
        {!loading && !error && (
          <AnimatePresence mode="wait">
            {campaigns.length > 0 ? (
              <motion.div 
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
              >
                {campaigns.map((email, index) => (
                  <motion.div
                    key={email.id}
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.05 }}
                  >
                    <EmailCard
                      email={email}
                      onClick={() => handleEmailClick(email)}
                    />
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <motion.div 
                className="text-center py-24"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
              >
                <div className="w-32 h-32 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-8">
                  <Search className="w-16 h-16 text-gray-400" />
                </div>
                <h3 className="text-2xl font-semibold text-gray-900 mb-4">No campaigns found</h3>
                <p className="text-gray-600 max-w-md mx-auto text-lg leading-relaxed">
                  Try adjusting your search criteria or filters to discover more email campaigns.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* Load More Button */}
        {!loading && !error && campaigns.length > 0 && hasMore && (
          <motion.div 
            className="text-center mt-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <button
              onClick={loadMoreCampaigns}
              disabled={loadingMore}
              className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
            >
              {loadingMore ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Loading more...
                </>
              ) : (
                `Load More Campaigns`
              )}
            </button>
            <p className="text-gray-500 text-sm mt-2">
              Showing {campaigns.length} campaigns
            </p>
          </motion.div>
        )}
      </main>

      {/* Email Drawer */}
      <EmailDrawer
        email={selectedEmail}
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        isLoadingDetails={isLoadingDetails}
      />
    </div>
  );
}

export default App;