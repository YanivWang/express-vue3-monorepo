import Antd from "ant-design-vue";
import "ant-design-vue/dist/reset.css";
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import zhCn from "element-plus/es/locale/lang/zh-cn";
import { createPinia } from "pinia";
import { createApp, type Component } from "vue";

import App from "./App.vue";
import router from "./router";

const app = createApp(App as Component);
app.use(createPinia());
app.use(router);
app.use(Antd);
app.use(ElementPlus, { locale: zhCn });
app.mount("#app");
