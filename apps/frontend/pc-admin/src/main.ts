import ElementPlus from "element-plus";
import zhCn from "element-plus/es/locale/lang/zh-cn";
import { createApp } from "vue";

import "element-plus/dist/index.css";

import "@/styles/admin.scss";

import App from "./App.vue";
import router from "./router";
import { useAuthStore } from "./stores/auth";
import pinia from "./stores/pinia";

const app = createApp(App);

app.use(pinia);
app.use(router);
await useAuthStore().bootstrapSession();
app.use(ElementPlus, { locale: zhCn });
app.mount("#app");
