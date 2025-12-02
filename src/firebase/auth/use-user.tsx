
'use client';

import { useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { FirebaseContext } from '@/firebase/provider';
import { doc, getDoc } from 'firebase/firestore';

// This defines the structure of the custom claims we expect.
interface CustomClaims {
  role?: 'admin' | 'washer';
  [key: string]: any;
}

// Extend the Firebase User type to include our custom claims.
export type UserWithClaims = User & {
  customClaims?: CustomClaims;
};


// Return type for useUser() - specific to user auth state
export interface UserHookResult { 
  user: UserWithClaims | null;
  isUserLoading: boolean; 
  userError: Error | null;
}

/**
 * Hook specifically for accessing the authenticated user's state,
 * including custom claims.
 * This provides the User object, loading status, and any auth errors.
 * @returns {UserHookResult} Object with user, isUserLoading, userError.
 */
export const useUser = (): UserHookResult => {
  const context = useContext(FirebaseContext);
  const [userAuthState, setUserAuthState] = useState<{ user: UserWithClaims | null; isUserLoading: boolean; userError: Error | null; }>({
    user: null,
    isUserLoading: true,
    userError: null,
  });

  useEffect(() => {
    if (!context?.auth || !context?.firestore) {
      setUserAuthState({ user: null, isUserLoading: false, userError: new Error("Firebase services not available.") });
      return;
    }

    const unsubscribe = onAuthStateChanged(context.auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Get claims from the token
          let idTokenResult = await firebaseUser.getIdTokenResult(true);
          
          // If role is not in the token, it might be stale.
          // This happens on the very first login after a role is assigned.
          // We'll fetch from Firestore to be sure and force a token refresh if needed.
          if (!idTokenResult.claims.role) {
              const userDocRef = doc(context.firestore, 'users', firebaseUser.uid);
              const userDocSnap = await getDoc(userDocRef);

              if (userDocSnap.exists() && userDocSnap.data()?.role) {
                  // Role exists in Firestore but not token. Force refresh.
                  idTokenResult = await firebaseUser.getIdTokenResult(true);
              }
          }
          
          const userWithClaims: UserWithClaims = Object.assign(firebaseUser, {
            customClaims: idTokenResult.claims
          });

          setUserAuthState({ user: userWithClaims, isUserLoading: false, userError: null });

        } catch (error) {
          console.error("Error fetching user claims:", error);
          // Set user but also populate the error
          setUserAuthState({ user: firebaseUser as UserWithClaims, isUserLoading: false, userError: error as Error });
        }
      } else {
        // No user is signed in
        setUserAuthState({ user: null, isUserLoading: false, userError: null });
      }
    }, (error) => {
        // Handle initial onAuthStateChanged errors
        console.error("onAuthStateChanged error:", error);
        setUserAuthState({ user: null, isUserLoading: false, userError: error });
    });

    return () => unsubscribe();
  }, [context?.auth, context?.firestore]);
  

  if (context === undefined) {
    throw new Error('useUser must be used within a FirebaseProvider.');
  }
  
  return userAuthState;
};
