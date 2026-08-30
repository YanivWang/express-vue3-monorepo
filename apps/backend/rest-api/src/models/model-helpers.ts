/**
 * `sequelize.define<M, TAttributes>` 要求属性表覆盖 TAttributes 的**每一个**键。
 * 而 id 与 createdAt / updatedAt 由 Sequelize 自动管理、不在属性表里显式书写，
 * 因此把它们从「需要在属性表中声明的列」里排除。
 *
 * 注意：外键列不在排除之列——它们是真实存在的列，应当在各模型的属性表里显式声明。
 * 早期版本让 belongsTo 隐式创建外键列，结果是模型定义并不能完整描述表结构，
 * 且隐式列默认可空，直接造成了库层允许孤儿行（已由 migrations/0003 收紧）。
 */
export type DefinedColumns<A> = Omit<A, "id" | "createdAt" | "updatedAt">;
