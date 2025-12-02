import { useState, useEffect } from 'react';
import { auth, db } from '../../config/firebase';
import { signOut } from 'firebase/auth';
import {
  collection, query, where, onSnapshot,
  doc, getDoc, addDoc, deleteDoc, setDoc
} from 'firebase/firestore';
import { useRouter } from 'next/router';

type Order = {
  id: string;
  status?: string;
  carModel?: string;
  package?: string;
  grossAmount?: number;
};

type Vehicle = {
  id: string;
  year: string;
  brand: string;
  model: string;
  type?: string;
  color?: string;
  ownerId: string;
};

export default function CustomerDashboard() {
  const [uid, setUid] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'home'|'order'|'history'|'vehicles'|'profile'>('profile');
  const [userName, setUserName] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profile, setProfile] = useState({
    firstName: '',
    lastName: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    phone: '+1',
    email: ''
  });

  const [orders, setOrders] = useState<Order[]>([]);
  const activeOrder = orders.find(o => ['pending','in-progress'].includes((o.status||'').toLowerCase()));

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const allowedTypes = ['Sedan', 'SUV', 'SUV XL', 'Truck', 'Lifted Truck'];
  const [newVehicle, setNewVehicle] = useState({ year: '', brand: '', model: '', type: 'Sedan', color: '' });

  const router = useRouter();

  // Derivar uid y redirigir si no hay sesión
  useEffect(() => {
    const current = auth.currentUser;
    if (!current) {
      router.replace('/');
      return;
    }
    setUid(current.uid);
  }, [router]);

  // Cargar perfil con fallback a datos de Auth
  useEffect(() => {
    if (!uid) return;
    (async () => {
      setProfileLoading(true);
      try {
        const email = auth.currentUser?.email || '';
        const displayName = auth.currentUser?.displayName || '';
        const [fnFromAuth = '', lnFromAuth = ''] = displayName.split(' ');

        const snap = await getDoc(doc(db, 'users', uid));
        if (snap.exists()) {
          const d = snap.data() as any;
          setUserName(`${(d.firstName||fnFromAuth).trim()} ${(d.lastName||lnFromAuth).trim()}`.trim() || email.split('@')[0] || 'Usuario');
          setProfile({
            firstName: d.firstName || fnFromAuth || '',
            lastName: d.lastName || lnFromAuth || '',
            address: d.address || '',
            city: d.city || '',
            state: d.state || '',
            zipCode: d.zipCode || '',
            phone: d.phone || '+1',
            email
          });
        } else {
          // Fallback cuando no hay documento en Firestore
          setUserName(displayName.trim() || email.split('@')[0] || 'Usuario');
          setProfile(p => ({
            ...p,
            firstName: fnFromAuth || '',
            lastName: lnFromAuth || '',
            email
          }));
        }
      } catch {
        // Fallback si Firestore está bloqueado o offline
        const email = auth.currentUser?.email || '';
        const displayName = auth.currentUser?.displayName || '';
        const [fnFromAuth = '', lnFromAuth = ''] = displayName.split(' ');
        setUserName(displayName.trim() || email.split('@')[0] || 'Usuario');
        setProfile(p => ({
          ...p,
          firstName: fnFromAuth || '',
          lastName: lnFromAuth || '',
          email
        }));
      } finally {
        setProfileLoading(false);
      }
    })();
  }, [uid]);

  // Suscripción a órdenes (usa uid)
  useEffect(() => {
    if (!uid) return;
    try {
      const qOrd = query(collection(db, 'orders'), where('customerId', '==', uid));
      const unsub = onSnapshot(qOrd, snap => {
        setOrders(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
      }, () => setOrders([]));
      return () => unsub();
    } catch {
      setOrders([]);
    }
  }, [uid]);

  // Suscripción a vehículos (usa uid)
  useEffect(() => {
    if (!uid) return;
    setLoadingVehicles(true);
    try {
      const qVeh = query(collection(db, 'vehicles'), where('ownerId', '==', uid));
      const unsub = onSnapshot(qVeh, snap => {
        setVehicles(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
        setLoadingVehicles(false);
      }, () => { setVehicles([]); setLoadingVehicles(false); });
      return () => unsub();
    } catch {
      setVehicles([]);
      setLoadingVehicles(false);
    }
  }, [uid]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/');
  };

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid) return;
    const { year, brand, model, type, color } = newVehicle;
    if (!year || !brand || !model || !type) return;
    if (!allowedTypes.includes(type)) return; // validar contra las 5 opciones
    try {
      await addDoc(collection(db, 'vehicles'), {
        ownerId: uid,
        year, brand, model, type, color,
        createdAt: Date.now()
      });
      setNewVehicle({ year: '', brand: '', model: '', type: 'Sedan', color: '' });
      setShowAddForm(false);
    } catch {
      setVehicles(v => [...v, {
        id: Math.random().toString(36).slice(2),
        ownerId: uid,
        year, brand, model, type, color
      }]);
      setShowAddForm(false);
    }
  };

  const handleDeleteVehicle = async (id: string) => {
    if (!uid) return;
    try {
      await deleteDoc(doc(db, 'vehicles', id));
    } catch {
      setVehicles(v => v.filter(x => x.id !== id));
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-white">Resumen</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              <Stat label="Órdenes" value={orders.length} />
              <Stat label="Vehículos" value={vehicles.length} />
              <Stat label="Activa" value={activeOrder ? 1 : 0} />
            </div>
          </div>
        );
      case 'order':
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white">Orden Activa</h2>
            {activeOrder ? (
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                <p className="text-white font-semibold mb-2">{activeOrder.carModel || 'Vehículo'}</p>
                <p className="text-gray-400 text-sm">Paquete: {activeOrder.package || 'N/A'}</p>
                <p className="text-gray-400 text-sm">
                  Estado: <span className="text-green-400">{activeOrder.status}</span>
                </p>
              </div>
            ) : (
              <div className="text-gray-400">No tienes una orden activa.</div>
            )}
          </div>
        );
      case 'history':
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white">Historial de Órdenes</h2>
            {orders.length === 0 && <p className="text-gray-400">Sin órdenes todavía.</p>}
            <div className="space-y-3">
              {orders.map(o => (
                <div key={o.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700 flex justify-between">
                  <div>
                    <p className="text-white font-medium">{o.carModel || 'Vehículo'}</p>
                    <p className="text-gray-400 text-xs">{o.package || 'Paquete'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-blue-400 font-semibold text-sm">${o.grossAmount || '0.00'}</p>
                    <p className="text-gray-400 text-xs">{o.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case 'vehicles':
        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-white">Mis Vehículos</h2>
              <button
                onClick={() => setShowAddForm(s => !s)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                {showAddForm ? 'Cancelar' : 'Añadir'}
              </button>
            </div>
            {showAddForm && (
              <form onSubmit={handleAddVehicle} className="bg-gray-800 border border-gray-700 rounded-xl p-4 grid grid-cols-2 gap-3">
                <input
                  placeholder="Año"
                  className="bg-gray-700 rounded px-3 py-2 text-sm text-white"
                  value={newVehicle.year}
                  onChange={e => setNewVehicle(v => ({ ...v, year: e.target.value }))}
                  required
                />
                <input
                  placeholder="Marca"
                  className="bg-gray-700 rounded px-3 py-2 text-sm text-white"
                  value={newVehicle.brand}
                  onChange={e => setNewVehicle(v => ({ ...v, brand: e.target.value }))}
                  required
                />
                <input
                  placeholder="Modelo"
                  className="bg-gray-700 rounded px-3 py-2 text-sm text-white"
                  value={newVehicle.model}
                  onChange={e => setNewVehicle(v => ({ ...v, model: e.target.value }))}
                  required
                />
                <select
                  value={newVehicle.type}
                  onChange={e => setNewVehicle(v => ({ ...v, type: e.target.value }))}
                  required
                  className="bg-gray-700 rounded px-3 py-2 text-sm text-white"
                >
                  {allowedTypes.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <input
                  placeholder="Color"
                  className="bg-gray-700 rounded px-3 py-2 text-sm text-white col-span-2"
                  value={newVehicle.color}
                  onChange={e => setNewVehicle(v => ({ ...v, color: e.target.value }))}
                />
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 col-span-2 rounded py-2 text-white text-sm font-semibold"
                >
                  Guardar Vehículo
                </button>
              </form>
            )}
            {loadingVehicles && <p className="text-gray-400 text-sm">Cargando vehículos...</p>}
            <div className="space-y-3">
              {vehicles.map(v => (
                <div key={v.id} className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex justify-between items-center">
                  <div>
                    <p className="text-white font-medium">{v.year} {v.brand} {v.model}</p>
                    {/* Mostrar tipo como texto obligatorio */}
                    <p className="text-gray-400 text-xs">{(v.type || 'Tipo')} | {(v.color || 'Color')}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteVehicle(v.id)}
                    className="text-red-400 hover:text-red-300 text-xs font-medium"
                  >
                    Eliminar
                  </button>
                </div>
              ))}
              {vehicles.length === 0 && !loadingVehicles && (
                <p className="text-gray-500 text-sm">No hay vehículos registrados.</p>
              )}
            </div>
          </div>
        );
      case 'profile':
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-white">Perfil del Cliente</h2>
            {profileLoading && <p className="text-gray-400 text-sm">Cargando perfil...</p>}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ReadField label="Nombre" value={profile.firstName || '-'} />
                <ReadField label="Apellido" value={profile.lastName || '-'} />
              </div>
              <ReadField label="Dirección (Calle y número)" value={profile.address || '-'} />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <ReadField label="Ciudad" value={profile.city || '-'} />
                <ReadField label="Estado" value={profile.state || '-'} />
                <ReadField label="Código Postal" value={profile.zipCode || '-'} />
              </div>
              <ReadField label="Teléfono" value={profile.phone || '+1'} />
              <ReadField label="Correo Electrónico" value={profile.email || '-'} />
              <div className="pt-2">
                <button
                  type="button"
                  onClick={async () => { await signOut(auth); router.push('/'); }}
                  className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                  Cerrar sesión
                </button>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 pb-20">
      <header className="bg-gradient-to-r from-gray-900 to-gray-800 border-b border-gray-700 px-6 py-6">
        <h1 className="text-2xl font-bold text-white">Bienvenido, {userName}</h1>
        <p className="text-gray-400 text-sm mt-1">Tu panel de control</p>
      </header>

      <main className="px-6 py-6">
        {renderContent()}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700">
        <div className="flex justify-around items-center py-3">
          <TabButton id="home" label="Inicio" active={activeTab==='home'} onClick={() => setActiveTab('home')}>
            <HomeIcon />
          </TabButton>
          <TabButton id="order" label="Orden" active={activeTab==='order'} onClick={() => setActiveTab('order')}>
            <OrderIcon />
          </TabButton>
          <TabButton id="history" label="Historial" active={activeTab==='history'} onClick={() => setActiveTab('history')}>
            <HistoryIcon />
          </TabButton>
          <TabButton id="vehicles" label="Vehículos" active={activeTab==='vehicles'} onClick={() => setActiveTab('vehicles')}>
            <CarIcon />
          </TabButton>
          <TabButton id="profile" label="Perfil" active={activeTab==='profile'} onClick={() => setActiveTab('profile')}>
            <ProfileIcon />
          </TabButton>
        </div>
      </nav>
    </div>
  );
}

// Subcomponentes
function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <p className="text-gray-400 text-sm">{label}</p>
      <p className="text-2xl font-bold text-blue-400">{value}</p>
    </div>
  );
}

function Input({
  placeholder,
  value,
  onChange,
  required,
  className = ''
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  className?: string;
}) {
  return (
    <input
      placeholder={placeholder}
      value={value}
      required={required}
      onChange={e => onChange(e.target.value)}
      className={`bg-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
    />
  );
}

function TabButton({
  id, label, active, onClick, children
}: {
  id: string;
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className={`flex flex-col items-center gap-1 px-4 py-2 ${active ? 'text-blue-400' : 'text-gray-400'}`}
    >
      {children}
      <span className="text-xs">{label}</span>
    </button>
  );
}

// Campo de solo lectura
function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="text-gray-300 text-sm mb-1 block">{label}</label>
      <div className="bg-gray-700 rounded px-3 py-2 text-sm text-white border border-gray-600">
        {value || '-'}
      </div>
    </div>
  );
}

// Iconos (SVG inline)
function HomeIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
    </svg>
  );
}
function OrderIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
    </svg>
  );
}
function HistoryIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
    </svg>
  );
}
function CarIcon() {
  return (
    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
      <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
    </svg>
  );
}
function ProfileIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
    </svg>
  );
}
