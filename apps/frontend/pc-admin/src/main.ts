import ElementPlus from "element-plus";
import zhCn from "element-plus/es/locale/lang/zh-cn";
import { createApp, type Component } from "vue";

import "element-plus/dist/index.css";

import "@/styles/admin.scss";

import App from "./App.vue";
import router from "./router";
import { useAuthStore } from "./stores/auth";
import pinia from "./stores/pinia";

// ESLint 的类型程序无法解析 .vue SFC 的具体类型（只有 vue-tsc 能），显式标注根组件类型（与 pc-portal 一致）
const app = createApp(App as Component);

app.use(pinia);
app.use(router);
await useAuthStore().bootstrapSession();
app.use(ElementPlus, { locale: zhCn });
app.mount("#app");
