/* eslint-disable */
import { createApp } from 'vue'
import App from './App.vue'
import vuetify from './plugins/vuetify'
import './assets/global.css' // Import global CSS
import './assets/responsive.css' // Import responsive CSS
import './styles/full-width-overrides.css' // Import full width overrides

const app = createApp(App)
app.use(vuetify)
app.mount('#app')
