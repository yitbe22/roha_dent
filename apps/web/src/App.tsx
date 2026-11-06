import { useEffect, useState } from 'react';
import { Route, Routes, useLocation } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './components/Layout';
import Home from './pages/Home';
import About from './pages/About';
import Services from './pages/Services';
import ServiceDetail from './pages/ServiceDetail';
import Doctors from './pages/Doctors';
import Contact from './pages/Contact';
import LocationDetail from './pages/LocationDetail';
import Faq from './pages/Faq';
import Book from './pages/Book';
import { Careers, Events, Register } from './pages/Simple';
import NotFound from './pages/NotFound';
import ManageBookingPage from './pages/ManageBookingPage';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export function App() {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } } }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <ScrollToTop />
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/services" element={<Services />} />
          <Route path="/services/:slug" element={<ServiceDetail />} />
          <Route path="/doctors" element={<Doctors />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/locations/:slug" element={<LocationDetail />} />
          <Route path="/faq" element={<Faq />} />
          <Route path="/book" element={<Book />} />
          <Route path="/booking/:token" element={<ManageBookingPage />} />
          <Route path="/register" element={<Register />} />
          <Route path="/careers" element={<Careers />} />
          <Route path="/events" element={<Events />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Layout>
    </QueryClientProvider>
  );
}
