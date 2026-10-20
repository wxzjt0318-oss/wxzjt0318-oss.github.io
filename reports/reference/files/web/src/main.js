import { createApp } from 'vue';
import { createVuetify } from 'vuetify';
import 'vuetify/styles';
import '@mdi/font/css/materialdesignicons.css';
import App from './App.vue';

// 主题持久化：默认深色，用户选择存 localStorage，刷新后保持
const savedTheme = typeof localStorage !== 'undefined' ? localStorage.getItem('zmm-theme') : null;
const defaultTheme = savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : 'dark';

const vuetify = createVuetify({
  theme: {
    defaultTheme,
    themes: {
      light: { colors: { primary: '#0f766e', secondary: '#14b8a6', surface: '#ffffff' } },
      dark: { colors: { primary: '#2dd4bf', secondary: '#14b8a6', surface: '#1e293b', background: '#0f172a', 'on-background': '#e2e8f0' } },
    },
  },
});

createApp(App).use(vuetify).mount('#app');
