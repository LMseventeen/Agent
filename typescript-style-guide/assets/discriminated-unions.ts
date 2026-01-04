/**
 * 判别联合类型（Discriminated Unions）示例
 * 用于确保非法状态在类型层面不可表示
 */

// ============================================
// 1. 基础示例：请求状态
// ============================================

// ❌ 不好的设计：可能产生非法状态
interface BadRequestState {
  loading: boolean;
  data?: unknown;
  error?: string;
}
// 问题：loading: true 时同时有 data 和 error 是什么意思？

// ✅ 好的设计：非法状态不可表示
type RequestState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: Error };

// 使用示例
function renderRequest<T>(
  state: RequestState<T>,
  renderData: (data: T) => string
): string {
  switch (state.status) {
    case "idle":
      return "Ready to fetch";
    case "loading":
      return "Loading...";
    case "success":
      return renderData(state.data); // state.data 类型安全
    case "error":
      return `Error: ${state.error.message}`; // state.error 类型安全
    default:
      const _exhaustive: never = state;
      return _exhaustive;
  }
}

// ============================================
// 2. 进阶示例：表单字段验证
// ============================================

type ValidationResult =
  | { valid: true; value: string }
  | { valid: false; errors: string[] };

function validateEmail(input: string): ValidationResult {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!input) {
    return { valid: false, errors: ["Email is required"] };
  }

  if (!emailRegex.test(input)) {
    return { valid: false, errors: ["Invalid email format"] };
  }

  return { valid: true, value: input.toLowerCase() };
}

// ============================================
// 3. 复杂示例：支付状态机
// ============================================

interface PaymentPending {
  status: "pending";
  orderId: string;
  amount: number;
}

interface PaymentProcessing {
  status: "processing";
  orderId: string;
  amount: number;
  transactionId: string;
}

interface PaymentCompleted {
  status: "completed";
  orderId: string;
  amount: number;
  transactionId: string;
  completedAt: Date;
  receiptUrl: string;
}

interface PaymentFailed {
  status: "failed";
  orderId: string;
  amount: number;
  transactionId?: string;
  failureReason: string;
  retryable: boolean;
}

interface PaymentRefunded {
  status: "refunded";
  orderId: string;
  amount: number;
  originalTransactionId: string;
  refundTransactionId: string;
  refundedAt: Date;
}

type PaymentState =
  | PaymentPending
  | PaymentProcessing
  | PaymentCompleted
  | PaymentFailed
  | PaymentRefunded;

// 类型安全的状态转换
function processPayment(
  state: PaymentPending,
  transactionId: string
): PaymentProcessing {
  return {
    status: "processing",
    orderId: state.orderId,
    amount: state.amount,
    transactionId,
  };
}

function completePayment(
  state: PaymentProcessing,
  receiptUrl: string
): PaymentCompleted {
  return {
    status: "completed",
    orderId: state.orderId,
    amount: state.amount,
    transactionId: state.transactionId,
    completedAt: new Date(),
    receiptUrl,
  };
}

// 处理任意支付状态
function getPaymentSummary(state: PaymentState): string {
  switch (state.status) {
    case "pending":
      return `Order ${state.orderId}: Waiting for payment of $${state.amount}`;
    case "processing":
      return `Order ${state.orderId}: Processing transaction ${state.transactionId}`;
    case "completed":
      return `Order ${state.orderId}: Paid $${state.amount}. Receipt: ${state.receiptUrl}`;
    case "failed":
      return `Order ${state.orderId}: Failed - ${state.failureReason}${state.retryable ? " (retryable)" : ""}`;
    case "refunded":
      return `Order ${state.orderId}: Refunded $${state.amount} on ${state.refundedAt.toISOString()}`;
    default:
      const _exhaustive: never = state;
      return _exhaustive;
  }
}

// ============================================
// 4. 实用技巧：提取判别字段类型
// ============================================

// 从联合类型提取所有状态值
type PaymentStatus = PaymentState["status"];
// 结果: "pending" | "processing" | "completed" | "failed" | "refunded"

// 根据状态值提取对应类型
type ExtractByStatus<T, S> = T extends { status: S } ? T : never;

type CompletedPayment = ExtractByStatus<PaymentState, "completed">;
// 结果: PaymentCompleted

// ============================================
// 5. 与映射表结合使用
// ============================================

type StatusHandler<T extends PaymentState> = (state: T) => void;

const statusHandlers: {
  [K in PaymentStatus]: StatusHandler<Extract<PaymentState, { status: K }>>;
} = {
  pending: (state) => console.log(`Pending: ${state.orderId}`),
  processing: (state) => console.log(`Processing: ${state.transactionId}`),
  completed: (state) => console.log(`Completed: ${state.receiptUrl}`),
  failed: (state) => console.log(`Failed: ${state.failureReason}`),
  refunded: (state) => console.log(`Refunded: ${state.refundTransactionId}`),
};

function handlePaymentState(state: PaymentState): void {
  const handler = statusHandlers[state.status] as StatusHandler<typeof state>;
  handler(state);
}

export {
  RequestState,
  ValidationResult,
  PaymentState,
  PaymentStatus,
  processPayment,
  completePayment,
  getPaymentSummary,
  handlePaymentState,
  validateEmail,
  renderRequest,
};

