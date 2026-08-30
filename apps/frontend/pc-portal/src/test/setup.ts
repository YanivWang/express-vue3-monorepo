import { config, enableAutoUnmount } from "@vue/test-utils";
import ElementPlus from "element-plus";
import zhCn from "element-plus/es/locale/lang/zh-cn";
import { afterEach } from "vitest";

import "./element-plus-services";

/**
 * 全局测试环境。
 *
 * Element Plus 真实注册：组件与 v-loading 指令都要真身，
 * 否则模板层的属性/插槽错误会被 stub 吃掉，测了等于没测。
 *
 * 无需补 ResizeObserver / IntersectionObserver / matchMedia——
 * happy-dom 20 已自带这三个，Element Plus 的滚动条与浮层定位可直接工作。
 */
config.global.plugins = [[ElementPlus, { locale: zhCn }]];

/**
 * 每个用例结束后自动卸载 wrapper。
 * 必须有：el-select / el-dialog 这类组件把浮层 teleport 到 document.body，
 * 不卸载就会在同一个文件的后续用例里越积越多，document 级查询会命中上一个用例的残留。
 */
enableAutoUnmount(afterEach);
