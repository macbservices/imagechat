import { createContext, useContext, useEffect, useState } from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from './firebase.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setLoading(false);
      if (!u) return;

      // Mantém o perfil do usuário em /usuarios (sem tocar em campos protegidos:
      // `banido` e `ultimaGeracao` são gerenciados só pelas Cloud Functions).
      try {
        await setDoc(
          doc(db, 'usuarios', u.uid),
          {
            uid: u.uid,
            nome: u.displayName || u.email || 'Anônimo',
            email: u.email || null,
            foto: u.photoURL || null,
            atualizadoEm: serverTimestamp(),
          },
          { merge: true },
        );
      } catch (err) {
        console.error('Falha ao salvar o perfil do usuário', err);
      }
    });
  }, []);

  const value = {
    user,
    loading,
    signInWithGoogle: () => signInWithPopup(auth, googleProvider),
    signOut: () => firebaseSignOut(auth),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>.');
  return ctx;
}

// Reexport só para conveniência de quem importar daqui.
export { GoogleAuthProvider };
