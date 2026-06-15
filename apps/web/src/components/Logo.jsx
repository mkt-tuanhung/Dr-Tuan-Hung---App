
import React from 'react';

const Logo = ({ size = 'md', className = '' }) => {
  const variants = {
    sm: {
      container: 'gap-2.5',
      iconBox: 'w-10 h-10 rounded-lg',
      imgSize: 'w-10 h-10',
      title: 'text-lg',
      subtitle: 'text-[10px] mb-0.5',
    },
    md: {
      container: 'gap-3.5',
      iconBox: 'w-12 h-12 rounded-xl',
      imgSize: 'w-12 h-12',
      title: 'text-2xl',
      subtitle: 'text-xs mb-1',
    },
    lg: {
      container: 'gap-4',
      iconBox: 'w-16 h-16 rounded-2xl',
      imgSize: 'w-16 h-16',
      title: 'text-3xl',
      subtitle: 'text-sm mb-1',
    }
  };

  const current = variants[size] || variants.md;

  return (
    <div className={`flex items-center ${current.container} ${className}`}>
      {/* TH Logo Image */}
      <div className={`relative flex items-center justify-center bg-white shadow-lg shadow-primary/20 shrink-0 overflow-hidden ${current.iconBox}`}>
        <img 
          src="https://horizons-cdn.hostinger.com/c0dc5e95-f38f-4cf7-a91b-3f28bd737b24/8eeee59166c6f1ccbe41cbd6dd0f14bd.png"
          alt="Thẩm mỹ Dr Tuấn Hùng Logo"
          className={`${current.imgSize} object-contain`}
        />
      </div>

      {/* Typography */}
      <div className="flex flex-col justify-center">
        <span className={`font-bold tracking-widest text-primary uppercase leading-none ${current.subtitle}`}>
          Phòng Khám
        </span>
        <span className={`font-black tracking-tight text-foreground leading-none ${current.title}`}>
          Dr Tuấn Hùng
        </span>
      </div>
    </div>
  );
};

export default Logo;
