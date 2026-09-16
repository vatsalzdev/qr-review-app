import React, { useState, useEffect } from 'react';
import CustomerReviewPage from './pages/CustomerReviewPage';
import DevPortal from './pages/DevPortal';

export default function App() {
  const [currentPath, setCurrentPath] = useState(
    typeof window !== 'undefined'
      ? window.location.pathname + window.location.search
      : '/'
  );

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname + window.location.search);
    };

    // Global link click handler for instant SPA navigation
    const handleLinkClick = (e) => {
      const anchor = e.target.closest('a');
      if (
        anchor &&
        anchor.href &&
        anchor.origin === window.location.origin &&
        !anchor.target &&
        !anchor.hasAttribute('download')
      ) {
        const targetPath = anchor.pathname;
        if (targetPath.startsWith('/r/') || targetPath === '/') {
          e.preventDefault();
          // Preserve query string (e.g. ?name=…&google=…) so params survive navigation
          window.history.pushState(null, '', targetPath + anchor.search);
          setCurrentPath(targetPath + anchor.search);
          window.scrollTo(0, 0);
        }
      }
    };

    window.addEventListener('popstate', handleLocationChange);
    document.addEventListener('click', handleLinkClick);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      document.removeEventListener('click', handleLinkClick);
    };
  }, []);

  // Parse dynamic route: /r/:businessSlug
  const matchReviewRoute = currentPath.match(/^\/r\/([^/]+)/);

  if (matchReviewRoute) {
    const businessSlug = matchReviewRoute[1];
    return <CustomerReviewPage key={businessSlug} slug={businessSlug} />;
  }

  return <DevPortal />;
}
