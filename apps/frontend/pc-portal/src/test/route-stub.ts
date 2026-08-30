import { defineComponent, h } from "vue";

/**
 * 测试路由表里的占位组件：跳转目标本身不是被测对象，渲染一个空 div 即可。
 *
 * 必须是有状态组件（defineComponent）而不是函数式组件：
 * vue-router 卸载路由视图时会读组件实例，函数式组件没有实例，
 * 卸载阶段会抛 "Cannot read properties of null (reading 'isUnmounted')"。
 */
export const RouteStub = defineComponent({
  name: "RouteStub",
  render: () => h("div", { class: "route-stub" }),
});
