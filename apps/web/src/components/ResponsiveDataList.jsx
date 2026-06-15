
import React from 'react';

/**
 * A highly reusable component that renders a Table on desktop
 * and a list of structured Cards on mobile to prevent horizontal overflow.
 */
export default function ResponsiveDataList({ 
  data = [], 
  renderDesktop, 
  renderMobileItem, 
  emptyText = "Không có dữ liệu",
  className = ""
}) {
  return (
    <div className={`w-full ${className}`}>
      {/* Desktop View: renders the standard Table */}
      <div className="hidden md:block w-full">
        {renderDesktop()}
      </div>

      {/* Mobile View: renders a stack of cards */}
      <div className="block md:hidden space-y-3 w-full">
        {data.length === 0 ? (
          <div className="text-center py-10 px-4 text-sm text-muted-foreground bg-card/50 rounded-2xl border border-dashed border-border shadow-sm">
            {emptyText}
          </div>
        ) : (
          data.map((item, index) => renderMobileItem(item, index))
        )}
      </div>
    </div>
  );
}
