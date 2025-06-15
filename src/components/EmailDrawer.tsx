import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EmailCampaign } from '../types/email';
import { X, Calendar, Mail, Globe, Eye, User, BarChart3, Building2, MapPin, Package, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

interface EmailDrawerProps {
  email: EmailCampaign | null;
  isOpen: boolean;
  onClose: () => void;
  isLoadingDetails: boolean;
}

export const EmailDrawer: React.FC<EmailDrawerProps> = ({ email, isOpen, onClose, isLoadingDetails }) => {
  if (!email) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount: number | string) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (!numAmount || isNaN(numAmount)) return '$0';
    
    // Divide by 100 to convert from cents to dollars
    const dollarAmount = numAmount / 100;
    
    if (dollarAmount >= 1000000) {
      return `$${(dollarAmount / 1000000).toFixed(1)}M`;
    } else if (dollarAmount >= 1000) {
      return `$${(dollarAmount / 1000).toFixed(0)}K`;
    }
    return `$${dollarAmount.toLocaleString()}`;
  };

  const getBrandInitials = (brand: string) => {
    return brand.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
  };

  const getBrandColor = (brand: string) => {
    const colors = {
      'Teeter': 'bg-blue-600',
      'Nike': 'bg-black',
      'Apple': 'bg-gray-800',
      'Spotify': 'bg-green-500',
      'Airbnb': 'bg-red-500',
      'Tesla': 'bg-red-600',
      'Gucci': 'bg-green-700',
      'Mimco': 'bg-pink-500',
      'PACSUN': 'bg-orange-500'
    };
    return colors[brand as keyof typeof colors] || 'bg-gray-600';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full max-w-6xl bg-white shadow-2xl z-50 border-l border-gray-200"
          >
            <div className="flex h-full">
              {/* Left Sidebar - Basic Info */}
              <div className="w-80 bg-gray-50 border-r border-gray-200 overflow-y-auto">
                <div className="p-6">
                  {/* Close Button */}
                  <div className="flex justify-end mb-4">
                    <Button
                      onClick={onClose}
                      variant="ghost"
                      size="icon"
                      className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full"
                    >
                      <X className="w-5 h-5" />
                    </Button>
                  </div>

                  {/* Brand Info */}
                  <div className="mb-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold",
                        getBrandColor(email.brand)
                      )}>
                        {getBrandInitials(email.brand)}
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">{email.brand}</h2>
                        <p className="text-sm text-gray-500">{typeof email.categories === 'string' ? email.categories.split('/')[0] : 'Brand'}</p>
                      </div>
                    </div>
                  </div>

                  {/* About Section */}
                  {(email.description || isLoadingDetails) && (
                    <Card className="border-0 shadow-sm mb-6">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                          <Building2 className="w-4 h-4" />
                          About
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {isLoadingDetails && !email.description ? (
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                            <span className="text-sm text-gray-500">Loading brand information...</span>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-700 leading-relaxed">{email.description}</p>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Email Details */}
                  <Card className="border-0 shadow-sm mb-6">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        Email Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Subject</label>
                        <p className="text-sm font-medium text-gray-900 mt-1 leading-relaxed">{email.subject}</p>
                      </div>
                      
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Date Sent
                        </label>
                        <p className="text-sm font-medium text-gray-900 mt-1">{formatDate(email.date)}</p>
                      </div>
                      
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          Domain
                        </label>
                        <p className="text-sm font-medium text-gray-900 mt-1">{email.sender_domain || `${email.brand.toLowerCase().replace(/\s+/g, '')}.com`}</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Brand Information */}
                  {(email.estimated_sales_yearly || email.location || email.product_count || email.employee_count) && (
                    <Card className="border-0 shadow-sm">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                          <Building2 className="w-4 h-4" />
                          Brand Information
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {email.estimated_sales_yearly && (
                          <div>
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1">
                              <DollarSign className="w-3 h-3" />
                              Estimated Annual Sales
                            </label>
                            <p className="text-lg font-bold text-green-600 mt-1">{formatCurrency(email.estimated_sales_yearly)}</p>
                          </div>
                        )}
                        
                        {email.location && (
                          <div>
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              Location
                            </label>
                            <p className="text-sm font-medium text-gray-900 mt-1">{email.location}</p>
                          </div>
                        )}
                        
                        {email.product_count && (
                          <div>
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1">
                              <Package className="w-3 h-3" />
                              Product Catalog
                            </label>
                            <p className="text-sm font-medium text-gray-900 mt-1">{typeof email.product_count === 'number' ? email.product_count.toLocaleString() : parseInt(email.product_count).toLocaleString()} products</p>
                          </div>
                        )}

                        {email.employee_count && (
                          <div>
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1">
                              <User className="w-3 h-3" />
                              Team Size
                            </label>
                            <p className="text-sm font-medium text-gray-900 mt-1">{typeof email.employee_count === 'number' ? email.employee_count.toLocaleString() : parseInt(email.employee_count).toLocaleString()} employees</p>
                          </div>
                        )}

                        {email.avg_price && (
                          <div>
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1">
                              <DollarSign className="w-3 h-3" />
                              Average Price
                            </label>
                            <p className="text-sm font-medium text-gray-900 mt-1">${typeof email.avg_price === 'number' ? (email.avg_price / 100).toFixed(2) : (parseFloat(email.avg_price) / 100).toFixed(2)}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>

              {/* Main Content Area - Email Display */}
              <div className="flex-1 bg-white flex flex-col">
                {/* Email Content - Scrollable */}
                <div className="flex-1 overflow-y-auto bg-gray-100 p-8">
                  <div className="max-w-2xl mx-auto bg-white shadow-lg rounded-lg overflow-hidden">
                    <img 
                      src={email.screenshot} 
                      alt={`${email.brand} email campaign`}
                      className="w-full h-auto object-cover block"
                      style={{ 
                        maxHeight: 'none',
                        minHeight: '800px'
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Right Sidebar - Campaign Analysis & Metrics */}
              <div className="w-80 bg-gray-50 border-l border-gray-200 overflow-y-auto">
                <div className="p-6 space-y-6">
                  
                  {/* Campaign Analysis */}
                  <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4" />
                        Campaign Analysis
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Theme</label>
                        <p className="text-sm font-medium text-gray-900 mt-1 capitalize">{email.campaign_theme}</p>
                      </div>
                      
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Design Level</label>
                        <Badge className={cn(
                          "mt-1",
                          email.design_level === 'Expert' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                        )}>
                          {email.design_level}
                        </Badge>
                      </div>
                      
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Emotional Tone</label>
                        <p className="text-sm font-medium text-gray-900 mt-1 capitalize">{email.emotional_tone}</p>
                      </div>
                      
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Campaign Type</label>
                        <p className="text-sm font-medium text-gray-900 mt-1 capitalize">{email.flow_vs_campaign}</p>
                      </div>
                      
                      {email.event_or_seasonality && (
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Seasonality</label>
                          <p className="text-sm font-medium text-gray-900 mt-1">{email.event_or_seasonality}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Content Metrics */}
                  <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                        <Eye className="w-4 h-4" />
                        Content Metrics
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Products Featured</label>
                        <p className="text-2xl font-bold text-gray-900 mt-1">{email.num_products_featured}</p>
                      </div>
                      
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Image/Text Ratio</label>
                        <div className="mt-2">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-teal-500 h-2 rounded-full transition-all duration-1000"
                                style={{ width: `${email.image_vs_text_ratio * 100}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium text-gray-900">
                              {Math.round(email.image_vs_text_ratio * 100)}%
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {email.discount_percent && (
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Discount Offer</label>
                          <Badge className="bg-red-100 text-red-800 mt-1 font-semibold">
                            {email.discount_percent}% OFF
                          </Badge>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Engagement Features */}
                  <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Engagement Features
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Personalization Used</span>
                        <div className={cn(
                          "w-4 h-4 rounded-full",
                          email.personalization_used ? 'bg-emerald-500' : 'bg-gray-300'
                        )} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Social Proof Used</span>
                        <div className={cn(
                          "w-4 h-4 rounded-full",
                          email.social_proof_used ? 'bg-emerald-500' : 'bg-gray-300'
                        )} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Unsubscribe Visible</span>
                        <div className={cn(
                          "w-4 h-4 rounded-full",
                          email.unsubscribe_visible ? 'bg-emerald-500' : 'bg-gray-300'
                        )} />
                      </div>
                    </CardContent>
                  </Card>

                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};