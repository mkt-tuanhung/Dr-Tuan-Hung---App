
import React from 'react';
import { Helmet } from 'react-helmet';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import RevenueForm from '@/components/RevenueForm.jsx';
import { motion } from 'framer-motion';

const AddRevenuePage = () => {
  return (
    <>
      <Helmet>
        <title>Thêm Doanh thu - MediFinance</title>
      </Helmet>
      
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        
        <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <RevenueForm isEdit={false} />
          </motion.div>
        </main>
        
        <Footer />
      </div>
    </>
  );
};

export default AddRevenuePage;
