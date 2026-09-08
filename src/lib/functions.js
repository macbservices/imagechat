import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase.js';

// Wrappers das Cloud Functions callable. Cada um retorna uma Promise;
// erros vêm como FunctionsError com `.code` e `.message` já traduzida.
export const processarMensagem = httpsCallable(functions, 'processarMensagem');
export const souAdmin = httpsCallable(functions, 'souAdmin');
export const adminApagarMensagem = httpsCallable(functions, 'adminApagarMensagem');
export const adminDefinirBanido = httpsCallable(functions, 'adminDefinirBanido');
