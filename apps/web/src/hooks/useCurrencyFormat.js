
export const useCurrencyFormat = () => {
  const formatCurrency = (value) => {
    if (value === undefined || value === null || value === '') return '';
    const num = Number(value);
    if (isNaN(num)) return '';
    return new Intl.NumberFormat('vi-VN').format(num);
  };

  const parseCurrency = (formattedValue) => {
    if (formattedValue === undefined || formattedValue === null || formattedValue === '') return '';
    const cleanStr = formattedValue.toString().replace(/[^0-9]/g, '');
    if (!cleanStr) return '';
    return parseInt(cleanStr, 10);
  };

  return { formatCurrency, parseCurrency };
};
