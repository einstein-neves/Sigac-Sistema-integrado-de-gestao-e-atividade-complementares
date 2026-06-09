import React from 'react';
import { AuthContext } from '../contexts/AuthContext';

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  return context;
}
