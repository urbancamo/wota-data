import { createApp } from 'vue'
import { Locale } from 'vant'
import enUS from 'vant/es/locale/lang/en-US'
import 'vant/lib/index.css'
import './style.css'
import App from './App.vue'

// Set Vant to English
Locale.use('en-US', enUS)

createApp(App).mount('#app')
