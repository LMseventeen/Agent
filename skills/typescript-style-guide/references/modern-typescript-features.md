# 现代 TypeScript 特性参考

本文档补充主规范中未涵盖的现代 TypeScript（4.9+）特性。

## 1. satisfies 操作符（TypeScript 4.9+）

`satisfies` 允许验证表达式是否匹配某个类型，同时保留最具体的推断类型。

```typescript
// 传统写法：失去字面量类型
const colors1: Record<string, string> = {
  red: "#ff0000",
  green: "#00ff00",
};
// colors1.red 的类型是 string

// satisfies 写法：保留字面量类型
const colors2 = {
  red: "#ff0000",
  green: "#00ff00",
} satisfies Record<string, string>;
// colors2.red 的类型是 "#ff0000"

// 同时获得类型检查和最佳推断
colors2.red.toUpperCase(); // ✅ 类型安全
// colors2.blue; // ❌ 编译错误：不存在 blue 属性
```

### 最佳实践场景

```typescript
// 配置对象
const config = {
  apiUrl: "https://api.example.com",
  timeout: 5000,
  retries: 3,
} satisfies {
  apiUrl: string;
  timeout: number;
  retries: number;
};

// 路由表
const routes = {
  home: "/",
  about: "/about",
  user: "/user/:id",
} satisfies Record<string, string>;

// routes.home 的类型是 "/" 而不是 string
```

## 2. as const 断言

将对象/数组转换为只读的字面量类型。

```typescript
// 不使用 as const
const STATUS = {
  PENDING: "pending",
  ACTIVE: "active",
};
// 类型: { PENDING: string; ACTIVE: string }

// 使用 as const
const STATUS_CONST = {
  PENDING: "pending",
  ACTIVE: "active",
} as const;
// 类型: { readonly PENDING: "pending"; readonly ACTIVE: "active" }

// 提取值的联合类型
type StatusValue = (typeof STATUS_CONST)[keyof typeof STATUS_CONST];
// 类型: "pending" | "active"
```

### 替代枚举的推荐模式

```typescript
// ❌ 传统枚举（有运行时开销，tree-shaking 不友好）
enum HttpMethod {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
}

// ✅ const 对象（更好的类型推断，零运行时开销）
const HttpMethod = {
  GET: "GET",
  POST: "POST",
  PUT: "PUT",
} as const;

type HttpMethod = (typeof HttpMethod)[keyof typeof HttpMethod];
// 类型: "GET" | "POST" | "PUT"
```

## 3. 模板字面量类型

用于创建强类型的字符串模式。

```typescript
// 基础用法
type EventName = `on${Capitalize<string>}`;
// 匹配: "onClick", "onSubmit", "onLoad" 等

// 组合类型
type Color = "red" | "blue" | "green";
type Size = "sm" | "md" | "lg";
type ButtonClass = `btn-${Color}-${Size}`;
// 类型: "btn-red-sm" | "btn-red-md" | ... 共 9 种组合

// CSS 单位
type CSSValue = `${number}${"px" | "rem" | "em" | "%"}`;
const width: CSSValue = "100px"; // ✅
const height: CSSValue = "2rem"; // ✅
// const bad: CSSValue = "100"; // ❌ 编译错误

// 路由参数
type Route = `/users/${string}` | `/posts/${string}/comments/${string}`;
```

## 4. 条件类型与 infer

用于复杂类型转换。

```typescript
// 基础条件类型
type IsString<T> = T extends string ? true : false;

// 使用 infer 提取类型
type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;

type A = UnwrapPromise<Promise<string>>; // string
type B = UnwrapPromise<number>; // number

// 提取函数返回类型
type ReturnType<T> = T extends (...args: any[]) => infer R ? R : never;

// 提取数组元素类型
type ArrayElement<T> = T extends (infer E)[] ? E : never;

type Elements = ArrayElement<string[]>; // string
```

### 实用类型示例

```typescript
// 将对象所有属性变为可选（深层）
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// 提取对象中值为特定类型的键
type KeysOfType<T, V> = {
  [K in keyof T]: T[K] extends V ? K : never;
}[keyof T];

interface User {
  id: number;
  name: string;
  email: string;
  age: number;
}

type StringKeys = KeysOfType<User, string>; // "name" | "email"
type NumberKeys = KeysOfType<User, number>; // "id" | "age"
```

## 5. 类型谓词（Type Predicates）

自定义类型守卫。

```typescript
interface Cat {
  meow(): void;
}

interface Dog {
  bark(): void;
}

type Animal = Cat | Dog;

// 类型谓词
function isCat(animal: Animal): animal is Cat {
  return "meow" in animal;
}

function handleAnimal(animal: Animal) {
  if (isCat(animal)) {
    animal.meow(); // ✅ TypeScript 知道这是 Cat
  } else {
    animal.bark(); // ✅ TypeScript 知道这是 Dog
  }
}

// 数组过滤中的类型谓词
const animals: Animal[] = [
  /* ... */
];
const cats = animals.filter(isCat); // 类型: Cat[]
```

## 6. const 类型参数（TypeScript 5.0+）

```typescript
// 不使用 const：推断为宽类型
function getValues<T>(arr: T[]) {
  return arr;
}
const values1 = getValues(["a", "b", "c"]);
// 类型: string[]

// 使用 const：保留字面量类型
function getValuesConst<const T>(arr: T[]) {
  return arr;
}
const values2 = getValuesConst(["a", "b", "c"]);
// 类型: ("a" | "b" | "c")[]
```

## 7. 索引访问类型

```typescript
interface ApiResponse {
  data: {
    users: Array<{
      id: string;
      name: string;
      profile: {
        avatar: string;
        bio: string;
      };
    }>;
  };
  meta: {
    total: number;
    page: number;
  };
}

// 提取嵌套类型
type User = ApiResponse["data"]["users"][number];
type Profile = User["profile"];
type MetaInfo = ApiResponse["meta"];
```

## 8. 映射类型修饰符

```typescript
interface Config {
  readonly apiUrl: string;
  timeout?: number;
}

// 移除 readonly
type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

// 移除可选
type Required<T> = {
  [P in keyof T]-?: T[P];
};

// 添加 readonly
type Immutable<T> = {
  +readonly [P in keyof T]: T[P];
};

type MutableConfig = Mutable<Config>;
// { apiUrl: string; timeout?: number }

type RequiredConfig = Required<Config>;
// { readonly apiUrl: string; timeout: number }
```

## 总结：何时使用哪个特性

| 特性 | 使用场景 |
|------|----------|
| `satisfies` | 需要类型检查但保留推断类型 |
| `as const` | 创建只读字面量对象/数组 |
| 模板字面量类型 | 强类型字符串模式 |
| 条件类型 + `infer` | 复杂类型转换和提取 |
| 类型谓词 | 自定义类型守卫 |
| `const` 类型参数 | 泛型函数保留字面量类型 |

