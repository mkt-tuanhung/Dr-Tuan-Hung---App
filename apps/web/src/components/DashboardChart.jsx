
import React from 'react';
import { motion } from 'framer-motion';

const DashboardChart = ({ title, children, delay = 0, className = '' }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className={`glass-panel p-5 sm:p-6 flex flex-col h-full ${className}`}
    >
      {title && <h3 className="text-lg font-semibold mb-6 text-foreground">{title}</h3>}
      <div className="flex-1 w-full min-h-[300px] relative">
        {children}
      </div>
    </motion.div>
  );
};

export default DashboardChart;
