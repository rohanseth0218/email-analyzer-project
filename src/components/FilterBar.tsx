import React from 'react';
import { motion } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { FilterOptions } from '../types/email';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Button } from './ui/button';

interface FilterBarProps {
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  availableFilters?: {
    brands: string[];
    themes: string[];
    designLevels: string[];
  };
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onFiltersChange,
  searchQuery,
  onSearchChange,
  availableFilters
}) => {
  const brands = availableFilters?.brands || ['All Brands'];
  const dateRanges = ['All Time', 'Last 7 days', 'Last 30 days', 'This Year'];
  const themes = availableFilters?.themes || ['All Themes'];
  const designLevels = availableFilters?.designLevels || ['All Levels'];

  const hasActiveFilters = filters.brand !== 'All Brands' || 
                          filters.dateRange !== 'All Time' || 
                          filters.theme !== 'All Themes' ||
                          searchQuery !== '';

  const clearAllFilters = () => {
    onFiltersChange({
      brand: 'All Brands',
      dateRange: 'All Time',
      theme: 'All Themes',
      designLevel: 'All Levels'
    });
    onSearchChange('');
  };

  return (
    <div className="sticky top-16 z-40 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Search Bar */}
        <motion.div 
          className="relative mb-6"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input
            type="text"
            placeholder="Search email campaigns..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-12 pr-12 py-3 bg-gray-50 border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 text-base h-12"
          />
          {searchQuery && (
            <Button
              onClick={() => onSearchChange('')}
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 rounded-full hover:bg-gray-200"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </motion.div>

        {/* Filter Controls */}
        <motion.div 
          className="flex items-center gap-4 flex-wrap"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          {/* Brand Filter */}
          <Select value={filters.brand} onValueChange={(value) => onFiltersChange({ ...filters, brand: value })}>
            <SelectTrigger className="w-36 bg-white border-gray-200 focus:ring-2 focus:ring-teal-500/20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {brands.map(brand => (
                <SelectItem key={brand} value={brand}>{brand}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date Range Filter */}
          <Select value={filters.dateRange} onValueChange={(value) => onFiltersChange({ ...filters, dateRange: value })}>
            <SelectTrigger className="w-32 bg-white border-gray-200 focus:ring-2 focus:ring-teal-500/20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {dateRanges.map(range => (
                <SelectItem key={range} value={range}>{range}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Theme Filter */}
          <Select value={filters.theme} onValueChange={(value) => onFiltersChange({ ...filters, theme: value })}>
            <SelectTrigger className="w-44 bg-white border-gray-200 focus:ring-2 focus:ring-teal-500/20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {themes.map(theme => (
                <SelectItem key={theme} value={theme}>
                  {theme === 'All Themes' ? theme : theme.charAt(0).toUpperCase() + theme.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="ml-auto"
            >
              <Button
                onClick={clearAllFilters}
                variant="outline"
                className="bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300 text-gray-600"
              >
                <X className="w-4 h-4 mr-2" />
                Clear filters
              </Button>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
};