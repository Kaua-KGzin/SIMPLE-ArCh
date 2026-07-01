// Guarda do JWT no localStorage.
// (Em produção o ideal é cookie httpOnly; para o MVP o localStorage basta.)

const KEY = 'simple_arch_token';

export const auth = {
  getToken: () => localStorage.getItem(KEY),
  setToken: (t: string) => localStorage.setItem(KEY, t),
  clear: () => localStorage.removeItem(KEY),
  isLoggedIn: () => !!localStorage.getItem(KEY),
};
