import { useState, useEffect } from 'react';
import { auth, db } from '../../config/firebase';
import { signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/router';

export default function WasherDashboard() {
  const [userName, setUserName] = useState('');
  const [orders, setOrders] = useState<any[]>([]);
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

    const q = query(collection(db, 'orders'), where('washerId', '==', auth.currentUser.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(ordersList);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-indigo-600">Car Wash - Lavador</h1>
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
        <h2 className="text-3xl font-bold mb-6">Mis Trabajos</h2>
        
        {orders.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">No tienes trabajos asignados</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {orders.map(order => {
              const appFee = (order.grossAmount || 0) * (order.appFeePercent || 0.15);
              const netEarnings = (order.grossAmount || 0) - appFee;
              
              return (
                <div key={order.id} className="bg-white rounded-lg shadow p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-semibold text-lg">{order.carModel || 'Vehículo'}</h3>
                      <p className="text-gray-600">Paquete: {order.package || 'N/A'}</p>
                      <p className="text-gray-600">Estado: <span className="font-medium">{order.status || 'pendiente'}</span></p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Total: ${order.grossAmount?.toFixed(2) || '0.00'}</p>
                      <p className="text-sm text-gray-500">Comisión app: -${appFee.toFixed(2)}</p>
                      <p className="text-2xl font-bold text-green-600">${netEarnings.toFixed(2)}</p>
                      <p className="text-xs text-gray-500">Tu ganancia</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
