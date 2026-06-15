
export const getAttendanceDayStyle = (status) => {
  switch (status) {
    case 'present':
      return { classes: 'bg-[#A7F3D0] border-[#34D399] text-[#064E3B]', shortLabel: 'C' };
    case 'absent':
    case 'leave_full':
      return { classes: 'bg-[#FECACA] border-[#FCA5A5] text-[#7F1D1D]', shortLabel: 'N' };
    case 'late':
    case 'early_leave':
      return { classes: 'bg-[#FEF08A] border-[#FDE047] text-[#713F12]', shortLabel: 'M' };
    case 'leave_morning':
    case 'leave_afternoon':
      return { classes: 'bg-[#BFDBFE] border-[#93C5FD] text-[#1E3A8A]', shortLabel: '1/2' };
    case 'pending':
      return { classes: 'bg-[#E9D5FF] border-[#D8B4FE] text-[#581C87]', shortLabel: 'Chờ' };
    default:
      return { classes: 'bg-[#FFFFFF] border-gray-200 text-gray-500', shortLabel: '' };
  }
};
