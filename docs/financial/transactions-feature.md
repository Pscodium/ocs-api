# Feature: Financial Transactions (Backend — ocs-api)

Este documento lista o que precisa ser implementado no repo `ocs-api` para suportar a feature `financial_transactions`, cujo frontend está documentado em `docs/financial-transactions-frontend.md` (repo `ocs-financial`).

## Contexto

"Transaction" = gasto pontual/avulso registrado num dia específico do mês, distinto de "Bill" (conta mensal planejada/recorrente). Serve para separar gasto programado de gasto de oportunidade, e entra como métrica própria no saldo do mês — não deve ser somada junto com `bills` nos totais existentes.

## Feature flag

- Nome: `financial_transactions` — já criada, e `GET /financial/identity` já trata e retorna essa flag no feature map normalmente (confirmado). Nenhuma mudança necessária aqui.
- Essa flag **não é uma flag de rota/aba** (diferente de `financial_budgets`, `financial_investments` etc., que controlam abas inteiras). É consumida como flag de seção dentro da Dashboard. Não deve ser adicionada a nenhum agrupamento de "tab access" existente na API — só precisa continuar aparecendo normalmente na lista de flags do usuário.

## Novo recurso: Transaction

Seguir exatamente o mesmo padrão já usado para `budgets`, `investments`, `goals`, `subscriptions` (recursos aninhados em `Month`).

### Endpoints necessários

```
GET    /months/{monthKey}/transactions
POST   /months/{monthKey}/transactions
PUT    /months/{monthKey}/transactions/:id
DELETE /months/{monthKey}/transactions/:id
```

Autenticação/autorização: mesmo padrão dos outros recursos de month (Bearer token, escopo do usuário dono do month).

### Modelo de dados sugerido

```
Transaction {
  id: string (uuid)
  monthKey: string        // FK lógica pro Month
  description: string
  amount: number          // valor em centavos ou decimal, seguir padrão já usado em Bill.amount
  date: string (ISO date) // data específica do gasto, deve estar dentro do range do monthKey
  tag?: string            // texto livre, sem enum — front sugere tags já usadas pelo usuário
  userId: string          // dono do registro
  createdAt: timestamp
  updatedAt: timestamp
}
```

Validações:
- `date` deve pertencer ao `monthKey` informado na rota (rejeitar se fora do mês).
- `amount` > 0.
- `description` obrigatória, tamanho mínimo (evitar registro vazio, já que o front quer isso "rápido" — mas rápido não é sinônimo de sem validação).

### Retorno do GET /months/{monthKey}

Se hoje o endpoint `GET /months/{monthKey}` (consumido por `getMonthByKey` no front) já retorna `budgets`, `investments`, `goals`, `subscriptions` embutidos no payload do Month, adicionar `transactions: Transaction[]` na mesma resposta, para o front não precisar de uma segunda chamada para saber se "já existem transações no mês" (isso decide se mostra a seção cheia ou o botão discreto).

## Impacto em cálculos que hoje ficam só no client

Hoje `getGrandTotal`, `getGrandPaid`, `getSobra` etc. são calculados no frontend (`hooks/use-finance.ts`), a partir do payload cru de `bills`/`income`. Se a API já expõe algum agregado pré-calculado (resumo mensal, relatórios, analytics), então:

- Qualquer endpoint de resumo/analytics que hoje agregue `bills` + `income` do mês precisa decidir explicitamente se soma `transactions` ou não. Recomendação (alinhada ao front): **transactions não entram no total de "contas" (`getGrandTotal`/`getGrandPaid`)**, mas entram no cálculo de "sobra"/saldo disponível real do mês.
- Se existir endpoint tipo `/months/{monthKey}/summary` ou similar usado por analytics/gráficos, verificar se precisa de um campo novo `transactionsTotal` para não obrigar o front a buscar `transactions` separadamente só para exibir o número agregado.

## Escopo do que muda no backend (resumo)

1. Confirmar flag `financial_transactions` retornada corretamente por `/identity`.
2. Nova entidade `Transaction` (migration/schema).
3. CRUD completo: `GET/POST/PUT/DELETE /months/{monthKey}/transactions[/:id]`.
4. Validação de `date` dentro do `monthKey`, `amount > 0`, `description` obrigatória.
5. Incluir `transactions` no payload de `GET /months/{monthKey}` (e `GET /months` se este endpoint também embute recursos do mês).
6. Se houver endpoint de summary/analytics agregando totais do mês, avaliar exposição de `transactionsTotal` separado dos totais de `bills`.

## Decisões confirmadas

- Transaction é sempre paga no registro — sem estado pending, sem endpoint de "marcar como pago".
- `tag` é string livre (sem enum), validada só por tamanho. Sugestão de tags já usadas é responsabilidade do front, derivada da própria listagem (`GET /months/{monthKey}/transactions`) ou de um histórico maior — se o time achar pesado o front varrer todos os meses, considerar endpoint auxiliar tipo `GET /transactions/tags` (distinct de tags do usuário) como otimização futura; não é bloqueante para o MVP.

## Pendências / perguntas para o time de backend

- `amount` é armazenado como decimal ou inteiro (centavos)? Seguir o padrão já usado em `Bill`/`Budget` para consistência.
- Existe algum limite de transações por mês/rate limit a considerar, dado que o objetivo é registro "rápido e frequente"?
