import { initializeApp } from 'firebase/app';

const firebaseConfig = {
  apiKey: 'AIzaSyA7e9rwSTlRLMTyBr2HnMjODYNMcRia-QY',
  authDomain: 'remindernotifapp009.firebaseapp.com',
  projectId: 'remindernotifapp009',
  storageBucket: 'remindernotifapp009.firebasestorage.app',
  messagingSenderId: '640285667262',
  appId: '1:640285667262:android:e8f53089f0316192ce93ef',
};

const app = initializeApp(firebaseConfig);

export default app;