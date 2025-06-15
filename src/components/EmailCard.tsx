import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { EmailCampaign } from '../types/email';
import { Star, ExternalLink, Calendar } from 'lucide-react';
import { Card } from './ui/card';
import { cn } from '../lib/utils';

interface EmailCardProps {
  email: EmailCampaign;
  onClick: () => void;
}

export const EmailCard: React.FC<EmailCardProps> = ({ email, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
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
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="group cursor-pointer"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Card className="overflow-hidden bg-white border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 rounded-lg">
        {/* Header */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Brand Logo Circle */}
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm",
                getBrandColor(email.brand)
              )}>
                {getBrandInitials(email.brand)}
              </div>
              
              {/* Brand Name and Date */}
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">{email.brand}</h3>
                <p className="text-xs text-gray-500">{formatDate(email.date)}</p>
              </div>
            </div>
            
            {/* Action Icons */}
            <div className="flex items-center gap-2">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  // Add to favorites logic
                }}
              >
                <Star className="w-4 h-4 text-gray-400 hover:text-yellow-500" />
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  // Open in new tab logic
                }}
              >
                <ExternalLink className="w-4 h-4 text-gray-400 hover:text-blue-500" />
              </motion.button>
            </div>
          </div>
        </div>

        {/* Email Preview */}
        <div className="relative h-96 overflow-hidden bg-gray-50">
          <motion.img
            src={email.screenshot}
            alt={`Email campaign from ${email.brand}`}
            className="w-full h-auto object-cover object-top"
            style={{ minHeight: '100%' }}
            animate={isHovered ? { y: '-80%' } : { y: '0%' }}
            transition={{ duration: 3, ease: "linear" }}
            onError={(e) => {
              console.error('Failed to load image:', email.screenshot);
              e.currentTarget.style.display = 'none';
            }}
          />
          
          {/* Subtle overlay on hover */}
          <motion.div
            className="absolute inset-0 bg-black/5"
            initial={{ opacity: 0 }}
            animate={{ opacity: isHovered ? 1 : 0 }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Footer Info */}
        <div className="p-4">
          <h4 className="font-medium text-gray-900 text-sm mb-2 line-clamp-2 leading-relaxed">
            {email.subject}
          </h4>
          
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span className="capitalize">{email.campaign_theme}</span>
            {email.discount_percent && (
              <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">
                {email.discount_percent}% OFF
              </span>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
};