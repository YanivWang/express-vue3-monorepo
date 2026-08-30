import { defineComponent, h, ref, watch } from "vue";

/**
 * `@yanivjs/yaniv-editor` 的测试挡板（仅在 vitest 中经 resolve.alias 生效，见 vitest.config.ts）。
 *
 * 为什么挡：它是基于 ProseMirror 的第三方富文本编辑器，不是本次重构的对象。
 * 真身在 happy-dom 下依赖大量排版/选区 API，既跑不稳也拖慢用例，
 * 而我们真正要守住的是「宿主组件怎么用它」——传什么内容进去、拿什么内容出来。
 *
 * 因此挡板保留三件事：
 * 1. 把 initial-content 原样渲染出来，正文清洗结果可断言；
 * 2. 暴露 getHTML / getText，宿主的 editorRef 调用链保持可用；
 * 3. 编辑态给一个真实输入框，用例能像用户一样敲字并触发 update 事件。
 */
export const YanivEditor = defineComponent({
  name: "YanivEditorStub",
  props: {
    mode: { type: String, default: "" },
    preset: { type: String, default: "" },
    appearance: { type: String, default: "" },
    colorMode: { type: String, default: "" },
    features: { type: Object, default: () => ({}) },
    locale: { type: String, default: "" },
    initialContent: { type: String, default: "" },
    uploadImage: { type: Function, default: undefined },
    uploadVideo: { type: Function, default: undefined },
  },
  emits: ["update"],
  setup(props, { emit, expose }) {
    const html = ref(props.initialContent);

    // 宿主可能在加载完成后才灌入正文，挡板要跟着更新，否则断言到的是空串
    watch(
      () => props.initialContent,
      (next) => {
        html.value = next;
      },
    );

    function getHTML(): string {
      return html.value;
    }

    function getText(): string {
      return html.value.replace(/<[^>]+>/g, "");
    }

    expose({ getHTML, getText });

    return () =>
      h("div", { class: "yaniv-editor-stub", "data-mode": props.mode }, [
        h("div", { class: "yaniv-editor-stub__content", innerHTML: html.value }),
        props.mode === "edit"
          ? h("textarea", {
              class: "yaniv-editor-stub__input",
              value: html.value,
              onInput: (event: Event) => {
                html.value = (event.target as HTMLTextAreaElement).value;
                emit("update");
              },
            })
          : null,
      ]);
  },
});
