import { io, type Socket } from 'socket.io-client';
import { API_URL } from './api';
import { auth } from './auth';

let socket: Socket | null = null;

/**
 * Socket único e compartilhado pelo app. `auth` é uma função (não um objeto
 * fixo) para que o token mais recente seja usado a cada (re)conexão — útil
 * após login/logout, sem precisar recriar o socket.
 */
export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_URL || undefined, {
      autoConnect: false,
      withCredentials: true,
      auth: (cb) => cb({ token: auth.getToken() }),
    });
  }
  return socket;
}
