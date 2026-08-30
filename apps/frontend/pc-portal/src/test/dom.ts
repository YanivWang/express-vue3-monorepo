import type { DOMWrapper, VueWrapper } from "@vue/test-utils";

/**
 * 按可见文案定位元素的小工具。
 *
 * 用例一律按「用户看到什么、点了什么」来定位，不按组件层级定位——
 * 组件拆分会重排层级，但按钮上的字不会变，这样基线才能拆分前后一字不改地复用。
 */

type AnyWrapper = VueWrapper | DOMWrapper<Element>;

export function findByText(
  wrapper: AnyWrapper,
  selector: string,
  text: string,
): DOMWrapper<Element> | undefined {
  return wrapper.findAll(selector).find((el) => el.text().trim() === text);
}

export function findContainingText(
  wrapper: AnyWrapper,
  selector: string,
  text: string,
): DOMWrapper<Element> | undefined {
  return wrapper.findAll(selector).find((el) => el.text().includes(text));
}

/** 定位按钮并断言其存在；找不到时直接抛错，避免用例里到处写可选链 */
export function button(wrapper: AnyWrapper, text: string): DOMWrapper<Element> {
  const found = findByText(wrapper, "button", text);
  if (!found) {
    const available = wrapper
      .findAll("button")
      .map((b) => JSON.stringify(b.text().trim()))
      .join(", ");
    throw new Error(`找不到文案为「${text}」的按钮；当前可见按钮：[${available}]`);
  }
  return found;
}

export function hasButton(wrapper: AnyWrapper, text: string): boolean {
  return findByText(wrapper, "button", text) !== undefined;
}
