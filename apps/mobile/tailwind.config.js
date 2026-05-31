/** @type {import('tailwindcss').Config} */
module.exports = {
  // NativeWind v4 on web requires 'class' so it can toggle dark mode via JS.
  // 'media' (the default) crashes at runtime with StyleSheet.setFlag error.
  darkMode: 'class',
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#7C3AED',
          dark: '#5B21B6',
          light: '#F5F3FF',
        },
        accent: {
          star: '#F59E0B',
          success: '#10B981',
          warning: '#F97316',
          danger: '#EF4444',
        },
        child: {
          sky: '#0EA5E9',
          rose: '#F43F5E',
          lime: '#84CC16',
        },
        neutral: {
          900: '#111827',
          500: '#6B7280',
          100: '#F3F4F6',
        },
        pastel: {
          lavender: '#EDE0FF',
          lilac:    '#D4BBFF',
          sky:      '#D0EAFF',
          mint:     '#C8F5E0',
          peach:    '#FFE4C8',
          rose:     '#FFD6EA',
          gold:     '#FFF0C0',
          teal:     '#C0F0EC',
          base:     '#F5F0FF',
        },
        // MY24 glassmorphic palette
        my24: {
          bg:       '#B5A8E0',  // rich lavender base — matches MY24 final design
          bgSoft:   '#CABFEA',  // lighter for less-busy areas
          dark:     '#1A1A2E',  // deep navy for rewards / modals / overlays
        },
        glass: {
          card:    'rgba(255,255,255,0.85)',
          cardSoft:'rgba(255,255,255,0.70)',
          border:  'rgba(255,255,255,0.55)',
          dark:    'rgba(255,255,255,0.10)',
        },
        // MY24 solid pastel icon circles
        icon: {
          teal:     '#4FD1C5',
          pink:     '#F687B3',
          lavender: '#A78BFA',
          peach:    '#FBB774',
          sky:      '#7DD3FC',
          mint:     '#86EFAC',
        },
      },
      fontFamily: {
        nunito: ['Nunito_400Regular'],
        'nunito-semibold': ['Nunito_600SemiBold'],
        'nunito-bold': ['Nunito_700Bold'],
        'nunito-extrabold': ['Nunito_800ExtraBold'],
        inter: ['Inter_400Regular'],
        'inter-medium': ['Inter_500Medium'],
        'inter-semibold': ['Inter_600SemiBold'],
      },
      fontSize: {
        'display': ['40px', { fontWeight: '800', lineHeight: '48px' }],
        'heading': ['28px', { fontWeight: '700', lineHeight: '36px' }],
        'subhead': ['22px', { fontWeight: '600', lineHeight: '30px' }],
        'body': ['18px', { fontWeight: '400', lineHeight: '26px' }],
        'caption': ['14px', { fontWeight: '400', lineHeight: '20px' }],
        'parent-body': ['16px', { fontWeight: '400', lineHeight: '24px' }],
      },
    },
  },
  plugins: [],
};
