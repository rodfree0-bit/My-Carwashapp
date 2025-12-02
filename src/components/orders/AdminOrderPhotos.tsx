import React, { useEffect, useState } from 'react';
import { db } from '../../config/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { getPhotoDownloadURL, OrderPhotoEntry } from '../../services/photos';

type Props = { orderId: string };

const AdminOrderPhotos: React.FC<Props> = ({ orderId }) => {
  const [before, setBefore] = useState<OrderPhotoEntry[]>([]);
  const [after, setAfter] = useState<OrderPhotoEntry[]>([]);
  const [urlsBefore, setUrlsBefore] = useState<string[]>([]);
  const [urlsAfter, setUrlsAfter] = useState<string[]>([]);

  useEffect(() => {
    const ref = doc(db, 'orders', orderId);
    const unsub = onSnapshot(ref, async (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as any;
      const b: OrderPhotoEntry[] = data?.beforePhotos || [];
      const a: OrderPhotoEntry[] = data?.afterPhotos || [];
      setBefore(b);
      setAfter(a);

      // Intenta resolver URLs (necesita permisos de lectura en Storage)
      const bUrls = await Promise.all(b.map(x => getPhotoDownloadURL(x.path).catch(() => '')));
      const aUrls = await Promise.all(a.map(x => getPhotoDownloadURL(x.path).catch(() => '')));
      setUrlsBefore(bUrls.filter(Boolean));
      setUrlsAfter(aUrls.filter(Boolean));
    });
    return () => unsub();
  }, [orderId]);

  return (
    <div className="space-y-8">
      <section>
        <h3 className="text-lg font-semibold mb-3">Fotos ANTES ({before.length})</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {urlsBefore.map((u, i) => (
            <a key={i} href={u} target="_blank" rel="noreferrer">
              <img src={u} alt={`before-${i}`} className="w-full h-32 object-cover rounded" />
            </a>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-3">Fotos DESPUÉS ({after.length})</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {urlsAfter.map((u, i) => (
            <a key={i} href={u} target="_blank" rel="noreferrer">
              <img src={u} alt={`after-${i}`} className="w-full h-32 object-cover rounded" />
            </a>
          ))}
        </div>
      </section>
    </div>
  );
};

export default AdminOrderPhotos;
