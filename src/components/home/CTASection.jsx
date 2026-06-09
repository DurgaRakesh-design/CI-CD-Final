import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CTASection() {
  return (
    <section className="py-20 sm:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-violet-700 p-10 sm:p-16 text-center"
        >
          {/* Decorative circles */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
          
          <div className="relative">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white/90 text-sm font-medium mb-6">
              <Sparkles className="w-3.5 h-3.5" />
              Start delivering quality today
            </div>
            <h2 className="font-heading font-bold text-3xl sm:text-4xl text-white tracking-tight max-w-xl mx-auto">
              Ready to transform your QA workflow?
            </h2>
            <p className="mt-4 text-white/70 text-lg max-w-md mx-auto">
              Upload your Java package and let AI handle requirements, testing, and pipeline automation.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/workspace">
                <Button size="lg" variant="secondary" className="h-12 px-8 text-base font-semibold rounded-xl">
                  Get Started
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link to="/dashboard">
                <Button size="lg" variant="ghost" className="h-12 px-8 text-base font-semibold rounded-xl text-white/90 hover:text-white hover:bg-white/10">
                  Explore Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
