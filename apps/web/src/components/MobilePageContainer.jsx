
import React from 'react';
import { cn } from '@/lib/utils.js';

const MobilePageContainer = ({ children, className }) => {
  return (
    <div 
      className={cn(
        "w-full px-3 py-4 md:px-6 md:py-8 space-y-4 md:space-y-6",
        // Add bottom padding on mobile to account for the fixed MobileBottomNav
        "pb-[calc(80px+env(safe-area-inset-bottom,0px))] md:pb-8",
        className
      )}
    >
      {children}
    </div>
  );
};

export default MobilePageContainer;
