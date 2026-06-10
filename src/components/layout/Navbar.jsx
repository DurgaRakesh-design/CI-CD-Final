import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, LayoutDashboard, FlaskConical, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const navItems = [
  { label: 'Home', path: '/', icon: Sparkles },
  { label: 'QA Workspace', path: '/workspace', icon: FlaskConical },
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
];

export default function Navbar() {
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-slate-950/78 border-b border-white/15 shadow-lg shadow-slate-950/20 backdrop-blur-2xl backdrop-saturate-150 supports-[backdrop-filter]:bg-slate-950/68'
          : 'bg-slate-950/70 border-b border-white/10 backdrop-blur-2xl backdrop-saturate-150 supports-[backdrop-filter]:bg-slate-950/60'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-heading font-bold text-lg tracking-tight text-white">
              QA<span className="text-indigo-300">Pilot</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link key={item.path} to={item.path}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`relative px-4 font-medium text-sm transition-all ${
                      isActive
                        ? 'text-white'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <item.icon className="w-4 h-4 mr-1.5" />
                    {item.label}
                    {isActive && (
                      <motion.div
                        layoutId="nav-indicator"
                        className="absolute bottom-0 left-2 right-2 h-0.5 bg-indigo-400 rounded-full"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                  </Button>
                </Link>
              );
            })}
          </nav>

          {/* Mobile Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden text-slate-200 hover:bg-white/10 hover:text-white"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Nav */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-slate-950/78 border-b border-white/15 backdrop-blur-2xl backdrop-saturate-150 supports-[backdrop-filter]:bg-slate-950/68"
          >
            <div className="px-4 py-3 space-y-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                  >
                    <div className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-white/10 text-white'
                        : 'text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}>
                      <item.icon className="w-4 h-4" />
                      {item.label}
                    </div>
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
