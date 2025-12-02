import { useState, useEffect } from 'react';
import { auth, db } from '../../config/firebase';
import { signOut } from 'firebase/auth';
import { collection, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/router';

export default function AdminDashboard() {
  const [userName, setUserName] = useState('');
  const [orders, setOrders] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    if (!auth.currentUser) return;
    
    const fetchUser = async () => {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser!.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUserName(`${data.firstName} ${data.lastName}`);
      }
    };
    fetchUser();

    const unsubOrders = onSnapshot(collection(db, 'orders'), (snapshot) => {
      const ordersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(ordersList);
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersList);
    });

    return () => {
      unsubOrders();
      unsubUsers();
    };
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/');
  };

  const totalRevenue = orders.reduce((sum, order) => sum + ((order.grossAmount || 0) * (order.appFeePercent || 0.15)), 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-indigo-600">Car Wash - Admin</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-700">Hola, {userName}</span>
            <button
              onClick={handleLogout}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-gray-500 text-sm font-medium">Total Órdenes</h3>
            <p className="text-3xl font-bold text-indigo-600 mt-2">{orders.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-gray-500 text-sm font-medium">Total Usuarios</h3>
            <p className="text-3xl font-bold text-indigo-600 mt-2">{users.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-gray-500 text-sm font-medium">Ingresos por Comisión</h3>
            <p className="text-3xl font-bold text-green-600 mt-2">${totalRevenue.toFixed(2)}</p>
          </div>
        </div>

        <h2 className="text-2xl font-bold mb-4">Todas las Órdenes</h2>
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vehículo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Comisión</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orders.map(order => {
                const commission = (order.grossAmount || 0) * (order.appFeePercent || 0.15);
                return (
                  <tr key={order.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{order.id.slice(0, 8)}...</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{order.carModel || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{order.status || 'pendiente'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${(order.grossAmount || 0).toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">${commission.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
