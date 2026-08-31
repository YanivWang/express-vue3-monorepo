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

// 会话恢复必须排在 app.use(router) 之前，而不只是排在 mount 之前：
// vue-router 在 install 时就同步发起首次导航，守卫随即读 isLoggedIn 决定去留。
// 访问令牌只存内存、刷新页面必然丢失，若此刻还没用 HttpOnly 刷新 Cookie 换回令牌，
// 守卫读到的恒为「未登录」。管理端所有非白名单路由都要求登录，
// 因此这个顺序错位的表现就是「每次刷新都被踢回登录页」——哪怕刷新 Cookie 完全有效。
//
// 这里刻意不写成顶层 await：顶层 await 要求构建 target 抬到 es2022+，
// 等于用一个构建报错替我们决定了放弃 Safari 14 / Chrome 87。
// main.ts 是入口、无人 import，本就不需要模块级 await 语义。
void (async () => {
  await useAuthStore().bootstrapSession();
  app.use(router);
  app.use(ElementPlus, { locale: zhCn });
  app.mount("#app");
})();
