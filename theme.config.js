/** @type {const} */
const themeColors = {
  primary: { light: '#00D9FF', dark: '#00D9FF' },
  background: { light: '#F8FAFC', dark: '#0A0E27' },
  surface: { light: '#FFFFFF', dark: '#1A1F3A' },
  foreground: { light: '#0F172A', dark: '#F1F5F9' },
  muted: { light: '#64748B', dark: '#94A3B8' },
  border: { light: '#E2E8F0', dark: '#334155' },
  success: { light: '#10B981', dark: '#6EE7B7' },
  warning: { light: '#F59E0B', dark: '#FBBF24' },
  error: { light: '#EF4444', dark: '#F87171' },
  accent: { light: '#7C3AED', dark: '#A78BFA' },
  glass: { light: 'rgba(255, 255, 255, 0.7)', dark: 'rgba(26, 31, 58, 0.7)' },
};

module.exports = { themeColors };

// Gradient definitions for modern 2026 design
const gradients = {
  primary: 'linear-gradient(135deg, #00D9FF 0%, #0099CC 100%)',
  accent: 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)',
  glass: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
};

module.exports = { themeColors, gradients };
