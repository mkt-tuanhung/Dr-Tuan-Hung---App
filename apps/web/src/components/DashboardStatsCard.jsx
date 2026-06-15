
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const useAnimatedNumber = (value, duration = 1000) => {
  const [displayValue, setDisplayValue] = useState(0);
  
  // Detect formatted currency strings or dates to bypass parsing and animation
  const isFormattedString = typeof value === 'string' && (value.includes('đ') || value.includes('.') || value.includes('/'));
  
  // Only parse if it's a plain number or comma-separated number
  const numericValue = isFormattedString ? 0 : (typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : Number(value) || 0);

  useEffect(() => {
    if (isFormattedString) return; // Do not animate formatted strings

    let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      
      // Easing function: easeOutExpo
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setDisplayValue(easeProgress * numericValue);
      
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        setDisplayValue(numericValue);
      }
    };
    
    window.requestAnimationFrame(step);
  }, [numericValue, duration, isFormattedString]);

  // Return the formatted string directly
  if (isFormattedString) {
    return value;
  }

  // Handle regular numbers and comma-separated formats
  return typeof value === 'string' && value.includes(',') 
    ? Math.round(displayValue).toLocaleString('vi-VN') 
    : Math.round(displayValue);
};

const DashboardStatsCard = ({ title, value, prefix = '', suffix = '', icon: Icon, trend, variant = 'default', delay = 0 }) => {
  const animatedValue = useAnimatedNumber(value);
  
  const variants = {
    default: 'bg-card border-border text-foreground',
    mint: 'stat-card-mint',
    teal: 'stat-card-teal',
    accent: 'stat-card-accent'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className={`glass-card p-5 rounded-[1.25rem] flex flex-col gap-4 ${variants[variant] || variants.default}`}
    >
      <div className="flex justify-between items-start">
        <h3 className="text-sm font-medium opacity-80">{title}</h3>
        <div className={`p-2 rounded-xl bg-white/40 backdrop-blur-md shadow-sm border border-white/20`}>
          {Icon && <Icon className="w-5 h-5 opacity-90" />}
        </div>
      </div>
      
      <div className="mt-auto">
        <div className="flex items-baseline gap-1">
          {prefix && <span className="text-lg font-semibold opacity-70">{prefix}</span>}
          <span className="text-3xl sm:text-4xl font-bold tracking-tight" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {animatedValue}
          </span>
          {suffix && <span className="text-sm font-medium opacity-70 ml-1">{suffix}</span>}
        </div>
        
        {trend && (
          <div className="mt-2 text-xs font-medium flex items-center gap-1">
            <span className={trend.isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
              {trend.isPositive ? '↑' : '↓'} {trend.value}
            </span>
            <span className="opacity-60">{trend.label}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default DashboardStatsCard;
