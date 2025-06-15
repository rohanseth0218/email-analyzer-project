import React from 'react';
import { motion } from 'framer-motion';

interface RippleLogoProps {
  size?: number;
  className?: string;
}

export const RippleLogo: React.FC<RippleLogoProps> = ({ size = 32, className = '' }) => {
  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      {/* Outer ripple */}
      <motion.div
        className="absolute inset-0 rounded-full border-2"
        style={{ borderColor: '#043D4E' }}
        initial={{ scale: 0.8, opacity: 0.8 }}
        animate={{ scale: 1.2, opacity: 0 }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeOut"
        }}
      />
      
      {/* Middle ripple */}
      <motion.div
        className="absolute inset-0 rounded-full border-2"
        style={{ borderColor: '#043D4E', opacity: 0.7 }}
        initial={{ scale: 0.6, opacity: 0.6 }}
        animate={{ scale: 1, opacity: 0 }}
        transition={{
          duration: 2,
          repeat: Infinity,
          delay: 0.5,
          ease: "easeOut"
        }}
      />
      
      {/* Inner core */}
      <motion.div
        className="absolute inset-0 rounded-full shadow-lg"
        style={{ 
          width: size * 0.6, 
          height: size * 0.6,
          left: size * 0.2,
          top: size * 0.2,
          background: `linear-gradient(135deg, #043D4E 0%, #065A6E 100%)`
        }}
        animate={{ 
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      
      {/* Center dot */}
      <div
        className="absolute bg-white rounded-full"
        style={{ 
          width: size * 0.2, 
          height: size * 0.2,
          left: size * 0.4,
          top: size * 0.4
        }}
      />
    </div>
  );
}; 