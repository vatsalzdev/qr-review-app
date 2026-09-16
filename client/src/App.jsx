import React, { useState, useEffect } from 'react';
import CustomerReviewPage from './pages/CustomerReviewPage';
import DevPortal from './pages/DevPortal';

export default function App() {
  const [currentPath, setCurrentPath] = useState(
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  // Parse path: /r/:slug
  const matchReviewRoute = currentPath.match(/^\/r\/([^/]+)/);

  if (matchReviewRoute) {
    const slug = matchReviewRoute[1];
    return <CustomerReviewPage slug={slug} />;
  }

  return <DevPortal />;
}
