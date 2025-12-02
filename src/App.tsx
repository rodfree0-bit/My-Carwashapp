import { useEffect, useState } from 'react';
import { auth } from './config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import Login from './components/Login';
import CustomerDashboard from './components/dashboards/CustomerDashboard';
import WasherDashboard from './components/dashboards/WasherDashboard';
import AdminDashboard from './components/dashboards/AdminDashboard';

function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handleLocationChange);

    return () => {
      unsubscribe();
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Cargando...</div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (currentPath === '/customer-dashboard') {
    return <CustomerDashboard />;
  }

  if (currentPath === '/washer/orders') {
    return <WasherDashboard />;
  }

  if (currentPath === '/admin/orders') {
    return <AdminDashboard />;
  }

  return <Login />;
}

export default App;
