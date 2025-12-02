import { storage, db, auth } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, updateDoc, arrayUnion, serverTimestamp, getDoc } from 'firebase/firestore';

export type PhotoPhase = 'before' | 'after';

export type OrderPhotoEntry = {
  path: string;
  phase: PhotoPhase;
  uploader: string;
  uploadedAt: number;
  name: string;
  size: number;
  type: string;
};

export async function uploadOrderPhotos(orderId: string, files: File[], phase: PhotoPhase) {
  if (!auth.currentUser) throw new Error('No autenticado');
  const uid = auth.currentUser.uid;
  const orderRef = doc(db, 'orders', orderId);

  const snap = await getDoc(orderRef);
  if (!snap.exists()) {
    await setDoc(orderRef, { createdAt: serverTimestamp(), id: orderId }, { merge: true });
  }

  const entries: OrderPhotoEntry[] = [];
  let i = 0;
  for (const file of files) {
    const ts = Date.now();
    const cleanName = file.name.replace(/[^\w.\-]+/g, '_');
    const path = `orders/${orderId}/${phase}/${ts}_${i}_${uid}_${cleanName}`;
    const objectRef = ref(storage, path);

    await uploadBytes(objectRef, file, {
      contentType: file.type || 'application/octet-stream',
      customMetadata: { orderId, phase, uploader: uid }
    });

    entries.push({
      path,
      phase,
      uploader: uid,
      uploadedAt: ts,
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream'
    });
    i++;
  }

  const field = phase === 'before' ? 'beforePhotos' : 'afterPhotos';
  await updateDoc(orderRef, {
    [field]: arrayUnion(...entries),
    updatedAt: serverTimestamp()
  });

  return entries;
}

export async function getPhotoDownloadURL(path: string) {
  const objectRef = ref(storage, path);
  return getDownloadURL(objectRef);
}
