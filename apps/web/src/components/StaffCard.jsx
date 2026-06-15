
import React from 'react';
import pb from '@/lib/pocketbaseClient';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Settings2, WalletCards, Trash2 } from 'lucide-react';
import { useCurrencyFormat } from '@/hooks/useCurrencyFormat.js';

const StaffCard = ({ staff, onEdit, onDelete }) => {
  const { formatCurrency } = useCurrencyFormat();
  const initials = staff.name ? staff.name.substring(0, 2).toUpperCase() : 'NV';
  const displayId = staff.position?.startsWith('ID: ') ? staff.position.replace('ID: ', '') : (staff.position || 'N/A');
  
  const specialtiesArray = Array.isArray(staff.specialties) ? staff.specialties : [];
  const totalAllowances = staff.allowances?.reduce((sum, item) => sum + (Number(item.amount) || 0), 0) || 0;
  
  const avatarUrl = staff.avatar ? pb.files.getUrl(staff, staff.avatar) : null;

  return (
    <Card className={`bg-card border-border shadow-sm overflow-hidden hover:shadow-md hover:border-primary/30 transition-all duration-200 ${!staff.active ? 'opacity-75 grayscale-[0.2]' : ''}`}>
      <div className="p-5 flex flex-col h-full">
        <div className="flex items-start gap-4 mb-4">
          <Avatar className="w-14 h-14 border-2 border-background shadow-sm shrink-0">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={staff.name} className="object-cover" />}
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">{initials}</AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg text-foreground truncate" title={staff.name}>{staff.name}</h3>
            
            <div className="flex flex-wrap gap-1 mt-1.5">
              {specialtiesArray.length > 0 ? (
                specialtiesArray.map((spec, idx) => (
                  <Badge 
                    key={idx} 
                    variant="secondary" 
                    className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-secondary/60 text-secondary-foreground"
                  >
                    {spec === 'Content' ? 'MARKETING' : spec.toUpperCase()}
                  </Badge>
                ))
              ) : (
                <Badge variant="outline" className="text-[10px] text-muted-foreground px-2 py-0.5 rounded-md">
                  CHƯA CÓ VỊ TRÍ
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium bg-muted px-2 py-0.5 rounded-md border border-border">
                <WalletCards className="w-3 h-3" /> {displayId}
              </span>
              {!staff.active && (
                <Badge variant="destructive" className="text-[10px] h-5 px-1.5">Nghỉ việc</Badge>
              )}
            </div>
          </div>
        </div>

        <div className="bg-muted/30 rounded-xl p-3 mt-auto mb-4 text-sm border border-border space-y-2">
          <div className="flex justify-between text-muted-foreground items-center">
            <span>Lương cơ bản:</span>
            <span className="font-bold text-foreground">
              {formatCurrency(staff.basic_salary)}đ
            </span>
          </div>
          <div className="flex justify-between text-muted-foreground items-center">
            <span>Phụ cấp:</span>
            <span className="font-bold text-foreground">
              {formatCurrency(totalAllowances)}đ
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <Button 
            variant="outline"
            className="flex-1 h-9 text-xs font-bold rounded-xl transition-all hover:bg-muted" 
            onClick={() => onEdit(staff)}
          >
            <Settings2 className="w-3.5 h-3.5 mr-1.5" /> SỬA
          </Button>
          {onDelete && (
            <Button 
              variant="destructive"
              className="h-9 w-9 p-0 shrink-0 rounded-xl transition-all" 
              onClick={() => onDelete(staff)}
              title="Xóa nhân sự"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};

export default StaffCard;
