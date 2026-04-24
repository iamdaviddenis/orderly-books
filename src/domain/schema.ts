import { z } from 'zod'

export const tierSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
])
export type Tier = z.infer<typeof tierSchema>

export const isoDateSchema = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid ISO date')
export type IsoDate = z.infer<typeof isoDateSchema>

export const recurrenceSchema = z.union([
  z.literal('one_time'),
  z.literal('weekly'),
  z.literal('monthly'),
  z.literal('every_6_months'),
  z.literal('yearly'),
])
export type Recurrence = z.infer<typeof recurrenceSchema>

export const moneyTzsSchema = z.number().int().nonnegative()
export type MoneyTzs = z.infer<typeof moneyTzsSchema>

export const obligationSchema = z.object({
  id: z.string().min(1),
  tier: z.literal(1),
  name: z.string().min(1),
  amountTzs: moneyTzsSchema,
  dueDate: isoDateSchema,
  recurrence: recurrenceSchema,
  paidAt: isoDateSchema.optional(),
  lastClearedAt: isoDateSchema.optional(),
  lastClearedPaymentId: z.string().min(1).optional(),
  notes: z.string().optional(),
})
export type Obligation = z.infer<typeof obligationSchema>

export const plannedTransferSchema = z.object({
  id: z.string().min(1),
  tier: z.literal(2),
  name: z.string().min(1),
  amountTzs: moneyTzsSchema,
  targetTzs: moneyTzsSchema.optional(),
  targetNote: z.string().optional(),
  dueDate: isoDateSchema,
  recurrence: recurrenceSchema,
  paidAt: isoDateSchema.optional(),
  notes: z.string().optional(),
  skipLog: z
    .array(
      z.object({
        at: isoDateSchema,
        reason: z.string().min(2),
      }),
    )
    .default([]),
})
export type PlannedTransfer = z.infer<typeof plannedTransferSchema>

export const currencyCodeSchema = z.union([z.literal('TZS'), z.literal('USD')])
export type CurrencyCode = z.infer<typeof currencyCodeSchema>

export const worthItemKindSchema = z.union([z.literal('asset'), z.literal('liability')])
export type WorthItemKind = z.infer<typeof worthItemKindSchema>

export const worthItemSchema = z.object({
  id: z.string().min(1),
  kind: worthItemKindSchema,
  name: z.string().min(1),
  type: z.string().min(1),
  tags: z.array(z.string().min(1)).default([]),
  currency: currencyCodeSchema.default('TZS'),
})
export type WorthItem = z.infer<typeof worthItemSchema>

export const worthSnapshotSchema = z.object({
  id: z.string().min(1),
  itemId: z.string().min(1),
  date: isoDateSchema,
  value: z.number().nonnegative(),
})
export type WorthSnapshot = z.infer<typeof worthSnapshotSchema>

export const goalStatusSchema = z.union([z.literal('active'), z.literal('completed'), z.literal('cancelled')])
export type GoalStatus = z.infer<typeof goalStatusSchema>

export const goalSchema = z.object({
  id: z.string().min(1),
  tier: tierSchema,
  name: z.string().min(1),
  targetTzs: moneyTzsSchema,
  dueDate: isoDateSchema,
  status: goalStatusSchema.default('active'),
  createdAt: isoDateSchema,
  notes: z.string().optional(),
})
export type Goal = z.infer<typeof goalSchema>

export const transactionKindSchema = z.union([
  z.literal('expense'),
  z.literal('income'),
])
export type TransactionKind = z.infer<typeof transactionKindSchema>

export const transactionSchema = z.object({
  id: z.string().min(1),
  date: isoDateSchema,
  kind: transactionKindSchema,
  tier: tierSchema,
  amountTzs: moneyTzsSchema,
  payee: z.string().min(1),
  categoryId: z.string().min(1),
  notes: z.string().optional(),
  goalId: z.string().min(1).optional(),
  linked: z
    .object({
      type: z.union([z.literal('obligation'), z.literal('transfer')]),
      id: z.string().min(1),
    })
    .optional(),
})
export type Transaction = z.infer<typeof transactionSchema>

export const categorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  tierHint: tierSchema.optional(),
})
export type Category = z.infer<typeof categorySchema>

export const categorizationRuleSchema = z.object({
  id: z.string().min(1),
  pattern: z.string().min(1), // case-insensitive substring (MVP)
  categoryId: z.string().min(1),
  tier: tierSchema.optional(),
  updatedAt: isoDateSchema,
})
export type CategorizationRule = z.infer<typeof categorizationRuleSchema>

export const weekBudgetSchema = z.object({
  weekStart: isoDateSchema,
  limitTzs: moneyTzsSchema,
})
export type WeekBudget = z.infer<typeof weekBudgetSchema>

