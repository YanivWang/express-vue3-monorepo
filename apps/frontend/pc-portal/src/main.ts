import ElementPlus from "element-plus";
import zhCn from "element-plus/es/locale/lang/zh-cn";
import { createPinia } from "pinia";
import { createApp, type Component } from "vue";

import "element-plus/dist/index.css";

import App from "./App.vue";
import router from "./router";
import { useAuthStore } from "./stores/auth";

const app = createApp(App as Component);
app.use(createPinia());
app.use(router);
await useAuthStore().bootstrapSession();
app.use(ElementPlus, { locale: zhCn });
app.mount("#app");
