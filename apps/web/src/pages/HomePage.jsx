
import React from 'react';
import { Helmet } from 'react-helmet';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

const HomePage = () => {
  return (
    <>
      <Helmet>
        <title>Welcome - Horizons</title>
      </Helmet>
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background relative overflow-hidden px-4">
        {/* Subtle background decoration */}
        <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
          <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary rounded-full blur-[120px]"></div>
          <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-secondary rounded-full blur-[120px]"></div>
        </div>

        <motion.main 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative z-10 max-w-3xl mx-auto text-center space-y-8"
        >
          <div className="space-y-4">
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-foreground text-balance" style={{ letterSpacing: '-0.02em' }}>
              Welcome to Horizons
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-[60ch] mx-auto text-balance">
              The environment has been completely reset. We are starting with a clean slate, ready for your next vision.
            </p>
          </div>

          <div className="pt-4">
            <Button size="lg" className="rounded-full px-8 h-14 text-base font-semibold shadow-lg hover:-translate-y-0.5 transition-transform duration-300">
              Get Started
            </Button>
          </div>
        </motion.main>
      </div>
    </>
  );
};

export default HomePage;