export const shoppingItemSchema = z.object({
  id: z.string().min(1),
  group: z.string().min(1), // proteins, staples, etc.
  name: z.string().min(1),
  qty: z.number().nonnegative().optional(),
  unit: z.string().optional(),
  estimatedTzs: moneyTzsSchema,
  actualTzs: moneyTzsSchema.optional(),
  purchased: z.boolean().default(false),
  notes: z.string().optional(),
})
export type ShoppingItem = z.infer<typeof shoppingItemSchema>

export const shoppingTemplateItemSchema = z.object({
  id: z.string().min(1),
  group: z.string().min(1),
  name: z.string().min(1),
  qty: z.number().nonnegative().optional(),
  unit: z.string().optional(),
  estimatedTzs: moneyTzsSchema.default(0),
  notes: z.string().optional(),
})
export type ShoppingTemplateItem = z.infer<typeof shoppingTemplateItemSchema>

export const shoppingWeekSchema = z.object({
  weekStart: isoDateSchema,
  items: z.array(shoppingItemSchema).default([]),
})
export type ShoppingWeek = z.infer<typeof shoppingWeekSchema>

export const auditLogEntrySchema = z.object({
  id: z.string().min(1),
  at: isoDateSchema,
  type: z.union([
    z.literal('skip_transfer'),
    z.literal('override_category'),
    z.literal('edit_budget'),
    z.literal('reflection'),
  ]),
  message: z.string().min(1),
})
export type AuditLogEntry = z.infer<typeof auditLogEntrySchema>

export const reflectionSchema = z.object({
  id: z.string().min(1),
  at: isoDateSchema,
  cadence: z.union([z.literal('weekly'), z.literal('monthly')]),
  text: z.string().min(1),
})
export type Reflection = z.infer<typeof reflectionSchema>

export const allocationSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/), // YYYY-MM
  incomeTzs: moneyTzsSchema,
  tier1Tzs: moneyTzsSchema,
  tier2Tzs: moneyTzsSchema,
  tier3Tzs: moneyTzsSchema,
  tier4Tzs: moneyTzsSchema,
})
export type Allocation = z.infer<typeof allocationSchema>

export const netWorthSchema = z.object({
  cashTzs: moneyTzsSchema.default(0),
  savingsTzs: moneyTzsSchema.default(0),
  investmentsTzs: moneyTzsSchema.default(0),
  debtsTzs: moneyTzsSchema.default(0),
})
export type NetWorth = z.infer<typeof netWorthSchema>

export const settingsSchema = z.object({
  currency: z.literal('TZS').default('TZS'),
  weekStartsOn: z.union([z.literal(1), z.literal(0)]).default(1), // 1=Mon, 0=Sun
  strictTier1Gate: z.boolean().default(true),
  timezone: z.string().default(Intl.DateTimeFormat().resolvedOptions().timeZone),
  readOnlyMode: z.boolean().default(false),
})
export type Settings = z.infer<typeof settingsSchema>

export const commentSchema = z.object({
  id: z.string().min(1),
  at: isoDateSchema,
  author: z.string().min(1),
  message: z.string().min(1),
  relatedTo: z
    .object({
      type: z.union([z.literal('obligation'), z.literal('transfer'), z.literal('transaction')]),
      id: z.string().min(1),
    })
    .optional(),
})
export type Comment = z.infer<typeof commentSchema>

export const appStateSchemaV1 = z.object({
  schemaVersion: z.literal(1),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,

  settings: settingsSchema,

  startingCashTzs: z.number().int().default(0),

  categories: z.array(categorySchema),
  categorizationRules: z.array(categorizationRuleSchema).default([]),

  obligations: z.array(obligationSchema).default([]),
  plannedTransfers: z.array(plannedTransferSchema).default([]),

  weekBudgets: z.array(weekBudgetSchema).default([]),
  shoppingTemplate: z.array(shoppingTemplateItemSchema).default([]),
  shoppingWeeks: z.array(shoppingWeekSchema).default([]),

  transactions: z.array(transactionSchema).default([]),
  netWorth: netWorthSchema.default(() => ({
    cashTzs: 0,
    savingsTzs: 0,
    investmentsTzs: 0,
    debtsTzs: 0,
  })),
  worthItems: z.array(worthItemSchema).default([]),
  worthSnapshots: z.array(worthSnapshotSchema).default([]),
  goals: z.array(goalSchema).default([]),

  auditLog: z.array(auditLogEntrySchema).default([]),
  reflections: z.array(reflectionSchema).default([]),
  comments: z.array(commentSchema).default([]),
  allocations: z.array(allocationSchema).default([]),
})

export type AppStateV1 = z.infer<typeof appStateSchemaV1>

export const appStateSchema = appStateSchemaV1
export type AppState = AppStateV1
