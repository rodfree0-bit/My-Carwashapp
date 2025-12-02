import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { auth, db } from '../../config/firebase';
import {
  doc, getDoc, collection, onSnapshot, addDoc, deleteDoc, setDoc, serverTimestamp,
  query, orderBy, limit, where
} from 'firebase/firestore';
import { sendPasswordResetEmail, signOut } from 'firebase/auth';

type AllowedType = 'Sedan' | 'SUV' | 'SUV XL' | 'Truck' | 'Lifted Truck';
type PriceMap = Record<AllowedType, number | ''>;
type UserRow = { id: string; firstName?: string; lastName?: string; email?: string; role?: string; disabled?: boolean };

const allowedTypes: AllowedType[] = ['Sedan', 'SUV', 'SUV XL', 'Truck', 'Lifted Truck'];

export default function OwnerDashboard() {
  const router = useRouter();

  // Guard de acceso
  const [uid, setUid] = useState<string | null>(null);
  const [guardLoading, setGuardLoading] = useState(true);
  const [guardError, setGuardError] = useState('');

  // Tabs
  const [tab, setTab] = useState<'overview'|'packages'|'extras'|'users'|'settings'>('overview');

  // Paquetes y extras
  const [packages, setPackages] = useState<any[]>([]);
  const [extras, setExtras] = useState<any[]>([]);
  const emptyPrices: PriceMap = { Sedan: '', SUV: '', 'SUV XL': '', Truck: '', 'Lifted Truck': '' };
  const [newPackage, setNewPackage] = useState<{ name: string; prices: PriceMap }>({ name: '', prices: { ...emptyPrices } });
  const [newExtra, setNewExtra] = useState<{ name: string; prices: PriceMap }>({ name: '', prices: { ...emptyPrices } });
  const [savingPkg, setSavingPkg] = useState(false);
  const [savingExt, setSavingExt] = useState(false);

  // Usuarios
  const [users, setUsers] = useState<UserRow[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  // Configuración
  const [settings, setSettings] = useState({
    businessName: '',
    currency: 'USD',
    taxRate: 0,
    serviceAreas: '',
    basePrices: { ...emptyPrices }
  });
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Estadísticas
  const stats = useMemo(() => {
    const totalUsers = users.length;
    const admins = users.filter(u => u.role === 'admin').length;
    const workers = users.filter(u => u.role === 'worker' || u.role === 'washer').length;
    return {
      totalUsers,
      admins,
      workers,
      packages: packages.length,
      extras: extras.length
    };
  }, [users, packages, extras]);

  // Derivar uid y verificar rol
  useEffect(() => {
    const current = auth.currentUser;
    if (!current) { router.replace('/'); return; }
    setUid(current.uid);
  }, [router]);

  useEffect(() => {
    if (!uid) return;
    (async () => {
      try {
        const u = await getDoc(doc(db, 'users', uid));
        const role = (u.exists() && (u.data() as any).role) || 'customer';
        if (role !== 'owner') {
          setGuardError('No autorizado (solo Owner).');
          router.replace('/');
          return;
        }
        // Subscribir paquetes y extras
        const pkRef = collection(db, 'owners', uid, 'packages');
        const exRef = collection(db, 'owners', uid, 'extras');
        const unPk = onSnapshot(pkRef, s => setPackages(s.docs.map(d => ({ id: d.id, ...(d.data() as any) }))), () => setPackages([]));
        const unEx = onSnapshot(exRef, s => setExtras(s.docs.map(d => ({ id: d.id, ...(d.data() as any) }))), () => setExtras([]));

        // Subscribir usuarios (SIN orderBy para evitar índice)
        const usersRef = query(collection(db, 'users'), limit(100));
        const unUsers = onSnapshot(usersRef, s => {
          setUsers(s.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
        }, (err) => {
          console.error('Error cargando usuarios:', err);
          setUsers([]);
        });

        // Cargar configuración
        setLoadingSettings(true);
        const st = await getDoc(doc(db, 'owners', uid, 'settings', 'general'));
        if (st.exists()) {
          const d = st.data() as any;
          setSettings({
            businessName: d.businessName || '',
            currency: d.currency || 'USD',
            taxRate: Number(d.taxRate || 0),
            serviceAreas: d.serviceAreas || '',
            basePrices: { ...emptyPrices, ...(d.basePrices || {}) }
          });
        }
        setLoadingSettings(false);

        setGuardLoading(false);
        return () => { unPk(); unEx(); unUsers(); };
      } catch (e) {
        console.error('Error en useEffect:', e);
        setGuardError('Error cargando datos.');
        setGuardLoading(false);
      }
    })();
  }, [uid, router]);

  // Helpers
  const normalizePrices = (p: PriceMap) => {
    const out: Record<AllowedType, number> = { ...({} as any) };
    for (const t of allowedTypes) {
      const v = Number(p[t] || 0);
      out[t] = isNaN(v) ? 0 : v;
    }
    return out;
  };

  // Acciones: paquetes/extras
  const addPackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid || !newPackage.name.trim()) return;
    setSavingPkg(true);
    try {
      await addDoc(collection(db, 'owners', uid, 'packages'), {
        name: newPackage.name.trim(),
        prices: normalizePrices(newPackage.prices),
        active: true,
        createdAt: serverTimestamp()
      });
      setNewPackage({ name: '', prices: { ...emptyPrices } });
    } finally {
      setSavingPkg(false);
    }
  };
  const addExtra = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid || !newExtra.name.trim()) return;
    setSavingExt(true);
    try {
      await addDoc(collection(db, 'owners', uid, 'extras'), {
        name: newExtra.name.trim(),
        prices: normalizePrices(newExtra.prices),
        active: true,
        createdAt: serverTimestamp()
      });
      setNewExtra({ name: '', prices: { ...emptyPrices } });
    } finally {
      setSavingExt(false);
    }
  };
  const deletePackage = async (id: string) => { if (!uid) return; try { await deleteDoc(doc(db, 'owners', uid, 'packages', id)); } catch {} };
  const deleteExtra = async (id: string) => { if (!uid) return; try { await deleteDoc(doc(db, 'owners', uid, 'extras', id)); } catch {} };

  // Acciones: usuarios
  const updateUserRole = async (userId: string, role: 'customer'|'worker'|'washer'|'admin'|'owner') => {
    setUpdatingUserId(userId);
    try { await setDoc(doc(db, 'users', userId), { role }, { merge: true }); } finally { setUpdatingUserId(null); }
  };
  const toggleUserDisabled = async (userId: string, disabled: boolean) => {
    setUpdatingUserId(userId);
    try { await setDoc(doc(db, 'users', userId), { disabled: !!disabled }, { merge: true }); } finally { setUpdatingUserId(null); }
  };
  const resetPassword = async (email?: string) => {
    if (!email) return;
    try { await sendPasswordResetEmail(auth, email); alert('Email de reseteo enviado.'); } catch { alert('No se pudo enviar.'); }
  };

  // Acciones: configuración
  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid) return;
    setSavingSettings(true);
    try {
      await setDoc(doc(db, 'owners', uid, 'settings', 'general'), {
        ...settings,
        basePrices: normalizePrices(settings.basePrices as any),
        updatedAt: serverTimestamp()
      }, { merge: true });
    } finally {
      setSavingSettings(false);
    }
  };

  // Filtros de usuarios
  const filteredUsers = users.filter(u => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return true;
    return (u.email || '').toLowerCase().includes(q) ||
           (u.firstName || '').toLowerCase().includes(q) ||
           (u.lastName || '').toLowerCase().includes(q);
  });

  if (guardLoading) {
    return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">Cargando...</div>;
  }
  if (guardError) {
    return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">{guardError}</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <header className="bg-gray-900/60 border-b border-gray-700 px-6 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{settings.businessName || 'Panel de Owner'}</h1>
          <p className="text-gray-400 text-sm">Control total: paquetes, extras, usuarios y configuración</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => router.push('/customer-dashboard')} className="text-gray-300 text-sm hover:text-white">Ir a cliente</button>
          <button onClick={async () => { await signOut(auth); router.replace('/'); }} className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-sm">Cerrar sesión</button>
        </div>
      </header>

      <nav className="px-6 pt-4 flex gap-2 flex-wrap">
        { [
          { id: 'overview', label: 'Resumen' },
          { id: 'packages', label: 'Paquetes' },
          { id: 'extras', label: 'Extras' },
          { id: 'users', label: 'Usuarios' },
          { id: 'settings', label: 'Configuración' }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`px-4 py-2 rounded ${tab===t.id ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
          >
            {t.label}
          </button>
        )) }
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {tab === 'overview' && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard label="Usuarios" value={stats.totalUsers} />
            <StatCard label="Admins" value={stats.admins} />
            <StatCard label="Workers" value={stats.workers} />
            <StatCard label="Paquetes" value={stats.packages} />
            <StatCard label="Extras" value={stats.extras} />
          </div>
        )}

        {tab === 'packages' && (
          <section className="space-y-4">
            <form onSubmit={addPackage} className="bg-gray-800 border border-gray-700 rounded-xl p-4">
              <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                <input
                  placeholder="Nombre del paquete (Ej: Básico, Premium)"
                  value={newPackage.name}
                  onChange={e => setNewPackage(s => ({ ...s, name: e.target.value }))}
                  className="bg-gray-700 text-white rounded px-3 py-2 text-sm md:col-span-2"
                  required
                />
                {allowedTypes.map(t => (
                  <input
                    key={t}
                    placeholder={`${t} $`}
                    value={newPackage.prices[t] as any}
                    onChange={e => setNewPackage(s => ({ ...s, prices: { ...s.prices, [t]: e.target.value as any } }))}
                    className="bg-gray-700 text-white rounded px-3 py-2 text-sm"
                  />
                ))}
              </div>
              <div className="flex justify-end mt-3">
                <button type="submit" disabled={savingPkg} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-semibold disabled:opacity-50">
                  {savingPkg ? 'Guardando...' : 'Agregar paquete'}
                </button>
              </div>
            </form>

            <div className="space-y-3">
              {packages.map(p => (
                <div key={p.id} className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex justify-between items-start">
                  <div>
                    <p className="text-white font-semibold">{p.name}</p>
                    <div className="text-gray-400 text-xs mt-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-1">
                      {allowedTypes.map(t => (
                        <span key={t}>{t}: <span className="text-blue-400">${p.prices?.[t] ?? 0}</span></span>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => deletePackage(p.id)} className="text-red-400 hover:text-red-300 text-sm">Eliminar</button>
                </div>
              ))}
              {packages.length === 0 && <div className="text-gray-400 text-sm">No hay paquetes todavía.</div>}
            </div>
          </section>
        )}

        {tab === 'extras' && (
          <section className="space-y-4">
            <form onSubmit={addExtra} className="bg-gray-800 border border-gray-700 rounded-xl p-4">
              <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                <input
                  placeholder="Nombre del extra (Ej: Cera, Interior Detallado)"
                  value={newExtra.name}
                  onChange={e => setNewExtra(s => ({ ...s, name: e.target.value }))}
                  className="bg-gray-700 text-white rounded px-3 py-2 text-sm md:col-span-2"
                  required
                />
                {allowedTypes.map(t => (
                  <input
                    key={t}
                    placeholder={`${t} $`}
                    value={newExtra.prices[t] as any}
                    onChange={e => setNewExtra(s => ({ ...s, prices: { ...s.prices, [t]: e.target.value as any } }))}
                    className="bg-gray-700 text-white rounded px-3 py-2 text-sm"
                  />
                ))}
              </div>
              <div className="flex justify-end mt-3">
                <button type="submit" disabled={savingExt} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-semibold disabled:opacity-50">
                  {savingExt ? 'Guardando...' : 'Agregar extra'}
                </button>
              </div>
            </form>

            <div className="space-y-3">
              {extras.map(x => (
                <div key={x.id} className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex justify-between items-start">
                  <div>
                    <p className="text-white font-semibold">{x.name}</p>
                    <div className="text-gray-400 text-xs mt-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-1">
                      {allowedTypes.map(t => (
                        <span key={t}>{t}: <span className="text-blue-400">${x.prices?.[t] ?? 0}</span></span>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => deleteExtra(x.id)} className="text-red-400 hover:text-red-300 text-sm">Eliminar</button>
                </div>
              ))}
              {extras.length === 0 && <div className="text-gray-400 text-sm">No hay extras todavía.</div>}
            </div>
          </section>
        )}

        {tab === 'users' && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Usuarios</h2>
              <input
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                placeholder="Buscar por nombre o email..."
                className="bg-gray-800 border border-gray-700 text-white rounded px-3 py-2 text-sm w-72"
              />
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-auto">
              <table className="min-w-full text-sm text-gray-200">
                <thead className="bg-gray-900 text-gray-400">
                  <tr>
                    <th className="text-left px-4 py-2">Nombre</th>
                    <th className="text-left px-4 py-2">Email</th>
                    <th className="text-left px-4 py-2">Rol</th>
                    <th className="text-left px-4 py-2">Estado</th>
                    <th className="text-right px-4 py-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => (
                    <tr key={u.id} className="border-t border-gray-700">
                      <td className="px-4 py-2">{`${u.firstName || ''} ${u.lastName || ''}`.trim() || '-'}</td>
                      <td className="px-4 py-2">{u.email || '-'}</td>
                      <td className="px-4 py-2 capitalize">{u.role || 'customer'}</td>
                      <td className="px-4 py-2">{u.disabled ? 'Desactivado' : 'Activo'}</td>
                      <td className="px-4 py-2">
                        <div className="flex gap-2 justify-end">
                          <select
                            value={u.role || 'customer'}
                            onChange={e => updateUserRole(u.id, e.target.value as any)}
                            className="bg-gray-700 text-white px-2 py-1 rounded"
                            disabled={updatingUserId === u.id}
                          >
                            {['customer','worker','washer','admin','owner'].map(r => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => toggleUserDisabled(u.id, !u.disabled)}
                            className={`px-2 py-1 rounded ${u.disabled ? 'bg-green-600' : 'bg-yellow-600'} text-white`}
                            disabled={updatingUserId === u.id}
                          >
                            {u.disabled ? 'Activar' : 'Desactivar'}
                          </button>
                          <button
                            onClick={() => resetPassword(u.email)}
                            className="px-2 py-1 rounded bg-blue-600 text-white"
                          >
                            Reset pass
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr><td className="px-4 py-4 text-gray-400" colSpan={5}>Sin usuarios.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-500">Nota: Desactivar solo marca el usuario en Firestore. No elimina ni deshabilita en Firebase Auth.</p>
          </section>
        )}

        {tab === 'settings' && (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">Configuración</h2>
            <form onSubmit={saveSettings} className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-4">
              <div className="grid md:grid-cols-3 gap-3">
                <input
                  placeholder="Nombre del negocio"
                  value={settings.businessName}
                  onChange={e => setSettings(s => ({ ...s, businessName: e.target.value }))}
                  className="bg-gray-700 text-white rounded px-3 py-2 text-sm"
                  required
                />
                <select
                  value={settings.currency}
                  onChange={e => setSettings(s => ({ ...s, currency: e.target.value }))}
                  className="bg-gray-700 text-white rounded px-3 py-2 text-sm"
                >
                  {['USD','MXN','EUR'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Impuesto %"
                  value={settings.taxRate}
                  onChange={e => setSettings(s => ({ ...s, taxRate: Number(e.target.value) }))}
                  className="bg-gray-700 text-white rounded px-3 py-2 text-sm"
                />
              </div>
              <textarea
                placeholder="Áreas de servicio (texto libre)"
                value={settings.serviceAreas}
                onChange={e => setSettings(s => ({ ...s, serviceAreas: e.target.value }))}
                className="bg-gray-700 text-white rounded px-3 py-2 text-sm w-full min-h-[80px]"
              />
              <div>
                <p className="text-gray-300 text-sm mb-2">Precios base por tipo (fallback)</p>
                <div className="grid md:grid-cols-5 gap-3">
                  {allowedTypes.map(t => (
                    <input
                      key={t}
                      placeholder={`${t} $`}
                      value={(settings.basePrices as any)[t] as any}
                      onChange={e => setSettings(s => ({ ...s, basePrices: { ...(s.basePrices as any), [t]: e.target.value } }))}
                      className="bg-gray-700 text-white rounded px-3 py-2 text-sm"
                    />
                  ))}
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-semibold disabled:opacity-50"
                >
                  {savingSettings ? 'Guardando...' : 'Guardar configuración'}
                </button>
              </div>
            </form>
            {loadingSettings && <p className="text-gray-400 text-sm">Cargando configuración...</p>}
          </section>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
      <p className="text-gray-400 text-sm">{label}</p>
      <p className="text-2xl font-bold text-blue-400">{value}</p>
    </div>
  );
}
