import React, { useState } from 'react';
import { uploadOrderPhotos } from '../../services/photos';

type Props = { orderId: string };

const WasherOrderPhotos: React.FC<Props> = ({ orderId }) => {
  const [beforeFiles, setBeforeFiles] = useState<FileList | null>(null);
  const [afterFiles, setAfterFiles] = useState<FileList | null>(null);
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleUpload = async (phase: 'before' | 'after') => {
    const files = phase === 'before' ? beforeFiles : afterFiles;
    if (!files || files.length === 0) return;
    setLoading(true);
    setStatus('');
    try {
      await uploadOrderPhotos(orderId, Array.from(files), phase);
      setStatus(`Fotos de "${phase}" subidas correctamente.`);
      if (phase === 'before') setBeforeFiles(null);
      else setAfterFiles(null);
    } catch (e: any) {
      setStatus(e?.message || 'Error al subir fotos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-4 border rounded-lg">
        <h3 className="font-semibold mb-2">Fotos ANTES</h3>
        <input type="file" accept="image/*" multiple onChange={(e) => setBeforeFiles(e.target.files)} />
        <button
          type="button"
          disabled={loading || !beforeFiles?.length}
          onClick={() => handleUpload('before')}
          className="ml-3 px-3 py-1.5 bg-indigo-600 text-white rounded disabled:opacity-50"
        >
          Subir fotos antes
        </button>
      </div>

      <div className="p-4 border rounded-lg">
        <h3 className="font-semibold mb-2">Fotos DESPUÉS</h3>
        <input type="file" accept="image/*" multiple onChange={(e) => setAfterFiles(e.target.files)} />
        <button
          type="button"
          disabled={loading || !afterFiles?.length}
          onClick={() => handleUpload('after')}
          className="ml-3 px-3 py-1.5 bg-indigo-600 text-white rounded disabled:opacity-50"
        >
          Subir fotos después
        </button>
      </div>

      {status && <p className="text-sm text-gray-600">{status}</p>}

      {/* Nota: el washer no ve las fotos, solo sube */}
    </div>
  );
};

export default WasherOrderPhotos;
