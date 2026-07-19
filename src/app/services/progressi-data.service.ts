import { Injectable } from '@angular/core';
import { doc, getDocs, setDoc, deleteDoc, collection } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { FirebaseService } from '../core/services/firebase.service';
import { ZoneFixService } from '../core/utils/zone.util';
import { ProgressiRecord } from '../models/progressi.model';

@Injectable({ providedIn: 'root' })
export class ProgressiDataService {
  constructor(private fb: FirebaseService, private zoneFix: ZoneFixService) {}

  private col(uid: string) {
    return collection(this.fb.db, 'users', uid, 'progressi');
  }

  loadHistory(uid: string): Promise<ProgressiRecord[]> {
    return this.zoneFix.run((async () => {
      const snap = await getDocs(this.col(uid));
      return snap.docs
        .map(d => d.data() as ProgressiRecord)
        .sort((a, b) => b.date.localeCompare(a.date));
    })());
  }

  save(uid: string, date: string, files: { fronte: Blob; retro: Blob; laterale: Blob }): Promise<void> {
    return this.zoneFix.run((async () => {
      const [fronteUrl, retroUrl, lateraleUrl] = await Promise.all([
        this.uploadOne(uid, date, 'fronte', files.fronte),
        this.uploadOne(uid, date, 'retro', files.retro),
        this.uploadOne(uid, date, 'laterale', files.laterale)
      ]);
      const record: ProgressiRecord = { date, fronteUrl, retroUrl, lateraleUrl };
      await setDoc(doc(this.col(uid), date), record);
    })());
  }

  delete(uid: string, date: string): Promise<void> {
    return this.zoneFix.run((async () => {
      await Promise.all(['fronte', 'retro', 'laterale'].map(type =>
        deleteObject(ref(this.fb.storage, `users/${uid}/progressi/${date}/${type}.jpg`)).catch(() => {})
      ));
      await deleteDoc(doc(this.col(uid), date));
    })());
  }

  private async uploadOne(uid: string, date: string, type: string, blob: Blob): Promise<string> {
    const fileRef = ref(this.fb.storage, `users/${uid}/progressi/${date}/${type}.jpg`);
    await uploadBytes(fileRef, blob);
    return getDownloadURL(fileRef);
  }
}
