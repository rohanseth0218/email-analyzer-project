import React from 'react';
import { motion } from 'framer-motion';
import { RippleLogo } from './RippleLogo';

interface HeaderProps {
  onLogoClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onLogoClick }) => {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <motion.div 
            className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            onClick={onLogoClick}
          >
            <RippleLogo size={32} />
            <h1 className="text-xl font-semibold text-gray-900">Pulse</h1>
          </motion.div>
        </div>
      </div>
    </header>
  );
};