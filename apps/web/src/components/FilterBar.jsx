
import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X, Filter } from 'lucide-react';

const FilterBar = ({ filters, onFilterChange, onClearFilters, staff }) => {
  const categories = ['MKT', 'Vật tư', 'Văn phòng', 'Nhân công', 'Khác'];

  return (
    <div className="flex flex-col md:flex-row gap-4 p-4 rounded-2xl bg-card border border-white/5 shadow-sm">
      <div className="flex items-center gap-2 text-primary font-medium px-2 shrink-0 md:border-r border-white/10 md:pr-6">
        <Filter className="h-4 w-4" />
        Lọc dữ liệu
      </div>

      <div className="flex flex-wrap flex-1 gap-3">
        <div className="flex-1 min-w-[160px]">
          <Select 
            value={filters.category || ''} 
            onValueChange={(value) => onFilterChange('category', value)}
          >
            <SelectTrigger className="bg-background border-white/10 focus:ring-primary">
              <SelectValue placeholder="Tất cả danh mục" />
            </SelectTrigger>
            <SelectContent className="bg-card border-white/10">
              {categories.map(cat => (
                <SelectItem key={cat} value={cat} className="focus:bg-primary/20 focus:text-primary">{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {staff && staff.length > 0 && (
          <div className="flex-1 min-w-[160px]">
            <Select 
              value={filters.staffId || ''} 
              onValueChange={(value) => onFilterChange('staffId', value)}
            >
              <SelectTrigger className="bg-background border-white/10 focus:ring-primary">
                <SelectValue placeholder="Tất cả nhân sự" />
              </SelectTrigger>
              <SelectContent className="bg-card border-white/10">
                {staff.map(s => (
                  <SelectItem key={s.id} value={s.id} className="focus:bg-primary/20 focus:text-primary">{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex-1 min-w-[140px]">
          <Input
            type="date"
            value={filters.startDate || ''}
            onChange={(e) => onFilterChange('startDate', e.target.value)}
            className="bg-background border-white/10 focus-visible:ring-primary text-muted-foreground [color-scheme:dark]"
            title="Từ ngày"
          />
        </div>

        <div className="flex-1 min-w-[140px]">
          <Input
            type="date"
            value={filters.endDate || ''}
            onChange={(e) => onFilterChange('endDate', e.target.value)}
            className="bg-background border-white/10 focus-visible:ring-primary text-muted-foreground [color-scheme:dark]"
            title="Đến ngày"
          />
        </div>

        <Button 
          variant="outline" 
          onClick={onClearFilters}
          className="shrink-0 border-white/10 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
        >
          <X className="h-4 w-4 mr-2" />
          Xóa bộ lọc
        </Button>
      </div>
    </div>
  );
};

export default FilterBar;
