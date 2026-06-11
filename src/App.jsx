import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';

import AppLayout from './components/layout/AppLayout';
import Home from './pages/Home';
import QAWorkspace from './pages/QAWorkspace';
import Dashboard from './pages/Dashboard';
import PipelineSummary from './pages/PipelineSummary';

function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <Router>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/workspace" element={<QAWorkspace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/summary/:runNumber" element={<PipelineSummary />} />
          </Route>
          <Route path="*" element={<PageNotFound />} />
        </Routes>
      </Router>
      <Toaster />
    </QueryClientProvider>
  )
}

export default App
