import { lazy, Suspense, useEffect, useLayoutEffect, useState } from 'react';
import { Outlet, Route, Routes, useLocation, type Location } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './components/Layout';
import { jumpToTop } from './lib/smoothScroll';
import { playHeroEntrance } from './lib/intro';
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

// Staff dashboard: its own shell, lazy-loaded so public pages never download supabase-js.
const AdminApp = lazy(() => import('./admin/AdminApp'));

function PublicShell() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** How long the old page takes to fade out (matches html[data-page='out'] in styles.css). */
const LEAVE_MS = 200;

/**
 * Page transition (after the Habesha storefront): the old page fades out, the window returns to
 * the top, then the next page fades in while its header plays the entrance (PageIntro, or the
 * hero words on the home page). Opacity only, so a treatment photo flying into its page
 * (lib/photoFlight) lands on a header that isn't moving. The routes render the *shown* location,
 * which trails the real one by the fade-out.
 *
 * Skipped for query/hash-only changes, the staff dashboard, reduced motion, and the logo's
 * home link (it has its own covered intro transition, lib/intro.ts).
 */
function usePageTransition(): Location {
  const location = useLocation();
  const [shown, setShown] = useState(location);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (location === shown) return;
    const instant =
      location.pathname === shown.pathname ||
      /^\/admin(\/|$)/.test(location.pathname) ||
      /^\/admin(\/|$)/.test(shown.pathname) ||
      matchMedia('(prefers-reduced-motion: reduce)').matches ||
      document.getElementById('loader')?.className === 'replay';
    if (instant) {
      delete document.documentElement.dataset.page;
      setShown(location);
      setEntered(false);
      return;
    }
    document.documentElement.dataset.page = 'out';
    const t = window.setTimeout(() => {
      setShown(location);
      setEntered(true);
    }, LEAVE_MS);
    return () => window.clearTimeout(t);
  }, [location]);

  // Before the new page paints: swap the fade-out for the fade-in, then return to the top.
  useIsoLayoutEffect(() => {
    const root = document.documentElement;
    if (entered) root.dataset.page = 'in';
    else delete root.dataset.page;
    jumpToTop();
    // inner pages play their entrance on mount (PageIntro); the home hero replays its intro words
    if (entered && shown.pathname === '/') playHeroEntrance();
    if (!entered) return;
    const t = window.setTimeout(() => {
      if (root.dataset.page === 'in') delete root.dataset.page;
    }, 700);
    return () => window.clearTimeout(t);
  }, [shown.pathname]);

  return shown;
}

export function App() {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } } }),
  );
  const location = usePageTransition();
  return (
    <QueryClientProvider client={queryClient}>
      <Routes location={location}>
        <Route
          path="/admin/*"
          element={
            <Suspense fallback={<p className="p-8 text-ink-soft">Loading…</p>}>
              <AdminApp />
            </Suspense>
          }
        />
        <Route element={<PublicShell />}>
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
          <Route path="/b/:token" element={<ManageBookingPage />} />
          <Route path="/register" element={<Register />} />
          <Route path="/careers" element={<Careers />} />
          <Route path="/events" element={<Events />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </QueryClientProvider>
  );
}
